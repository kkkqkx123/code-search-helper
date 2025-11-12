import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Java创建关系提取器
 * 处理对象实例化、内存分配、构造函数调用等
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
        filePath: symbolTable?.filePath || 'current_file.java',
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
  private determineCreationType(astNode: Parser.SyntaxNode): 'instantiation' | 'allocation' | 'initialization' | 'construction' | null {
    const nodeType = astNode.type;
    const text = astNode.text || '';

    if (nodeType === 'object_creation_expression') {
      return 'instantiation';
    } else if (nodeType === 'array_creation_expression') {
      return 'allocation';
    } else if (nodeType === 'assignment_expression') {
      return 'initialization';
    } else if (nodeType === 'constructor_declaration') {
      return 'construction';
    }

    return null;
  }

  /**
   * 提取创建关系的节点
   */
  private extractCreationNodes(astNode: Parser.SyntaxNode, creationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    if (creationType === 'instantiation' || creationType === 'initialization' || creationType === 'construction') {
      // 对于实例化，提取类型信息
      const typeNode = this.extractTypeNode(astNode);
      if (typeNode) {
        toNodeId = NodeIdGenerator.forAstNode(typeNode);
      }
    } else if (creationType === 'allocation') {
      // 对于内存分配，提取分配的变量或类型
      const varNode = this.extractVariableNode(astNode);
      const typeNode = this.extractTypeNode(astNode);
      if (typeNode) {
        toNodeId = NodeIdGenerator.forAstNode(typeNode);
      } else if (varNode) {
        toNodeId = NodeIdGenerator.forAstNode(varNode);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取类型节点
   */
  private extractTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找类型标识符
    if (astNode.children) {
      for (const child of astNode.children) {
        if (child.type === 'type_identifier' ||
          child.type === 'class_literal' ||
          child.type === 'array_type') {
          return child;
        }
      }
    }
    return null;
  }

  /**
   * 提取变量节点
   */
  private extractVariableNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 对于赋值表达式，左侧通常是变量
    if (astNode.type === 'assignment_expression') {
      const left = astNode.childForFieldName('left');
      if (left) {
        return left;
      }
    }

    // 对于对象创建表达式，查找类型
    if (astNode.type === 'object_creation_expression') {
      const typeNode = astNode.childForFieldName('type');
      if (typeNode) {
        return typeNode;
      }
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

    const varNode = this.extractVariableNode(astNode);
    if (varNode) {
      return varNode.text || null;
    }

    return null;
  }

  /**
   * 提取构造函数信息
   */
  private extractConstructorInfo(astNode: Parser.SyntaxNode): any {
    const constructorInfo: any = {};

    if (astNode.type === 'object_creation_expression') {
      constructorInfo.isObjectCreation = true;
      constructorInfo.arguments = this.extractConstructorArguments(astNode);
    } else if (astNode.type === 'constructor_declaration') {
      constructorInfo.isConstructorDeclaration = true;
      constructorInfo.parameters = this.extractConstructorParameters(astNode);
    } else if (astNode.type === 'array_creation_expression') {
      constructorInfo.isArrayCreation = true;
      constructorInfo.dimensions = this.extractArrayDimensions(astNode);
    }

    return constructorInfo;
  }

  /**
   * 提取构造函数参数
   */
  private extractConstructorArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of astNode.children) {
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
   * 提取构造函数参数
   */
  private extractConstructorParameters(astNode: Parser.SyntaxNode): any[] {
    const parameters: any[] = [];

    for (const child of astNode.children) {
      if (child.type === 'formal_parameters') {
        for (const param of child.children) {
          if (param.type === 'formal_parameter') {
            parameters.push({
              type: param.type,
              text: param.text
            });
          }
        }
        break;
      }
    }

    return parameters;
  }

  /**
   * 提取数组维度
   */
  private extractArrayDimensions(astNode: Parser.SyntaxNode): any[] {
    const dimensions: any[] = [];

    for (const child of astNode.children) {
      if (child.type === 'dimensions' || child.type === 'array_initializer') {
        dimensions.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return dimensions;
  }

  /**
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'object_creation_expression',
      'array_creation_expression',
      'assignment_expression',
      'constructor_declaration'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 查找类实例
   */
  findClassInstances(varDecl: Parser.SyntaxNode, filePath: string): Array<{
    className: string;
    classId: string;
    isArray: boolean;
  }> {
    const instances: Array<{
      className: string;
      classId: string;
      isArray: boolean;
    }> = [];

    // 检查变量声明中的类型是否是类
    const typeIdentifiers = this.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      instances.push({
        className: typeIdent.text,
        classId: NodeIdGenerator.forAstNode(typeIdent),
        isArray: false
      });
    }

    // 检查数组类型
    const arrayTypes = this.findNodeByType(varDecl, 'array_type');
    for (const arrayType of arrayTypes) {
      instances.push({
        className: arrayType.text,
        classId: NodeIdGenerator.forAstNode(arrayType),
        isArray: true
      });
    }

    return instances;
  }

  /**
   * 查找对象创建表达式
   */
  findObjectCreations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const objectCreations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'object_creation_expression') {
        objectCreations.push(node);
      }
    });

    return objectCreations;
  }

  /**
   * 查找构造函数声明
   */
  findConstructorDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const constructorDeclarations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'constructor_declaration') {
        constructorDeclarations.push(node);
      }
    });

    return constructorDeclarations;
  }

  /**
   * 按类型查找节点
   */
  private findNodeByType(node: Parser.SyntaxNode, nodeType: string): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];

    if (node.type === nodeType) {
      results.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        results.push(...this.findNodeByType(child, nodeType));
      }
    }

    return results;
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

    // 查找所有对象创建表达式
    const objectCreations = this.findObjectCreations(ast);
    for (const objCreation of objectCreations) {
      const targetName = this.extractTargetName(objCreation);
      const creationType = this.determineCreationType(objCreation);
      const constructorInfo = this.extractConstructorInfo(objCreation);

      if (targetName && creationType) {
        creations.push({
          sourceId: NodeIdGenerator.forAstNode(objCreation),
          targetId: NodeIdGenerator.forSymbol(targetName, 'class', filePath, objCreation.startPosition.row + 1),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: objCreation.startPosition.row + 1,
            columnNumber: objCreation.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有构造函数声明
    const constructorDeclarations = this.findConstructorDeclarations(ast);
    for (const constructorDecl of constructorDeclarations) {
      const targetName = this.extractTargetName(constructorDecl);
      const creationType = this.determineCreationType(constructorDecl);
      const constructorInfo = this.extractConstructorInfo(constructorDecl);

      if (targetName && creationType) {
        creations.push({
          sourceId: NodeIdGenerator.forAstNode(constructorDecl),
          targetId: NodeIdGenerator.forSymbol(targetName, 'constructor', filePath, constructorDecl.startPosition.row + 1),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: constructorDecl.startPosition.row + 1,
            columnNumber: constructorDecl.startPosition.column + 1
          }
        });
      }
    }

    return creations;
  }

  /**
   * 生成节点ID
   */
}