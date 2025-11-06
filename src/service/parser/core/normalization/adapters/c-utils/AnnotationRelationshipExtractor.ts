import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言注解关系提取器
 * 处理C11属性说明符和类型注解
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
        filePath: symbolTable?.filePath || 'current_file.c',
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
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'attribute' | 'type_annotation' | null {
    const nodeType = astNode.type;

    if (nodeType === 'attribute_declaration' || nodeType === 'attribute_specifier') {
      return 'attribute';
    } else if (nodeType === 'type_definition' || nodeType === 'type_declaration') {
      return 'type_annotation';
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
        toNodeId = this.generateNodeId(attributeName, 'attribute', 'current_file.c');
      }
    } else if (annotationType === 'type_annotation') {
      const typeName = this.extractTypeName(astNode);
      if (typeName) {
        toNodeId = this.generateNodeId(typeName, 'type', 'current_file.c');
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.children && astNode.children.length > 0) {
      for (const child of astNode.children) {
        if (child.type === 'identifier') {
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
    if (astNode.children && astNode.children.length > 0) {
      for (const child of astNode.children) {
        if (child.type === 'type_identifier' || child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationParameters(astNode: Parser.SyntaxNode): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const child of astNode.children) {
      if (child.type === 'argument_list') {
        // 处理属性参数
        const args = this.extractCallArguments(child);
        parameters.args = args;
        break;
      }
    }

    return parameters;
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(argList: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of argList.children) {
      if (child.type !== 'comment') { // 排除注释
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
      'attribute_declaration',
      'attribute_specifier',
      'type_definition',
      'type_declaration'
    ];

    return annotationNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}