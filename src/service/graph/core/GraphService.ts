import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaClient } from '../../../database/nebula/client/NebulaClient';
import { NebulaSpaceManager } from '../../../database/nebula/space/NebulaSpaceManager';
import { NebulaConnectionManager } from '../../../database/nebula/NebulaConnectionManager';
import { NebulaDataBatchProcessor } from '../../../database/nebula/batch/NebulaDataBatchProcessor';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { IGraphService } from './IGraphService';

/**
 * 统一的图服务入口
 * 职责：协调各个图服务，直接使用 database/nebula 层组件
 * 移除了 GraphDatabaseService 的中间抽象层
 */
@injectable()
export class GraphService implements IGraphService {
  private nebulaClient: NebulaClient;
  private spaceManager: NebulaSpaceManager;
  private connectionManager: NebulaConnectionManager;
  private batchProcessor: NebulaDataBatchProcessor;
  private cacheService: ICacheService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private performanceMonitor: IPerformanceMonitor;
  private currentSpace: string | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaClient) nebulaClient: NebulaClient,
    @inject(TYPES.NebulaSpaceManager) spaceManager: NebulaSpaceManager,
    @inject(TYPES.NebulaConnectionManager) connectionManager: NebulaConnectionManager,
    @inject(TYPES.NebulaDataBatchProcessor) batchProcessor: NebulaDataBatchProcessor,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaClient = nebulaClient;
    this.spaceManager = spaceManager;
    this.connectionManager = connectionManager;
    this.batchProcessor = batchProcessor;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * 初始化图服务
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph service');

      // 检查NEBULA_ENABLED环境变量
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        this.logger.info('Graph service is disabled via NEBULA_ENABLED environment variable');
        return true;
      }

      // 初始化性能监控
      this.performanceMonitor.startPeriodicMonitoring?.();

      // 验证连接状态
      const connectionStatus = this.connectionManager.getConnectionStatus();
      if (!connectionStatus.connected) {
        this.logger.warn('Nebula connection manager reports not connected, service will continue in degraded mode');
      }

      // 初始化缓存服务
      try {
        const cacheStats = this.cacheService.getCacheStats();
        this.logger.debug('Cache service initialized', { stats: cacheStats });
      } catch (error) {
        this.logger.warn('Cache service initialization failed, caching will be disabled');
      }

      this.logger.info('Graph service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'initialize' }
      );
      return false;
    }
  }

  /**
   * 执行读查询（带缓存）
   */
  async executeReadQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, parameters);

    // 检查缓存
    const cachedResult = this.cacheService.getFromCache<any>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate?.(true);
      this.logger.debug('Cache hit for read query', { query: query.substring(0, 100) });
      return cachedResult;
    }

    try {
      const result = await this.nebulaClient.execute(query, parameters);

      // 缓存结果
      if (result) {
        this.cacheService.setCache(cacheKey, result, 300000); // 5分钟
      }

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);
      this.performanceMonitor.updateCacheHitRate?.(false);

      this.logger.debug('Read query executed successfully', {
        query: query.substring(0, 100),
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Failed to execute read query: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphService',
          operation: 'executeReadQuery',
          query: query.substring(0, 100),
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 执行写查询
   */
  async executeWriteQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();

    try {
      const result = await this.nebulaClient.execute(query, parameters);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      // 使相关缓存失效
      this.invalidateRelatedCache(query);

      this.logger.debug('Write query executed successfully', {
        query: query.substring(0, 100),
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Failed to execute write query: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphService',
          operation: 'executeWriteQuery',
          query: query.substring(0, 100),
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 批量执行查询
   */
  async executeBatch(queries: Array<{ nGQL: string; parameters?: Record<string, any> }>): Promise<any> {
    const startTime = Date.now();

    try {
      const batchQueries = queries.map(q => ({ query: q.nGQL, params: q.parameters }));
      const results = await this.nebulaClient.executeBatch(batchQueries);

      return {
        success: true,
        results,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to execute batch queries: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphService',
          operation: 'executeBatch',
          queryCount: queries.length,
        }
      );

      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 切换空间
   */
  async useSpace(spaceName: string): Promise<void> {
    try {
      await this.connectionManager.executeQuery(`USE \`${spaceName}\``, {});
      this.currentSpace = spaceName;
      this.logger.debug('Switched to space', { spaceName });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to switch to space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'useSpace' }
      );
      throw error;
    }
  }

  /**
   * 创建空间
   */
  async createSpace(spaceName: string, options?: any): Promise<boolean> {
    try {
      const created = await this.spaceManager.createSpace(spaceName, options);
      if (created) {
        this.logger.info('Space created successfully', { spaceName });
      }
      return created;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to create space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'createSpace' }
      );
      return false;
    }
  }

  /**
   * 删除空间
   */
  async deleteSpace(spaceName: string): Promise<boolean> {
    try {
      const deleted = await this.spaceManager.deleteSpace(spaceName);
      if (deleted) {
        this.logger.info('Space deleted successfully', { spaceName });
      }
      return deleted;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to delete space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'deleteSpace' }
      );
      return false;
    }
  }

  /**
   * 检查空间是否存在
   */
  async spaceExists(spaceName: string): Promise<boolean> {
    try {
      return await this.spaceManager.checkSpaceExists(spaceName);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to check if space exists ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'spaceExists' }
      );
      return false;
    }
  }

  /**
   * 批量插入节点
   */
  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    try {
      await this.useSpace(projectId);
      await this.batchProcessor.batchInsertNodes(nodes);
      
      return {
        success: true,
        insertedCount: nodes.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch insert nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'batchInsertNodes' }
      );
      
      return {
        success: false,
        insertedCount: 0,
        failedCount: nodes.length,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * 批量插入边
   */
  async batchInsertEdges(edges: any[], projectId: string): Promise<any> {
    try {
      await this.useSpace(projectId);
      await this.batchProcessor.insertRelationships(edges);
      
      return {
        success: true,
        insertedCount: edges.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch insert edges: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'batchInsertEdges' }
      );
      
      return {
        success: false,
        insertedCount: 0,
        failedCount: edges.length,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * 获取当前空间
   */
  getCurrentSpace(): string | null {
    return this.currentSpace;
  }

  /**
   * 检查数据库连接状态
   */
  isDatabaseConnected(): boolean {
    const connectionStatus = this.connectionManager.getConnectionStatus();
    return connectionStatus.connected;
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph service');

      // 停止性能监控
      this.performanceMonitor.stopPeriodicMonitoring?.();

      // 关闭Nebula客户端
      await this.nebulaClient.close();

      this.logger.info('Graph service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close graph service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'close' }
      );
      throw error;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: string, parameters: Record<string, any>): string {
    const paramString = JSON.stringify(parameters || {});
    return `${this.currentSpace}_${query}_${paramString}`.replace(/\s+/g, '_');
  }

  /**
   * 使相关缓存失效
   */
  private invalidateRelatedCache(query: string): void {
    // 简单的缓存失效基于查询类型
    if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
      // 清除当前空间的所有缓存
      if (this.currentSpace) {
        this.logger.warn('Cache clearing by pattern not implemented', { currentSpace: this.currentSpace });
      }
    }
  }
}