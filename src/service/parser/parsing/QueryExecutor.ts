import Parser from 'tree-sitter';
import { QueryManager } from './QueryManager';
import { LoggerService } from '../../../utils/LoggerService';
import { CacheService } from './CacheService';
import { QueryPerformanceMonitor } from './QueryPerformanceMonitor';
import { QueryResultProcessor, QueryMatch } from './QueryResultProcessor';
import {
  EntityType,
  RelationshipType,
  EntityQueryResult,
  RelationshipQueryResult,
  EntityTypeRegistry,
  RelationshipTypeRegistry
} from './types';
import { queryConfigManager } from './QueryConfig';
import { initializeLanguageFactories } from './types/languages';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';

/**
 * 混合查询结果
 */
export interface MixedQueryResult {
  /** 实体查询结果 */
  entities: EntityQueryResult[];

  /** 关系查询结果 */
  relationships: RelationshipQueryResult[];

  /** 查询执行时间 */
  executionTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: string;
}

/**
 * 查询执行选项
 */
export interface QueryExecutionOptions {
  /** 是否包含关系识别 */
  includeRelationships?: boolean;

  /** 是否使用缓存 */
  useCache?: boolean;

  /** 自定义文件路径 */
  filePath?: string;

  /** 自定义参数 */
  customParams?: Record<string, any>;
}

/**
 * 查询策略枚举
 */
enum QueryStrategy {
  OPTIMIZED = 1,     // 使用优化的查询系统
  STANDARD = 2,      // 使用标准Tree-sitter查询
  FALLBACK = 3       // 使用FallbackExtractor
}

/**
 * 系统状态
 */
interface SystemStatus {
  querySystemInitialized: boolean
  optimizedQueriesEnabled: boolean
  fallbackAvailable: boolean
}

/**
 * 查询统计信息
 */
export interface QueryStats {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  cacheHits: number
  cacheMisses: number
  averageExecutionTime: number
  totalExecutionTime: number
}

/**
 * 整合查询执行器
 * 合并了 TreeSitterQueryExecutor、TreeSitterQueryFacade 和 ParserQueryService 的功能
 * 提供统一的查询接口，支持多种查询策略和优先级管理
 */
export class QueryExecutor {
  private static instance: QueryExecutor;
  private queryManager = QueryManager;
  private logger = new LoggerService();
  private errorHandler: ErrorHandlerService;
  private initialized = false;
  private querySystemInitialized = false;
  private resultProcessor: QueryResultProcessor;
  private entityRegistry: EntityTypeRegistry;
  private relationshipRegistry: RelationshipTypeRegistry;
  private queryStats: QueryStats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0,
  };

  private constructor() {
    this.errorHandler = new ErrorHandlerService(this.logger);
    // 初始化语言工厂
    initializeLanguageFactories();

    this.resultProcessor = new QueryResultProcessor();
    this.entityRegistry = EntityTypeRegistry.getInstance();
    this.relationshipRegistry = RelationshipTypeRegistry.getInstance();

    this.initialize();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): QueryExecutor {
    if (!QueryExecutor.instance) {
      QueryExecutor.instance = new QueryExecutor();
    }
    return QueryExecutor.instance;
  }

  /**
   * 重置单例实例（主要用于测试）
   */
  static resetInstance(): void {
    QueryExecutor.instance = null as any;
  }

  /**
   * 检查实例是否已初始化
   */
  static isInitialized(): boolean {
    return QueryExecutor.instance !== undefined;
  }

  /**
   * 异步初始化
   */
  private async initialize(): Promise<void> {
    try {
      const success = await QueryManager.initialize();
      if (success) {
        this.initialized = true;
        this.logger.info('QueryExecutor 初始化完成');
      } else {
        this.logger.warn('QueryExecutor 初始化失败: 全局查询系统初始化失败');
      }
    } catch (error) {
      this.logger.error('QueryExecutor 初始化失败:', error);
    }

    // 初始化查询系统
    await this.initializeQuerySystem();
  }

  /**
   * 初始化查询系统
   */
  private async initializeQuerySystem(): Promise<void> {
    try {
      const success = await QueryManager.initialize();
      if (success) {
        this.querySystemInitialized = true;
        this.logger.info('QueryExecutor 的查询系统初始化完成');
      } else {
        this.logger.warn('查询系统初始化失败，将使用回退机制');
      }
    } catch (error) {
      this.logger.error('查询系统初始化异常:', error);
    }
  }

  /**
   * 等待查询系统初始化
   */
  private async waitForQuerySystem(timeout = 5000): Promise<void> {
    const startTime = Date.now();

    while (!this.querySystemInitialized && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.querySystemInitialized) {
      this.logger.warn('等待查询系统初始化超时，将使用回退机制');
    }
  }

  /**
   * 获取系统状态
   */
  private getSystemStatus(): SystemStatus {
    return {
      querySystemInitialized: this.querySystemInitialized,
      optimizedQueriesEnabled: true,
      fallbackAvailable: true,
    };
  }

  /**
   * 选择查询策略
   */
  private selectStrategy(language: string, queryType: string): QueryStrategy {
    const status = this.getSystemStatus();

    // 如果查询系统已初始化且支持该语言，使用优化策略
    if (status.querySystemInitialized && status.optimizedQueriesEnabled) {
      const isSupported = QueryManager.isSupported(language.toLowerCase(), queryType);
      if (isSupported) {
        return QueryStrategy.OPTIMIZED;
      }
    }

    // 次级使用标准Tree-sitter查询
    return QueryStrategy.STANDARD;
  }

  // ==================== 实体查询 ====================

  /**
   * 执行实体查询
   */
  async executeEntityQuery(
    ast: Parser.SyntaxNode,
    entityType: EntityType,
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<EntityQueryResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const { useCache = true, filePath = '' } = options;

    try {
      // 检查缓存
      if (useCache) {
        const cacheKey = CacheService.forEntityQuery(ast, entityType, language);
        const cached = CacheService.getEntityResult(cacheKey);
        if (cached) {
          QueryPerformanceMonitor.recordCacheHit(true);
          this.queryStats.cacheHits++;
          return cached;
        }
        QueryPerformanceMonitor.recordCacheHit(false);
        this.queryStats.cacheMisses++;
      }

      // 获取查询类型配置
      const queryTypes = this.getQueryTypesForEntityType(entityType, language);
      const allEntities: EntityQueryResult[] = [];

      // 执行所有相关的查询类型
      for (const queryType of queryTypes) {
        const entities = await this.executeQueryForType(ast, queryType, language, filePath);
        allEntities.push(...entities);
      }

      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`entity_${entityType}_${language}`, executionTime);
      CacheService.recordQueryTime(executionTime);

      // 缓存结果
      if (useCache) {
        const cacheKey = CacheService.forEntityQuery(ast, entityType, language);
        CacheService.setEntityResult(cacheKey, allEntities);
      }

      // 更新统计
      this.updateQueryStats(executionTime, true);

      return allEntities;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`entity_${entityType}_${language}_error`, executionTime);
      this.updateQueryStats(executionTime, false);
      this.logger.error(`实体查询失败 (${entityType}):`, error);
      return [];
    }
  }

  /**
   * 执行关系查询
   */
  async executeRelationshipQuery(
    ast: Parser.SyntaxNode,
    relationshipType: RelationshipType,
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<RelationshipQueryResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const { useCache = true, filePath = '' } = options;

    try {
      // 检查缓存
      if (useCache) {
        const cacheKey = CacheService.forRelationshipQuery(ast, relationshipType, language);
        const cached = CacheService.getRelationshipResult(cacheKey);
        if (cached) {
          QueryPerformanceMonitor.recordCacheHit(true);
          this.queryStats.cacheHits++;
          return cached;
        }
        QueryPerformanceMonitor.recordCacheHit(false);
        this.queryStats.cacheMisses++;
      }

      // 获取查询类型配置
      const queryTypes = this.getQueryTypesForRelationshipType(relationshipType, language);
      const allRelationships: RelationshipQueryResult[] = [];

      // 执行所有相关的查询类型
      for (const queryType of queryTypes) {
        const relationships = await this.executeRelationshipQueryForType(ast, queryType, language, filePath);
        allRelationships.push(...relationships);
      }

      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`relationship_${relationshipType}_${language}`, executionTime);
      CacheService.recordQueryTime(executionTime);

      // 缓存结果
      if (useCache) {
        const cacheKey = CacheService.forRelationshipQuery(ast, relationshipType, language);
        CacheService.setRelationshipResult(cacheKey, allRelationships);
      }

      // 更新统计
      this.updateQueryStats(executionTime, true);

      return allRelationships;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`relationship_${relationshipType}_${language}_error`, executionTime);
      this.updateQueryStats(executionTime, false);
      this.logger.error(`关系查询失败 (${relationshipType}):`, error);
      return [];
    }
  }

  /**
   * 执行混合查询（实体和关系）
   */
  async executeMixedQuery(
    ast: Parser.SyntaxNode,
    queryTypes: string[],
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<MixedQueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const { useCache = true, filePath = '', includeRelationships = true } = options;

    try {
      // 检查缓存
      if (useCache) {
        const cacheKey = CacheService.forMixedQuery(ast, queryTypes, language);
        const cached = CacheService.getMixedResult(cacheKey);
        if (cached) {
          QueryPerformanceMonitor.recordCacheHit(true);
          this.queryStats.cacheHits++;
          return cached;
        }
        QueryPerformanceMonitor.recordCacheHit(false);
        this.queryStats.cacheMisses++;
      }

      const allEntities: EntityQueryResult[] = [];
      const allRelationships: RelationshipQueryResult[] = [];

      // 执行实体查询
      for (const queryType of queryTypes) {
        const config = queryConfigManager.getQueryTypeConfig(queryType);
        if (config && config.category === 'entity') {
          const entityTypes = config.entityTypes || [];
          for (const entityType of entityTypes) {
            const entities = await this.executeEntityQuery(ast, entityType, language, { ...options, useCache: false });
            allEntities.push(...entities);
          }
        }
      }

      // 识别关系
      if (includeRelationships) {
        allRelationships.push(...this.resultProcessor.identifyRelationships(allEntities, ast, language, filePath));
      }

      // 执行关系查询
      for (const queryType of queryTypes) {
        const config = queryConfigManager.getQueryTypeConfig(queryType);
        if (config && config.category === 'relationship') {
          const relationshipTypes = config.relationshipTypes || [];
          for (const relationshipType of relationshipTypes) {
            const relationships = await this.executeRelationshipQuery(ast, relationshipType, language, { ...options, useCache: false });
            allRelationships.push(...relationships);
          }
        }
      }

      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`mixed_${language}`, executionTime);
      CacheService.recordQueryTime(executionTime);

      const result: MixedQueryResult = {
        entities: allEntities,
        relationships: allRelationships,
        executionTime,
        success: true
      };

      // 缓存结果
      if (useCache) {
        const cacheKey = CacheService.forMixedQuery(ast, queryTypes, language);
        CacheService.setMixedResult(cacheKey, result);
      }

      // 更新统计
      this.updateQueryStats(executionTime, true);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`mixed_${language}_error`, executionTime);
      this.updateQueryStats(executionTime, false);
      this.logger.error(`混合查询失败:`, error);

      return {
        entities: [],
        relationships: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 批量执行实体查询
   */
  async executeMultipleEntityQueries(
    ast: Parser.SyntaxNode,
    entityTypes: EntityType[],
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<Map<EntityType, EntityQueryResult[]>> {
    const results = new Map<EntityType, EntityQueryResult[]>();

    // 使用并行查询提升性能
    const queryPromises = entityTypes.map(async (entityType) => {
      const entities = await this.executeEntityQuery(ast, entityType, language, options);
      return { entityType, entities };
    });

    const queryResults = await Promise.all(queryPromises);

    // 将结果存入Map
    for (const { entityType, entities } of queryResults) {
      results.set(entityType, entities);
    }

    return results;
  }

  /**
   * 批量执行关系查询
   */
  async executeMultipleRelationshipQueries(
    ast: Parser.SyntaxNode,
    relationshipTypes: RelationshipType[],
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<Map<RelationshipType, RelationshipQueryResult[]>> {
    const results = new Map<RelationshipType, RelationshipQueryResult[]>();

    // 使用并行查询提升性能
    const queryPromises = relationshipTypes.map(async (relationshipType) => {
      const relationships = await this.executeRelationshipQuery(ast, relationshipType, language, options);
      return { relationshipType, relationships };
    });

    const queryResults = await Promise.all(queryPromises);

    // 将结果存入Map
    for (const { relationshipType, relationships } of queryResults) {
      results.set(relationshipType, relationships);
    }

    return results;
  }

  // ==================== 简化查询方法 ====================

  /**
   * 查找函数 - 简化方法
   */
  async findFunctions(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.FUNCTION, language);
  }

  /**
   * 查找类型定义 - 简化方法
   */
  async findTypes(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.TYPE_DEFINITION, language);
  }

  /**
   * 查找变量 - 简化方法
   */
  async findVariables(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.VARIABLE, language);
  }

  /**
   * 查找预处理器 - 简化方法
   */
  async findPreprocessors(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.PREPROCESSOR, language);
  }

  /**
   * 查找注解 - 简化方法
   */
  async findAnnotations(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.ANNOTATION, language);
  }

  /**
   * 查找类 - 简化方法
   */
  async findClasses(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.TYPE_DEFINITION, language);
  }

  /**
   * 查找导入 - 简化方法
   */
  async findImports(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.INCLUDE, language) as Promise<any>;
  }

  /**
   * 查找导出 - 简化方法
   */
  async findExports(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.FUNCTION, language);
  }

  /**
   * 查找调用关系 - 简化方法
   */
  async findCalls(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.CALL, language);
  }

  /**
   * 查找数据流关系 - 简化方法
   */
  async findDataFlow(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.ASSIGNMENT, language);
  }

  /**
   * 查找控制流关系 - 简化方法
   */
  async findControlFlow(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.CONDITIONAL, language);
  }

  /**
   * 查找依赖关系 - 简化方法
   */
  async findDependencies(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.INCLUDE, language);
  }

  /**
   * 查找所有主要结构（函数、类型、变量）
   */
  async findAllMainStructures(ast: Parser.SyntaxNode, language: string): Promise<{
    functions: EntityQueryResult[];
    types: EntityQueryResult[];
    variables: EntityQueryResult[];
  }> {
    // 检查AST是否有效
    if (!ast) {
      return {
        functions: [],
        types: [],
        variables: []
      };
    }

    const [functions, types, variables] = await Promise.all([
      this.findFunctions(ast, language),
      this.findTypes(ast, language),
      this.findVariables(ast, language)
    ]);

    return {
      functions,
      types,
      variables
    };
  }

  // ==================== 性能和缓存管理 ====================

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    const allCacheStats = CacheService.getAllStats();
    const resultCacheStats = allCacheStats.entityCache || { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0, memoryUsage: 0 };

    return {
      queryMetrics: QueryPerformanceMonitor.getMetrics(),
      querySummary: QueryPerformanceMonitor.getSummary(),
      systemMetrics: QueryPerformanceMonitor.getSystemMetrics(),
      cacheStats: CacheService.getCacheStatistics(),
      engineCacheSize: resultCacheStats.size,
      allCacheStats: allCacheStats,
      queryStats: this.queryStats
    };
  }

  /**
   * 获取查询统计信息
   */
  getQueryStats(): QueryStats {
    return { ...this.queryStats };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    CacheService.clearAll();
  }

  /**
   * 预热缓存 - 为常见的查询类型预加载结果
   */
  async warmupCache(ast: Parser.SyntaxNode, language: string): Promise<void> {
    // 检查AST是否有效
    if (!ast) {
      return;
    }

    const commonEntityTypes = [EntityType.FUNCTION, EntityType.TYPE_DEFINITION, EntityType.VARIABLE];
    const commonRelationshipTypes = [RelationshipType.CALL, RelationshipType.ASSIGNMENT];

    // 并行预热所有常见查询类型
    const warmupPromises = [
      this.executeMultipleEntityQueries(ast, commonEntityTypes, language),
      this.executeMultipleRelationshipQueries(ast, commonRelationshipTypes, language)
    ];

    await Promise.all(warmupPromises);
  }

  /**
   * 检查查询系统是否已初始化
   */
  isQuerySystemInitialized(): boolean {
    return this.querySystemInitialized;
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取实体类型对应的查询类型
   */
  private getQueryTypesForEntityType(entityType: EntityType, language: string): string[] {
    const allQueryTypes = queryConfigManager.getAllQueryTypes();
    const matchingTypes: string[] = [];

    for (const queryType of allQueryTypes) {
      const config = queryConfigManager.getQueryTypeConfig(queryType);
      if (config &&
        config.category === 'entity' &&
        config.entityTypes?.includes(entityType) &&
        this.isQueryTypeSupportedForLanguage(config, language)) {
        matchingTypes.push(queryType);
      }
    }

    return matchingTypes;
  }

  /**
   * 获取关系类型对应的查询类型
   */
  private getQueryTypesForRelationshipType(relationshipType: RelationshipType, language: string): string[] {
    const allQueryTypes = queryConfigManager.getAllQueryTypes();
    const matchingTypes: string[] = [];

    for (const queryType of allQueryTypes) {
      const config = queryConfigManager.getQueryTypeConfig(queryType);
      if (config &&
        config.category === 'relationship' &&
        config.relationshipTypes?.includes(relationshipType) &&
        this.isQueryTypeSupportedForLanguage(config, language)) {
        matchingTypes.push(queryType);
      }
    }

    return matchingTypes;
  }

  /**
   * 检查查询类型是否支持指定语言
   */
  private isQueryTypeSupportedForLanguage(config: any, language: string): boolean {
    if (!config.supportedLanguages || config.supportedLanguages.length === 0) {
      return true;
    }
    return config.supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * 为指定查询类型执行查询
   */
  private async executeQueryForType(
    ast: Parser.SyntaxNode,
    queryType: string,
    language: string,
    filePath: string
  ): Promise<EntityQueryResult[]> {
    const config = queryConfigManager.getQueryTypeConfig(queryType);
    if (!config || !config.entityTypes) {
      return [];
    }

    const allEntities: EntityQueryResult[] = [];

    for (const entityType of config.entityTypes) {
      try {
        // 获取查询模式
        const pattern = await this.queryManager.getPattern(language, queryType);
        if (!pattern) {
          continue;
        }

        // 执行查询
        const matches = await this.executeQueryPattern(ast, pattern);

        // 处理结果
        const entities = this.resultProcessor.processEntityMatches(matches, entityType, language, filePath);
        allEntities.push(...entities);
      } catch (error) {
        this.logger.warn(`执行查询类型 ${queryType} 失败:`, error);
      }
    }

    return allEntities;
  }

  /**
   * 为指定关系查询类型执行查询
   */
  private async executeRelationshipQueryForType(
    ast: Parser.SyntaxNode,
    queryType: string,
    language: string,
    filePath: string
  ): Promise<RelationshipQueryResult[]> {
    const config = queryConfigManager.getQueryTypeConfig(queryType);
    if (!config || !config.relationshipTypes) {
      return [];
    }

    const allRelationships: RelationshipQueryResult[] = [];

    for (const relationshipType of config.relationshipTypes) {
      try {
        // 获取查询模式
        const pattern = await this.queryManager.getPattern(language, queryType);
        if (!pattern) {
          continue;
        }

        // 执行查询
        const matches = await this.executeQueryPattern(ast, pattern);

        // 处理结果（需要先获取实体）
        const entities = await this.getAllEntitiesForRelationships(ast, language, filePath);
        const relationships = this.resultProcessor.processRelationshipMatches(matches, relationshipType, language, filePath, entities);
        allRelationships.push(...relationships);
      } catch (error) {
        this.logger.warn(`执行关系查询类型 ${queryType} 失败:`, error);
      }
    }

    return allRelationships;
  }

  /**
   * 获取所有实体用于关系识别
   */
  private async getAllEntitiesForRelationships(ast: Parser.SyntaxNode, language: string, filePath: string): Promise<EntityQueryResult[]> {
    const entityQueryTypes = queryConfigManager.getEntityQueryTypes();
    const allEntities: EntityQueryResult[] = [];

    for (const queryType of entityQueryTypes) {
      const entities = await this.executeQueryForType(ast, queryType, language, filePath);
      allEntities.push(...entities);
    }

    return allEntities;
  }

  /**
   * 执行查询模式
   */
  private async executeQueryPattern(ast: Parser.SyntaxNode, pattern: string): Promise<QueryMatch[]> {
    try {
      // 获取语言对象
      const languageObj = await this.getLanguageObject('c'); // 简化实现，实际应该传入language参数
      if (!languageObj) {
        return [];
      }

      const query = CacheService.getQuery(languageObj, pattern);
      const matches = query.matches(ast);

      return matches.map(match => ({
        node: match.captures[0]?.node,
        captures: match.captures.reduce((acc, capture) => {
          acc[capture.name] = capture.node;
          return acc;
        }, {} as Record<string, Parser.SyntaxNode>),
        location: this.getNodeLocation(match.captures[0]?.node)
      }));
    } catch (error) {
      this.logger.error('查询执行失败:', error);
      return [];
    }
  }

  /**
   * 获取语言对象
   */
  private async getLanguageObject(language: string): Promise<Parser.Language | null> {
    try {
      const { DynamicParserManager } = await import('./DynamicParserManager');
      const tempCacheService = this.createTempCacheService();
      const dynamicManager = new DynamicParserManager(tempCacheService);
      const parser = await dynamicManager.getParser(language);

      if (parser) {
        return parser.getLanguage();
      }

      return null;
    } catch (error) {
      this.logger.warn(`无法获取语言对象 ${language}:`, error);
      return null;
    }
  }

  /**
   * 创建临时缓存服务
   */
  private createTempCacheService(): any {
    return {
      getFromCache: () => undefined,
      setCache: () => { },
      deleteFromCache: () => false,
      clearAllCache: () => { },
      getCacheStats: () => ({ totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0 }),
      cleanupExpiredEntries: () => { },
      isGraphCacheHealthy: () => true,
      checkMemoryUsage: () => { },
      aggressiveCleanup: () => { },
      startCleanupInterval: () => { },
      evictEntries: () => { },
      getGraphStatsCache: () => undefined,
      setGraphStatsCache: () => { },
      cacheGraphData: async () => { },
      getGraphData: async () => null,
      hasKey: () => false,
      getKeys: () => [],
      getSize: () => 0,
      updateConfig: () => { },
      stopCleanupInterval: () => { },
      forceCleanup: () => { },
      getPerformanceMetrics: () => ({ totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0, averageTTL: 0, expiredEntries: 0, memoryUsage: 0 }),
      preloadCache: () => { },
      getKeysByPattern: () => [],
      deleteByPattern: () => 0,
      getDatabaseSpecificCache: async () => null,
      setDatabaseSpecificCache: async () => { },
      invalidateDatabaseCache: async () => { },
      cacheNebulaGraphData: async () => { },
      getNebulaGraphData: async () => null,
      cacheVectorData: async () => { },
      getVectorData: async () => null
    };
  }

  /**
   * 获取节点位置
   */
  private getNodeLocation(node: Parser.SyntaxNode): QueryMatch['location'] {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  /**
   * 更新查询统计
   */
  private updateQueryStats(executionTime: number, success: boolean): void {
    this.queryStats.totalQueries++;
    if (success) {
      this.queryStats.successfulQueries++;
    } else {
      this.queryStats.failedQueries++;
    }
    this.queryStats.totalExecutionTime += executionTime;
    this.queryStats.averageExecutionTime = this.queryStats.totalExecutionTime / this.queryStats.totalQueries;
  }
}

// 为了保持向后兼容性，导出别名
export const TreeSitterQueryEngine = QueryExecutor;
export const TreeSitterQueryFacade = QueryExecutor;