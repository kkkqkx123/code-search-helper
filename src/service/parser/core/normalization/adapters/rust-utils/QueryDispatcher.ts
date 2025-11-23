/**
 * Rust语言查询分流器
 * 负责根据查询类型分发到相应的查询模式
 */
import { SHARED_CALL_EXPRESSIONS, SHARED_FUNCTION_ANNOTATIONS } from '../../../../constants/queries/rust/shared';

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
    
    // 处理Rust特有的macro相关查询
    if (this.isMacroRelatedQuery(queryType)) {
      return SHARED_CALL_EXPRESSIONS; // macro调用也使用调用表达式
    }
    
    // 处理Rust特有的trait相关查询
    if (this.isTraitRelatedQuery(queryType)) {
      return SHARED_CALL_EXPRESSIONS; // trait实现也使用调用表达式
    }
    
    // 处理Rust特有的lifetime相关查询
    if (this.isLifetimeRelatedQuery(queryType)) {
      return SHARED_CALL_EXPRESSIONS; // lifetime注解也使用调用表达式
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
      'trait.call',
      'struct.call',
      'module.call',
      'macro.call'
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
      'attribute.function'
    ];
    
    return annotationRelatedPatterns.some(pattern => 
      queryType.toLowerCase().includes(pattern)
    );
  }
  
  /**
   * 判断是否为macro相关查询
   */
  private static isMacroRelatedQuery(queryType: string): boolean {
    const macroRelatedPatterns = [
      'macro',
      'macro.call',
      'macro.definition',
      'macro.invocation',
      'derive.macro'
    ];
    
    return macroRelatedPatterns.some(pattern => 
      queryType.toLowerCase().includes(pattern)
    );
  }
  
  /**
   * 判断是否为trait相关查询
   */
  private static isTraitRelatedQuery(queryType: string): boolean {
    const traitRelatedPatterns = [
      'trait',
      'trait.implementation',
      'trait.method',
      'trait.bound',
      'generic.trait'
    ];
    
    return traitRelatedPatterns.some(pattern => 
      queryType.toLowerCase().includes(pattern)
    );
  }
  
  /**
   * 判断是否为lifetime相关查询
   */
  private static isLifetimeRelatedQuery(queryType: string): boolean {
    const lifetimeRelatedPatterns = [
      'lifetime',
      'lifetime.annotation',
      'lifetime.parameter',
      'lifetime.bound'
    ];
    
    return lifetimeRelatedPatterns.some(pattern => 
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