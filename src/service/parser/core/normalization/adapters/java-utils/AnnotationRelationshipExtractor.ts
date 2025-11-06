import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Java注解关系提取器
 * 处理Java注解(Annotations)、元数据注解和编译器指令
 */
export class JavaAnnotationRelationshipExtractor {
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
        filePath: symbolTable?.filePath || 'current_file.java',
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
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'annotation' | 'marker_annotation' | 'compiler_directive' | null {
    const nodeType = astNode.type;

    if (nodeType === 'annotation') {
      return 'annotation';
    } else if (nodeType === 'marker_annotation') {
      return 'marker_annotation';
    }

    return null;
  }

  /**
   * 提取注解关系的节点
   */
  private extractAnnotationNodes(astNode: Parser.SyntaxNode, annotationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (annotationType === 'annotation' || annotationType === 'marker_annotation') {
      const annotationName = this.extractAnnotationName(astNode);
      if (annotationName) {
        toNodeId = this.generateNodeId(annotationName, 'annotation', 'current_file.java');
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'annotation' || astNode.type === 'marker_annotation') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode) {
        return nameNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationParameters(astNode: Parser.SyntaxNode): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (astNode.type === 'annotation') {
      const argumentList = astNode.childForFieldName('arguments');
      if (argumentList) {
        parameters.arguments = this.extractAnnotationArguments(argumentList);
      }
    }

    return parameters;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationArguments(argumentList: Parser.SyntaxNode): any[] {
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
      'annotation',
      'marker_annotation'
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
   * 查找注解声明
   */
  findAnnotationDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const annotations: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'annotation' || node.type === 'marker_annotation') {
        annotations.push(node);
      }
    });
    
    return annotations;
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

    // 查找所有注解声明
    const annotationDeclarations = this.findAnnotationDeclarations(ast);
    for (const annotationDecl of annotationDeclarations) {
      const annotationName = this.extractAnnotationName(annotationDecl);
      const annotationType = this.determineAnnotationType(annotationDecl);
      const parameters = this.extractAnnotationParameters(annotationDecl);

      if (annotationName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(annotationDecl),
          targetId: this.generateNodeId(annotationName, 'annotation', filePath),
          annotationType,
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: annotationDecl.startPosition.row + 1,
            columnNumber: annotationDecl.startPosition.column + 1
          }
        });
      }
    }

    return annotations;
  }
}