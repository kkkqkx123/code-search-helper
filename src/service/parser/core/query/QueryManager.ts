import Parser from 'tree-sitter';
import { LRUCache } from '../../../../utils/LRUCache';
import { LoggerService } from '../../../../utils/LoggerService';
import { QueryRegistry, QueryRegistryImpl } from './QueryRegistry';
import { QueryTransformer } from './QueryTransformer';

/**
 * 查询管理器 - 负责加载、缓存和执行Tree-sitter查询
 */
export class QueryManager {
  private static queryCache = new LRUCache<string, Parser.Query>(100);
  private static patternCache = new LRUCache<string, string>(50);
  private static cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private static logger = new LoggerService();
  private static queryRegistry = QueryRegistryImpl;
  private static initialized = false;

  /**
   * 异步初始化
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.queryRegistry.initialize();
      this.initialized = true;
      this.logger.info('QueryManager 初始化完成');
    } catch (error) {
      this.logger.error('QueryManager 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定语言和查询类型的查询对象
   * @param language 语言名称
   * @param queryType 查询类型（functions, classes, imports等）
   * @param parser Tree-sitter解析器实例
   * @returns Parser.Query实例
   */
  static getQuery(language: string, queryType: string, parser: Parser): Parser.Query {
    const cacheKey = `${language}:${queryType}`;

    // 检查查询缓存
    if (this.queryCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.queryCache.get(cacheKey)!;
    }

    this.cacheStats.misses++;

    try {
      // 获取查询模式
      const pattern = this.getQueryPattern(language, queryType);
      if (!pattern) {
        throw new Error(`未找到${language}语言的${queryType}查询模式`);
      }

      // 创建查询对象
      const query = new Parser.Query(parser.getLanguage(), pattern);

      // 缓存查询对象
      this.queryCache.set(cacheKey, query);

      return query;
    } catch (error) {
      this.logger.error(`创建查询失败: ${language}:${queryType}`, error);
      throw error;
    }
  }

  /**
   * 获取查询字符串（异步）
   */
  static async getQueryString(language: string, queryType: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = await this.queryRegistry.getPattern(language, queryType);
    if (!query) {
      throw new Error(`未找到 ${language}.${queryType} 的查询模式`);
    }

    return query;
  }

  /**
   * 获取查询模式字符串
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 查询模式字符串
   */
  static getQueryPattern(language: string, queryType: string): string | null {
    const cacheKey = `${language}:${queryType}`;

    // 检查模式缓存
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    // 从注册表获取模式
    const pattern = this.queryRegistry.getPatternSync(language, queryType);
    if (pattern) {
      this.patternCache.set(cacheKey, pattern);
    }

    return pattern;
  }

  /**
   * 执行查询并返回结果
   * @param ast AST节点
   * @param language 语言名称
   * @param queryType 查询类型
   * @param parser Tree-sitter解析器实例
   * @returns 查询结果数组
   */
  static executeQuery(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    parser: Parser
  ): Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }> {
    try {
      const query = this.getQuery(language, queryType, parser);
      const matches = query.matches(ast);

      // 转换为标准格式
      return matches.map(match => ({
        captures: match.captures.map(capture => ({
          name: capture.name,
          node: capture.node
        }))
      }));
    } catch (error) {
      this.logger.error(`执行查询失败: ${language}:${queryType}`, error);
      return [];
    }
  }

  /**
   * 批量执行多个查询
   * @param ast AST节点
   * @param language 语言名称
   * @param queryTypes 查询类型数组
   * @param parser Tree-sitter解析器实例
   * @returns 查询结果映射
   */
  static executeBatchQueries(
    ast: Parser.SyntaxNode,
    language: string,
    queryTypes: string[],
    parser: Parser
  ): Map<string, Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }>> {
    const results = new Map();

    for (const queryType of queryTypes) {
      const queryResults = this.executeQuery(ast, language, queryType, parser);
      results.set(queryType, queryResults);
    }

    return results;
  }

  /**
   * 合并多个查询模式为单一查询
   * @param language 语言名称
   * @param queryTypes 查询类型数组
   * @returns 合并后的查询模式
   */
  static combinePatterns(language: string, queryTypes: string[]): string {
    const patterns: string[] = [];

    for (const queryType of queryTypes) {
      const pattern = this.getQueryPattern(language, queryType);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns.join('\n\n');
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.queryCache.clear();
    this.patternCache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    this.logger.info('QueryManager缓存已清除');
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.cacheStats,
      totalRequests: total,
      hitRate: `${hitRate}%`,
      queryCacheSize: this.queryCache.size(),
      patternCacheSize: this.patternCache.size(),
    };
  }

  /**
   * 检查查询是否支持
   */
  static async isQuerySupported(language: string, queryType: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.queryRegistry.isSupported(language, queryType);
  }

  /**
   * 检查是否支持指定语言的查询
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 是否支持
   */
  static isSupported(language: string, queryType?: string): boolean {
    if (queryType) {
      const pattern = this.getQueryPattern(language, queryType);
      return pattern !== null;
    }

    const patterns = this.queryRegistry.getPatternsForLanguage(language);
    return Object.keys(patterns).length > 0;
  }

  /**
   * 获取支持的语言列表
   */
  static getSupportedLanguages(): string[] {
    return this.queryRegistry.getSupportedLanguages();
  }

  /**
   * 获取指定语言支持的查询类型
   */
  static getQueryTypesForLanguage(language: string): string[] {
    return this.queryRegistry.getQueryTypesForLanguage(language);
  }

  /**
   * 重新加载语言查询
   */
  static async reloadLanguageQueries(language: string): Promise<void> {
    await this.queryRegistry.reloadLanguageQueries(language);
  }

  /**
   * 获取查询统计信息
   */
  static getQueryStats() {
    return this.queryRegistry.getStats();
  }

  /**
   * 获取转换器统计信息
   */
  static getTransformerStats() {
    return QueryTransformer.getCacheStats();
  }

  /**
   * 清除所有缓存
   */
  static clearAllCaches(): void {
    this.queryCache.clear();
    this.patternCache.clear();
    this.queryRegistry.clearCache();
    QueryTransformer.clearCache();
    this.logger.info('所有查询缓存已清除');
  }
}