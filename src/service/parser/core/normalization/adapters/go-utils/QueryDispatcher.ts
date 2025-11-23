/**
 * Go语言查询分流器
 * 负责根据查询类型分发到相应的查询模式
 */
import { SHARED_CALL_EXPRESSIONS, SHARED_FUNCTION_ANNOTATIONS } from '../../../../constants/queries/go/shared';

export class QueryDispatcher {
  /**
   * 根据查询类型获取相应的查询模式
   */
  static getQueryForType(queryType: string): string {
    // 处理调用相关查询
    if (this.isCallRelatedQuery(queryType)) {
      return SHARED_CALL_EXPRESSIONS;
    }

    // 处理函数注解相关查询
    if (this.isFunctionAnnotationQuery(queryType)) {
      return SHARED_FUNCTION_ANNOTATIONS;
    }

    // 处理Go特有的goroutine相关查询
    if (this.isGoroutineRelatedQuery(queryType)) {
      return SHARED_CALL_EXPRESSIONS; // goroutine调用也使用调用表达式
    }

    // 处理Go特有的channel相关查询
    if (this.isChannelRelatedQuery(queryType)) {
      return SHARED_CALL_EXPRESSIONS; // channel操作也使用调用表达式
    }

    // 返回空字符串表示不使用共享查询
    return '';
  }

  /**
   * 判断是否为调用相关查询
   */
  private static isCallRelatedQuery(queryType: string): boolean {
    const callRelatedPatterns = [
      'call',
      'function.call',
      'method.call',
      'interface.call',
      'struct.call',
      'package.call'
    ];

    return callRelatedPatterns.some(pattern =>
      queryType.toLowerCase().includes(pattern)
    );
  }

  /**
   * 判断是否为函数注解查询
   */
  private static isFunctionAnnotationQuery(queryType: string): boolean {
    const annotationRelatedPatterns = [
      'annotation.function',
      'function.annotation',
      'doc.comment',
      'build.tag'
    ];

    return annotationRelatedPatterns.some(pattern =>
      queryType.toLowerCase().includes(pattern)
    );
  }

  /**
   * 判断是否为goroutine相关查询
   */
  private static isGoroutineRelatedQuery(queryType: string): boolean {
    const goroutineRelatedPatterns = [
      'goroutine',
      'go.call',
      'concurrency.goroutine',
      'async.goroutine'
    ];

    return goroutineRelatedPatterns.some(pattern =>
      queryType.toLowerCase().includes(pattern)
    );
  }

  /**
   * 判断是否为channel相关查询
   */
  private static isChannelRelatedQuery(queryType: string): boolean {
    const channelRelatedPatterns = [
      'channel',
      'chan.operation',
      'select.statement',
      'concurrency.channel'
    ];

    return channelRelatedPatterns.some(pattern =>
      queryType.toLowerCase().includes(pattern)
    );
  }

  /**
   * 合并查询 - 将共享查询与特定查询合并
   */
  static mergeQueries(baseQuery: string, queryType: string): string {
    const sharedQuery = this.getQueryForType(queryType);

    if (!sharedQuery) {
      return baseQuery;
    }

    // 避免重复查询
    if (baseQuery.includes(sharedQuery.trim())) {
      return baseQuery;
    }

    return `${baseQuery}\n\n${sharedQuery}`;
  }
}