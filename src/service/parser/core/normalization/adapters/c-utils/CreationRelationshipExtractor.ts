import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言创建关系提取器
 * 处理结构体实例化和变量声明
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

    return {
      type: 'creation',
      fromNodeId,
      toNodeId,
      creationType,
      targetName,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
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
  private determineCreationType(astNode: Parser.SyntaxNode): 'instantiation' | 'allocation' | 'initialization' | null {
    const nodeType = astNode.type;
    const text = astNode.text || '';

    if (nodeType === 'declaration' || nodeType === 'init_declarator') {
      if (text.includes('malloc') || text.includes('calloc')) {
        return 'allocation';
      }
      return 'instantiation';
    } else if (nodeType === 'assignment_expression') {
      if (text.includes('malloc') || text.includes('calloc')) {
        return 'allocation';
      }
      return 'initialization';
    }

    return null;
  }

  /**
   * 提取创建关系的节点
   */
  private extractCreationNodes(astNode: Parser.SyntaxNode, creationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    if (creationType === 'instantiation' || creationType === 'initialization') {
      // 对于实例化，提取类型信息
      const typeNode = this.extractTypeNode(astNode);
      if (typeNode) {
        toNodeId = NodeIdGenerator.forAstNode(typeNode);
      }
    } else if (creationType === 'allocation') {
      // 对于内存分配，提取分配的变量
      const varNode = this.extractVariableNode(astNode);
      if (varNode) {
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
        if (child.type === 'type_identifier' || child.type === 'struct_specifier' || child.type === 'enum_specifier') {
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
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'declaration',
      'init_declarator',
      'assignment_expression'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 查找结构体实例
   */
  findStructInstances(varDecl: Parser.SyntaxNode, filePath: string): Array<{
    structName: string;
    structId: string;
  }> {
    const instances: Array<{
      structName: string;
      structId: string;
    }> = [];

    // 检查变量声明中的类型是否是结构体
    const typeIdentifiers = this.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      instances.push({
        structName: typeIdent.text,
        structId: NodeIdGenerator.forAstNode(typeIdent)
      });
    }

    return instances;
  }

  /**
   * 查找枚举实例
   */
  findEnumInstances(varDecl: Parser.SyntaxNode, filePath: string): Array<{
    enumName: string;
    enumId: string;
  }> {
    const instances: Array<{
      enumName: string;
      enumId: string;
    }> = [];

    // 检查变量声明中的类型是否是枚举
    const typeIdentifiers = this.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      instances.push({
        enumName: typeIdent.text,
        enumId: NodeIdGenerator.forAstNode(typeIdent)
      });
    }

    return instances;
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
}