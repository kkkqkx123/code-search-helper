import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go注解/标签关系提取器
 * 处理Go中的struct标签等注解关系
 */
export class AnnotationRelationshipExtractor {
  /**
   * 提取注解关系元数据
   */
  extractAnnotationMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const annotationType = this.determineAnnotationType(astNode);

    if (!annotationType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractAnnotationNodes(astNode, annotationType);
    const target = this.extractTarget(astNode);
    const annotationValue = this.extractAnnotationValue(astNode);
    const annotationKind = this.determineAnnotationKind(astNode);

    return {
      type: 'annotation',
      fromNodeId,
      toNodeId,
      annotationType,
      annotationKind,
      target,
      annotationValue,
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取注解关系数组
   */
  extractAnnotationRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为注解相关的节点类型
    if (!this.isAnnotationNode(astNode)) {
      return relationships;
    }

    const annotationMetadata = this.extractAnnotationMetadata(result, astNode, null);
    if (annotationMetadata) {
      relationships.push(annotationMetadata);
    }

    return relationships;
  }

  /**
   * 确定注解类型
   */
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'struct_tag' | 'comment' | 'build_directive' | null {
    const nodeType = astNode.type;

    if (nodeType === 'field_identifier' && astNode.parent?.type === 'field_declaration') {
      // 检查是否有相关的struct标签
      const fieldDecl = astNode.parent;
      const tagNode = this.findStructTag(fieldDecl);
      if (tagNode) {
        return 'struct_tag';
      }
    } else if (nodeType === 'comment') {
      // 检查是否是构建指令或其他特殊注释
      if (astNode.text?.includes('//go:')) {
        return 'build_directive';
      }
      return 'comment';
    } else if (nodeType === 'string_literal' && this.isStructTag(astNode)) {
      return 'struct_tag';
    }

    return null;
  }

  /**
   * 确定注解种类
   */
  private determineAnnotationKind(astNode: Parser.SyntaxNode): 'struct_tag' | 'json_tag' | 'xml_tag' | 'sql_tag' | 'validation' | 'doc' | 'directive' {
    const annotationType = this.determineAnnotationType(astNode);

    if (annotationType === 'struct_tag') {
      const tagValue = this.extractAnnotationValue(astNode);
      if (tagValue && tagValue.includes('json:')) {
        return 'json_tag';
      } else if (tagValue && tagValue.includes('xml:')) {
        return 'xml_tag';
      } else if (tagValue && tagValue.includes('sql:')) {
        return 'sql_tag';
      } else if (tagValue && (tagValue.includes('validate:') || tagValue.includes('valid:'))) {
        return 'validation';
      } else {
        return 'struct_tag';
      }
    } else if (annotationType === 'comment') {
      if (astNode.text?.includes('//go:')) {
        return 'directive';
      } else {
        return 'doc';
      }
    }

    return 'struct_tag'; // 默认
  }

  /**
   * 提取注解关系的节点
   */
  private extractAnnotationNodes(astNode: Parser.SyntaxNode, annotationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (annotationType === 'struct_tag') {
      // 对于结构体标签，目标是相关的字段声明
      if (astNode.type === 'string_literal' && astNode.parent?.type === 'field_declaration') {
        toNodeId = generateDeterministicNodeId(astNode.parent);
      } else if (astNode.type === 'field_identifier' && astNode.parent?.type === 'field_declaration') {
        toNodeId = generateDeterministicNodeId(astNode.parent);
      }
    } else if (annotationType === 'comment') {
      // 对于注释，目标通常是注释所关联的后续声明
      const associatedNode = this.findNodeAssociatedWithComment(astNode);
      if (associatedNode) {
        toNodeId = generateDeterministicNodeId(associatedNode);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 检查节点是否为struct标签
   */
  private isStructTag(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'string_literal' && node.type !== 'interpreted_string_literal' && node.type !== 'raw_string_literal') {
      return false;
    }

    // 检查父节点是否为字段声明
    if (node.parent && node.parent.type === 'field_declaration') {
      return true;
    }

    return false;
  }

  /**
   * 查找结构体字段的标签
   */
  private findStructTag(fieldDeclaration: Parser.SyntaxNode): Parser.SyntaxNode | null {
    for (const child of fieldDeclaration.children) {
      if (child.type === 'string_literal' || child.type === 'interpreted_string_literal' || child.type === 'raw_string_literal') {
        // 检查文本格式是否为struct标签（通常是 `key:"value"` 格式）
        const tagText = child.text;
        if (tagText && tagText.startsWith('`') && tagText.endsWith('`')) {
          return child;
        }
      }
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const annotationType = this.determineAnnotationType(astNode);

    if (annotationType === 'struct_tag') {
      if (astNode.parent) {
        const tag = this.findStructTag(astNode.parent);
        if (tag) {
          return astNode.parent.text || null;
        }
      }
      return astNode.text || null;
    } else if (annotationType === 'comment') {
      return astNode.text || null;
    }

    return null;
  }

  /**
   * 提取注解值
   */
  private extractAnnotationValue(astNode: Parser.SyntaxNode): string | null {
    const annotationType = this.determineAnnotationType(astNode);

    if (annotationType === 'struct_tag') {
      // 移除反引号
      const tagText = astNode.text?.replace(/[`]/g, '') || '';
      return tagText || null;
    } else if (annotationType === 'comment') {
      return astNode.text?.replace(/^\/\/\s?/, '') || null; // 移除注释前缀
    } else if (annotationType === 'build_directive') {
      return astNode.text?.replace(/^\/\/\s?/, '') || null;
    }

    return null;
  }

  /**
   * 查找与注释关联的节点
   */
  private findNodeAssociatedWithComment(commentNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 在Go中，注释通常位于其所描述的声明之前
    let currentNode = commentNode.nextNamedSibling;

    // 查找下一个有意义的声明
    while (currentNode) {
      if (this.isDeclarationNode(currentNode)) {
        return currentNode;
      }
      currentNode = currentNode.nextNamedSibling;
    }

    return null;
  }

  /**
   * 判断是否为声明节点
   */
  private isDeclarationNode(node: Parser.SyntaxNode): boolean {
    const declarationTypes = [
      'function_declaration',
      'method_declaration',
      'type_declaration',
      'var_declaration',
      'const_declaration',
      'field_declaration'
    ];

    return declarationTypes.includes(node.type);
  }

  /**
   * 判断是否为注解关系节点
   */
  private isAnnotationNode(astNode: Parser.SyntaxNode): boolean {
    const annotationNodeTypes = [
      'comment',
      'field_identifier', // 与struct标签关联的字段
      'string_literal',    // struct标签本身
      'interpreted_string_literal',
      'raw_string_literal'
    ];

    return annotationNodeTypes.includes(astNode.type);
  }

  /**
   * 提取struct标签信息
   */
  extractStructTagInfo(tagNode: Parser.SyntaxNode): {
    raw: string;
    parsed: { [key: string]: string };
    associatedField: string | null;
  } | null {
    if (!this.isStructTag(tagNode)) {
      return null;
    }

    const rawTag = tagNode.text?.replace(/[`]/g, '') || '';
    const parsed: { [key: string]: string } = {};

    // 简单解析key:"value"格式的标签
    const tagRegex = /(\w+):"([^"]*)"/g;
    let match;
    while ((match = tagRegex.exec(rawTag)) !== null) {
      parsed[match[1]] = match[2];
    }

    const associatedField = tagNode.parent?.type === 'field_declaration'
      ? this.extractFieldName(tagNode.parent)
      : null;

    return {
      raw: rawTag,
      parsed,
      associatedField
    };
  }

  /**
   * 提取字段名称
   */
  private extractFieldName(fieldDeclaration: Parser.SyntaxNode): string | null {
    for (const child of fieldDeclaration.children) {
      if (child.type === 'field_identifier' || child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 查找struct标签
   */
  findStructTags(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const tags: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (this.isStructTag(node)) {
        tags.push(node);
      }
    });

    return tags;
  }

  /**
   * 查找注释
   */
  findComments(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const comments: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'comment') {
        comments.push(node);
      }
    });

    return comments;
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
   * 分析注解关系
   */
  analyzeAnnotations(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    annotationType: string;
    annotationKind: string;
    target: string;
    annotationValue: string;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const annotations: Array<any> = [];
    const structTags = this.findStructTags(ast);
    const comments = this.findComments(ast);

    // 处理struct标签
    for (const tag of structTags) {
      const annotationMetadata = this.extractAnnotationMetadata(
        { captures: [{ node: tag }] },
        tag,
        { filePath }
      );

      if (annotationMetadata) {
        annotations.push({
          sourceId: annotationMetadata.fromNodeId,
          targetId: annotationMetadata.toNodeId,
          annotationType: annotationMetadata.annotationType,
          annotationKind: annotationMetadata.annotationKind,
          target: annotationMetadata.target,
          annotationValue: annotationMetadata.annotationValue,
          location: annotationMetadata.location
        });
      }
    }

    // 处理注释
    for (const comment of comments) {
      const annotationMetadata = this.extractAnnotationMetadata(
        { captures: [{ node: comment }] },
        comment,
        { filePath }
      );

      if (annotationMetadata) {
        annotations.push({
          sourceId: annotationMetadata.fromNodeId,
          targetId: annotationMetadata.toNodeId,
          annotationType: annotationMetadata.annotationType,
          annotationKind: annotationMetadata.annotationKind,
          target: annotationMetadata.target,
          annotationValue: annotationMetadata.annotationValue,
          location: annotationMetadata.location
        });
      }
    }

    return annotations;
  }
}