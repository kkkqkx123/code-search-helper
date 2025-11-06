import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Python创建关系提取器
 * 处理对象实例化、类实例化、函数对象创建等
 */
export class CreationRelationshipExtractor {
  /**
   * 提取创建关系元数据
   */
  extractCreationMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const creationType = this.determineCreationType(astNode);

    if (!creationType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractCreationNodes(astNode, creationType);
    const targetName = this.extractTargetName(astNode);
    const constructorInfo = this.extractConstructorInfo(astNode);

    return {
      type: 'creation',
      fromNodeId,
      toNodeId,
      creationType,
      targetName,
      constructorInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取创建关系数组
   */
  extractCreationRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为创建相关的节点类型
    if (!this.isCreationNode(astNode)) {
      return relationships;
    }

    const creationMetadata = this.extractCreationMetadata(result, astNode, null);
    if (creationMetadata) {
      relationships.push(creationMetadata);
    }

    return relationships;
  }

  /**
   * 确定创建类型
   */
  private determineCreationType(astNode: Parser.SyntaxNode): 'instantiation' | 'function_object' | 'comprehension' | 'generator' | 'closure' | null {
    const nodeType = astNode.type;
    const text = astNode.text || '';

    if (nodeType === 'call') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.type === 'identifier') {
        // 检查是否是类实例化（首字母大写的启发式）
        if (funcNode.text && funcNode.text[0] === funcNode.text[0].toUpperCase()) {
          return 'instantiation';
        }
        return 'function_object';
      }
    } else if (nodeType === 'assignment') {
      const right = astNode.childForFieldName('right');
      if (right?.type === 'call') {
        return 'instantiation';
      } else if (right?.type === 'lambda') {
        return 'closure';
      }
    } else if (nodeType === 'list_comprehension' || nodeType === 'dictionary_comprehension' || 
               nodeType === 'set_comprehension' || nodeType === 'generator_expression') {
      return 'comprehension';
    } else if (nodeType === 'lambda') {
      return 'closure';
    } else if (text.includes('yield') || text.includes('yield from')) {
      return 'generator';
    }

    return null;
  }

  /**
   * 提取创建关系的节点
   */
  private extractCreationNodes(astNode: Parser.SyntaxNode, creationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (creationType === 'instantiation' || creationType === 'function_object') {
      // 对于实例化，提取类型信息
      const typeNode = this.extractTypeNode(astNode);
      if (typeNode) {
        toNodeId = generateDeterministicNodeId(typeNode);
      }
    } else if (creationType === 'comprehension') {
      // 对于推导式，提取推导式类型
      const comprehensionType = this.extractComprehensionType(astNode);
      if (comprehensionType) {
        toNodeId = this.generateNodeId(comprehensionType, 'comprehension', 'current_file.py');
      }
    } else if (creationType === 'closure') {
      // 对于闭包，提取lambda表达式
      toNodeId = this.generateNodeId('lambda', 'closure', 'current_file.py');
    } else if (creationType === 'generator') {
      // 对于生成器，提取生成器类型
      toNodeId = this.generateNodeId('generator', 'generator', 'current_file.py');
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取类型节点
   */
  private extractTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (astNode.type === 'call') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.type === 'identifier') {
        return funcNode;
      }
    } else if (astNode.type === 'assignment') {
      const right = astNode.childForFieldName('right');
      if (right?.type === 'call') {
        const funcNode = right.childForFieldName('function');
        if (funcNode?.type === 'identifier') {
          return funcNode;
        }
      }
    }
    return null;
  }

  /**
   * 提取推导式类型
   */
  private extractComprehensionType(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'list_comprehension') {
      return 'list';
    } else if (astNode.type === 'dictionary_comprehension') {
      return 'dict';
    } else if (astNode.type === 'set_comprehension') {
      return 'set';
    } else if (astNode.type === 'generator_expression') {
      return 'generator';
    }
    return null;
  }

  /**
   * 提取目标名称
   */
  private extractTargetName(astNode: Parser.SyntaxNode): string | null {
    const typeNode = this.extractTypeNode(astNode);
    if (typeNode) {
      return typeNode.text || null;
    }

    const comprehensionType = this.extractComprehensionType(astNode);
    if (comprehensionType) {
      return comprehensionType;
    }

    if (astNode.type === 'lambda') {
      return 'lambda';
    }

    return null;
  }

  /**
   * 提取构造函数信息
   */
  private extractConstructorInfo(astNode: Parser.SyntaxNode): any {
    const constructorInfo: any = {};

    if (astNode.type === 'call') {
      constructorInfo.isConstructorCall = true;
      constructorInfo.arguments = this.extractCallArguments(astNode);
    } else if (astNode.type === 'assignment') {
      const right = astNode.childForFieldName('right');
      if (right?.type === 'call') {
        constructorInfo.isConstructorCall = true;
        constructorInfo.arguments = this.extractCallArguments(right);
      } else if (right?.type === 'lambda') {
        constructorInfo.isLambdaCreation = true;
        constructorInfo.parameters = this.extractLambdaParameters(right);
      }
    } else if (astNode.type === 'lambda') {
      constructorInfo.isLambdaCreation = true;
      constructorInfo.parameters = this.extractLambdaParameters(astNode);
    } else if (astNode.type === 'list_comprehension' || astNode.type === 'dictionary_comprehension' || 
               astNode.type === 'set_comprehension' || astNode.type === 'generator_expression') {
      constructorInfo.isComprehension = true;
      constructorInfo.comprehensionType = this.extractComprehensionType(astNode);
      constructorInfo.iterable = this.extractComprehensionIterable(astNode);
    }

    return constructorInfo;
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(callNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of callNode.children) {
      if (child.type === 'argument_list') {
        for (const arg of child.children) {
          if (arg.type !== 'comment' && arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
            args.push({
              type: arg.type,
              text: arg.text
            });
          }
        }
        break;
      }
    }

    return args;
  }

  /**
   * 提取lambda参数
   */
  private extractLambdaParameters(lambdaNode: Parser.SyntaxNode): string[] {
    const params: string[] = [];
    const parameters = lambdaNode.childForFieldName('parameters');
    
    if (parameters) {
      for (const child of parameters.children) {
        if (child.type === 'identifier') {
          params.push(child.text || '');
        }
      }
    }
    
    return params;
  }

  /**
   * 提取推导式的可迭代对象
   */
  private extractComprehensionIterable(comprehensionNode: Parser.SyntaxNode): string | null {
    for (const child of comprehensionNode.children) {
      if (child.type === 'for_clause') {
        const iterable = child.childForFieldName('iterable');
        if (iterable?.text) {
          return iterable.text;
        }
      }
    }
    return null;
  }

  /**
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'call',
      'assignment',
      'list_comprehension',
      'dictionary_comprehension',
      'set_comprehension',
      'generator_expression',
      'lambda'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 查找类实例
   */
  findClassInstances(ast: Parser.SyntaxNode, filePath: string): Array<{
    className: string;
    classId: string;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const instances: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'call') {
        const funcNode = node.childForFieldName('function');
        if (funcNode?.type === 'identifier' && funcNode.text) {
          // 简单启发式：首字母大写的可能是类
          if (funcNode.text[0] === funcNode.text[0].toUpperCase()) {
            instances.push({
              className: funcNode.text,
              classId: generateDeterministicNodeId(funcNode),
              location: {
                lineNumber: node.startPosition.row + 1,
                columnNumber: node.startPosition.column + 1
              }
            });
          }
        }
      }
    });

    return instances;
  }

  /**
   * 查找函数对象创建
   */
  findFunctionObjects(ast: Parser.SyntaxNode, filePath: string): Array<{
    functionName: string;
    functionId: string;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const functionObjects: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'call') {
        const funcNode = node.childForFieldName('function');
        if (funcNode?.type === 'identifier' && funcNode.text) {
          // 简单启发式：首字母小写的可能是函数
          if (funcNode.text[0] === funcNode.text[0].toLowerCase()) {
            functionObjects.push({
              functionName: funcNode.text,
              functionId: generateDeterministicNodeId(funcNode),
              location: {
                lineNumber: node.startPosition.row + 1,
                columnNumber: node.startPosition.column + 1
              }
            });
          }
        }
      }
    });

    return functionObjects;
  }

  /**
   * 查找推导式
   */
  findComprehensions(ast: Parser.SyntaxNode, filePath: string): Array<{
    comprehensionType: string;
    comprehensionId: string;
    iterable: string | null;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const comprehensions: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'list_comprehension' || node.type === 'dictionary_comprehension' || 
          node.type === 'set_comprehension' || node.type === 'generator_expression') {
        const comprehensionType = this.extractComprehensionType(node);
        const iterable = this.extractComprehensionIterable(node);
        
        if (comprehensionType) {
          comprehensions.push({
            comprehensionType,
            comprehensionId: generateDeterministicNodeId(node),
            iterable,
            location: {
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
      }
    });

    return comprehensions;
  }

  /**
   * 查找闭包
   */
  findClosures(ast: Parser.SyntaxNode, filePath: string): Array<{
    closureId: string;
    parameters: string[];
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const closures: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'lambda') {
        const parameters = this.extractLambdaParameters(node);
        
        closures.push({
          closureId: generateDeterministicNodeId(node),
          parameters,
          location: {
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column + 1
          }
        });
      }
    });

    return closures;
  }

  /**
   * 遍历AST树
   */
  private traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);

    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, callback);
      }
    }
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

  /**
   * 分析创建关系
   */
  analyzeCreations(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    creationType: string;
    targetName: string;
    constructorInfo: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const creations: Array<any> = [];

    // 查找所有类实例
    const classInstances = this.findClassInstances(ast, filePath);
    for (const instance of classInstances) {
      creations.push({
        sourceId: instance.classId,
        targetId: this.generateNodeId(instance.className, 'class', filePath),
        creationType: 'instantiation',
        targetName: instance.className,
        constructorInfo: { isConstructorCall: true },
        location: {
          filePath,
          ...instance.location
        }
      });
    }

    // 查找所有函数对象
    const functionObjects = this.findFunctionObjects(ast, filePath);
    for (const funcObj of functionObjects) {
      creations.push({
        sourceId: funcObj.functionId,
        targetId: this.generateNodeId(funcObj.functionName, 'function', filePath),
        creationType: 'function_object',
        targetName: funcObj.functionName,
        constructorInfo: { isFunctionObject: true },
        location: {
          filePath,
          ...funcObj.location
        }
      });
    }

    // 查找所有推导式
    const comprehensions = this.findComprehensions(ast, filePath);
    for (const comprehension of comprehensions) {
      creations.push({
        sourceId: comprehension.comprehensionId,
        targetId: this.generateNodeId(comprehension.comprehensionType, 'comprehension', filePath),
        creationType: 'comprehension',
        targetName: comprehension.comprehensionType,
        constructorInfo: { 
          isComprehension: true,
          iterable: comprehension.iterable
        },
        location: {
          filePath,
          ...comprehension.location
        }
      });
    }

    // 查找所有闭包
    const closures = this.findClosures(ast, filePath);
    for (const closure of closures) {
      creations.push({
        sourceId: closure.closureId,
        targetId: this.generateNodeId('lambda', 'closure', filePath),
        creationType: 'closure',
        targetName: 'lambda',
        constructorInfo: { 
          isLambdaCreation: true,
          parameters: closure.parameters
        },
        location: {
          filePath,
          ...closure.location
        }
      });
    }

    return creations;
  }
}