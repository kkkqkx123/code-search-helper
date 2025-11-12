import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Rust注解关系提取器
 * 处理Rust属性、宏、文档注释等
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
    const annotationName = this.extractAnnotationName(astNode);
    const parameters = this.extractAnnotationParameters(astNode);

    return {
      type: 'annotation',
      fromNodeId,
      toNodeId,
      annotationType,
      annotationName,
      parameters,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
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
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'attribute' | 'derive' | 'macro' | 'doc_comment' | null {
    const nodeType = astNode.type;
    const text = astNode.text || '';

    if (nodeType === 'attribute_item' || nodeType === 'inner_attribute_item' || nodeType === 'outer_attribute_item') {
      if (text.includes('derive')) {
        return 'derive';
      }
      return 'attribute';
    } else if (nodeType === 'macro_invocation') {
      return 'macro';
    } else if (nodeType === 'line_comment' || nodeType === 'block_comment') {
      if (text.startsWith('///') || text.startsWith('/**')) {
        return 'doc_comment';
      }
    }

    return null;
  }

  /**
   * 提取注解关系的节点
   */
  private extractAnnotationNodes(astNode: Parser.SyntaxNode, annotationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    if (annotationType === 'attribute' || annotationType === 'derive') {
      const attributeName = this.extractAnnotationName(astNode);
      if (attributeName) {
        toNodeId = NodeIdGenerator.forSymbol(attributeName, 'attribute', 'current_file.rs', 0);
      }
    } else if (annotationType === 'macro') {
      const macroName = this.extractMacroName(astNode);
      if (macroName) {
        toNodeId = NodeIdGenerator.forSymbol(macroName, 'macro', 'current_file.rs', 0);
      }
    } else if (annotationType === 'doc_comment') {
      toNodeId = NodeIdGenerator.forSymbol('doc_comment', 'doc_comment', 'current_file.rs', 0);
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'attribute_item' || astNode.type === 'inner_attribute_item' || astNode.type === 'outer_attribute_item') {
      // 查找属性名称
      for (const child of astNode.children) {
        if (child.type === 'identifier' || child.type === 'scoped_identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取宏名称
   */
  private extractMacroName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'macro_invocation') {
      const macroNode = astNode.childForFieldName('macro');
      if (macroNode?.type === 'identifier' || macroNode?.type === 'scoped_identifier') {
        return `${macroNode.text}!`;
      }
    }
    return null;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationParameters(astNode: Parser.SyntaxNode): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (astNode.type === 'attribute_item' || astNode.type === 'inner_attribute_item' || astNode.type === 'outer_attribute_item') {
      // 处理属性参数
      const annotationType = this.determineAnnotationType(astNode);
      
      if (annotationType === 'derive') {
        parameters.deriveTraits = this.extractDeriveTraits(astNode);
      } else {
        parameters.args = this.extractAttributeArguments(astNode);
      }
    } else if (astNode.type === 'macro_invocation') {
      // 处理宏参数
      parameters.args = this.extractMacroArguments(astNode);
    } else if (astNode.type === 'line_comment' || astNode.type === 'block_comment') {
      // 处理文档注释
      parameters.content = astNode.text;
      parameters.isDocComment = true;
      parameters.isInnerDoc = astNode.text.startsWith('//!') || astNode.text.startsWith('/*!');
    }

    return parameters;
  }

  /**
   * 提取derive特征
   */
  private extractDeriveTraits(astNode: Parser.SyntaxNode): string[] {
    const traits: string[] = [];
    
    for (const child of astNode.children) {
      if (child.type === 'token_tree' || child.type === 'arguments') {
        for (const subChild of child.children) {
          if (subChild.type === 'identifier' || subChild.type === 'scoped_identifier') {
            traits.push(subChild.text || '');
          }
        }
      }
    }
    
    return traits;
  }

  /**
   * 提取属性参数
   */
  private extractAttributeArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];
    
    for (const child of astNode.children) {
      if (child.type === 'token_tree' || child.type === 'arguments') {
        for (const subChild of child.children) {
          if (subChild.type !== 'comment' && subChild.type !== ',' && subChild.type !== '(' && subChild.type !== ')') {
            args.push({
              type: subChild.type,
              text: subChild.text
            });
          }
        }
      }
    }
    
    return args;
  }

  /**
   * 提取宏参数
   */
  private extractMacroArguments(astNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];
    
    for (const child of astNode.children) {
      if (child.type === 'token_tree') {
        for (const subChild of child.children) {
          if (subChild.type !== 'comment' && subChild.type !== ',' && subChild.type !== '(' && subChild.type !== ')') {
            args.push({
              type: subChild.type,
              text: subChild.text
            });
          }
        }
      }
    }
    
    return args;
  }

  /**
   * 判断是否为注解关系节点
   */
  private isAnnotationNode(astNode: Parser.SyntaxNode): boolean {
    const annotationNodeTypes = [
      'attribute_item',
      'inner_attribute_item',
      'outer_attribute_item',
      'macro_invocation',
      'line_comment',
      'block_comment'
    ];

    return annotationNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

  /**
   * 查找属性声明
   */
  findAttributeDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const attributes: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'attribute_item' || node.type === 'inner_attribute_item' || node.type === 'outer_attribute_item') {
        attributes.push(node);
      }
    });

    return attributes;
  }

  /**
   * 查找derive属性
   */
  findDeriveAttributes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const deriveAttributes: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if ((node.type === 'attribute_item' || node.type === 'inner_attribute_item' || node.type === 'outer_attribute_item') &&
          node.text && node.text.includes('derive')) {
        deriveAttributes.push(node);
      }
    });

    return deriveAttributes;
  }

  /**
   * 查找宏调用
   */
  findMacroInvocations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const macroInvocations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'macro_invocation') {
        macroInvocations.push(node);
      }
    });

    return macroInvocations;
  }

  /**
   * 查找文档注释
   */
  findDocComments(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const docComments: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if ((node.type === 'line_comment' || node.type === 'block_comment') &&
          node.text && (node.text.startsWith('///') || node.text.startsWith('/**'))) {
        docComments.push(node);
      }
    });

    return docComments;
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
    annotationName: string;
    parameters: Record<string, any>;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const annotations: Array<any> = [];

    // 查找所有属性声明
    const attributeDeclarations = this.findAttributeDeclarations(ast);
    for (const attrDecl of attributeDeclarations) {
      const annotationName = this.extractAnnotationName(attrDecl);
      const annotationType = this.determineAnnotationType(attrDecl);
      const parameters = this.extractAnnotationParameters(attrDecl);

      if (annotationName && annotationType) {
        annotations.push({
          sourceId: NodeIdGenerator.forAstNode(attrDecl),
          targetId: NodeIdGenerator.forSymbol(annotationName, 'attribute', filePath, 0),
          annotationType,
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: attrDecl.startPosition.row + 1,
            columnNumber: attrDecl.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有宏调用
    const macroInvocations = this.findMacroInvocations(ast);
    for (const macroInvocation of macroInvocations) {
      const macroName = this.extractMacroName(macroInvocation);
      const annotationType = this.determineAnnotationType(macroInvocation);
      const parameters = this.extractAnnotationParameters(macroInvocation);

      if (macroName && annotationType) {
        annotations.push({
          sourceId: NodeIdGenerator.forAstNode(macroInvocation),
          targetId: NodeIdGenerator.forSymbol(macroName, 'macro', filePath, 0),
          annotationType,
          annotationName: macroName,
          parameters,
          location: {
            filePath,
            lineNumber: macroInvocation.startPosition.row + 1,
            columnNumber: macroInvocation.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有文档注释
    const docComments = this.findDocComments(ast);
    for (const docComment of docComments) {
      const annotationType = this.determineAnnotationType(docComment);
      const parameters = this.extractAnnotationParameters(docComment);

      if (annotationType) {
        annotations.push({
          sourceId: NodeIdGenerator.forAstNode(docComment),
          targetId: NodeIdGenerator.forSymbol('doc_comment', 'doc_comment', filePath, 0),
          annotationType,
          annotationName: 'doc_comment',
          parameters,
          location: {
            filePath,
            lineNumber: docComment.startPosition.row + 1,
            columnNumber: docComment.startPosition.column + 1
          }
        });
      }
    }

    return annotations;
  }
}