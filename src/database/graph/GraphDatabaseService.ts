import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaSpaceManager } from '../nebula/space/NebulaSpaceManager';
import { GraphQueryBuilder } from '../nebula/query/GraphQueryBuilder';
import { ICacheService } from '../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../infrastructure/monitoring/types';
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
import { INebulaClient } from './interfaces';
import { IGraphDatabaseService, GraphDatabaseConfig, GraphQuery } from './interfaces';


@injectable()
export class GraphDatabaseService implements IGraphDatabaseService {
  private nebulaClient: INebulaClient;
  private spaceManager: NebulaSpaceManager;
  private queryBuilder: GraphQueryBuilder;
  private batchOptimizer: BatchProcessingService;
  private cacheService: ICacheService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private performanceMonitor: IPerformanceMonitor;
  private performanceOptimizer: BatchProcessingService;
  private config: GraphDatabaseConfig;
  private currentSpace: string | null = null;
  private isConnected: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.INebulaClient) nebulaClient: INebulaClient,
    @inject(TYPES.INebulaSpaceManager) spaceManager: NebulaSpaceManager,
    @inject(TYPES.GraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.BatchProcessingService) batchOptimizer: BatchProcessingService,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor,
    @inject(TYPES.PerformanceOptimizerService) performanceOptimizer: BatchProcessingService
  ) {
    // Initialize services directly
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaClient = nebulaClient;
    this.spaceManager = spaceManager;
    this.queryBuilder = queryBuilder;
    this.batchOptimizer = batchOptimizer;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.performanceOptimizer = performanceOptimizer;

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

    // Load graph-specific configuration from environment variables or default values
    this.loadGraphConfig();
  }

  private loadGraphConfig(): void {
    // Load configuration from environment variables with defaults
    const envConfig: Partial<GraphDatabaseConfig> = {};

    // Example of loading from environment variables:
    // const maxRetries = process.env.GRAPH_DB_MAX_RETRIES;
    // if (maxRetries) envConfig.maxRetries = parseInt(maxRetries, 10);

    // For now, we'll just use the default configuration
    // In a real implementation, you might want to load some settings from environment variables
    this.config = { ...this.config, ...envConfig };
  }

  async initialize(): Promise<boolean> {
    try {
      // 检查NEBULA_ENABLED环境变量
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        this.isConnected = false;
        this.logger.info('Graph database service is disabled via NEBULA_ENABLED environment variable, skipping initialization');
        return true; // 返回true表示服务成功初始化（但处于禁用状态）
      }

      this.logger.info('Initializing graph database service');

      // 初始化性能监控
      this.performanceMonitor.startPeriodicMonitoring();

      // 初始化Nebula client
      const nebulaInitialized = await this.nebulaClient.initialize();
      if (!nebulaInitialized) {
        this.logger.warn('Failed to initialize Nebula client, service will continue in degraded mode');
        this.isConnected = false;
        // 不抛出错误，允许服务在降级模式下继续运行
      } else {
        // 验证连接
        const connectionVerified = await this.checkConnection();
        if (!connectionVerified) {
          this.logger.warn('Nebula client initialized but connection verification failed, service will continue in degraded mode');
          this.isConnected = false;
        } else {
          this.isConnected = true;
          this.logger.info('Nebula client initialized and connection verified successfully');
        }
      }

      // 启动健康检查
      this.startHealthChecks();

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

      // 初始化批处理优化器
      try {
        // 验证批处理服务是否可用
        this.logger.debug('Batch processing service initialized');
      } catch (error) {
        this.logger.warn('Batch processing service initialization failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // 记录初始化状态
      const initializationStatus = {
        connected: this.isConnected,
        cachingEnabled: this.config.enableCaching,
        healthChecksEnabled: true,
        degradedMode: !this.isConnected
      };

      this.logger.info('Graph database service initialization completed', initializationStatus);

      // 如果处于降级模式，发出警告
      if (!this.isConnected) {
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
      // 使用底层客户端执行 USE 命令
      await this.nebulaClient.execute(`USE \`${spaceName}\``);
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

    // Check cache first
    if (this.config.enableCaching) {
      const cachedResult = this.cacheService.getFromCache<any>(cacheKey);
      if (cachedResult) {
        this.performanceMonitor.updateCacheHitRate(true);
        this.logger.debug('Cache hit for read query', { query: query.substring(0, 100) });
        return cachedResult;
      }
    }

    try {
      const result = await this.batchOptimizer.executeWithRetry(
        () => this.nebulaClient.execute(query, parameters),
        'executeReadQuery',
        { maxAttempts: this.config.maxRetries, baseDelay: this.config.retryDelay }
      );

      // Cache the result
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
      const result = await this.performanceOptimizer.executeWithRetry(
        () => this.nebulaClient.execute(query, parameters),
        'executeWriteQuery',
        { maxAttempts: this.config.maxRetries, baseDelay: this.config.retryDelay }
      );

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);

      // Invalidate related cache entries
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

    // Calculate optimal batch size based on query count
    const optimalBatchSize = 50; // Default batch size

    try {
      // Use batch processing for efficient execution
      const batchResults = await this.performanceOptimizer.processBatches(
        queries,
        async (batch: GraphQuery[]) => {
          // Execute queries individually since Nebula doesn't support transactions
          const results = [];
          for (const query of batch) {
            const result = await this.executeWriteQuery(query.nGQL, query.parameters);
            results.push(result);
          }

          return results;
        },
        {
          batchSize: optimalBatchSize,
          context: { domain: 'database', subType: 'nebula' }
        }
      );

      // Handle case where batchResults is not an array
      if (!Array.isArray(batchResults)) {
        this.logger.warn('Batch processing returned non-array result', { result: batchResults });
        return {
          success: true,
          results: [],
          executionTime: Date.now() - startTime,
        };
      }

      // Process results from batch processing
      const combinedResults: any[] = [];
      let hasError = false;
      let errorMessage = "";

      for (const result of batchResults) {
        if (Array.isArray(result)) {
          // It's an array of results from a batch
          combinedResults.push(...result);
        } else if (result && typeof result === 'object') {
          if (result.success !== undefined) {
            // It's a TransactionResult
            if (result.success) {
              combinedResults.push(...(result.results || []));
            } else {
              hasError = true;
              errorMessage = result.error || "Batch execution failed";
            }
          } else {
            // It's a regular result from executeWriteQuery
            combinedResults.push(result);
          }
        } else {
          // Handle primitive results
          combinedResults.push(result);
        }
      }

      return {
        success: !hasError,
        results: combinedResults,
        error: hasError ? errorMessage : undefined,
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

        // Clear cache for this space
        if (this.config.enableCaching) {
          // Since we don't have deleteByPattern, we'll need to implement a workaround
          // For now, we'll just log a warning that this functionality is not implemented
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
    // Create a deterministic cache key based on query and parameters
    const paramString = JSON.stringify(parameters || {});
    return `${this.currentSpace}_${query}_${paramString}`.replace(/\s+/g, '_');
  }

  private invalidateRelatedCache(query: string): void {
    // Simple cache invalidation based on query type
    if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
      // Clear all cache for the current space on write operations
      if (this.currentSpace) {
        // Since we don't have deleteByPattern, we'll need to implement a workaround
        // For now, we'll just log a warning that this functionality is not implemented
        this.logger.warn('Cache clearing by pattern not implemented', { currentSpace: this.currentSpace });
      }
    }
  }

  updateConfig(config: Partial<GraphDatabaseConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Graph database configuration updated', { config });

    // Restart health checks with new interval
    if (this.healthCheckInterval) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }
  }

  getConfig(): GraphDatabaseConfig {
    return { ...this.config };
  }

  getCurrentSpace(): string | null {
    return this.currentSpace;
  }

  private async connect(): Promise<boolean> {
    // Check if Nebula Graph is enabled
    const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
    if (!nebulaEnabled) {
      this.logger.info('Nebula Graph is disabled, skipping connection');
      return false; // Return false to indicate no actual connection
    }

    // For Nebula, we rely on NebulaClient to handle the actual connection
    // This is a simplified implementation that just checks if NebulaClient is connected
    const isConnected = this.nebulaClient.isConnected();

    // If NebulaClient claims to be connected but we know it's a mock connection,
    // we should still try to initialize it to set the proper state
    if (isConnected) {
      try {
        // Try to execute a simple test query to verify the connection is real
        await this.nebulaClient.execute('SHOW HOSTS', {});
        this.logger.info('Nebula Graph connection verified');
        return true;
      } catch (error) {
        this.logger.warn('Nebula Graph connection test failed, but client reports connected', {
          error: error instanceof Error ? error.message : String(error),
        });
        // If the test query fails, we'll consider it a degraded state
        // but still return true to allow the service to function in limited mode
        return true;
      }
    }

    return isConnected;
  }

  private async disconnect(): Promise<void> {
    // For Nebula, we rely on NebulaClient to handle the actual disconnection
    // This is a simplified implementation
    await this.nebulaClient.close();
    this.isConnected = false;
  }

  private async checkConnection(): Promise<boolean> {
    // For Nebula, we rely on NebulaClient to check the connection status
    return this.nebulaClient.isConnected();
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      this.logger.warn('Health checks are already running');
      return;
    }

    this.logger.info('Starting database health checks', { interval: this.config.healthCheckInterval });

    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.checkConnection();
        if (!isHealthy) {
          this.logger.warn('Database connection health check failed');
          // Attempt to reconnect
          await this.reconnect();
        }
      } catch (error) {
        this.logger.error('Database health check error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.healthCheckInterval);

    // Ensure interval doesn't prevent Node.js from exiting
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info('Stopped database health checks');
    }
  }

  private async reconnect(): Promise<boolean> {
    this.logger.info('Attempting to reconnect to database');

    try {
      // Disconnect first
      await this.disconnect();

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

      // Attempt to reconnect through NebulaClient
      const reconnected = await this.nebulaClient.initialize();
      if (reconnected) {
        this.isConnected = true;
        this.logger.info('Database reconnection successful');
        return true;
      }

      this.logger.error('Database reconnection failed');
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Database reconnection failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDatabaseService', operation: 'reconnect' }
      );
      return false;
    }
  }

  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.config.connectionTimeout
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Database operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph database service');

      // Stop health checks
      this.stopHealthChecks();

      // Stop performance monitoring
      this.performanceMonitor.stopPeriodicMonitoring();

      // Close Nebula client
      await this.nebulaClient.close();

      // Disconnect
      await this.disconnect();

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
}