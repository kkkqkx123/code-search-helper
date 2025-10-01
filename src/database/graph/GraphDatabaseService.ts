import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaService } from '../../NebulaService';
import { NebulaSpaceManager } from '../../nebula/NebulaSpaceManager';
import { GraphQueryBuilder } from '../../query/GraphQueryBuilder';
import { DatabaseService } from '../core/DatabaseService';
import { TransactionManager, TransactionOperation, TransactionResult } from '../core/TransactionManager';
import { IBatchOptimizer } from '../../../infrastructure/batching/types';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';

export interface GraphDatabaseConfig {
  defaultSpace: string;
  enableTransactions: boolean;
  enableCaching: boolean;
  cacheTTL: number;
  maxRetries: number;
  retryDelay: number;
}

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

@injectable()
export class GraphDatabaseService extends DatabaseService {
  private nebulaService: NebulaService;
  private spaceManager: NebulaSpaceManager;
  private queryBuilder: GraphQueryBuilder;
  private transactionManager: TransactionManager;
  private batchOptimizer: IBatchOptimizer;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private config: GraphDatabaseConfig;
  private currentSpace: string | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.NebulaSpaceManager) spaceManager: NebulaSpaceManager,
    @inject(TYPES.IGraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.TransactionManager) transactionManager: TransactionManager,
    @inject(TYPES.IBatchOptimizer) batchOptimizer: IBatchOptimizer,
    @inject(TYPES.ICacheService) cacheService: ICacheService,
    @inject(TYPES.IPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    super(logger, errorHandler, configService);
    this.nebulaService = nebulaService;
    this.spaceManager = spaceManager;
    this.queryBuilder = queryBuilder;
    this.transactionManager = transactionManager;
    this.batchOptimizer = batchOptimizer;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    
    this.config = {
      defaultSpace: 'default',
      enableTransactions: true,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
    };

    this.loadGraphConfig();
  }

  private loadGraphConfig(): void {
    const graphConfig = this.configService.get('graphDatabase');
    if (graphConfig) {
      this.config = { ...this.config, ...graphConfig };
    }
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph database service');
      
      // Initialize base database service
      const baseInitialized = await super.initialize();
      if (!baseInitialized) {
        throw new Error('Failed to initialize base database service');
      }

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
      const result = await this.executeWithRetry(() => 
        this.nebulaService.executeReadQuery(query, parameters)
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
      const result = await this.executeWithRetry(() => 
        this.nebulaService.executeWriteQuery(query, parameters)
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
      const result = await this.batchOptimizer.executeWithOptimalBatching(
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

      return result;
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
          this.cacheService.deleteByPattern(new RegExp(`^${spaceName}_`));
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
        this.cacheService.deleteByPattern(new RegExp(`^${this.currentSpace}_`));
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

  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph database service');
      
      // Stop performance monitoring
      this.performanceMonitor.stopPeriodicMonitoring();
      
      // Close Nebula service
      await this.nebulaService.close();
      
      // Close base database service
      await super.close();
      
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