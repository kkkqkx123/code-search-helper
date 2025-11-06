import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言引用关系提取器
 * 处理标识符引用、字段表达式引用等
 */
export class ReferenceRelationshipExtractor {
  /**
   * 提取引用关系元数据
   */
  extractReferenceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const referenceType = this.determineReferenceType(astNode);

    if (!referenceType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractReferenceNodes(astNode, referenceType);
    const referenceName = this.extractReferenceName(astNode);

    return {
      type: 'reference',
      fromNodeId,
      toNodeId,
      referenceType,
      referenceName,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取引用关系数组
   */
  extractReferenceRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为引用相关的节点类型
    if (!this.isReferenceNode(astNode)) {
      return relationships;
    }

    const referenceMetadata = this.extractReferenceMetadata(result, astNode, null);
    if (referenceMetadata) {
      relationships.push(referenceMetadata);
    }

    return relationships;
  }

  /**
   * 确定引用类型
   */
  private determineReferenceType(astNode: Parser.SyntaxNode): 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum' | 'function' | null {
    const nodeType = astNode.type;

    if (nodeType === 'identifier') {
      if (astNode.parent?.type === 'parameter_declaration') {
        return 'parameter';
      } else if (astNode.parent?.type === 'field_declaration') {
        return 'field';
      }
      return 'variable';
    } else if (nodeType === 'field_identifier') {
      return 'field';
    } else if (nodeType === 'type_identifier') {
      return 'type';
    } else if (nodeType === 'function_declarator') {
      return 'function';
    }

    return null;
  }

  /**
   * 提取引用关系的节点
   */
  private extractReferenceNodes(astNode: Parser.SyntaxNode, referenceType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    const referenceName = this.extractReferenceName(astNode);
    if (referenceName) {
      toNodeId = this.generateNodeId(referenceName, referenceType, 'current_file.c');
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取引用名称
   */
  private extractReferenceName(astNode: Parser.SyntaxNode): string | null {
    return astNode.text || null;
  }

  /**
   * 判断是否为引用关系节点
   */
  private isReferenceNode(astNode: Parser.SyntaxNode): boolean {
    const referenceNodeTypes = [
      'identifier',
      'field_identifier',
      'type_identifier',
      'function_declarator'
    ];

    return referenceNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

  /**
   * 查找所有标识符引用
   */
  findIdentifierReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'identifier' || node.type === 'field_identifier' || node.type === 'type_identifier') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找字段表达式引用
   */
  findFieldExpressionReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'field_expression') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找函数声明引用
   */
  findFunctionDeclarationReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'function_declarator') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找变量声明引用
   */
  findVariableDeclarationReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'declaration' || node.type === 'init_declarator') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找类型引用
   */
  findTypeReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'type_identifier') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找原生类型引用
   */
  findPrimitiveTypeReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'primitive_type') {
        references.push(node);
      }
    });

    return references;
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
   * 分析引用关系
   */
  analyzeReferences(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    referenceType: string;
    referenceName: string;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const references: Array<any> = [];

    // 查找所有标识符引用
    const identifiers = this.findIdentifierReferences(ast);
    for (const identifier of identifiers) {
      const identifierName = identifier.text;
      const referenceType = this.determineReferenceType(identifier);

      references.push({
        sourceId: generateDeterministicNodeId(identifier),
        targetId: this.generateNodeId(identifierName, 'identifier', filePath),
        referenceType,
        referenceName: identifierName,
        location: {
          filePath,
          lineNumber: identifier.startPosition.row + 1,
          columnNumber: identifier.startPosition.column + 1
        }
      });
    }

    // 查找字段表达式引用
    const fieldExpressions = this.findFieldExpressionReferences(ast);
    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        const referenceType = this.determineReferenceType(fieldExpr);

        references.push({
          sourceId: generateDeterministicNodeId(fieldExpr),
          targetId: this.generateNodeId(fieldName, 'field', filePath),
          referenceType,
          referenceName: fieldName,
          location: {
            filePath,
            lineNumber: fieldExpr.startPosition.row + 1,
            columnNumber: fieldExpr.startPosition.column + 1
          }
        });
      }
    }

    return references;
  }

  /**
   * 从字段表达式中提取字段名
   */
  private extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }
}