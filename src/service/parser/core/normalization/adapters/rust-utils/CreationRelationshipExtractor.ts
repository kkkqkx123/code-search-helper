import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Rust创建关系提取器
 * 处理结构体实例化、枚举创建、闭包创建等
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
        filePath: symbolTable?.filePath || 'current_file.rs',
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
  private determineCreationType(astNode: Parser.SyntaxNode): 'instantiation' | 'enum_creation' | 'closure' | 'function_object' | 'iterator' | 'collection' | null {
    const nodeType = astNode.type;
    const text = astNode.text || '';

    if (nodeType === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.type === 'type_identifier' || funcNode?.type === 'scoped_type_identifier') {
        return 'instantiation';
      } else if (funcNode?.type === 'identifier') {
        return 'function_object';
      }
    } else if (nodeType === 'struct_expression') {
      return 'instantiation';
    } else if (nodeType === 'enum_variant') {
      return 'enum_creation';
    } else if (nodeType === 'closure_expression') {
      return 'closure';
    } else if (nodeType === 'let_declaration') {
      const value = astNode.childForFieldName('value');
      if (value) {
        const valueCreationType = this.determineCreationType(value);
        if (valueCreationType) {
          return valueCreationType;
        }
      }
    } else if (text.includes('iter') || text.includes('collect')) {
      return 'iterator';
    } else if (text.includes('Vec::new') || text.includes('HashMap::new') || text.includes('HashSet::new')) {
      return 'collection';
    }

    return null;
  }

  /**
   * 提取创建关系的节点
   */
  private extractCreationNodes(astNode: Parser.SyntaxNode, creationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    if (creationType === 'instantiation' || creationType === 'enum_creation') {
      // 对于实例化，提取类型信息
      const typeNode = this.extractTypeNode(astNode);
      if (typeNode) {
        toNodeId = NodeIdGenerator.forAstNode(typeNode);
      }
    } else if (creationType === 'closure') {
      // 对于闭包，提取闭包表达式
      toNodeId = NodeIdGenerator.forSymbol('closure', 'closure', 'current_file.rs', astNode.startPosition.row);
    } else if (creationType === 'function_object') {
      // 对于函数对象，提取函数名
      const funcNode = this.extractFunctionNode(astNode);
      if (funcNode) {
        toNodeId = NodeIdGenerator.forAstNode(funcNode);
      }
    } else if (creationType === 'iterator') {
      // 对于迭代器，提取迭代器类型
      toNodeId = NodeIdGenerator.forSymbol('iterator', 'iterator', 'current_file.rs', astNode.startPosition.row);
    } else if (creationType === 'collection') {
      // 对于集合，提取集合类型
      const collectionType = this.extractCollectionType(astNode);
      if (collectionType) {
        toNodeId = NodeIdGenerator.forSymbol(collectionType, 'collection', 'current_file.rs', astNode.startPosition.row);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取类型节点
   */
  private extractTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (astNode.type === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.type === 'type_identifier' || funcNode?.type === 'scoped_type_identifier') {
        return funcNode;
      }
    } else if (astNode.type === 'struct_expression') {
      const typeNode = astNode.childForFieldName('type');
      if (typeNode) {
        return typeNode;
      }
    } else if (astNode.type === 'enum_variant') {
      const typeNode = astNode.childForFieldName('type');
      if (typeNode) {
        return typeNode;
      }
    }
    return null;
  }

  /**
   * 提取函数节点
   */
  private extractFunctionNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (astNode.type === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.type === 'identifier' || funcNode?.type === 'scoped_identifier') {
        return funcNode;
      }
    }
    return null;
  }

  /**
   * 提取集合类型
   */
  private extractCollectionType(astNode: Parser.SyntaxNode): string | null {
    const text = astNode.text || '';
    
    if (text.includes('Vec::new')) {
      return 'Vec';
    } else if (text.includes('HashMap::new')) {
      return 'HashMap';
    } else if (text.includes('HashSet::new')) {
      return 'HashSet';
    } else if (text.includes('BTreeMap::new')) {
      return 'BTreeMap';
    } else if (text.includes('BTreeSet::new')) {
      return 'BTreeSet';
    } else if (text.includes('LinkedList::new')) {
      return 'LinkedList';
    } else if (text.includes('VecDeque::new')) {
      return 'VecDeque';
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

    const funcNode = this.extractFunctionNode(astNode);
    if (funcNode) {
      return funcNode.text || null;
    }

    const collectionType = this.extractCollectionType(astNode);
    if (collectionType) {
      return collectionType;
    }

    if (astNode.type === 'closure_expression') {
      return 'closure';
    }

    return null;
  }

  /**
   * 提取构造函数信息
   */
  private extractConstructorInfo(astNode: Parser.SyntaxNode): any {
    const constructorInfo: any = {};

    if (astNode.type === 'call_expression') {
      constructorInfo.isConstructorCall = true;
      constructorInfo.arguments = this.extractCallArguments(astNode);
      constructorInfo.hasGenerics = this.hasGenericArguments(astNode);
    } else if (astNode.type === 'struct_expression') {
      constructorInfo.isStructExpression = true;
      constructorInfo.fields = this.extractStructFields(astNode);
      constructorInfo.hasGenerics = this.hasGenericArguments(astNode);
    } else if (astNode.type === 'enum_variant') {
      constructorInfo.isEnumVariant = true;
      constructorInfo.variant = this.extractEnumVariant(astNode);
      constructorInfo.arguments = this.extractEnumArguments(astNode);
    } else if (astNode.type === 'closure_expression') {
      constructorInfo.isClosureCreation = true;
      constructorInfo.parameters = this.extractClosureParameters(astNode);
      constructorInfo.isAsync = this.isAsyncClosure(astNode);
      constructorInfo.isMove = this.isMoveClosure(astNode);
    } else if (astNode.type === 'let_declaration') {
      const value = astNode.childForFieldName('value');
      if (value) {
        return this.extractConstructorInfo(value);
      }
    }

    return constructorInfo;
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(callNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];
    const argsNode = callNode.childForFieldName('arguments');
    
    if (argsNode) {
      for (const child of argsNode.children || []) {
        if (child.type !== 'comment' && child.type !== ',' && child.type !== '(' && child.type !== ')') {
          args.push({
            type: child.type,
            text: child.text
          });
        }
      }
    }
    
    return args;
  }

  /**
   * 提取结构体字段
   */
  private extractStructFields(structNode: Parser.SyntaxNode): any[] {
    const fields: any[] = [];
    const fieldsNode = structNode.childForFieldName('body');
    
    if (fieldsNode) {
      for (const child of fieldsNode.children || []) {
        if (child.type === 'field_initializer') {
          const nameNode = child.childForFieldName('name');
          const valueNode = child.childForFieldName('value');
          
          fields.push({
            name: nameNode?.text || '',
            value: valueNode?.text || '',
            type: valueNode?.type || ''
          });
        }
      }
    }
    
    return fields;
  }

  /**
   * 提取枚举变体
   */
  private extractEnumVariant(enumNode: Parser.SyntaxNode): string | null {
    const variantNode = enumNode.childForFieldName('variant');
    if (variantNode?.type === 'identifier') {
      return variantNode.text || null;
    }
    return null;
  }

  /**
   * 提取枚举参数
   */
  private extractEnumArguments(enumNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];
    const argsNode = enumNode.childForFieldName('arguments');
    
    if (argsNode) {
      for (const child of argsNode.children || []) {
        if (child.type !== 'comment' && child.type !== ',' && child.type !== '(' && child.type !== ')') {
          args.push({
            type: child.type,
            text: child.text
          });
        }
      }
    }
    
    return args;
  }

  /**
   * 提取闭包参数
   */
  private extractClosureParameters(closureNode: Parser.SyntaxNode): string[] {
    const params: string[] = [];
    const parameters = closureNode.childForFieldName('parameters');
    
    if (parameters) {
      for (const child of parameters.children) {
        if (child.type === 'parameter') {
          const pattern = child.childForFieldName('pattern');
          if (pattern?.type === 'identifier') {
            params.push(pattern.text || '');
          }
        }
      }
    }
    
    return params;
  }

  /**
   * 判断是否有泛型参数
   */
  private hasGenericArguments(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';
    return text.includes('<') && text.includes('>');
  }

  /**
   * 判断是否为异步闭包
   */
  private isAsyncClosure(astNode: Parser.SyntaxNode): boolean {
    return astNode.type === 'async_closure_expression';
  }

  /**
   * 判断是否为move闭包
   */
  private isMoveClosure(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'move') {
        return true;
      }
    }
    return false;
  }

  /**
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'call_expression',
      'struct_expression',
      'enum_variant',
      'closure_expression',
      'async_closure_expression',
      'let_declaration'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */

  /**
   * 查找结构体实例
   */
  findStructInstances(ast: Parser.SyntaxNode, filePath: string): Array<{
    structName: string;
    structId: string;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const instances: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'call_expression') {
        const funcNode = node.childForFieldName('function');
        if (funcNode?.type === 'type_identifier' && funcNode.text) {
          instances.push({
            structName: funcNode.text,
            structId: NodeIdGenerator.forAstNode(funcNode),
            location: {
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
      } else if (node.type === 'struct_expression') {
        const typeNode = node.childForFieldName('type');
        if (typeNode?.text) {
          instances.push({
            structName: typeNode.text,
            structId: NodeIdGenerator.forAstNode(typeNode),
            location: {
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
      }
    });

    return instances;
  }

  /**
   * 查找枚举创建
   */
  findEnumCreations(ast: Parser.SyntaxNode, filePath: string): Array<{
    enumName: string;
    variant: string;
    enumId: string;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const enumCreations: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'enum_variant') {
        const typeNode = node.childForFieldName('type');
        const variantNode = node.childForFieldName('variant');
        
        if (typeNode?.text && variantNode?.text) {
          enumCreations.push({
            enumName: typeNode.text,
            variant: variantNode.text,
            enumId: NodeIdGenerator.forAstNode(node),
            location: {
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
      }
    });

    return enumCreations;
  }

  /**
   * 查找闭包
   */
  findClosures(ast: Parser.SyntaxNode, filePath: string): Array<{
    closureId: string;
    parameters: string[];
    isAsync: boolean;
    isMove: boolean;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const closures: Array<any> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'closure_expression' || node.type === 'async_closure_expression') {
        const parameters = this.extractClosureParameters(node);
        const isAsync = node.type === 'async_closure_expression';
        const isMove = this.isMoveClosure(node);
        
        closures.push({
          closureId: NodeIdGenerator.forAstNode(node),
          parameters,
          isAsync,
          isMove,
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

    // 查找所有结构体实例
    const structInstances = this.findStructInstances(ast, filePath);
    for (const instance of structInstances) {
      creations.push({
        sourceId: instance.structId,
        targetId: NodeIdGenerator.forSymbol(instance.structName, 'struct', filePath, instance.location.lineNumber),
        creationType: 'instantiation',
        targetName: instance.structName,
        constructorInfo: { isConstructorCall: true },
        location: {
          filePath,
          ...instance.location
        }
      });
    }

    // 查找所有枚举创建
    const enumCreations = this.findEnumCreations(ast, filePath);
    for (const enumCreation of enumCreations) {
      creations.push({
        sourceId: enumCreation.enumId,
        targetId: NodeIdGenerator.forSymbol(enumCreation.enumName, 'enum', filePath, enumCreation.location.lineNumber),
        creationType: 'enum_creation',
        targetName: `${enumCreation.enumName}::${enumCreation.variant}`,
        constructorInfo: { 
          isEnumVariant: true,
          variant: enumCreation.variant
        },
        location: {
          filePath,
          ...enumCreation.location
        }
      });
    }

    // 查找所有闭包
    const closures = this.findClosures(ast, filePath);
    for (const closure of closures) {
      creations.push({
        sourceId: closure.closureId,
        targetId: NodeIdGenerator.forSymbol('closure', 'closure', filePath, closure.location.lineNumber),
        creationType: 'closure',
        targetName: 'closure',
        constructorInfo: { 
          isClosureCreation: true,
          parameters: closure.parameters,
          isAsync: closure.isAsync,
          isMove: closure.isMove
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