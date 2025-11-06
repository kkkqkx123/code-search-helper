import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C#创建关系提取器
 * 处理对象实例化、数组创建、委托创建等
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
        filePath: symbolTable?.filePath || 'current_file.cs',
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
  private determineCreationType(astNode: Parser.SyntaxNode): 'instantiation' | 'array_creation' | 'delegate_creation' | 'anonymous_object' | 'implicit_creation' | null {
    const nodeType = astNode.type;

    if (nodeType === 'object_creation_expression') {
      return 'instantiation';
    } else if (nodeType === 'array_creation_expression' ||
      nodeType === 'implicit_array_creation_expression' ||
      nodeType === 'stack_alloc_array_creation_expression') {
      return 'array_creation';
    } else if (nodeType === 'anonymous_object_creation_expression') {
      return 'anonymous_object';
    } else if (nodeType === 'delegate_creation_expression') {
      return 'delegate_creation';
    } else if (nodeType === 'assignment_expression') {
      // 检查是否是隐式创建（如var x = new MyClass()）
      const right = astNode.childForFieldName('right');
      if (right && (right.type === 'object_creation_expression' ||
        right.type === 'array_creation_expression')) {
        return 'implicit_creation';
      }
    }

    return null;
  }

  /**
   * 提取创建关系的节点
   */
  private extractCreationNodes(astNode: Parser.SyntaxNode, creationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (creationType === 'instantiation' || creationType === 'implicit_creation') {
      // 对于对象实例化，提取类型信息
      const typeNode = this.extractTypeNode(astNode);
      if (typeNode) {
        toNodeId = generateDeterministicNodeId(typeNode);
      }
    } else if (creationType === 'array_creation') {
      // 对于数组创建，提取数组类型
      const arrayTypeNode = this.extractArrayTypeNode(astNode);
      if (arrayTypeNode) {
        toNodeId = generateDeterministicNodeId(arrayTypeNode);
      }
    } else if (creationType === 'delegate_creation') {
      // 对于委托创建，提取委托类型
      const delegateTypeNode = this.extractDelegateTypeNode(astNode);
      if (delegateTypeNode) {
        toNodeId = generateDeterministicNodeId(delegateTypeNode);
      }
    } else if (creationType === 'anonymous_object') {
      // 对于匿名对象，使用特殊标识
      toNodeId = this.generateNodeId('anonymous_object', 'anonymous', 'current_file.cs');
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取类型节点
   */
  private extractTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (astNode.type === 'object_creation_expression') {
      return astNode.childForFieldName('type');
    } else if (astNode.type === 'assignment_expression') {
      const right = astNode.childForFieldName('right');
      if (right && right.type === 'object_creation_expression') {
        return right.childForFieldName('type');
      }
    }
    return null;
  }

  /**
   * 提取数组类型节点
   */
  private extractArrayTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (astNode.type === 'array_creation_expression') {
      return astNode.childForFieldName('type');
    } else if (astNode.type === 'implicit_array_creation_expression') {
      return astNode.childForFieldName('type');
    } else if (astNode.type === 'stack_alloc_array_creation_expression') {
      return astNode.childForFieldName('type');
    }
    return null;
  }

  /**
   * 提取委托类型节点
   */
  private extractDelegateTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (astNode.type === 'delegate_creation_expression') {
      return astNode.childForFieldName('type');
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

    const arrayTypeNode = this.extractArrayTypeNode(astNode);
    if (arrayTypeNode) {
      return arrayTypeNode.text || null;
    }

    const delegateTypeNode = this.extractDelegateTypeNode(astNode);
    if (delegateTypeNode) {
      return delegateTypeNode.text || null;
    }

    if (astNode.type === 'anonymous_object_creation_expression') {
      return 'anonymous_object';
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
      constructorInfo.initializer = this.extractObjectInitializer(astNode);
    } else if (astNode.type === 'array_creation_expression' ||
      astNode.type === 'implicit_array_creation_expression') {
      constructorInfo.isArrayCreation = true;
      constructorInfo.dimensions = this.extractArrayDimensions(astNode);
      constructorInfo.initializer = this.extractArrayInitializer(astNode);
    } else if (astNode.type === 'anonymous_object_creation_expression') {
      constructorInfo.isAnonymousObject = true;
      constructorInfo.initializers = this.extractAnonymousObjectInitializers(astNode);
    } else if (astNode.type === 'delegate_creation_expression') {
      constructorInfo.isDelegateCreation = true;
      constructorInfo.arguments = this.extractDelegateArguments(astNode);
    }

    return constructorInfo;
  }

  /**
   * 提取构造函数参数
   */
  private extractConstructorArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];
    const argumentList = astNode.childForFieldName('arguments');

    if (argumentList) {
      for (const child of argumentList.children) {
        if (child.type === 'argument') {
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
   * 提取对象初始化器
   */
  private extractObjectInitializer(astNode: Parser.SyntaxNode): any {
    const initializer = astNode.childForFieldName('initializer');
    if (initializer) {
      return {
        type: initializer.type,
        text: initializer.text
      };
    }
    return null;
  }

  /**
   * 提取数组维度
   */
  private extractArrayDimensions(astNode: Parser.SyntaxNode): any[] {
    const dimensions: any[] = [];

    if (astNode.type === 'array_creation_expression') {
      const rankSpecifiers = astNode.children.filter(child => child.type === 'array_rank_specifier');
      for (const rankSpecifier of rankSpecifiers) {
        dimensions.push({
          type: rankSpecifier.type,
          text: rankSpecifier.text
        });
      }
    }

    return dimensions;
  }

  /**
   * 提取数组初始化器
   */
  private extractArrayInitializer(astNode: Parser.SyntaxNode): any {
    const initializer = astNode.childForFieldName('initializer');
    if (initializer) {
      return {
        type: initializer.type,
        text: initializer.text
      };
    }
    return null;
  }

  /**
   * 提取匿名对象初始化器
   */
  private extractAnonymousObjectInitializers(astNode: Parser.SyntaxNode): any[] {
    const initializers: any[] = [];

    for (const child of astNode.children) {
      if (child.type === 'anonymous_object_member_declarator') {
        initializers.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return initializers;
  }

  /**
   * 提取委托参数
   */
  private extractDelegateArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];
    const argumentList = astNode.childForFieldName('argument');

    if (argumentList) {
      args.push({
        type: argumentList.type,
        text: argumentList.text
      });
    }

    return args;
  }

  /**
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'object_creation_expression',
      'array_creation_expression',
      'implicit_array_creation_expression',
      'stack_alloc_array_creation_expression',
      'anonymous_object_creation_expression',
      'delegate_creation_expression',
      'assignment_expression'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 查找对象创建表达式
   */
  findObjectCreationExpressions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const objectCreations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'object_creation_expression') {
        objectCreations.push(node);
      }
    });

    return objectCreations;
  }

  /**
   * 查找数组创建表达式
   */
  findArrayCreationExpressions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const arrayCreations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'array_creation_expression' ||
        node.type === 'implicit_array_creation_expression' ||
        node.type === 'stack_alloc_array_creation_expression') {
        arrayCreations.push(node);
      }
    });

    return arrayCreations;
  }

  /**
   * 查找匿名对象创建表达式
   */
  findAnonymousObjectCreations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const anonymousObjects: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'anonymous_object_creation_expression') {
        anonymousObjects.push(node);
      }
    });

    return anonymousObjects;
  }

  /**
   * 查找委托创建表达式
   */
  findDelegateCreationExpressions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const delegateCreations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'delegate_creation_expression') {
        delegateCreations.push(node);
      }
    });

    return delegateCreations;
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
    const objectCreations = this.findObjectCreationExpressions(ast);
    for (const objCreation of objectCreations) {
      const targetName = this.extractTargetName(objCreation);
      const creationType = this.determineCreationType(objCreation);
      const constructorInfo = this.extractConstructorInfo(objCreation);

      if (targetName && creationType) {
        creations.push({
          sourceId: generateDeterministicNodeId(objCreation),
          targetId: this.generateNodeId(targetName, 'class', filePath),
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

    // 查找所有数组创建表达式
    const arrayCreations = this.findArrayCreationExpressions(ast);
    for (const arrayCreation of arrayCreations) {
      const targetName = this.extractTargetName(arrayCreation);
      const creationType = this.determineCreationType(arrayCreation);
      const constructorInfo = this.extractConstructorInfo(arrayCreation);

      if (targetName && creationType) {
        creations.push({
          sourceId: generateDeterministicNodeId(arrayCreation),
          targetId: this.generateNodeId(targetName, 'array', filePath),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: arrayCreation.startPosition.row + 1,
            columnNumber: arrayCreation.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有匿名对象创建表达式
    const anonymousObjects = this.findAnonymousObjectCreations(ast);
    for (const anonymousObj of anonymousObjects) {
      const targetName = this.extractTargetName(anonymousObj);
      const creationType = this.determineCreationType(anonymousObj);
      const constructorInfo = this.extractConstructorInfo(anonymousObj);

      if (targetName && creationType) {
        creations.push({
          sourceId: generateDeterministicNodeId(anonymousObj),
          targetId: this.generateNodeId(targetName, 'anonymous', filePath),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: anonymousObj.startPosition.row + 1,
            columnNumber: anonymousObj.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有委托创建表达式
    const delegateCreations = this.findDelegateCreationExpressions(ast);
    for (const delegateCreation of delegateCreations) {
      const targetName = this.extractTargetName(delegateCreation);
      const creationType = this.determineCreationType(delegateCreation);
      const constructorInfo = this.extractConstructorInfo(delegateCreation);

      if (targetName && creationType) {
        creations.push({
          sourceId: generateDeterministicNodeId(delegateCreation),
          targetId: this.generateNodeId(targetName, 'delegate', filePath),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: delegateCreation.startPosition.row + 1,
            columnNumber: delegateCreation.startPosition.column + 1
          }
        });
      }
    }

    return creations;
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}