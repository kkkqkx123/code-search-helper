import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C#引用关系提取器
 * 处理标识符引用、成员访问、类型引用等
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
    const typeInfo = this.extractTypeInfo(astNode);
    const namespaceInfo = this.extractNamespaceInfo(astNode);

    return {
      type: 'reference',
      fromNodeId,
      toNodeId,
      referenceType,
      referenceName,
      typeInfo,
      namespaceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
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
  private determineReferenceType(astNode: Parser.SyntaxNode): 'variable' | 'constant' | 'parameter' | 'field' | 'property' | 'type' | 'method' | 'event' | 'delegate' | 'namespace' | 'enum' | 'interface' | 'class' | 'struct' | null {
    const nodeType = astNode.type;

    if (nodeType === 'identifier') {
      if (astNode.parent?.type === 'parameter_declaration') {
        return 'parameter';
      } else if (astNode.parent?.type === 'field_declaration') {
        return 'field';
      } else if (astNode.parent?.type === 'property_declaration') {
        return 'property';
      } else if (astNode.parent?.type === 'event_declaration') {
        return 'event';
      } else if (astNode.parent?.type === 'delegate_declaration') {
        return 'delegate';
      } else if (astNode.parent?.type === 'enum_declaration') {
        return 'enum';
      } else if (astNode.parent?.type === 'interface_declaration') {
        return 'interface';
      } else if (astNode.parent?.type === 'class_declaration') {
        return 'class';
      } else if (astNode.parent?.type === 'struct_declaration') {
        return 'struct';
      } else if (astNode.parent?.type === 'method_declaration') {
        return 'method';
      }
      return 'variable';
    } else if (nodeType === 'generic_name') {
      return 'type';
    } else if (nodeType === 'member_access_expression') {
      return 'field'; // 可能是字段、属性或方法
    } else if (nodeType === 'qualified_name') {
      return 'namespace';
    } else if (nodeType === 'this_expression') {
      return 'class';
    } else if (nodeType === 'base_expression') {
      return 'class';
    }

    return null;
  }

  /**
   * 提取引用关系的节点
   */
  private extractReferenceNodes(astNode: Parser.SyntaxNode, referenceType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    const referenceName = this.extractReferenceName(astNode);
    if (referenceName) {
      toNodeId = NodeIdGenerator.forSymbol(referenceName, referenceType, 'current_file.cs', astNode.startPosition.row + 1);
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取引用名称
   */
  private extractReferenceName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'identifier' ||
      astNode.type === 'generic_name' ||
      astNode.type === 'qualified_name') {
      return astNode.text || null;
    } else if (astNode.type === 'member_access_expression') {
      return this.extractMemberNameFromExpression(astNode);
    } else if (astNode.type === 'this_expression') {
      return 'this';
    } else if (astNode.type === 'base_expression') {
      return 'base';
    }
    return null;
  }

  /**
   * 从成员访问表达式中提取成员名称
   */
  private extractMemberNameFromExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 提取类型信息
   */
  private extractTypeInfo(astNode: Parser.SyntaxNode): any {
    const typeInfo: any = {};

    // 检查是否是泛型引用
    if (astNode.type === 'generic_name') {
      typeInfo.isGeneric = true;
      typeInfo.typeArguments = this.extractTypeArguments(astNode);
    }

    // 检查父节点是否包含类型参数
    if (astNode.parent) {
      for (const child of astNode.parent.children) {
        if (child.type === 'type_argument_list') {
          typeInfo.hasTypeArguments = true;
          typeInfo.typeArguments = this.extractTypeArguments(child);
          break;
        }
      }
    }

    // 检查是否是可空类型
    if (astNode.parent?.type === 'nullable_type') {
      typeInfo.isNullable = true;
    }

    // 检查是否是数组类型
    if (astNode.parent?.type === 'array_type') {
      typeInfo.isArray = true;
      typeInfo.rankSpecifiers = this.extractArrayRankSpecifiers(astNode.parent);
    }

    return Object.keys(typeInfo).length > 0 ? typeInfo : null;
  }

  /**
   * 提取类型参数
   */
  private extractTypeArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of astNode.children) {
      if (child.type === 'type_argument_list') {
        for (const arg of child.children) {
          if (arg.type !== 'comment' && arg.type !== ',' && arg.type !== '<' && arg.type !== '>') {
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
   * 提取数组秩说明符
   */
  private extractArrayRankSpecifiers(arrayType: Parser.SyntaxNode): any[] {
    const rankSpecifiers: any[] = [];

    for (const child of arrayType.children) {
      if (child.type === 'array_rank_specifier') {
        rankSpecifiers.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return rankSpecifiers;
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

    // 检查父节点是否是成员访问表达式
    if (astNode.parent?.type === 'member_access_expression') {
      namespaceInfo.isMemberAccess = true;
      namespaceInfo.memberAccessNode = astNode.parent;
    }

    // 检查父节点是否是限定名称
    if (astNode.parent?.type === 'qualified_name') {
      namespaceInfo.isQualified = true;
      namespaceInfo.qualifiedNode = astNode.parent;
    }

    return Object.keys(namespaceInfo).length > 0 ? namespaceInfo : null;
  }

  /**
   * 判断是否为引用关系节点
   */
  private isReferenceNode(astNode: Parser.SyntaxNode): boolean {
    const referenceNodeTypes = [
      'identifier',
      'generic_name',
      'member_access_expression',
      'qualified_name',
      'this_expression',
      'base_expression'
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
        node.type === 'generic_name') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找成员访问表达式引用
   */
  findMemberAccessReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'member_access_expression') {
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
      if (node.type === 'generic_name' ||
        node.type === 'qualified_name') {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 查找命名空间引用
   */
  findNamespaceReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'qualified_name' && this.isLikelyNamespace(node)) {
        references.push(node);
      }
    });

    return references;
  }

  /**
   * 判断是否可能是命名空间
   */
  private isLikelyNamespace(node: Parser.SyntaxNode): boolean {
    // 简化判断：如果包含多个点且不是已知类型
    const text = node.text;
    if (!text.includes('.')) {
      return false;
    }

    // 检查是否以常见命名空间前缀开头
    const commonNamespacePrefixes = ['System', 'Microsoft', 'Newtonsoft', 'UnityEngine'];
    return commonNamespacePrefixes.some(prefix => text.startsWith(prefix));
  }

  /**
   * 查找this和base引用
   */
  findThisBaseReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const references: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'this_expression' || node.type === 'base_expression') {
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
    typeInfo?: any;
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
      const typeInfo = this.extractTypeInfo(identifier);
      const namespaceInfo = this.extractNamespaceInfo(identifier);

      if (referenceType) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(identifier),
          targetId: NodeIdGenerator.forSymbol(identifierName, referenceType, filePath, identifier.startPosition.row + 1),
          referenceType,
          referenceName: identifierName,
          typeInfo,
          namespaceInfo,
          location: {
            filePath,
            lineNumber: identifier.startPosition.row + 1,
            columnNumber: identifier.startPosition.column + 1
          }
        });
      }
    }

    // 查找成员访问表达式引用
    const memberAccesses = this.findMemberAccessReferences(ast);
    for (const memberAccess of memberAccesses) {
      const memberName = this.extractMemberNameFromExpression(memberAccess);

      if (memberName) {
        const referenceType = this.determineReferenceType(memberAccess);
        const namespaceInfo = this.extractNamespaceInfo(memberAccess);

        references.push({
          sourceId: NodeIdGenerator.forAstNode(memberAccess),
          targetId: NodeIdGenerator.forSymbol(memberName, referenceType || 'field', filePath, memberAccess.startPosition.row + 1),
          referenceType: referenceType || 'field',
          referenceName: memberName,
          namespaceInfo,
          location: {
            filePath,
            lineNumber: memberAccess.startPosition.row + 1,
            columnNumber: memberAccess.startPosition.column + 1
          }
        });
      }
    }

    // 查找类型引用
    const typeReferences = this.findTypeReferences(ast);
    for (const typeRef of typeReferences) {
      const typeName = typeRef.text;
      const referenceType = this.determineReferenceType(typeRef);
      const typeInfo = this.extractTypeInfo(typeRef);

      if (referenceType && typeName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(typeRef),
          targetId: NodeIdGenerator.forSymbol(typeName, referenceType, filePath, typeRef.startPosition.row + 1),
          referenceType,
          referenceName: typeName,
          typeInfo,
          location: {
            filePath,
            lineNumber: typeRef.startPosition.row + 1,
            columnNumber: typeRef.startPosition.column + 1
          }
        });
      }
    }

    // 查找this和base引用
    const thisBaseReferences = this.findThisBaseReferences(ast);
    for (const thisBaseRef of thisBaseReferences) {
      const referenceName = thisBaseRef.text;
      const referenceType = this.determineReferenceType(thisBaseRef);

      if (referenceType) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(thisBaseRef),
          targetId: NodeIdGenerator.forSymbol(referenceName, referenceType, filePath, thisBaseRef.startPosition.row + 1),
          referenceType,
          referenceName,
          location: {
            filePath,
            lineNumber: thisBaseRef.startPosition.row + 1,
            columnNumber: thisBaseRef.startPosition.column + 1
          }
        });
      }
    }

    return references;
  }
}