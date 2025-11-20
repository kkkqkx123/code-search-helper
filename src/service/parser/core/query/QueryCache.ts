import Parser from 'tree-sitter';
import { createCache } from '../../../../utils/cache';
import { CacheKeyUtils } from '../../../../utils/cache/CacheKeyUtils';

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

  // AST对象缓存
  private static astCache = createCache<string, Parser.SyntaxNode>('stats-decorated', 200, {
    enableStats: true
  });

  static getQuery(language: Parser.Language, pattern: string): Parser.Query {
    const key = `${language.name}:${this.hashPattern(pattern)}`;

    const cached = this.queryCache.get(key);
    if (cached) {
      return cached;
    }

    try {
      const query = new Parser.Query(language, pattern);
      this.queryCache.set(key, query);
      return query;
    } catch (error) {
      console.error('QueryCache.getQuery error - failed to create Parser.Query:', error);
      console.error('Language:', language?.name);
      console.error('Pattern:', pattern.substring(0, 200) + (pattern.length > 200 ? '...' : '')); // 只显示前200个字符
      throw error; // 重新抛出错误，让上层处理
    }
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
    this.astCache.clear();
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

  // AST缓存管理方法
  static getAst(key: string): Parser.SyntaxNode | undefined {
    return this.astCache.get(key);
  }

  static setAst(key: string, ast: Parser.SyntaxNode): void {
    this.astCache.set(key, ast);
  }

  static getAstStats(): any {
    return this.astCache.getStats();
  }

  // 统一的缓存统计信息
  static getAllStats(): {
    queryCache: any;
    resultCache: any;
    astCache: any;
    combined: any;
  } {
    const queryStats = this.queryCache.getStats();
    const resultStats = this.resultCache.getStats();
    const astStats = this.astCache.getStats();

    // 计算合并的统计信息
    const combined = {
      totalHits: (queryStats?.hits || 0) + (resultStats?.hits || 0) + (astStats?.hits || 0),
      totalMisses: (queryStats?.misses || 0) + (resultStats?.misses || 0) + (astStats?.misses || 0),
      totalSize: (queryStats?.size || 0) + (resultStats?.size || 0) + (astStats?.size || 0),
      overallHitRate: '0.00%'
    };

    const totalRequests = combined.totalHits + combined.totalMisses;
    combined.overallHitRate = totalRequests > 0 ? (combined.totalHits / totalRequests * 100).toFixed(2) + '%' : '0.00%';

    return {
      queryCache: queryStats,
      resultCache: resultStats,
      astCache: astStats,
      combined
    };
  }

  private static hashPattern(pattern: string): string {
    return CacheKeyUtils.generateCacheKey(pattern);
  }
}