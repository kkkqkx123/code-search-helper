import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C#注解关系提取器
 * 处理C#特性(Attributes)、元数据注解和编译器指令
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
        filePath: symbolTable?.filePath || 'current_file.cs',
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
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'attribute' | 'compiler_directive' | 'metadata' | null {
    const nodeType = astNode.type;

    if (nodeType === 'attribute' || nodeType === 'attribute_list') {
      return 'attribute';
    } else if (nodeType === 'preproc_directive') {
      return 'compiler_directive';
    } else if (nodeType === 'extern_alias_directive') {
      return 'metadata';
    }

    return null;
  }

  /**
   * 提取注解关系的节点
   */
  private extractAnnotationNodes(astNode: Parser.SyntaxNode, annotationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (annotationType === 'attribute') {
      const attributeName = this.extractAnnotationName(astNode);
      if (attributeName) {
        toNodeId = this.generateNodeId(attributeName, 'attribute', 'current_file.cs');
      }
    } else if (annotationType === 'compiler_directive') {
      const directiveName = this.extractDirectiveName(astNode);
      if (directiveName) {
        toNodeId = this.generateNodeId(directiveName, 'directive', 'current_file.cs');
      }
    } else if (annotationType === 'metadata') {
      const metadataName = this.extractMetadataName(astNode);
      if (metadataName) {
        toNodeId = this.generateNodeId(metadataName, 'metadata', 'current_file.cs');
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'attribute') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode) {
        return nameNode.text || null;
      }
    } else if (astNode.type === 'attribute_list') {
      // 查找属性列表中的第一个属性
      for (const child of astNode.children) {
        if (child.type === 'attribute') {
          const nameNode = child.childForFieldName('name');
          if (nameNode) {
            return nameNode.text || null;
          }
        }
      }
    }
    return null;
  }

  /**
   * 提取指令名称
   */
  private extractDirectiveName(astNode: Parser.SyntaxNode): string | null {
    // 对于预处理器指令，提取指令类型
    const text = astNode.text;
    if (text.startsWith('#')) {
      const parts = text.split(/\s+/);
      return parts[0].substring(1); // 移除#号
    }
    return null;
  }

  /**
   * 提取元数据名称
   */
  private extractMetadataName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'extern_alias_directive') {
      const identifier = astNode.childForFieldName('identifier');
      if (identifier) {
        return identifier.text || null;
      }
    }
    return null;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationParameters(astNode: Parser.SyntaxNode): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (astNode.type === 'attribute') {
      const argumentList = astNode.childForFieldName('arguments');
      if (argumentList) {
        parameters.arguments = this.extractAttributeArguments(argumentList);
      }
    } else if (astNode.type === 'attribute_list') {
      const attributes: any[] = [];
      for (const child of astNode.children) {
        if (child.type === 'attribute') {
          const attributeName = this.extractAnnotationName(child);
          const argumentList = child.childForFieldName('arguments');
          const args = argumentList ? this.extractAttributeArguments(argumentList) : [];

          attributes.push({
            name: attributeName,
            arguments: args
          });
        }
      }
      parameters.attributes = attributes;
    } else if (astNode.type === 'preproc_directive') {
      const text = astNode.text;
      const parts = text.split(/\s+/);
      if (parts.length > 1) {
        parameters.directiveArgs = parts.slice(1);
      }
    }

    return parameters;
  }

  /**
   * 提取特性参数
   */
  private extractAttributeArguments(argumentList: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of argumentList.children) {
      if (child.type === 'argument') {
        args.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return args;
  }

  /**
   * 判断是否为注解关系节点
   */
  private isAnnotationNode(astNode: Parser.SyntaxNode): boolean {
    const annotationNodeTypes = [
      'attribute',
      'attribute_list',
      'preproc_directive',
      'extern_alias_directive'
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
   * 查找特性声明
   */
  findAttributeDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const attributes: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'attribute' || node.type === 'attribute_list') {
        attributes.push(node);
      }
    });

    return attributes;
  }

  /**
   * 查找预处理器指令
   */
  findPreprocessorDirectives(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const directives: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'preproc_directive') {
        directives.push(node);
      }
    });

    return directives;
  }

  /**
   * 查找外部别名指令
   */
  findExternAliasDirectives(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const externAliases: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'extern_alias_directive') {
        externAliases.push(node);
      }
    });

    return externAliases;
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

    // 查找所有特性声明
    const attributeDeclarations = this.findAttributeDeclarations(ast);
    for (const attrDecl of attributeDeclarations) {
      const annotationName = this.extractAnnotationName(attrDecl);
      const annotationType = this.determineAnnotationType(attrDecl);
      const parameters = this.extractAnnotationParameters(attrDecl);

      if (annotationName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(attrDecl),
          targetId: this.generateNodeId(annotationName, 'attribute', filePath),
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

    // 查找所有预处理器指令
    const preprocessorDirectives = this.findPreprocessorDirectives(ast);
    for (const directive of preprocessorDirectives) {
      const directiveName = this.extractDirectiveName(directive);
      const annotationType = this.determineAnnotationType(directive);
      const parameters = this.extractAnnotationParameters(directive);

      if (directiveName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(directive),
          targetId: this.generateNodeId(directiveName, 'directive', filePath),
          annotationType,
          annotationName: directiveName,
          parameters,
          location: {
            filePath,
            lineNumber: directive.startPosition.row + 1,
            columnNumber: directive.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有外部别名指令
    const externAliasDirectives = this.findExternAliasDirectives(ast);
    for (const externAlias of externAliasDirectives) {
      const metadataName = this.extractMetadataName(externAlias);
      const annotationType = this.determineAnnotationType(externAlias);
      const parameters = this.extractAnnotationParameters(externAlias);

      if (metadataName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(externAlias),
          targetId: this.generateNodeId(metadataName, 'metadata', filePath),
          annotationType,
          annotationName: metadataName,
          parameters,
          location: {
            filePath,
            lineNumber: externAlias.startPosition.row + 1,
            columnNumber: externAlias.startPosition.column + 1
          }
        });
      }
    }

    return annotations;
  }
}