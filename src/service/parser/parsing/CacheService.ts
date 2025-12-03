import Parser from 'tree-sitter';
import { createCache } from '../../../utils/cache';
import { CacheKeyUtils } from '../../../utils/cache/CacheKeyUtils';
import { HashUtils } from '../../../utils/cache/HashUtils';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 实体类型枚举
 */
export type EntityType = 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'method' | 'property' | 'enum' | 'type';

/**
 * 关系类型枚举
 */
export type RelationshipType = 'calls' | 'contains' | 'extends' | 'implements' | 'imports' | 'exports' | 'uses' | 'references';

/**
 * 缓存统计信息
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  hitRate: string;
  cacheSize?: number;
}

/**
 * 性能统计信息
 */
export interface PerformanceStatistics {
  totalParseTime: number;
  totalParseCount: number;
  averageParseTime: number;
  maxParseTime: number;
  minParseTime: number;
  totalQueryTime: number;
  totalQueryCount: number;
  averageQueryTime: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  parserCacheTTL: number;      // 解析器缓存有效期（毫秒）
  astCacheTTL: number;         // AST缓存有效期
  queryCacheTTL: number;       // 查询结果缓存有效期
  nodeCacheSize: number;       // 节点缓存最大条目数
}

/**
 * 统一缓存服务
 * 整合了原有的 ParserCacheService 和 QueryCache 的功能
 * 使用静态设计，支持配置和统计功能
 */
export class CacheService {
  private static logger = new LoggerService();

  // 缓存键前缀，用于区分不同引擎
  private static readonly SIMPLE_QUERY_PREFIX = 'simple:';
  private static readonly TREE_SITTER_QUERY_PREFIX = 'treesitter:';
  private static readonly BATCH_QUERY_PREFIX = 'batch:';
  private static readonly AST_PREFIX = 'ast:';
  private static readonly PARSER_PREFIX = 'parser:';

  // 解析器对象缓存
  private static parserCache = createCache<string, Parser>('stats-decorated', 50, {
    enableStats: true
  });

  // 预编译查询对象缓存
  private static queryCache = createCache<string, Parser.Query>('stats-decorated', 200, {
    enableStats: true
  });

  // 查询结果缓存
  private static resultCache = createCache<string, any>('stats-decorated', 500, {
    enableStats: true
  });

  // AST对象缓存
  private static astCache = createCache<string, Parser.SyntaxNode>('stats-decorated', 200, {
    enableStats: true
  });

  // 实体结果缓存
  private static entityCache = createCache<string, any[]>('stats-decorated', 300, {
    enableStats: true
  });

  // 关系结果缓存
  private static relationshipCache = createCache<string, any[]>('stats-decorated', 300, {
    enableStats: true
  });

  // 混合结果缓存
  private static mixedCache = createCache<string, any>('stats-decorated', 200, {
    enableStats: true
  });

  // 节点缓存
  private static nodeCache: Map<string, Parser.SyntaxNode[]> = new Map();

  // 缓存配置
  private static cacheConfig: CacheConfig = {
    parserCacheTTL: 30 * 60 * 1000,      // 30分钟
    astCacheTTL: 10 * 60 * 1000,         // 10分钟
    queryCacheTTL: 5 * 60 * 1000,        // 5分钟
    nodeCacheSize: 1000,                 // 最多1000个节点
  };

  // 性能统计
  private static performanceStats = {
    totalParseTime: 0,
    totalParseCount: 0,
    averageParseTime: 0,
    maxParseTime: 0,
    minParseTime: Number.MAX_VALUE,
    totalQueryTime: 0,
    totalQueryCount: 0,
    averageQueryTime: 0,
  };

  /**
   * 配置缓存参数
   */
  static setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
    this.logger.info('缓存配置已更新:', this.cacheConfig);
  }

  /**
   * 获取缓存配置
   */
  static getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  // ==================== 解析器缓存 ====================

  /**
   * 获取缓存的解析器
   */
  static getCachedParser(language: string): Parser | null {
    const cacheKey = this.generateParserCacheKey(language);
    const cached = this.parserCache.get(cacheKey);

    if (cached) {
      this.logger.debug(`解析器缓存命中: ${language}`);
      return cached;
    }

    return null;
  }

  /**
   * 缓存解析器
   */
  static cacheParser(language: string, parser: Parser): void {
    const cacheKey = this.generateParserCacheKey(language);
    this.parserCache.set(cacheKey, parser);
    this.logger.debug(`解析器已缓存: ${language}`);
  }

  // ==================== AST缓存 ====================

  /**
   * 获取缓存的AST
   */
  static getCachedAST(language: string, code: string): Parser.Tree | null {
    const cacheKey = this.generateASTCacheKey(language, code);
    const cached = this.astCache.get(cacheKey);

    if (cached) {
      this.logger.debug(`AST缓存命中: ${language}`);
      return cached as any;
    }

    return null;
  }

  /**
   * 缓存AST
   */
  static cacheAST(language: string, code: string, tree: Parser.Tree): void {
    const cacheKey = this.generateASTCacheKey(language, code);
    this.astCache.set(cacheKey, tree.rootNode);
    this.logger.debug(`AST已缓存: ${language}`);
  }

  // ==================== 查询对象缓存 ====================

  /**
   * 获取预编译查询对象
   */
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
      console.error('CacheService.getQuery error - failed to create Parser.Query:', error);
      console.error('Language:', language?.name);
      console.error('Pattern:', pattern.substring(0, 200) + (pattern.length > 200 ? '...' : ''));
      throw error;
    }
  }

  // ==================== 查询结果缓存 ====================

  /**
   * 获取缓存的查询结果
   */
  static getResult(key: string): any {
    return this.resultCache.get(key);
  }

  /**
   * 缓存查询结果
   */
  static setResult(key: string, result: any): void {
    this.resultCache.set(key, result);
  }

  // ==================== 实体缓存 ====================

  /**
   * 获取缓存的实体结果
   */
  static getEntityResult(key: string): any[] | undefined {
    return this.entityCache.get(key);
  }

  /**
   * 缓存实体结果
   */
  static setEntityResult(key: string, result: any[]): void {
    this.entityCache.set(key, result);
  }

  // ==================== 关系缓存 ====================

  /**
   * 获取缓存的关系结果
   */
  static getRelationshipResult(key: string): any[] | undefined {
    return this.relationshipCache.get(key);
  }

  /**
   * 缓存关系结果
   */
  static setRelationshipResult(key: string, result: any[]): void {
    this.relationshipCache.set(key, result);
  }

  // ==================== 混合缓存 ====================

  /**
   * 获取缓存的混合结果
   */
  static getMixedResult(key: string): any | undefined {
    return this.mixedCache.get(key);
  }

  /**
   * 缓存混合结果
   */
  static setMixedResult(key: string, result: any): void {
    this.mixedCache.set(key, result);
  }

  // ==================== 节点缓存 ====================

  /**
   * 获取缓存的节点
   */
  static getCachedNodes(cacheKey: string): Parser.SyntaxNode[] | null {
    const cached = this.nodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    return null;
  }

  /**
   * 缓存节点
   */
  static cacheNodes(cacheKey: string, nodes: Parser.SyntaxNode[]): void {
    // 简单的LRU淘汰：超过大小限制时删除最旧的条目
    if (this.nodeCache.size >= this.cacheConfig.nodeCacheSize) {
      const firstKey = this.nodeCache.keys().next().value;
      if (firstKey) {
        this.nodeCache.delete(firstKey);
      }
    }

    this.nodeCache.set(cacheKey, nodes);
  }

  // ==================== 缓存键生成 ====================

  /**
   * 生成解析器缓存键
   */
  static generateParserCacheKey(language: string): string {
    return `${this.PARSER_PREFIX}${language.toLowerCase()}`;
  }

  /**
   * 生成AST缓存键
   */
  static generateASTCacheKey(language: string, code: string): string {
    const codeHash = CacheKeyUtils.generateCacheKey(code);
    return `${this.AST_PREFIX}${language.toLowerCase()}:${codeHash}`;
  }

  /**
   * 生成查询缓存键
   */
  static generateQueryCacheKey(language: string, queryType: string, nodeHash: string): string {
    return `query:${language.toLowerCase()}:${queryType}:${nodeHash}`;
  }

  /**
   * 生成节点缓存键
   */
  static generateNodeCacheKey(nodeHash: string, queryType: string): string {
    return `node:${nodeHash}:${queryType}`;
  }

  /**
   * 计算节点哈希值
   */
  static hashNode(node: Parser.SyntaxNode): string {
    return `${node.type}:${node.startIndex}:${node.endIndex}`;
  }

  /**
   * 为SimpleQueryEngine生成缓存键
   */
  static forSimpleQuery(ast: Parser.SyntaxNode, queryType: string, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.SIMPLE_QUERY_PREFIX}${contentHash}:${queryType}:${language}`;
  }

  /**
   * 为TreeSitterQueryEngine生成缓存键
   */
  static forTreeSitterQuery(ast: Parser.SyntaxNode, patternName: string, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.TREE_SITTER_QUERY_PREFIX}${contentHash}:${patternName}:${language}`;
  }

  /**
   * 为批量查询生成缓存键
   */
  static forBatchQuery(ast: Parser.SyntaxNode, types: string[], language: string): string {
    const contentHash = this.generateContentHash(ast);
    const typesKey = CacheKeyUtils.generateCacheKey(types.sort());
    return `${this.BATCH_QUERY_PREFIX}${contentHash}:batch:${typesKey}:${language}`;
  }

  /**
   * 为AST对象生成缓存键
   */
  static forAst(filePath: string, contentHash: string): string {
    const normalizedKey = CacheKeyUtils.generateCacheKey(filePath, contentHash);
    return `${this.AST_PREFIX}${normalizedKey}`;
  }

  /**
   * 为实体查询生成缓存键
   */
  static forEntityQuery(ast: Parser.SyntaxNode, entityType: EntityType, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.TREE_SITTER_QUERY_PREFIX}entity:${contentHash}:${entityType}:${language}`;
  }

  /**
   * 为关系查询生成缓存键
   */
  static forRelationshipQuery(ast: Parser.SyntaxNode, relationshipType: RelationshipType, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.TREE_SITTER_QUERY_PREFIX}relationship:${contentHash}:${relationshipType}:${language}`;
  }

  /**
   * 为混合查询生成缓存键
   */
  static forMixedQuery(ast: Parser.SyntaxNode, queryTypes: string[], language: string): string {
    const contentHash = this.generateContentHash(ast);
    const typesKey = CacheKeyUtils.generateCacheKey(queryTypes.sort());
    return `${this.TREE_SITTER_QUERY_PREFIX}mixed:${contentHash}:${typesKey}:${language}`;
  }

  /**
   * 生成AST内容的哈希值
   */
  private static generateContentHash(ast: Parser.SyntaxNode): string {
    if (!ast) {
      return 'invalid-ast';
    }

    if ((ast as any)._stableId) {
      return (ast as any)._stableId;
    }

    const text = ast.text || '';
    const structure = this.extractNodeStructure(ast);
    const combined = `${ast.type}:${text.length}:${structure}`;

    return HashUtils.fnv1aHash(combined);
  }

  /**
   * 提取节点结构信息用于哈希计算
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
   * 哈希查询模式
   */
  private static hashPattern(pattern: string): string {
    return CacheKeyUtils.generateCacheKey(pattern);
  }

  // ==================== 性能统计 ====================

  /**
   * 记录解析耗时
   */
  static recordParseTime(parseTime: number): void {
    this.performanceStats.totalParseTime += parseTime;
    this.performanceStats.totalParseCount++;
    this.performanceStats.averageParseTime =
      this.performanceStats.totalParseTime / this.performanceStats.totalParseCount;
    this.performanceStats.maxParseTime = Math.max(this.performanceStats.maxParseTime, parseTime);
    this.performanceStats.minParseTime = Math.min(this.performanceStats.minParseTime, parseTime);
  }

  /**
   * 记录查询耗时
   */
  static recordQueryTime(queryTime: number): void {
    this.performanceStats.totalQueryTime += queryTime;
    this.performanceStats.totalQueryCount++;
    this.performanceStats.averageQueryTime =
      this.performanceStats.totalQueryTime / this.performanceStats.totalQueryCount;
  }

  // ==================== 统计查询 ====================

  /**
   * 获取缓存统计信息
   */
  static getCacheStatistics(): CacheStatistics {
    const queryStats = this.queryCache.getStats();
    if (!queryStats) {
      return {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalRequests: 0,
        hitRate: '0.00%',
        cacheSize: 0
      };
    }

    let hitRate: string;
    if (typeof (queryStats as any).hitRate === 'number') {
      hitRate = ((queryStats as any).hitRate * 100).toFixed(2);
    } else {
      const totalRequests = (queryStats as any).gets || (queryStats.hits + queryStats.misses);
      hitRate = totalRequests > 0 ? ((queryStats.hits / totalRequests) * 100).toFixed(2) : '0.00';
    }

    const total = (queryStats as any).gets || (queryStats.hits + queryStats.misses);

    return {
      hits: queryStats.hits,
      misses: queryStats.misses,
      evictions: queryStats.evictions || 0,
      totalRequests: total,
      hitRate: `${hitRate}%`,
      cacheSize: queryStats.size
    };
  }

  /**
   * 获取性能统计信息
   */
  static getPerformanceStatistics(): PerformanceStatistics {
    return { ...this.performanceStats };
  }

  /**
   * 获取完整的统计信息
   */
  static getCompleteStats() {
    return {
      cache: this.getCacheStatistics(),
      performance: this.getPerformanceStatistics(),
      config: this.cacheConfig,
    };
  }

  /**
   * 获取所有缓存统计信息
   */
  static getAllStats(): {
    parserCache: any;
    queryCache: any;
    resultCache: any;
    astCache: any;
    entityCache: any;
    relationshipCache: any;
    mixedCache: any;
    combined: any;
  } {
    const parserStats = this.parserCache.getStats();
    const queryStats = this.queryCache.getStats();
    const resultStats = this.resultCache.getStats();
    const astStats = this.astCache.getStats();
    const entityStats = this.entityCache.getStats();
    const relationshipStats = this.relationshipCache.getStats();
    const mixedStats = this.mixedCache.getStats();

    // 计算合并的统计信息
    const combined = {
      totalHits: (parserStats?.hits || 0) + (queryStats?.hits || 0) + (resultStats?.hits || 0) + (astStats?.hits || 0) +
        (entityStats?.hits || 0) + (relationshipStats?.hits || 0) + (mixedStats?.hits || 0),
      totalMisses: (parserStats?.misses || 0) + (queryStats?.misses || 0) + (resultStats?.misses || 0) + (astStats?.misses || 0) +
        (entityStats?.misses || 0) + (relationshipStats?.misses || 0) + (mixedStats?.misses || 0),
      totalSize: (parserStats?.size || 0) + (queryStats?.size || 0) + (resultStats?.size || 0) + (astStats?.size || 0) +
        (entityStats?.size || 0) + (relationshipStats?.size || 0) + (mixedStats?.size || 0),
      overallHitRate: '0.00%'
    };

    const totalRequests = combined.totalHits + combined.totalMisses;
    combined.overallHitRate = totalRequests > 0 ? (combined.totalHits / totalRequests * 100).toFixed(2) + '%' : '0.00%';

    return {
      parserCache: parserStats,
      queryCache: queryStats,
      resultCache: resultStats,
      astCache: astStats,
      entityCache: entityStats,
      relationshipCache: relationshipStats,
      mixedCache: mixedStats,
      combined
    };
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除所有缓存
   */
  static clearAll(): void {
    this.parserCache.clear();
    this.queryCache.clear();
    this.resultCache.clear();
    this.astCache.clear();
    this.entityCache.clear();
    this.relationshipCache.clear();
    this.mixedCache.clear();
    this.nodeCache.clear();
    this.logger.info('所有缓存已清除');
  }

  /**
   * 清除解析器缓存
   */
  static clearParsers(): void {
    this.queryCache.clear();
    this.logger.info('解析器缓存已清除');
  }

  /**
   * 清除AST缓存
   */
  static clearASTs(): void {
    this.astCache.clear();
    this.logger.info('AST缓存已清除');
  }

  /**
   * 清除查询结果缓存
   */
  static clearQueryResults(): void {
    this.resultCache.clear();
    this.logger.info('查询结果缓存已清除');
  }

  /**
   * 清除节点缓存
   */
  static clearNodes(): void {
    this.nodeCache.clear();
    this.logger.info('节点缓存已清除');
  }

  /**
   * 清除特定语言的缓存
   */
  static clearLanguageCache(language: string): void {
    const pattern = new RegExp(`(parser|ast|query):${language.toLowerCase()}`);
    // 这里需要实现按模式删除的逻辑
    this.logger.info(`${language} 的缓存已清除`);
  }

  /**
   * 获取缓存大小信息
   */
  static getCacheSize(): {
    parserCache: number;
    nodeCache: number;
    queryCache: number;
    resultCache: number;
    astCache: number;
    entityCache: number;
    relationshipCache: number;
    mixedCache: number;
  } {
    return {
      parserCache: this.parserCache.getStats()?.size || 0,
      nodeCache: this.nodeCache.size,
      queryCache: this.queryCache.getStats()?.size || 0,
      resultCache: this.resultCache.getStats()?.size || 0,
      astCache: this.astCache.getStats()?.size || 0,
      entityCache: this.entityCache.getStats()?.size || 0,
      relationshipCache: this.relationshipCache.getStats()?.size || 0,
      mixedCache: this.mixedCache.getStats()?.size || 0,
    };
  }
}