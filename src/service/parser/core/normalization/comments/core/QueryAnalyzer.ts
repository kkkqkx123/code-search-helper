import { QueryCapture, QueryResult, SemanticInfo } from '../types';
import { getQueryMapping } from '../config/QueryMappings';

/**
 * 查询结果分析器
 * 专门处理tree-sitter查询结果
 */
export class QueryAnalyzer {
  /**
   * 提取注释捕获
   */
  extractCommentCaptures(queryResult: QueryResult): QueryCapture[] {
    return queryResult.captures
      .filter(capture => this.isCommentCapture(capture))
      .map(capture => this.normalizeCapture(capture));
  }

  /**
   * 批量提取注释捕获
   */
  extractCommentCapturesBatch(queryResults: QueryResult[]): QueryCapture[] {
    const captures: QueryCapture[] = [];

    for (const result of queryResults) {
      captures.push(...this.extractCommentCaptures(result));
    }

    return captures;
  }

  /**
    * 判断是否为注释捕获
    */
  private isCommentCapture(capture: QueryCapture): boolean {
    return capture.name.startsWith('comment.');
  }

  /**
   * 标准化捕获信息
   */
  private normalizeCapture(capture: any): QueryCapture {
    return {
      name: capture.name,
      node: capture.node,
      text: capture.node.text || '',
      startPosition: {
        row: capture.node.startPosition?.row || 0,
        column: capture.node.startPosition?.column || 0
      },
      endPosition: {
        row: capture.node.endPosition?.row || 0,
        column: capture.node.endPosition?.column || 0
      }
    };
  }

  /**
   * 提取语义信息
   */
  extractSemanticInfo(capture: QueryCapture): SemanticInfo {
    const mapping = getQueryMapping(capture.name);

    if (!mapping) {
      return {
        type: 'unknown',
        confidence: 0.0,
        attributes: {}
      };
    }

    return {
      type: mapping.category,
      confidence: mapping.confidence,
      attributes: mapping.attributes || {}
    };
  }
}