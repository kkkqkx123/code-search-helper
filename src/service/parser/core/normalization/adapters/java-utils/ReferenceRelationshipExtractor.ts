import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Java引用关系提取器
 * 处理标识符引用、字段表达式引用、方法引用等
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
    const templateInfo = this.extractTemplateInfo(astNode);
    const namespaceInfo = this.extractNamespaceInfo(astNode);

    return {
      type: 'reference',
      fromNodeId,
      toNodeId,
      referenceType,
      referenceName,
      templateInfo,
      namespaceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
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
  private determineReferenceType(astNode: Parser.SyntaxNode): 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum' | 'function' | 'method' | 'template' | 'package' | 'annotation' | null {
    const nodeType = astNode.type;

    if (nodeType === 'identifier') {
      if (astNode.parent?.type === 'formal_parameter') {
        return 'parameter';
      } else if (astNode.parent?.type === 'field_declaration') {
        return 'field';
      } else if (astNode.parent?.type === 'method_declaration' || astNode.parent?.type === 'method_declarator') {
        return 'method';
      } else if (astNode.parent?.type === 'variable_declarator') {
        return 'variable';
      }
      return 'variable';
    } else if (nodeType === 'field_identifier') {
      return 'field';
    } else if (nodeType === 'type_identifier') {
      return 'type';
    } else if (nodeType === 'method_declarator') {
      return 'method';
    } else if (nodeType === 'generic_type') {
      return 'template';
    } else if (nodeType === 'scoped_identifier') {
      return 'package';
    } else if (nodeType === 'annotation') {
      return 'annotation';
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
      toNodeId = this.generateNodeId(referenceName, referenceType, 'current_file.java');
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
   * 提取模板信息
   */
  private extractTemplateInfo(astNode: Parser.SyntaxNode): any {
    const templateInfo: any = {};

    // 检查是否是模板引用
    if (astNode.type === 'generic_type') {
      templateInfo.isTemplate = true;
      templateInfo.templateArguments = this.extractTemplateArguments(astNode);
    }

    // 检查父节点是否包含模板参数
    if (astNode.parent) {
      for (const child of astNode.parent.children) {
        if (child.type === 'type_arguments') {
          templateInfo.hasTemplateArguments = true;
          templateInfo.templateArguments = this.extractTemplateArguments(child);
          break;
        }
      }
    }

    return Object.keys(templateInfo).length > 0 ? templateInfo : null;
  }

  /**
   * 提取模板参数
   */
  private extractTemplateArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of astNode.children) {
      if (child.type !== 'comment' && child.type !== ',' && child.type !== '<' && child.type !== '>') {
        args.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return args;
  }

  /**
   * 提取命名空间信息
   */
  private extractNamespaceInfo(astNode: Parser.SyntaxNode): any {
    const namespaceInfo: any = {};

    // 检查是否是限定名称（包含.）
    if (astNode.text && astNode.text.includes('.')) {
      namespaceInfo.isQualifiedName = true;
      namespaceInfo.namespaceParts = astNode.text.split('.');
      namespaceInfo.baseName = namespaceInfo.namespaceParts[namespaceInfo.namespaceParts.length - 1];
      namespaceInfo.namespacePath = namespaceInfo.namespaceParts.slice(0, -1).join('.');
    }

    // 检查父节点是否是作用域解析表达式
    if (astNode.parent?.type === 'scoped_identifier') {
      namespaceInfo.isScoped = true;
      namespaceInfo.scopeNode = astNode.parent;
    }

    return Object.keys(namespaceInfo).length > 0 ? namespaceInfo : null;
  }

  /**
   * 判断是否为引用关系节点
   */
  private isReferenceNode(astNode: Parser.SyntaxNode): boolean {
    const referenceNodeTypes = [
      'identifier',
      'field_identifier',
      'type_identifier',
      'method_declarator',
      'generic_type',
      'scoped_identifier',
      'annotation'
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
      if (node.type === 'identifier' ||
        node.type === 'field_identifier' ||
        node.type === 'type_identifier') {
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
      if (node.type === 'field_access') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找方法声明引用
   */
  findMethodDeclarationReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'method_declarator') {
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
      if (node.type === 'variable_declarator') {
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
   * 查找模板引用
   */
  findTemplateReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'generic_type') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找包引用
   */
  findPackageReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'scoped_identifier') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找注解引用
   */
  findAnnotationReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'annotation' || node.type === 'marker_annotation') {
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
    templateInfo?: any;
    namespaceInfo?: any;
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
      const templateInfo = this.extractTemplateInfo(identifier);
      const namespaceInfo = this.extractNamespaceInfo(identifier);

      if (referenceType) {
        references.push({
          sourceId: generateDeterministicNodeId(identifier),
          targetId: this.generateNodeId(identifierName, referenceType, filePath),
          referenceType,
          referenceName: identifierName,
          templateInfo,
          namespaceInfo,
          location: {
            filePath,
            lineNumber: identifier.startPosition.row + 1,
            columnNumber: identifier.startPosition.column + 1
          }
        });
      }
    }

    // 查找字段表达式引用
    const fieldExpressions = this.findFieldExpressionReferences(ast);
    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        const referenceType = 'field';
        const namespaceInfo = this.extractNamespaceInfo(fieldExpr);

        references.push({
          sourceId: generateDeterministicNodeId(fieldExpr),
          targetId: this.generateNodeId(fieldName, referenceType, filePath),
          referenceType,
          referenceName: fieldName,
          namespaceInfo,
          location: {
            filePath,
            lineNumber: fieldExpr.startPosition.row + 1,
            columnNumber: fieldExpr.startPosition.column + 1
          }
        });
      }
    }

    // 查找模板引用
    const templateReferences = this.findTemplateReferences(ast);
    for (const templateRef of templateReferences) {
      const templateName = templateRef.text;
      const referenceType = this.determineReferenceType(templateRef);
      const templateInfo = this.extractTemplateInfo(templateRef);

      if (referenceType && templateName) {
        references.push({
          sourceId: generateDeterministicNodeId(templateRef),
          targetId: this.generateNodeId(templateName, referenceType, filePath),
          referenceType,
          referenceName: templateName,
          templateInfo,
          location: {
            filePath,
            lineNumber: templateRef.startPosition.row + 1,
            columnNumber: templateRef.startPosition.column + 1
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