import Parser from 'tree-sitter';
import { IQueryResultNormalizer, StandardizedQueryResult, NormalizationOptions, NormalizationStats } from './types';
import { CLanguageAdapter } from './adapters';
import { QueryManager } from '../query/QueryManager';
import { QueryLoader } from '../query/QueryLoader';
import { QueryTypeMapper } from './QueryTypeMappings';
import { LoggerService } from '../../../../utils/LoggerService';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { DefaultLanguageAdapter } from './adapters/DefaultLanguageAdapter';
import { HashUtils } from '../../../../utils/cache/HashUtils';
import { ICacheService } from '../../../../infrastructure/caching/types';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../../types';

/**
 * 增强的查询结果标准化器
 * 将不同语言的tree-sitter查询结果转换为统一格式
 * 集成了缓存、性能监控、错误处理和降级机制
 */
@injectable()
export class QueryResultNormalizer implements IQueryResultNormalizer {
  private logger: LoggerService;
  private options: Required<NormalizationOptions>;
  private stats: NormalizationStats;
  private treeSitterService?: TreeSitterCoreService;
  private errorCount: number = 0;
  private maxErrors: number = 10;
  private fallbackEnabled: boolean = true;
  private readonly ADAPTER_CACHE_TTL = 30 * 60 * 1000; // 30分钟
  private readonly QUERY_CACHE_TTL = 30 * 60 * 1000; // 30分钟

  constructor(
    @inject(TYPES.CacheService) private cacheService: ICacheService,
    options: NormalizationOptions = {}
  ) {
    this.logger = new LoggerService();
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheSize: options.cacheSize ?? 10,
      cacheTTL: options.cacheTTL ?? 1800000, // 默认30分钟（毫秒）
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      customTypeMappings: options.customTypeMappings ?? [],
      debug: options.debug ?? false
    };

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
    * 设置Tree-sitter服务
    */
  setTreeSitterService(service: TreeSitterCoreService): void {
    this.treeSitterService = service;
  }

  /**
   * 设置错误阈值
   */
  setErrorThreshold(maxErrors: number): void {
    this.maxErrors = maxErrors;
  }

  /**
   * 启用/禁用降级机制
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
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
      if (this.options.enableCache) {
        const cachedResult = this.cacheService.getFromCache(`query:result:${cacheKey}`) as StandardizedQueryResult[];
        if (cachedResult) {
          return cachedResult;
        }
      }

      // 获取查询类型（使用统一映射）
      const typesToQuery = await this.getSupportedQueryTypesWithMapping(language, queryTypes);

      if (this.options.debug) {
        this.logger.debug(`Normalizing ${language} AST with query types:`, typesToQuery);
      }

      // 使用Promise.all并行处理所有查询类型
      const normalizationPromises = typesToQuery.map(async (queryType) => {
        try {
          const queryResults = await this.executeQueryForType(ast, language, queryType);
          const normalized = await this.normalizeQueryResults(queryResults, language, queryType);

          // 更新统计信息（在并行处理中需要考虑线程安全）
          if (this.stats.typeStats[queryType]) {
            this.stats.typeStats[queryType] += normalized.length;
          } else {
            this.stats.typeStats[queryType] = normalized.length;
          }

          return normalized;
        } catch (error) {
          this.handleQueryError(error, language, queryType);
          return [];
        }
      });

      // 并行执行所有查询
      const resultsArrays = await Promise.all(normalizationPromises);
      const results = resultsArrays.flat();

      // 按起始行号排序
      results.sort((a, b) => a.startLine - b.startLine);

      // 缓存结果
      if (this.options.enableCache) {
        this.cacheService.setCache(`query:result:${cacheKey}`, results, this.QUERY_CACHE_TTL);
      }

      // 更新统计信息
      this.stats.successfulNormalizations += results.length;
      this.stats.totalNodes++;

      if (this.options.debug) {
        this.logger.debug(`Normalized ${results.length} structures for ${language}`);
      }

      return results;
    } catch (error) {
      if (this.fallbackEnabled) {
        this.logger.warn(`Using fallback normalization for ${language}:`, error);
        return this.fallbackNormalization(ast, language, queryTypes);
      }
      throw error;
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
        // 使用统一映射转换查询类型
        return QueryTypeMapper.getMappedQueryTypes(language, discoveredTypes);
      }

      // 如果动态发现失败，使用语言适配器的默认查询类型
      const adapter = await this.getAdapter(language);
      return adapter.getSupportedQueryTypes();
    } catch (error) {
      this.logger.warn(`Failed to get supported query types for ${language}:`, error);

      // 返回默认查询类型
      return ['functions', 'classes', 'methods', 'imports', 'variables'];
    }
  }

  /**
    * 获取支持查询类型（带映射）
    */
  private async getSupportedQueryTypesWithMapping(language: string, queryTypes?: string[]): Promise<string[]> {
    if (queryTypes) {
      // 验证查询类型
      if (QueryTypeMapper.validateQueryTypes(language, queryTypes)) {
        return queryTypes;
      }

      // 如果验证失败，尝试映射
      return QueryTypeMapper.getMappedQueryTypes(language, queryTypes);
    }

    return await this.getSupportedQueryTypes(language);
  }

  mapNodeType(nodeType: string, language: string): string {
    try {
      // 由于接口要求同步返回，我们尝试从缓存中获取适配器
      // 如果适配器已经存在缓存中，则使用它；否则使用默认适配器
      const cachedAdapter = this.getAdapterSync(language);
      if (cachedAdapter) {
        return cachedAdapter.mapNodeType(nodeType);
      }

      // 如果缓存中没有适配器，使用默认适配器
      const defaultAdapter = new DefaultLanguageAdapter();
      return defaultAdapter.mapNodeType(nodeType);
    } catch (error) {
      this.logger.warn(`Failed to map node type ${nodeType} for ${language}:`, error);
      return nodeType; // 返回原始类型作为降级
    }
  }

  /**
   * 获取标准化统计信息
   */
  getStats(): NormalizationStats {
    return { ...this.stats };
  }

  /**
   * 获取详细性能统计
   */
  async getPerformanceStats(): Promise<any> {
    const cacheStats = this.cacheService.getCacheStats();
    return {
      normalization: this.stats,
      cache: cacheStats,
      errorCount: this.errorCount,
      errorRate: this.stats.totalNodes > 0 ? (this.errorCount / this.stats.totalNodes) : 0,
      averageProcessingTime: this.stats.totalNodes > 0 ? (this.stats.processingTime / this.stats.totalNodes) : 0,
      cacheHitRate: cacheStats.hitCount > 0 ? cacheStats.hitCount / (cacheStats.hitCount + cacheStats.missCount) : 0
    };
  }

  /**
   * 重置统计信息
   */
  async resetStats(): Promise<void> {
    this.stats = {
      totalNodes: 0,
      successfulNormalizations: 0,
      failedNormalizations: 0,
      processingTime: 0,
      cacheHitRate: 0,
      typeStats: {}
    };
    this.errorCount = 0;
    this.cacheService.clearAllCache();
  }

  /**
    * 清除缓存
    */
  async clearCache(): Promise<void> {
    this.cacheService.clearAllCache();
  }

  /**
   * 更新配置选项
   */
  updateOptions(options: Partial<NormalizationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
    * 处理查询错误
    */
  private handleQueryError(error: any, language: string, queryType: string): void {
    this.logger.warn(`Failed to normalize query type ${queryType} for ${language}:`, error);
    this.stats.failedNormalizations++;
    this.errorCount++;

    // 检查错误阈值
    if (this.errorCount >= this.maxErrors) {
      this.logger.error(`Error threshold exceeded (${this.errorCount}/${this.maxErrors}), disabling further processing`);
      throw new Error(`Error threshold exceeded: ${this.errorCount} errors`);
    }
  }

  /**
   * 更新缓存命中率
   */
  private updateCacheHitRate(): void {
    const totalRequests = this.stats.totalNodes + 1;
    const currentHits = this.stats.cacheHitRate * this.stats.totalNodes;
    this.stats.cacheHitRate = (currentHits + 1) / totalRequests;
  }

  /**
   * 降级标准化
   */
  private fallbackNormalization(
    ast: Parser.SyntaxNode,
    language: string,
    queryTypes?: string[]
  ): StandardizedQueryResult[] {
    this.logger.warn(`Using fallback normalization for ${language}`);

    const results: StandardizedQueryResult[] = [];
    const visited = new Set<string>();

    // 简单遍历AST，提取基本结构
    this.extractBasicStructures(ast, language, results, visited);

    return results;
  }

  /**
   * 提取基本结构（降级方法）
   */
  private extractBasicStructures(
    node: Parser.SyntaxNode,
    language: string,
    results: StandardizedQueryResult[],
    visited: Set<string>
  ): void {
    if (!node || visited.has(node.id.toString())) {
      return;
    }

    visited.add(node.id.toString());

    // 基本结构识别
    const structureType = this.identifyBasicStructure(node, language);
    if (structureType) {
      const result: StandardizedQueryResult = {
        nodeId: `node_${node.id}_${Date.now()}`,
        type: structureType,
        name: this.extractBasicName(node),
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        content: node.text || '',
        metadata: {
          language,
          complexity: 1,
          dependencies: [],
          modifiers: []
        }
      };

      results.push(result);
    }

    // 递归处理子节点
    if (node.children) {
      for (const child of node.children) {
        this.extractBasicStructures(child, language, results, visited);
      }
    }
  }

  /**
   * 识别基本结构类型
   */
  private identifyBasicStructure(node: Parser.SyntaxNode, language: string): StandardizedQueryResult['type'] | null {
    const nodeType = node.type.toLowerCase();

    // 通用结构识别
    if (nodeType.includes('function') || nodeType.includes('method')) {
      return 'function';
    }
    if (nodeType.includes('class') || nodeType.includes('struct') || nodeType.includes('interface')) {
      return 'class';
    }
    if (nodeType.includes('import') || nodeType.includes('include')) {
      return 'import';
    }
    if (nodeType.includes('variable') || nodeType.includes('declaration')) {
      return 'variable';
    }
    if (nodeType.includes('interface')) {
      return 'interface';
    }
    if (nodeType.includes('type')) {
      return 'type';
    }
    if (nodeType.includes('export')) {
      return 'export';
    }
    if (nodeType.includes('if') || nodeType.includes('for') || nodeType.includes('while') || nodeType.includes('switch')) {
      return 'control-flow';
    }
    if (nodeType.includes('expression')) {
      return 'expression';
    }

    return null;
  }

  /**
    * 提取基本名称
    */
  private extractBasicName(node: Parser.SyntaxNode): string {
    // 尝试从节点文本中提取名称
    const text = node.text || '';
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // 查找函数/类/变量名
      const match = trimmed.match(/(?:function|class|var|let|const|def|interface|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (match) {
        return match[1];
      }
    }

    return `unnamed_${node.type}`;
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
    const adapter = await this.getAdapter(language);

    try {
      return await adapter.normalize(queryResults, queryType, language);
    } catch (error) {
      this.logger.error(`Failed to normalize results for ${language}.${queryType}:`, error);
      throw error;
    }
  }

  private async getParserForLanguage(language: string): Promise<Parser> {
    if (!this.treeSitterService) {
      throw new Error('TreeSitterCoreService not set. Please call setTreeSitterService() first.');
    }

    const dynamicManager = this.treeSitterService.getDynamicManager();
    const parser = await dynamicManager.getParser(language);

    if (!parser) {
      throw new Error(`Failed to get parser for language: ${language}`);
    }

    return parser;
  }

  private generateCacheKey(
    ast: Parser.SyntaxNode,
    language: string,
    queryTypes?: string[]
  ): string {
    // 基于AST内容、语言和查询类型生成缓存键
    const astHash = this.hashAST(ast);
    const queryTypesStr = queryTypes?.join(',') || 'auto';

    // 使用更健壮的组合方式
    return HashUtils.calculateStringHash(`${language}:${astHash}:${queryTypesStr}`);
  }

  protected hashAST(ast: Parser.SyntaxNode): string {
    // 提取全面的识别信息
    const components = {
      content: ast.text || '',
      startPosition: `${ast.startPosition.row}:${ast.startPosition.column}`,
      endPosition: `${ast.endPosition.row}:${ast.endPosition.column}`,
      nodeType: ast.type || '',
      nodeId: ast.id || '0', // 如果Tree-sitter提供节点ID
      contentLength: (ast.text || '').length
    };

    // 使用 HashUtils 的加密安全哈希
    return HashUtils.calculateStringHash(JSON.stringify(components));
  }

  /**
   * 为不同类型的分段生成哈希
   */
  protected generateSegmentHash(segment: any, segmentType: string): string {
    const baseComponents = {
      segmentType,
      contentLength: segment.content?.length || 0
    };

    let specificComponents: any = {};

    switch (segmentType) {
      case 'markdown':
        specificComponents = {
          contentPreview: this.getContentPreview(segment.content),
          headingLevel: segment.headingLevel,
          position: segment.position
        };
        break;

      case 'code':
        specificComponents = {
          language: segment.metadata?.language,
          startLine: segment.startLine,
          endLine: segment.endLine,
          complexity: segment.metadata?.complexity
        };
        break;

      default:
        specificComponents = {
          contentPreview: this.getContentPreview(segment.content)
        };
    }

    const hashInput = JSON.stringify({ ...baseComponents, ...specificComponents });
    return HashUtils.calculateStringHash(hashInput);
  }

  /**
   * 内容预览辅助方法
   */
  protected getContentPreview(content: string, maxLength: number = 100): string {
    if (!content || content.length <= maxLength) return content;

    // 取前80字符和后20字符，中间用省略号
    const prefix = content.substring(0, 80);
    const suffix = content.substring(content.length - 20);
    return `${prefix}...${suffix}`;
  }

  /**
   * 获取文件上下文哈希
   */
  private async getFileContextHash(filePath: string): Promise<string> {
    try {
      // 使用现有的 HashUtils 计算文件哈希
      return await HashUtils.calculateFileHash(filePath);
    } catch (error) {
      // 如果文件读取失败，使用文件路径和当前时间
      const fallbackInput = `${filePath}:${Date.now()}`;
      return HashUtils.calculateStringHash(fallbackInput);
    }
  }

  /**
   * 检查是否应该失效缓存
   */
  private async shouldInvalidateCache(cacheKey: string, filePath: string): Promise<boolean> {
    const currentFileHash = await this.getFileContextHash(filePath);
    const cachedFileHash = this.cacheService.getFromCache(`query:result:${cacheKey}:file_hash`) as string;

    // 如果文件哈希发生变化，需要失效缓存
    if (cachedFileHash && cachedFileHash !== currentFileHash) {
      return true;
    }

    return false;
  }

  /**
   * 获取语言适配器（带缓存）
   */
  private async getAdapter(language: string): Promise<any> {
    const cacheKey = `adapter:${language}`;
    
    // 尝试从缓存获取
    let adapter = this.cacheService.getFromCache(cacheKey);
    if (adapter) {
      return adapter;
    }

    // 根据语言返回相应的适配器
    switch (language.toLowerCase()) {
      case 'c':
      case 'cpp':
        adapter = new CLanguageAdapter();
        break;
      default:
        adapter = null; // 返回默认适配器或null
    }

    // 缓存适配器
    if (adapter) {
      this.cacheService.setCache(cacheKey, adapter, this.ADAPTER_CACHE_TTL);
    }

    return adapter;
  }

  /**
   * 同步获取语言适配器（从缓存）
   */
  private getAdapterSync(language: string): any {
    // 由于接口要求同步返回，我们只能尝试从缓存中获取适配器
    // 如果缓存中没有，返回null，让调用方使用默认适配器
    const cacheKey = `adapter:${language}`;
    
    // 注意：这里我们无法使用async/await，所以只能返回null
    // 在实际使用中，应该优先使用getAdapter方法
    return null;
  }
}