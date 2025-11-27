import Parser from 'tree-sitter';
import { createCache } from '../../../../utils/cache';
import { CacheKeyUtils } from '../../../../utils/cache/CacheKeyUtils';
import { HashUtils } from '../../../../utils/cache/HashUtils';

/**
 * 统一查询缓存管理器
 * 负责管理所有查询相关的缓存，包括：
 * 1. 预编译查询对象缓存 (Parser.Query)
 * 2. 查询结果缓存 (QueryResult)
 * 3. 提供统一的缓存统计和管理接口
 * 4. 内嵌缓存键生成功能
 */
export class QueryCache {
  // 缓存键前缀，用于区分不同引擎
  private static readonly SIMPLE_QUERY_PREFIX = 'simple:';
  private static readonly TREE_SITTER_QUERY_PREFIX = 'treesitter:';
  private static readonly BATCH_QUERY_PREFIX = 'batch:';
  private static readonly AST_PREFIX = 'ast:';
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

  // 缓存键生成方法（内嵌自 CacheKeyGenerator）
  
  /**
   * 为SimpleQueryEngine生成缓存键
   * @param ast AST节点
   * @param queryType 查询类型
   * @param language 语言
   * @returns 缓存键
   */
  static forSimpleQuery(ast: Parser.SyntaxNode, queryType: string, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.SIMPLE_QUERY_PREFIX}${contentHash}:${queryType}:${language}`;
  }

  /**
   * 为TreeSitterQueryEngine生成缓存键
   * @param ast AST节点
   * @param patternName 模式名称
   * @param language 语言
   * @returns 缓存键
   */
  static forTreeSitterQuery(ast: Parser.SyntaxNode, patternName: string, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.TREE_SITTER_QUERY_PREFIX}${contentHash}:${patternName}:${language}`;
  }

  /**
   * 为批量查询生成缓存键
   * @param ast AST节点
   * @param types 查询类型数组
   * @param language 语言
   * @returns 缓存键
   */
  static forBatchQuery(ast: Parser.SyntaxNode, types: string[], language: string): string {
    const contentHash = this.generateContentHash(ast);
    const typesKey = CacheKeyUtils.generateCacheKey(types.sort());
    return `${this.BATCH_QUERY_PREFIX}${contentHash}:batch:${typesKey}:${language}`;
  }

  /**
   * 为AST对象生成缓存键
   * @param filePath 文件路径
   * @param contentHash 文件内容哈希
   * @returns 缓存键
   */
  static forAst(filePath: string, contentHash: string): string {
    // 使用CacheKeyUtils标准化文件路径和内容哈希的组合
    const normalizedKey = CacheKeyUtils.generateCacheKey(filePath, contentHash);
    return `${this.AST_PREFIX}${normalizedKey}`;
  }

  /**
   * 生成AST内容的哈希值
   * @param ast AST节点
   * @returns 内容哈希
   */
  private static generateContentHash(ast: Parser.SyntaxNode): string {
    // 检查AST是否有效
    if (!ast) {
      return 'invalid-ast';
    }

    // 如果AST有稳定标识符，优先使用
    if ((ast as any)._stableId) {
      return (ast as any)._stableId;
    }

    // 否则基于AST内容生成哈希
    const text = ast.text || '';
    const structure = this.extractNodeStructure(ast);
    const combined = `${ast.type}:${text.length}:${structure}`;

    // 使用标准化的哈希算法（FNV-1a比简单哈希更可靠）
    return HashUtils.fnv1aHash(combined);
  }

  /**
   * 提取节点结构信息用于哈希计算
   * @param node 节点
   * @param depth 深度
   * @param maxDepth 最大深度
   * @returns 结构字符串
   */
  private static extractNodeStructure(node: Parser.SyntaxNode, depth: number = 0, maxDepth: number = 3): string {
    if (depth > maxDepth) return '...';

    let structure = `${node.type}[${node.childCount}]`;
    if (node.childCount > 0 && depth < maxDepth) {
      const childTypes = Array.from(node.children).slice(0, 5).map(child => child.type);
      structure += `(${childTypes.join(',')})`;
    }

    return structure;
  }

  /**
   * 验证缓存键格式
   * @param cacheKey 缓存键
   * @returns 是否为有效的缓存键
   */
  static isValidCacheKey(cacheKey: string): boolean {
    const validPrefixes = [
      this.SIMPLE_QUERY_PREFIX,
      this.TREE_SITTER_QUERY_PREFIX,
      this.BATCH_QUERY_PREFIX,
      this.AST_PREFIX
    ];

    return validPrefixes.some(prefix => cacheKey.startsWith(prefix));
  }

  /**
   * 从缓存键中提取查询类型
   * @param cacheKey 缓存键
   * @returns 查询类型或null
   */
  static extractQueryType(cacheKey: string): string | null {
    if (!this.isValidCacheKey(cacheKey)) {
      return null;
    }

    const parts = cacheKey.split(':');
    if (parts.length >= 3) {
      return parts[2]; // 第三部分是查询类型
    }

    return null;
  }

  /**
   * 从缓存键中提取语言
   * @param cacheKey 缓存键
   * @returns 语言或null
   */
  static extractLanguage(cacheKey: string): string | null {
    if (!this.isValidCacheKey(cacheKey)) {
      return null;
    }

    const parts = cacheKey.split(':');
    if (parts.length >= 4) {
      return parts[3]; // 第四部分是语言
    }

    return null;
  }
}

// 为了保持向后兼容性，导出 CacheKeyGenerator 作为 QueryCache 的别名
export const CacheKeyGenerator = QueryCache;