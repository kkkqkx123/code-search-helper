import Parser from 'tree-sitter';
import { createCache } from '../../../../utils/cache';

/**
 * 预编译查询缓存
 * 避免重复创建Parser.Query实例
 * 使用项目现有的缓存模块
 */
export class QueryCache {
  private static cache = createCache<string, Parser.Query>('stats-decorated', 200, {
    enableStats: true
  });

  static getQuery(language: Parser.Language, pattern: string): Parser.Query {
    const key = `${language.name}:${this.hashPattern(pattern)}`;
    
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const query = new Parser.Query(language, pattern);
    this.cache.set(key, query);
    return query;
  }

  static getStats() {
    const stats = this.cache.getStats();
    if (!stats) {
      return {
        hits: 0,
        misses: 0,
        total: 0,
        hitRate: '0.00%',
        cacheSize: 0
      };
    }

    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) : '0.00';
    
    return {
      hits: stats.hits,
      misses: stats.misses,
      total,
      hitRate: `${hitRate}%`,
      cacheSize: stats.size
    };
  }

  static clearCache(): void {
    this.cache.clear();
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