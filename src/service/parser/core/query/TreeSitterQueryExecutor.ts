import Parser from 'tree-sitter';
import { QueryRegistryImpl } from './QueryRegistry';
import { LoggerService } from '../../../../utils/LoggerService';
import { QueryCache } from './QueryCache';
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
import { queryConfigManager } from './query-config';
import { initializeLanguageFactories } from './types/languages';

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
 * Tree-sitter查询引擎 - 全新版本
 * 使用新的实体和关系类型系统，集成缓存和性能监控
 */
export class TreeSitterQueryEngine {
  private queryRegistry = QueryRegistryImpl;
  private logger = new LoggerService();
  private initialized = false;
  private resultProcessor: QueryResultProcessor;
  private entityRegistry: EntityTypeRegistry;
  private relationshipRegistry: RelationshipTypeRegistry;

  constructor() {
    // 初始化语言工厂
    initializeLanguageFactories();
    
    this.resultProcessor = new QueryResultProcessor();
    this.entityRegistry = EntityTypeRegistry.getInstance();
    this.relationshipRegistry = RelationshipTypeRegistry.getInstance();
    
    this.initialize();
  }

  /**
   * 异步初始化
   */
  private async initialize(): Promise<void> {
    try {
      const success = await QueryRegistryImpl.initialize();
      if (success) {
        this.initialized = true;
        this.logger.info('TreeSitterQueryEngine 初始化完成');
      } else {
        this.logger.warn('TreeSitterQueryEngine 初始化失败: 全局查询系统初始化失败');
      }
    } catch (error) {
      this.logger.error('TreeSitterQueryEngine 初始化失败:', error);
    }
  }

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
        const cacheKey = QueryCache.forEntityQuery(ast, entityType, language);
        const cached = QueryCache.getEntityResult(cacheKey);
        if (cached) {
          QueryPerformanceMonitor.recordCacheHit(true);
          return cached;
        }
        QueryPerformanceMonitor.recordCacheHit(false);
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

      // 缓存结果
      if (useCache) {
        const cacheKey = QueryCache.forEntityQuery(ast, entityType, language);
        QueryCache.setEntityResult(cacheKey, allEntities);
      }

      return allEntities;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`entity_${entityType}_${language}_error`, executionTime);
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
        const cacheKey = QueryCache.forRelationshipQuery(ast, relationshipType, language);
        const cached = QueryCache.getRelationshipResult(cacheKey);
        if (cached) {
          QueryPerformanceMonitor.recordCacheHit(true);
          return cached;
        }
        QueryPerformanceMonitor.recordCacheHit(false);
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

      // 缓存结果
      if (useCache) {
        const cacheKey = QueryCache.forRelationshipQuery(ast, relationshipType, language);
        QueryCache.setRelationshipResult(cacheKey, allRelationships);
      }

      return allRelationships;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`relationship_${relationshipType}_${language}_error`, executionTime);
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
        const cacheKey = QueryCache.forMixedQuery(ast, queryTypes, language);
        const cached = QueryCache.getMixedResult(cacheKey);
        if (cached) {
          QueryPerformanceMonitor.recordCacheHit(true);
          return cached;
        }
        QueryPerformanceMonitor.recordCacheHit(false);
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

      const result: MixedQueryResult = {
        entities: allEntities,
        relationships: allRelationships,
        executionTime,
        success: true
      };

      // 缓存结果
      if (useCache) {
        const cacheKey = QueryCache.forMixedQuery(ast, queryTypes, language);
        QueryCache.setMixedResult(cacheKey, result);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`mixed_${language}_error`, executionTime);
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

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    const allCacheStats = QueryCache.getAllStats();
    const resultCacheStats = allCacheStats.entityCache || { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0, memoryUsage: 0 };

    return {
      queryMetrics: QueryPerformanceMonitor.getMetrics(),
      querySummary: QueryPerformanceMonitor.getSummary(),
      systemMetrics: QueryPerformanceMonitor.getSystemMetrics(),
      cacheStats: QueryCache.getStats(),
      engineCacheSize: resultCacheStats.size,
      allCacheStats: allCacheStats
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    QueryCache.clearCache();
  }

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
        const pattern = await this.queryRegistry.getPattern(language, queryType);
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
        const pattern = await this.queryRegistry.getPattern(language, queryType);
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

      const query = QueryCache.getQuery(languageObj, pattern);
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
      const { DynamicParserManager } = await import('../parse/DynamicParserManager');
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
}

// 重新导出类型以供其他模块使用
export type { EntityQueryResult, RelationshipQueryResult } from './types';