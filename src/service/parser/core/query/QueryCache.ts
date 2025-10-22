import Parser from 'tree-sitter';
import { createCache } from '../../../../utils/cache';

/**
 * 统一查询缓存管理器
 * 负责管理所有查询相关的缓存，包括：
 * 1. 预编译查询对象缓存 (Parser.Query)
 * 2. 查询结果缓存 (QueryResult)
 * 3. 提供统一的缓存统计和管理接口
 */
export class QueryCache {
  // 预编译查询对象缓存
  private static queryCache = createCache<string, Parser.Query>('stats-decorated', 200, {
    enableStats: true
  });
  
  // 查询结果缓存 - 改为静态，供所有引擎实例共享
  private static resultCache = createCache<string, any>('stats-decorated', 500, {
    enableStats: true
  });

  static getQuery(language: Parser.Language, pattern: string): Parser.Query {
    const key = `${language.name}:${this.hashPattern(pattern)}`;

    const cached = this.queryCache.get(key);
    if (cached) {
      return cached;
    }

    const query = new Parser.Query(language, pattern);
    this.queryCache.set(key, query);
    return query;
  }

  static getStats() {
    const stats = this.queryCache.getStats();
    if (!stats) {
      return {
        hits: 0,
        misses: 0,
        total: 0,
        hitRate: '0.00%',
        cacheSize: 0
      };
    }

    // 对于StatsDecorator，hitRate已经计算好了
    let hitRate: string;
    if (typeof (stats as any).hitRate === 'number') {
      hitRate = ((stats as any).hitRate * 100).toFixed(2);
    } else {
      const totalRequests = (stats as any).gets || (stats.hits + stats.misses);
      hitRate = totalRequests > 0 ? ((stats.hits / totalRequests) * 100).toFixed(2) : '0.00';
    }

    const total = (stats as any).gets || (stats.hits + stats.misses);

    return {
      hits: stats.hits,
      misses: stats.misses,
      total,
      hitRate: `${hitRate}%`,
      cacheSize: stats.size
    };
  }

  static clearCache(): void {
    this.queryCache.clear();
    this.resultCache.clear();
  }

  // 结果缓存管理方法
  static getResult(key: string): any {
    return this.resultCache.get(key);
  }

  static setResult(key: string, result: any): void {
    this.resultCache.set(key, result);
  }

  static getResultStats(): any {
    return this.resultCache.getStats();
  }

  // 统一的缓存统计信息
  static getAllStats(): {
    queryCache: any;
    resultCache: any;
    combined: any;
  } {
    const queryStats = this.queryCache.getStats();
    const resultStats = this.resultCache.getStats();
    
    // 计算合并的统计信息
    const combined = {
      totalHits: (queryStats?.hits || 0) + (resultStats?.hits || 0),
      totalMisses: (queryStats?.misses || 0) + (resultStats?.misses || 0),
      totalSize: (queryStats?.size || 0) + (resultStats?.size || 0),
      overallHitRate: '0.00%'
    };
    
    const totalRequests = combined.totalHits + combined.totalMisses;
    combined.overallHitRate = totalRequests > 0 ? (combined.totalHits / totalRequests * 100).toFixed(2) + '%' : '0.00%';
    
    return {
      queryCache: queryStats,
      resultCache: resultStats,
      combined
    };
  }

  private static hashPattern(pattern: string): string {
    // 简单的哈希算法，用于生成缓存键
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }
}