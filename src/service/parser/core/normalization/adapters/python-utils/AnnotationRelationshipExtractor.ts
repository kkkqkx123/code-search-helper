import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Python注解关系提取器
 * 处理Python装饰器、类型注解和文档字符串
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
        filePath: symbolTable?.filePath || 'current_file.py',
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
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'decorator' | 'type_annotation' | 'docstring' | null {
    const nodeType = astNode.type;

    if (nodeType === 'decorator') {
      return 'decorator';
    } else if (nodeType === 'type_annotation') {
      return 'type_annotation';
    } else if (nodeType === 'string' && this.isDocstring(astNode)) {
      return 'docstring';
    }

    return null;
  }

  /**
   * 提取注解关系的节点
   */
  private extractAnnotationNodes(astNode: Parser.SyntaxNode, annotationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (annotationType === 'decorator') {
      const decoratorName = this.extractAnnotationName(astNode);
      if (decoratorName) {
        toNodeId = this.generateNodeId(decoratorName, 'decorator', 'current_file.py');
      }
    } else if (annotationType === 'type_annotation') {
      const typeName = this.extractTypeName(astNode);
      if (typeName) {
        toNodeId = this.generateNodeId(typeName, 'type', 'current_file.py');
      }
    } else if (annotationType === 'docstring') {
      const docstringContent = this.extractDocstringContent(astNode);
      if (docstringContent) {
        toNodeId = this.generateNodeId('docstring', 'docstring', 'current_file.py');
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'decorator') {
      // 对于装饰器，提取装饰器名称
      for (const child of astNode.children) {
        if (child.type === 'identifier' || child.type === 'attribute' || child.type === 'call') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取类型名称
   */
  private extractTypeName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'type_annotation') {
      // 对于类型注解，提取类型信息
      for (const child of astNode.children) {
        if (child.type === 'type' || child.type === 'identifier' || child.type === 'union_type') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取文档字符串内容
   */
  private extractDocstringContent(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'string') {
      return astNode.text || null;
    }
    return null;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationParameters(astNode: Parser.SyntaxNode): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (astNode.type === 'decorator') {
      for (const child of astNode.children) {
        if (child.type === 'call') {
          // 处理装饰器参数
          const args = this.extractCallArguments(child);
          parameters.args = args;
          break;
        }
      }
    } else if (astNode.type === 'type_annotation') {
      // 处理类型注解参数
      const typeInfo = this.extractTypeInfo(astNode);
      parameters.typeInfo = typeInfo;
    } else if (astNode.type === 'string') {
      // 处理文档字符串
      parameters.content = astNode.text;
      parameters.isDocstring = true;
    }

    return parameters;
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(callNode: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of callNode.children) {
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
   * 提取类型信息
   */
  private extractTypeInfo(typeAnnotationNode: Parser.SyntaxNode): any {
    const typeInfo: any = {};

    for (const child of typeAnnotationNode.children) {
      if (child.type === 'type') {
        typeInfo.type = child.text;
        typeInfo.isUnion = false; // Default value
        typeInfo.isGeneric = child.text.includes('[') && child.text.includes(']');
      } else if (child.type === 'union_type') {
        typeInfo.type = child.text;
        typeInfo.isUnion = true;
        typeInfo.isGeneric = child.text.includes('[') && child.text.includes(']');
      }
    }

    return typeInfo;
  }

  /**
   * 判断是否为文档字符串
   */
  private isDocstring(astNode: Parser.SyntaxNode): boolean {
    // 简单启发式：检查是否是函数或类定义的第一个字符串
    const parent = astNode.parent;
    if (!parent) return false;

    if (parent.type === 'function_definition' || parent.type === 'class_definition') {
      // 检查是否是第一个语句
      const firstChild = parent.childForFieldName('body')?.children?.[0];
      return firstChild === astNode;
    }

    return false;
  }

  /**
   * 判断是否为注解关系节点
   */
  private isAnnotationNode(astNode: Parser.SyntaxNode): boolean {
    const annotationNodeTypes = [
      'decorator',
      'type_annotation',
      'string'
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
   * 查找装饰器声明
   */
  findDecoratorDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const decorators: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'decorator') {
        decorators.push(node);
      }
    });

    return decorators;
  }

  /**
   * 查找类型注解
   */
  findTypeAnnotations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const typeAnnotations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'type_annotation') {
        typeAnnotations.push(node);
      }
    });

    return typeAnnotations;
  }

  /**
   * 查找文档字符串
   */
  findDocstrings(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const docstrings: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'string' && this.isDocstring(node)) {
        docstrings.push(node);
      }
    });

    return docstrings;
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

    // 查找所有装饰器
    const decoratorDeclarations = this.findDecoratorDeclarations(ast);
    for (const decoratorDecl of decoratorDeclarations) {
      const annotationName = this.extractAnnotationName(decoratorDecl);
      const annotationType = this.determineAnnotationType(decoratorDecl);
      const parameters = this.extractAnnotationParameters(decoratorDecl);

      if (annotationName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(decoratorDecl),
          targetId: this.generateNodeId(annotationName, 'decorator', filePath),
          annotationType,
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: decoratorDecl.startPosition.row + 1,
            columnNumber: decoratorDecl.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有类型注解
    const typeAnnotations = this.findTypeAnnotations(ast);
    for (const typeAnnotation of typeAnnotations) {
      const typeName = this.extractTypeName(typeAnnotation);
      const annotationType = this.determineAnnotationType(typeAnnotation);
      const parameters = this.extractAnnotationParameters(typeAnnotation);

      if (typeName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(typeAnnotation),
          targetId: this.generateNodeId(typeName, 'type', filePath),
          annotationType,
          annotationName: typeName,
          parameters,
          location: {
            filePath,
            lineNumber: typeAnnotation.startPosition.row + 1,
            columnNumber: typeAnnotation.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有文档字符串
    const docstrings = this.findDocstrings(ast);
    for (const docstring of docstrings) {
      const annotationType = this.determineAnnotationType(docstring);
      const parameters = this.extractAnnotationParameters(docstring);

      if (annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(docstring),
          targetId: this.generateNodeId('docstring', 'docstring', filePath),
          annotationType,
          annotationName: 'docstring',
          parameters,
          location: {
            filePath,
            lineNumber: docstring.startPosition.row + 1,
            columnNumber: docstring.startPosition.column + 1
          }
        });
      }
    }

    return annotations;
  }
}