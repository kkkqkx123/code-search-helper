import Parser from 'tree-sitter';
import { IQueryResultNormalizer, StandardizedQueryResult, NormalizationOptions, NormalizationStats } from './types';
import { LanguageAdapterFactory } from './adapters';
import { QueryManager } from '../query/QueryManager';
import { QueryLoader } from '../query/QueryLoader';
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/LRUCache';

/**
 * 查询结果标准化器
 * 将不同语言的tree-sitter查询结果转换为统一格式
 */
export class QueryResultNormalizer implements IQueryResultNormalizer {
  private logger: LoggerService;
  private options: Required<NormalizationOptions>;
  private cache: LRUCache<string, StandardizedQueryResult[]>;
  private stats: NormalizationStats;

  constructor(options: NormalizationOptions = {}) {
    this.logger = new LoggerService();
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheSize: options.cacheSize ?? 100,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      customTypeMappings: options.customTypeMappings ?? [],
      debug: options.debug ?? false
    };

    this.cache = new LRUCache(this.options.cacheSize);
    this.stats = {
      totalNodes: 0,
      successfulNormalizations: 0,
      failedNormalizations: 0,
      processingTime: 0,
      cacheHitRate: 0,
      typeStats: {}
    };
  }

  async normalize(
    ast: Parser.SyntaxNode, 
    language: string, 
    queryTypes?: string[]
  ): Promise<StandardizedQueryResult[]> {
    const startTime = Date.now();
    
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(ast, language, queryTypes);
      
      // 检查缓存
      if (this.options.enableCache && this.cache.has(cacheKey)) {
        this.stats.cacheHitRate = (this.stats.cacheHitRate * this.stats.totalNodes + 1) / (this.stats.totalNodes + 1);
        return this.cache.get(cacheKey)!;
      }

      // 获取查询类型
      const typesToQuery = queryTypes || await this.getSupportedQueryTypes(language);
      
      if (this.options.debug) {
        this.logger.debug(`Normalizing ${language} AST with query types:`, typesToQuery);
      }

      const results: StandardizedQueryResult[] = [];
      
      // 对每种查询类型执行查询和标准化
      for (const queryType of typesToQuery) {
        try {
          const queryResults = await this.executeQueryForType(ast, language, queryType);
          const normalized = await this.normalizeQueryResults(queryResults, language, queryType);
          results.push(...normalized);
          
          // 更新统计信息
          this.stats.typeStats[queryType] = (this.stats.typeStats[queryType] || 0) + normalized.length;
        } catch (error) {
          this.logger.warn(`Failed to normalize query type ${queryType} for ${language}:`, error);
          this.stats.failedNormalizations++;
        }
      }

      // 按起始行号排序
      results.sort((a, b) => a.startLine - b.startLine);

      // 缓存结果
      if (this.options.enableCache) {
        this.cache.set(cacheKey, results);
      }

      // 更新统计信息
      this.stats.successfulNormalizations += results.length;
      this.stats.totalNodes++;

      if (this.options.debug) {
        this.logger.debug(`Normalized ${results.length} structures for ${language}`);
      }

      return results;
    } finally {
      const endTime = Date.now();
      this.stats.processingTime += endTime - startTime;
    }
  }

  async getSupportedQueryTypes(language: string): Promise<string[]> {
    try {
      // 首先尝试从QueryLoader动态发现查询类型
      const discoveredTypes = await QueryLoader.discoverQueryTypes(language);
      
      if (discoveredTypes.length > 0) {
        return discoveredTypes;
      }

      // 如果动态发现失败，使用语言适配器的默认查询类型
      const adapter = LanguageAdapterFactory.getAdapter(language);
      return adapter.getSupportedQueryTypes();
    } catch (error) {
      this.logger.warn(`Failed to get supported query types for ${language}:`, error);
      
      // 返回默认查询类型
      return ['functions', 'classes', 'methods', 'imports', 'variables'];
    }
  }

  mapNodeType(nodeType: string, language: string): string {
    const adapter = LanguageAdapterFactory.getAdapter(language);
    return adapter.mapNodeType(nodeType);
  }

  /**
   * 获取标准化统计信息
   */
  getStats(): NormalizationStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalNodes: 0,
      successfulNormalizations: 0,
      failedNormalizations: 0,
      processingTime: 0,
      cacheHitRate: 0,
      typeStats: {}
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 更新配置选项
   */
  updateOptions(options: Partial<NormalizationOptions>): void {
    this.options = { ...this.options, ...options };
    
    // 如果缓存大小发生变化，重新创建缓存
    if (options.cacheSize !== undefined && options.cacheSize !== this.cache.size()) {
      const oldCache = this.cache;
      this.cache = new LRUCache(this.options.cacheSize);
      
      // 将旧缓存中的数据迁移到新缓存
      for (const key of oldCache.keys()) {
        const value = oldCache.get(key);
        if (value !== undefined) {
          this.cache.set(key, value);
        }
      }
    }
  }

  private async executeQueryForType(
    ast: Parser.SyntaxNode, 
    language: string, 
    queryType: string
  ): Promise<any[]> {
    try {
      // 获取查询字符串
      const queryString = await QueryManager.getQueryString(language, queryType);
      
      if (!queryString) {
        throw new Error(`No query string found for ${language}.${queryType}`);
      }

      // 获取解析器实例
      const parser = await this.getParserForLanguage(language);
      
      // 执行查询
      return QueryManager.executeQuery(ast, language, queryType, parser);
    } catch (error) {
      this.logger.error(`Failed to execute query for ${language}.${queryType}:`, error);
      throw error;
    }
  }

  private async normalizeQueryResults(
    queryResults: any[], 
    language: string, 
    queryType: string
  ): Promise<StandardizedQueryResult[]> {
    const adapter = LanguageAdapterFactory.getAdapter(language);
    
    try {
      return adapter.normalize(queryResults, queryType, language);
    } catch (error) {
      this.logger.error(`Failed to normalize results for ${language}.${queryType}:`, error);
      throw error;
    }
  }

  private async getParserForLanguage(language: string): Promise<Parser> {
    // 这里应该从TreeSitterCoreService获取解析器实例
    // 为了简化，我们假设有一个全局的解析器管理器
    // 在实际实现中，需要注入TreeSitterCoreService依赖
    
    // 临时实现 - 在实际使用中需要正确注入依赖
    throw new Error('Parser injection not implemented. Please inject TreeSitterCoreService dependency.');
  }

  private generateCacheKey(
    ast: Parser.SyntaxNode, 
    language: string, 
    queryTypes?: string[]
  ): string {
    // 基于AST内容、语言和查询类型生成缓存键
    const astHash = this.hashAST(ast);
    const queryTypesStr = queryTypes?.join(',') || 'auto';
    return `${language}:${astHash}:${queryTypesStr}`;
  }

  private hashAST(ast: Parser.SyntaxNode): string {
    // 简单的AST哈希实现
    // 在实际使用中，可能需要更复杂的哈希算法
    const content = ast.text || '';
    const position = `${ast.startPosition.row}:${ast.startPosition.column}`;
    return this.simpleHash(content + position);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
}