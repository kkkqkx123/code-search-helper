import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaSpaceManager } from '../nebula/space/NebulaSpaceManager';
import { NebulaConnectionManager } from '../nebula/NebulaConnectionManager';
import { NebulaDataBatchProcessor } from '../nebula/batch/NebulaDataBatchProcessor';
import { ICacheService } from '../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../infrastructure/monitoring/types';
import { INebulaClient } from './interfaces';
import { IGraphDatabaseService, GraphDatabaseConfig, GraphQuery } from './interfaces';

@injectable()
export class GraphDatabaseService implements IGraphDatabaseService {
  private nebulaClient: INebulaClient;
  private spaceManager: NebulaSpaceManager;
  private connectionManager: NebulaConnectionManager;
  private batchProcessor: NebulaDataBatchProcessor;
  private cacheService: ICacheService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private performanceMonitor: IPerformanceMonitor;
  private config: GraphDatabaseConfig;
  private currentSpace: string | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.INebulaClient) nebulaClient: INebulaClient,
    @inject(TYPES.INebulaSpaceManager) spaceManager: NebulaSpaceManager,
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

    // 初始化配置
    this.config = {
      defaultSpace: 'test_space',
      enableTransactions: true,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      connectionTimeout: 30000,
      healthCheckInterval: 60000,
    };

    this.loadGraphConfig();
  }

  private loadGraphConfig(): void {
    // 从环境变量加载配置，使用默认值
    const envConfig: Partial<GraphDatabaseConfig> = {};
    this.config = { ...this.config, ...envConfig };
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph database service');

      // 检查NEBULA_ENABLED环境变量
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        this.logger.info('Graph database service is disabled via NEBULA_ENABLED environment variable, skipping initialization');
        return true; // 返回true表示服务成功初始化（但处于禁用状态）
      }

      // 初始化性能监控
      this.performanceMonitor.startPeriodicMonitoring();

      // 验证连接状态
      const connectionStatus = this.connectionManager.getConnectionStatus();
      if (!connectionStatus.connected) {
        this.logger.warn('Nebula connection manager reports not connected, service will continue in degraded mode');
      } else {
        this.logger.info('Nebula connection manager reports connected');
      }

      // 初始化缓存服务
      if (this.config.enableCaching) {
        try {
          // 验证缓存服务是否可用
          const cacheStats = this.cacheService.getCacheStats();
          this.logger.debug('Cache service initialized', { stats: cacheStats });
        } catch (error) {
          this.logger.warn('Cache service initialization failed, caching will be disabled', {
            error: error instanceof Error ? error.message : String(error)
          });
          this.config.enableCaching = false;
        }
      }

      // 记录初始化状态
      const initializationStatus = {
        connected: connectionStatus.connected,
        cachingEnabled: this.config.enableCaching,
        healthChecksEnabled: true,
        degradedMode: !connectionStatus.connected
      };

      this.logger.info('Graph database service initialization completed', initializationStatus);

      // 如果处于降级模式，发出警告
      if (!connectionStatus.connected) {
        this.logger.warn('Graph database service is running in degraded mode - some features may be limited');
      }

      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph database service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'initialize' }
      );
      return false;
    }
  }

  async useSpace(spaceName: string): Promise<void> {
    try {
      // 使用连接管理器执行 USE 命令
      await this.connectionManager.executeQuery(`USE \`${spaceName}\``, {});
      this.currentSpace = spaceName;
      this.logger.debug('Switched to space', { spaceName });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to switch to space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'useSpace' }
      );
      throw error;
    }
  }

  async executeReadQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, parameters);

    // 检查缓存
    if (this.config.enableCaching) {
      const cachedResult = this.cacheService.getFromCache<any>(cacheKey);
      if (cachedResult) {
        this.performanceMonitor.updateCacheHitRate(true);
        this.logger.debug('Cache hit for read query', { query: query.substring(0, 100) });
        return cachedResult;
      }
    }

    try {
      const result = await this.connectionManager.executeQuery(query, parameters);

      // 缓存结果
      if (this.config.enableCaching && result) {
        this.cacheService.setCache(cacheKey, result, this.config.cacheTTL);
      }

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);
      this.performanceMonitor.updateCacheHitRate(false);

      this.logger.debug('Read query executed successfully', {
        query: query.substring(0, 100),
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);

      this.errorHandler.handleError(
        new Error(`Failed to execute read query: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphDatabaseService',
          operation: 'executeReadQuery',
          query: query.substring(0, 100),
          executionTime,
        }
      );
      throw error;
    }
  }

  async executeWriteQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();

    try {
      const result = await this.connectionManager.executeQuery(query, parameters);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);

      // 使相关缓存失效
      if (this.config.enableCaching) {
        this.invalidateRelatedCache(query);
      }

      this.logger.debug('Write query executed successfully', {
        query: query.substring(0, 100),
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);

      this.errorHandler.handleError(
        new Error(`Failed to execute write query: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphDatabaseService',
          operation: 'executeWriteQuery',
          query: query.substring(0, 100),
          executionTime,
        }
      );
      throw error;
    }
  }

  async executeBatch(queries: GraphQuery[]): Promise<any> {
    const startTime = Date.now();

    try {
      // 使用批处理器执行批量查询
      const results = [];
      for (const query of queries) {
        const result = await this.executeWriteQuery(query.nGQL, query.parameters);
        results.push(result);
      }

      return {
        success: true,
        results,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to execute batch queries: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphDatabaseService',
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
        { component: 'GraphDatabaseService', operation: 'createSpace' }
      );
      return false;
    }
  }

  async deleteSpace(spaceName: string): Promise<boolean> {
    try {
      const deleted = await this.spaceManager.deleteSpace(spaceName);
      if (deleted) {
        this.logger.info('Space deleted successfully', { spaceName });

        // 清除此空间的缓存
        if (this.config.enableCaching) {
          this.logger.warn('Cache clearing by pattern not implemented', { spaceName });
        }
      }
      return deleted;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to delete space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'deleteSpace' }
      );
      return false;
    }
  }

  async spaceExists(spaceName: string): Promise<boolean> {
    try {
      return await this.spaceManager.checkSpaceExists(spaceName);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to check if space exists ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'spaceExists' }
      );
      return false;
    }
  }

  async getDatabaseStats(): Promise<any> {
    try {
      const nebulaStats = await this.nebulaClient.getStats();
      const performanceStats = this.performanceMonitor.getMetrics();
      const cacheStats = this.cacheService.getCacheStats();

      return {
        ...nebulaStats,
        performance: performanceStats,
        cache: cacheStats,
        currentSpace: this.currentSpace,
        isConnected: this.isDatabaseConnected(),
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get database stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'getDatabaseStats' }
      );
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private generateCacheKey(query: string, parameters: Record<string, any>): string {
    const paramString = JSON.stringify(parameters || {});
    return `${this.currentSpace}_${query}_${paramString}`.replace(/\s+/g, '_');
  }

  private invalidateRelatedCache(query: string): void {
    // 简单的缓存失效基于查询类型
    if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
      // 清除当前空间的所有缓存
      if (this.currentSpace) {
        this.logger.warn('Cache clearing by pattern not implemented', { currentSpace: this.currentSpace });
      }
    }
  }

  updateConfig(config: Partial<GraphDatabaseConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Graph database configuration updated', { config });
  }

  getConfig(): GraphDatabaseConfig {
    return { ...this.config };
  }

  getCurrentSpace(): string | null {
    return this.currentSpace;
  }

  isDatabaseConnected(): boolean {
    const connectionStatus = this.connectionManager.getConnectionStatus();
    return connectionStatus.connected;
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph database service');

      // 停止性能监控
      this.performanceMonitor.stopPeriodicMonitoring();

      // 关闭Nebula客户端
      await this.nebulaClient.close();

      this.logger.info('Graph database service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close graph database service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'close' }
      );
      throw error;
    }
  }

  /**
   * 获取底层 NebulaClient 实例
   * 用于高级操作和直接访问底层功能
   */
  getNebulaClient(): INebulaClient {
    return this.nebulaClient;
  }

  // 新增的批处理方法
  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    try {
      // 转换为NebulaNode格式
      const nebulaNodes = nodes.map(node => ({
        id: node.id || node._id,
        label: node.type || node.label || 'default',
        properties: node.properties || node.props || {}
      }));

      await this.useSpace(projectId);
      await this.batchProcessor.batchInsertNodes(nebulaNodes);
      
      return {
        success: true,
        insertedCount: nodes.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch insert nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'batchInsertNodes' }
      );
      
      return {
        success: false,
        insertedCount: 0,
        failedCount: nodes.length,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  async batchInsertEdges(edges: any[], projectId: string): Promise<any> {
    try {
      // 转换为NebulaRelationship格式
      const nebulaRelationships = edges.map(edge => ({
        id: edge.id || edge._id,
        type: edge.type || edge.edgeType || 'default',
        sourceId: edge.sourceId || edge.src || edge.from,
        targetId: edge.targetId || edge.dst || edge.to,
        properties: edge.properties || edge.props || {}
      }));

      await this.useSpace(projectId);
      await this.batchProcessor.insertRelationships(nebulaRelationships);
      
      return {
        success: true,
        insertedCount: edges.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch insert edges: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'batchInsertEdges' }
      );
      
      return {
        success: false,
        insertedCount: 0,
        failedCount: edges.length,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  async batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean> {
    try {
      await this.useSpace(projectId);
      
      // 构建删除查询
      const nodeIdsStr = nodeIds.map(id => `"${id}"`).join(', ');
      const deleteQuery = `DELETE VERTEX ${nodeIdsStr} WITH EDGE`;
      
      await this.connectionManager.executeQuery(deleteQuery, {});
      
      this.logger.info('Nodes deleted successfully', { projectId, nodeCount: nodeIds.length });
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch delete nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'batchDeleteNodes' }
      );
      return false;
    }
  }

  // 新增的空间管理方法
  async clearSpace(projectId: string): Promise<boolean> {
    try {
      this.logger.info('Clearing space', { projectId });
      const cleared = await this.spaceManager.clearSpace(projectId);
      if (cleared) {
        this.logger.info('Space cleared successfully', { projectId });
      }
      return cleared;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to clear space ${projectId}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'clearSpace' }
      );
      return false;
    }
  }

  async getSpaceInfo(projectId: string): Promise<any> {
    try {
      this.logger.info('Getting space info', { projectId });
      const spaceInfo = await this.spaceManager.getSpaceInfo(projectId);
      return spaceInfo;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get space info for ${projectId}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'getSpaceInfo' }
      );
      return null;
    }
  }
}