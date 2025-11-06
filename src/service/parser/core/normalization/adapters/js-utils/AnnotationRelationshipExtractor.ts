/**
 * JavaScript/TypeScript 注解关系提取器
 * 提取代码中的注解、注释和指令关系
 */
export class AnnotationRelationshipExtractor {
  extractAnnotationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'comment' | 'jsdoc' | 'directive';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'comment' | 'jsdoc' | 'directive';
    }> = [];

    const captures = result.captures;
    if (!captures || !Array.isArray(captures)) {
      return relationships;
    }

    for (const capture of captures) {
      if (capture.name && capture.node?.text) {
        // 提取注释关系
        if (capture.name.includes('comment') || capture.node.type === 'comment') {
          relationships.push({
            source: capture.node.text,
            target: this.extractTargetFromComment(capture.node),
            type: 'comment'
          });
        }

        // 提取JSDoc关系
        if (capture.name.includes('jsdoc') || (capture.node.type === 'comment' && capture.node.text.includes('@'))) {
          relationships.push({
            source: capture.node.text,
            target: this.extractTargetFromJSDoc(capture.node),
            type: 'jsdoc'
          });
        }

        // 提取指令关系（如 "use strict"）
        if (capture.name.includes('directive') || capture.node.type === 'expression_statement') {
          const text = capture.node.text;
          if (text.includes('use')) {
            relationships.push({
              source: text,
              target: 'strict-mode',
              type: 'directive'
            });
          }
        }
      }
    }

    return relationships;
  }

  private extractTargetFromComment(node: any): string {
    // 从注释中提取目标信息
    const text = node.text || '';
    // 简单地返回注释中提到的标识符
    const matches = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    return matches.length > 0 ? matches[0] : 'unknown';
  }

  private extractTargetFromJSDoc(node: any): string {
    // 从JSDoc中提取目标信息
    const text = node.text || '';
    // 提取 @param, @return 等标签的目标
    const paramMatch = text.match(/@param\s+\{[^\}]+\}\s+(\w+)/);
    if (paramMatch) {
      return paramMatch[1];
    }

    const returnMatch = text.match(/@return\s+\{[^\}]+\}\s+(\w+)?/);
    if (returnMatch) {
      return returnMatch[1] || 'return-value';
    }

    return 'jsdoc-target';
  }

  extractAnnotationMetadata(result: any, astNode: any, symbolTable: any): any {
    // 提取注解元数据
    return {
      type: 'annotation',
      annotationText: astNode?.text || '',
      annotationType: this.getAnnotationType(astNode),
      location: {
        startLine: astNode?.startPosition?.row + 1,
        endLine: astNode?.endPosition?.row + 1,
      }
    };
  }

  private getAnnotationType(node: any): string {
    if (!node) return 'comment';

    const text = node.text || '';
    if (text.includes('/**') && text.includes('@')) {
      return 'jsdoc';
    } else if (text.includes('//') || text.includes('/*')) {
      return 'comment';
    } else if (text.includes('use')) {
      return 'directive';
    }
    return 'comment';
  }
}