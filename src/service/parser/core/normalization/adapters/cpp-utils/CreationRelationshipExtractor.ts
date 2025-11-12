import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++创建关系提取器
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
        filePath: symbolTable?.filePath || 'current_file.cpp',
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
  private determineCreationType(astNode: Parser.SyntaxNode): 'instantiation' | 'allocation' | 'initialization' | 'construction' | 'template_instantiation' | null {
    const nodeType = astNode.type;
    const text = astNode.text || '';

    if (nodeType === 'declaration' || nodeType === 'init_declarator') {
      if (text.includes('new') || text.includes('malloc') || text.includes('calloc')) {
        return 'allocation';
      } else if (text.includes('<') && text.includes('>')) {
        return 'template_instantiation';
      }
      return 'instantiation';
    } else if (nodeType === 'assignment_expression') {
      if (text.includes('new') || text.includes('malloc') || text.includes('calloc')) {
        return 'allocation';
      }
      return 'initialization';
    } else if (nodeType === 'new_expression') {
      return 'allocation';
    } else if (nodeType === 'constructor_initializer') {
      return 'construction';
    } else if (nodeType === 'call_expression' && this.isConstructorCall(astNode)) {
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
    } else if (creationType === 'template_instantiation') {
      // 对于模板实例化，提取模板类型
      const templateNode = this.extractTemplateTypeNode(astNode);
      if (templateNode) {
        toNodeId = NodeIdGenerator.forAstNode(templateNode);
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
          child.type === 'class_specifier' ||
          child.type === 'struct_specifier' ||
          child.type === 'enum_specifier' ||
          child.type === 'template_type') {
          return child;
        }
      }
    }
    return null;
  }

  /**
   * 提取模板类型节点
   */
  private extractTemplateTypeNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找模板类型
    if (astNode.children) {
      for (const child of astNode.children) {
        if (child.type === 'template_type' ||
          child.type === 'template_function') {
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

    // 对于声明，查找声明符
    if (astNode.type === 'declaration' || astNode.type === 'init_declarator') {
      const declarator = astNode.childForFieldName('declarator');
      if (declarator) {
        return declarator;
      }
    }

    // 对于new表达式，查找类型
    if (astNode.type === 'new_expression') {
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

    const templateNode = this.extractTemplateTypeNode(astNode);
    if (templateNode) {
      return templateNode.text || null;
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

    if (astNode.type === 'constructor_initializer') {
      constructorInfo.isConstructorInitializer = true;
      constructorInfo.memberName = this.extractMemberName(astNode);
      constructorInfo.arguments = this.extractConstructorArguments(astNode);
    } else if (astNode.type === 'call_expression' && this.isConstructorCall(astNode)) {
      constructorInfo.isConstructorCall = true;
      constructorInfo.arguments = this.extractCallArguments(astNode);
    } else if (astNode.type === 'new_expression') {
      constructorInfo.isNewExpression = true;
      constructorInfo.arguments = this.extractNewExpressionArguments(astNode);
    }

    return constructorInfo;
  }

  /**
   * 提取成员名称
   */
  private extractMemberName(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'field_identifier') {
        return child.text || null;
      }
    }
    return null;
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
   * 提取调用参数
   */
  private extractCallArguments(astNode: Parser.SyntaxNode): any[] {
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
   * 提取new表达式参数
   */
  private extractNewExpressionArguments(astNode: Parser.SyntaxNode): any[] {
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
   * 判断是否为构造函数调用
   */
  private isConstructorCall(astNode: Parser.SyntaxNode): boolean {
    if (astNode.type !== 'call_expression') {
      return false;
    }

    // 检查函数名是否是类型名
    const functionNode = astNode.childForFieldName('function');
    if (functionNode && functionNode.type === 'type_identifier') {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'declaration',
      'init_declarator',
      'assignment_expression',
      'new_expression',
      'constructor_initializer',
      'call_expression'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 查找类实例
   */
  findClassInstances(varDecl: Parser.SyntaxNode, filePath: string): Array<{
    className: string;
    classId: string;
    isTemplate: boolean;
  }> {
    const instances: Array<{
      className: string;
      classId: string;
      isTemplate: boolean;
    }> = [];

    // 检查变量声明中的类型是否是类
    const typeIdentifiers = this.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      instances.push({
        className: typeIdent.text,
        classId: NodeIdGenerator.forAstNode(typeIdent),
        isTemplate: false
      });
    }

    // 检查模板类型
    const templateTypes = this.findNodeByType(varDecl, 'template_type');
    for (const templateType of templateTypes) {
      instances.push({
        className: templateType.text,
        classId: NodeIdGenerator.forAstNode(templateType),
        isTemplate: true
      });
    }

    return instances;
  }

  /**
   * 查找结构体实例
   */
  findStructInstances(varDecl: Parser.SyntaxNode, filePath: string): Array<{
    structName: string;
    structId: string;
    isTemplate: boolean;
  }> {
    const instances: Array<{
      structName: string;
      structId: string;
      isTemplate: boolean;
    }> = [];

    // 检查变量声明中的类型是否是结构体
    const typeIdentifiers = this.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      instances.push({
        structName: typeIdent.text,
        structId: NodeIdGenerator.forAstNode(typeIdent),
        isTemplate: false
      });
    }

    // 检查模板结构体
    const templateTypes = this.findNodeByType(varDecl, 'template_type');
    for (const templateType of templateTypes) {
      instances.push({
        structName: templateType.text,
        structId: NodeIdGenerator.forAstNode(templateType),
        isTemplate: true
      });
    }

    return instances;
  }

  /**
   * 查找new表达式
   */
  findNewExpressions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const newExpressions: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'new_expression') {
        newExpressions.push(node);
      }
    });

    return newExpressions;
  }

  /**
   * 查找构造函数初始化器
   */
  findConstructorInitializers(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const constructorInitializers: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'constructor_initializer') {
        constructorInitializers.push(node);
      }
    });

    return constructorInitializers;
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

    // 查找所有new表达式
    const newExpressions = this.findNewExpressions(ast);
    for (const newExpr of newExpressions) {
      const targetName = this.extractTargetName(newExpr);
      const creationType = this.determineCreationType(newExpr);
      const constructorInfo = this.extractConstructorInfo(newExpr);

      if (targetName && creationType) {
        creations.push({
          sourceId: NodeIdGenerator.forAstNode(newExpr),
          targetId: NodeIdGenerator.forSymbol(targetName, 'class', filePath, newExpr.startPosition.row + 1),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: newExpr.startPosition.row + 1,
            columnNumber: newExpr.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有构造函数初始化器
    const constructorInitializers = this.findConstructorInitializers(ast);
    for (const constructorInit of constructorInitializers) {
      const targetName = this.extractTargetName(constructorInit);
      const creationType = this.determineCreationType(constructorInit);
      const constructorInfo = this.extractConstructorInfo(constructorInit);

      if (targetName && creationType) {
        creations.push({
          sourceId: NodeIdGenerator.forAstNode(constructorInit),
          targetId: NodeIdGenerator.forSymbol(targetName, 'member', filePath, constructorInit.startPosition.row + 1),
          creationType,
          targetName,
          constructorInfo,
          location: {
            filePath,
            lineNumber: constructorInit.startPosition.row + 1,
            columnNumber: constructorInit.startPosition.column + 1
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