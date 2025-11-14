import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { GraphDatabaseService } from '../../../database/graph/GraphDatabaseService';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import {
  GraphSearchOptions,
  GraphSearchResult,
  CodeGraphNode,
  CodeGraphRelationship
} from './types';
import { IGraphSearchService } from './IGraphSearchService';

// 导入工具类
import { CacheManager } from '../utils/CacheManager';
import { QueryBuilder } from '../utils/QueryBuilder';
import { PropertyFormatter } from '../utils/PropertyFormatter';

// 导入常量
import { ERROR_MESSAGES, LOG_MESSAGES } from '../constants/GraphSearchConstants';

@injectable()
export class GraphSearchServiceFinal implements IGraphSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private graphDatabase: GraphDatabaseService;
  private performanceMonitor: IPerformanceMonitor;
  private isInitialized: boolean = false;

  // 工具类实例
  private cacheManager: CacheManager;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.GraphDatabaseService) graphDatabase: GraphDatabaseService,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.graphDatabase = graphDatabase;
    this.performanceMonitor = performanceMonitor;

    // 初始化工具类
    this.cacheManager = new CacheManager(cacheService, performanceMonitor, configService, logger);
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info(LOG_MESSAGES.INITIALIZING);

      // 确保图数据库已初始化
      if (!this.graphDatabase.isDatabaseConnected()) {
        const initialized = await this.graphDatabase.initialize();
        if (!initialized) {
          throw new Error(ERROR_MESSAGES.DATABASE_INITIALIZATION_FAILED);
        }
      }

      this.isInitialized = true;
      this.logger.info(LOG_MESSAGES.INITIALIZATION_SUCCESS);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`${ERROR_MESSAGES.INITIALIZATION_FAILED}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchServiceFinal', operation: 'initialize' }
      );
      return false;
    }
  }

  async search(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateSearchCacheKey(query, options);

    try {
      this.logger.info(LOG_MESSAGES.EXECUTING_SEARCH, { query, options });

      // 使用缓存管理器执行带缓存的搜索
      return await this.cacheManager.executeWithCache(
        cacheKey,
        async () => {
          const searchQuery = QueryBuilder.buildSearchQuery(query, options);
          const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

          return this.cacheManager.createSearchResult(
            PropertyFormatter.formatNodes(result?.nodes || []),
            PropertyFormatter.formatRelationships(result?.relationships || []),
            Date.now() - startTime
          );
        }
      );
    } catch (error) {
      return this.handleSearchError(error, 'search', { query, options, startTime });
    }
  }

  async searchByNodeType(nodeType: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateNodeTypeCacheKey(nodeType, options);

    try {
      this.logger.info(LOG_MESSAGES.SEARCHING_BY_NODE_TYPE, { nodeType, options });

      return await this.cacheManager.executeWithCache(
        cacheKey,
        async () => {
          const searchQuery = QueryBuilder.buildNodeTypeQuery(nodeType, options);
          const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

          return this.cacheManager.createSearchResult(
            PropertyFormatter.formatNodes(result || []),
            [],
            Date.now() - startTime,
            true,
            false
          );
        }
      );
    } catch (error) {
      return this.handleSearchError(error, 'searchByNodeType', { nodeType, options, startTime });
    }
  }

  async searchByRelationshipType(relationshipType: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateRelationshipTypeCacheKey(relationshipType, options);

    try {
      this.logger.info(LOG_MESSAGES.SEARCHING_BY_RELATIONSHIP_TYPE, { relationshipType, options });

      return await this.cacheManager.executeWithCache(
        cacheKey,
        async () => {
          const searchQuery = QueryBuilder.buildRelationshipTypeQuery(relationshipType, options);
          const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

          return this.cacheManager.createSearchResult(
            [],
            PropertyFormatter.formatRelationships(result || []),
            Date.now() - startTime,
            false,
            true
          );
        }
      );
    } catch (error) {
      return this.handleSearchError(error, 'searchByRelationshipType', { relationshipType, options, startTime });
    }
  }

  async searchByPath(sourceId: string, targetId: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generatePathCacheKey(sourceId, targetId, options);

    try {
      this.logger.info(LOG_MESSAGES.SEARCHING_BY_PATH, { sourceId, targetId, options });

      return await this.cacheManager.executeWithCache(
        cacheKey,
        async () => {
          const searchQuery = QueryBuilder.buildPathQuery(sourceId, targetId, options);
          const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

          return this.cacheManager.createSearchResult(
            PropertyFormatter.formatNodes(result?.path?.nodes || []),
            PropertyFormatter.formatRelationships(result?.path?.relationships || []),
            Date.now() - startTime
          );
        }
      );
    } catch (error) {
      return this.handleSearchError(error, 'searchByPath', { sourceId, targetId, options, startTime });
    }
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      this.logger.debug(LOG_MESSAGES.GETTING_SEARCH_SUGGESTIONS, { query });

      // 在实际实现中，这将使用更复杂的建议算法
      // 目前，我们将根据查询返回一些模拟建议
      const suggestions: string[] = [];

      if (query.toLowerCase().includes('function')) {
        suggestions.push('函数名', '函数调用', '函数定义');
      }

      if (query.toLowerCase().includes('class')) {
        suggestions.push('类继承', '类方法', '类属性');
      }

      if (query.toLowerCase().includes('import')) {
        suggestions.push('导入路径', '导入模块', '导入依赖');
      }

      if (query.toLowerCase().includes('file')) {
        suggestions.push('文件路径', '文件内容', '文件依赖');
      }

      return suggestions.slice(0, 5); // 返回前5个建议
    } catch (error) {
      this.logger.error(ERROR_MESSAGES.SEARCH_SUGGESTIONS_FAILED, {
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  async getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }> {
    const metrics = this.performanceMonitor.getMetrics();
    return {
      totalSearches: metrics.queryExecutionTimes?.length || 0,
      avgExecutionTime: metrics.averageQueryTime || 0,
      cacheHitRate: metrics.cacheHitRate || 0,
    };
  }

  async close(): Promise<void> {
    try {
      this.logger.info(LOG_MESSAGES.CLOSING_SERVICE);
      this.isInitialized = false;
      // 如需要，关闭任何资源
      this.logger.info(LOG_MESSAGES.CLOSE_SERVICE_SUCCESS);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`${ERROR_MESSAGES.CLOSE_SERVICE_FAILED}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchServiceFinal', operation: 'close' }
      );
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  async isHealthy(): Promise<boolean> {
    try {
      // 检查服务是否已初始化
      if (!this.isInitialized) {
        return false;
      }

      // 检查Nebula Graph是否已启用
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        // 如果Nebula被禁用，则认为服务健康但性能降级
        this.logger.info(LOG_MESSAGES.HEALTH_CHECK.NEBULA_DISABLED);
        return true;
      }

      // 检查图数据库是否已连接
      if (!this.graphDatabase.isDatabaseConnected()) {
        return false;
      }

      // 尝试执行简单查询以验证连接
      await this.graphDatabase.executeReadQuery('SHOW HOSTS', {});

      return true;
    } catch (error) {
      this.logger.error(ERROR_MESSAGES.HEALTH_CHECK_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });

      // 检查错误是否与Nebula Graph被禁用/未配置有关
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        // 如果Nebula被禁用，则认为服务健康但性能降级
        this.logger.info(LOG_MESSAGES.HEALTH_CHECK.NEBULA_DISABLED_DESPITE_ERROR);
        return true;
      }

      return false;
    }
  }

  async getStatus(): Promise<any> {
    try {
      const isHealthy = await this.isHealthy();
      const isInitialized = this.isServiceInitialized();
      const isDbConnected = this.graphDatabase.isDatabaseConnected();

      return {
        healthy: isHealthy,
        initialized: isInitialized,
        databaseConnected: isDbConnected,
        serviceType: 'GraphSearchServiceFinal',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(ERROR_MESSAGES.GET_STATUS_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        healthy: false,
        initialized: false,
        databaseConnected: false,
        serviceType: 'GraphSearchServiceFinal',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  // 空间管理方法委托给数据库层
  async createSpace(projectId: string, config?: any): Promise<boolean> {
    return this.graphDatabase.createSpace(projectId, config);
  }

  async dropSpace(projectId: string): Promise<boolean> {
    return this.graphDatabase.deleteSpace(projectId);
  }

  async clearSpace(projectId: string): Promise<boolean> {
    return this.graphDatabase.clearSpace(projectId);
  }

  async getSpaceInfo(projectId: string): Promise<any> {
    return this.graphDatabase.getSpaceInfo(projectId);
  }

  // 批处理方法委托给数据库层
  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    return this.graphDatabase.batchInsertNodes(nodes, projectId);
  }

  async batchInsertEdges(edges: any[], projectId: string): Promise<any> {
    return this.graphDatabase.batchInsertEdges(edges, projectId);
  }

  async batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean> {
    return this.graphDatabase.batchDeleteNodes(nodeIds, projectId);
  }

  /**
   * 处理搜索错误的通用方法
   */
  private handleSearchError(
    error: any,
    operation: string,
    context: any
  ): GraphSearchResult {
    const startTime = context.startTime || Date.now();
    const errorContext = {
      component: 'GraphSearchServiceFinal',
      operation,
      ...context,
      duration: Date.now() - startTime,
    };

    this.errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      errorContext
    );

    this.logger.error(ERROR_MESSAGES.SEARCH_FAILED, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });

    // 错误情况下返回空结果
    return this.cacheManager.createEmptyResult(Date.now() - startTime);
  }
}