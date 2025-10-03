import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaService } from '../nebula/NebulaService';
import { NebulaSpaceManager } from '../nebula/NebulaSpaceManager';
import { GraphQueryBuilder } from '../query/GraphQueryBuilder';
import { TransactionManager, TransactionOperation } from '../core/TransactionManager';
import { TransactionResult } from '../core/TransactionManager';
import { IBatchOptimizer } from '../../infrastructure/batching/types';
import { ICacheService } from '../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../infrastructure/monitoring/types';
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';

export interface GraphDatabaseConfig {
  defaultSpace: string;
  enableTransactions: boolean;
  enableCaching: boolean;
  cacheTTL: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  healthCheckInterval: number;
}

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}


@injectable()
export class GraphDatabaseService {
  private nebulaService: NebulaService;
  private spaceManager: NebulaSpaceManager;
  private queryBuilder: GraphQueryBuilder;
  private transactionManager: TransactionManager;
  private batchOptimizer: IBatchOptimizer;
  private cacheService: ICacheService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private performanceMonitor: IPerformanceMonitor;
  private performanceOptimizer: PerformanceOptimizerService;
  private config: GraphDatabaseConfig;
  private currentSpace: string | null = null;
  private isConnected: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.INebulaSpaceManager) spaceManager: NebulaSpaceManager,
    @inject(TYPES.GraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: IBatchOptimizer,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor,
    @inject(TYPES.PerformanceOptimizerService) performanceOptimizer: PerformanceOptimizerService
  ) {
    // Initialize services directly
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaService = nebulaService;
    this.spaceManager = spaceManager;
    this.queryBuilder = queryBuilder;
    this.transactionManager = new TransactionManager(logger, errorHandler);
    this.batchOptimizer = batchOptimizer;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.performanceOptimizer = performanceOptimizer;

    this.config = {
      defaultSpace: 'default',
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
      this.logger.info('Initializing graph database service');

      // Initialize connection
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      // Start health checks
      this.startHealthChecks();

      this.isConnected = true;

      // Initialize Nebula service
      const nebulaInitialized = await this.nebulaService.initialize();
      if (!nebulaInitialized) {
        throw new Error('Failed to initialize Nebula service');
      }

      // Set default space
      await this.useSpace(this.config.defaultSpace);

      this.logger.info('Graph database service initialized successfully');
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
      await this.nebulaService.useSpace(spaceName);
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
      const result = await this.performanceOptimizer.executeWithRetry(
        () => this.nebulaService.executeReadQuery(query, parameters),
        'executeReadQuery'
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
        () => this.nebulaService.executeWriteQuery(query, parameters),
        'executeWriteQuery'
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

  async executeTransaction(queries: GraphQuery[]): Promise<TransactionResult> {
    if (!this.config.enableTransactions) {
      throw new Error('Transactions are disabled in configuration');
    }

    const transactionId = await this.transactionManager.beginTransaction();

    try {
      // Add all queries to the transaction
      for (const query of queries) {
        await this.transactionManager.addOperation(transactionId, query);
      }

      // Execute the transaction
      const result = await this.transactionManager.commitTransaction(
        transactionId,
        async (operations) => {
          const startTime = Date.now();

          try {
            // Execute all operations in sequence
            const results = [];
            for (const operation of operations) {
              const result = await this.nebulaService.executeWriteQuery(
                operation.nGQL,
                operation.parameters || {}
              );
              results.push(result);
            }

            const executionTime = Date.now() - startTime;
            this.performanceMonitor.recordQueryExecution(executionTime);

            return {
              success: true,
              results,
              executionTime,
            };
          } catch (error) {
            const executionTime = Date.now() - startTime;
            this.performanceMonitor.recordQueryExecution(executionTime);

            return {
              success: false,
              results: [],
              error: error instanceof Error ? error.message : String(error),
              executionTime,
            };
          }
        }
      );

      // Invalidate cache on successful transaction
      if (result.success && this.config.enableCaching) {
        for (const query of queries) {
          this.invalidateRelatedCache(query.nGQL);
        }
      }

      return result;
    } catch (error) {
      // Rollback on error
      await this.transactionManager.rollbackTransaction(transactionId);

      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
      };
    }
  }

  async executeBatch(queries: GraphQuery[]): Promise<TransactionResult> {
    const startTime = Date.now();

    try {
      // Use batch optimizer for efficient execution
      const batchResults = await this.batchOptimizer.executeWithOptimalBatching(
        queries,
        async (batch) => {
          if (this.config.enableTransactions && batch.length > 1) {
            return await this.executeTransaction(batch);
          } else {
            // Execute queries individually
            const results = [];
            for (const query of batch) {
              const result = await this.executeWriteQuery(query.nGQL, query.parameters);
              results.push(result);
            }

            return {
              success: true,
              results,
              executionTime: Date.now() - startTime,
            };
          }
        },
        { concurrency: 3 }
      );

      // Since batchResults is an array of results from each batch,
      // we need to combine them into a single TransactionResult
      const combinedResults: any[] = [];
      let totalExecutionTime = 0;
      let hasError = false;
      let errorMessage = "";

      for (const batchResult of batchResults) {
        if (batchResult.success !== undefined) {
          // It's a TransactionResult
          if (batchResult.success) {
            combinedResults.push(...batchResult.results);
          } else {
            hasError = true;
            errorMessage = batchResult.error || "Batch execution failed";
          }
          totalExecutionTime += batchResult.executionTime || 0;
        } else {
          // It's a regular result from executeWriteQuery
          combinedResults.push(batchResult);
        }
      }

      return {
        success: !hasError,
        results: combinedResults,
        error: hasError ? errorMessage : undefined,
        executionTime: totalExecutionTime || Date.now() - startTime,
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
      const nebulaStats = await this.nebulaService.getDatabaseStats();
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
    // For Nebula, we rely on NebulaService to handle the actual connection
    // This is a simplified implementation that just checks if NebulaService is connected
    return this.nebulaService.isConnected();
  }

  private async disconnect(): Promise<void> {
    // For Nebula, we rely on NebulaService to handle the actual disconnection
    // This is a simplified implementation
    await this.nebulaService.close();
    this.isConnected = false;
  }

  private async checkConnection(): Promise<boolean> {
    // For Nebula, we rely on NebulaService to check the connection status
    return this.nebulaService.isConnected();
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

      // Attempt to reconnect through NebulaService
      const reconnected = await this.nebulaService.initialize();
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

      // Close Nebula service
      await this.nebulaService.close();

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
}