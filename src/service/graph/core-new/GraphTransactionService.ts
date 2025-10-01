import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { GraphDatabaseService } from '../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../database/query/GraphQueryBuilder';
import { IBatchOptimizer } from '../../../infrastructure/batching/types';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { TransactionManager, TransactionOperation, TransactionResult } from '../../../database/core/TransactionManager';

export interface GraphTransactionConfig {
  enableTransactions: boolean;
  maxBatchSize: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

@injectable()
export class GraphTransactionService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private graphDatabase: GraphDatabaseService;
  private queryBuilder: GraphQueryBuilder;
  private batchOptimizer: IBatchOptimizer;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private transactionManager: TransactionManager;
  private config: GraphTransactionConfig;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.GraphDatabaseService) graphDatabase: GraphDatabaseService,
    @inject(TYPES.IGraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.IBatchOptimizer) batchOptimizer: IBatchOptimizer,
    @inject(TYPES.ICacheService) cacheService: ICacheService,
    @inject(TYPES.IPerformanceMonitor) performanceMonitor: IPerformanceMonitor,
    @inject(TYPES.TransactionManager) transactionManager: TransactionManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.graphDatabase = graphDatabase;
    this.queryBuilder = queryBuilder;
    this.batchOptimizer = batchOptimizer;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.transactionManager = transactionManager;
    
    this.config = {
      enableTransactions: true,
      maxBatchSize: 100,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
    };

    this.loadTransactionConfig();
  }

  private loadTransactionConfig(): void {
    const transactionConfig = this.configService.get('graphTransaction');
    if (transactionConfig) {
      this.config = { ...this.config, ...transactionConfig };
    }
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph transaction service');
      
      // Ensure the graph database is initialized
      if (!this.graphDatabase.isDatabaseConnected()) {
        const initialized = await this.graphDatabase.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize graph database');
        }
      }

      this.isInitialized = true;
      this.logger.info('Graph transaction service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph transaction service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphTransactionService', operation: 'initialize' }
      );
      return false;
    }
  }

  async executeInTransaction<T>(
    operations: TransactionOperation[],
    callback: (results: any[]) => Promise<T>
  ): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.config.enableTransactions) {
      // Execute operations without transaction
      const results = [];
      for (const operation of operations) {
        const result = await this.graphDatabase.executeWriteQuery(
          operation.nGQL, 
          operation.parameters || {}
        );
        results.push(result);
      }
      return callback(results);
    }

    const startTime = Date.now();
    const transactionId = await this.transactionManager.beginTransaction();
    
    try {
      // Add all operations to the transaction
      for (const operation of operations) {
        await this.transactionManager.addOperation(transactionId, operation);
      }

      // Execute the transaction
      const result = await this.transactionManager.commitTransaction(
        transactionId,
        async (transactionOperations) => {
          try {
            // Execute all operations in sequence
            const results = [];
            for (const operation of transactionOperations) {
              const result = await this.graphDatabase.executeWriteQuery(
                operation.nGQL, 
                operation.parameters || {}
              );
              results.push(result);
            }

            const executionTime = Date.now() - startTime;
            this.performanceMonitor.recordQueryExecution(executionTime);

            // Invalidate cache on successful transaction
            this.invalidateCacheForOperations(transactionOperations);

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

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      // Process results with callback
      return callback(result.results);
    } catch (error) {
      // Rollback on error
      await this.transactionManager.rollbackTransaction(transactionId);
      
      this.errorHandler.handleError(
        new Error(
          `Transaction execution failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphTransactionService', operation: 'executeInTransaction' }
      );
      throw error;
    }
  }

  async executeBatchInTransaction<T>(
    operations: TransactionOperation[],
    callback: (results: any[]) => Promise<T>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Use batch optimizer for efficient execution
      const result = await this.batchOptimizer.executeWithOptimalBatching(
        operations,
        async (batch) => {
          if (this.config.enableTransactions && batch.length > 1) {
            return await this.executeInTransaction(batch, async (results) => {
              return {
                success: true,
                results,
                executionTime: Date.now() - startTime,
              };
            });
          } else {
            // Execute queries individually
            const results = [];
            for (const operation of batch) {
              const result = await this.graphDatabase.executeWriteQuery(
                operation.nGQL, 
                operation.parameters || {}
              );
              results.push(result);
            }
            
            return {
              success: true,
              results,
              executionTime: Date.now() - startTime,
            };
          }
        },
        { 
          batchSize: options?.batchSize || this.config.maxBatchSize,
          concurrency: options?.concurrency || 3 
        }
      );

      return callback(result);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Batch transaction execution failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { 
          component: 'GraphTransactionService', 
          operation: 'executeBatchInTransaction',
          operationCount: operations.length,
        }
      );
      throw error;
    }
  }

  async createProjectSpace(projectId: string, options?: any): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Creating project space', { projectId });

      const operations = [
        {
          nGQL: `CREATE SPACE IF NOT EXISTS \`${projectId}\` (partition_num=10, replica_factor=1)`,
          parameters: {},
        },
        {
          nGQL: `USE SPACE \`${projectId}\``,
          parameters: {},
        },
        {
          nGQL: `CREATE TAG IF NOT EXISTS File(id string, path string, relativePath string, name string, language string, size int, hash string, linesOfCode int, functions int, classes int, lastModified string, updatedAt string)`,
          parameters: {},
        },
        {
          nGQL: `CREATE TAG IF NOT EXISTS Function(id string, name string, content string, startLine int, endLine int, complexity int, parameters string, returnType string, language string, updatedAt string)`,
          parameters: {},
        },
        {
          nGQL: `CREATE TAG IF NOT EXISTS Class(id string, name string, content string, startLine int, endLine int, methods int, properties int, inheritance string, language string, updatedAt string)`,
          parameters: {},
        },
        {
          nGQL: `CREATE TAG IF NOT EXISTS Import(id string, module string, updatedAt string)`,
          parameters: {},
        },
        {
          nGQL: `CREATE TAG IF NOT EXISTS Project(id string, name string, createdAt string, updatedAt string)`,
          parameters: {},
        },
        {
          nGQL: `CREATE EDGE IF NOT EXISTS CONTAINS()`,
          parameters: {},
        },
        {
          nGQL: `CREATE EDGE IF NOT EXISTS IMPORTS()`,
          parameters: {},
        },
        {
          nGQL: `CREATE EDGE IF NOT EXISTS CALLS()`,
          parameters: {},
        },
        {
          nGQL: `CREATE EDGE IF NOT EXISTS EXTENDS()`,
          parameters: {},
        },
        {
          nGQL: `CREATE EDGE IF NOT EXISTS BELONGS_TO()`,
          parameters: {},
        },
        {
          nGQL: `INSERT VERTEX Project(id, name, createdAt, updatedAt) VALUES $projectId:($projectId, $projectId, now(), now())`,
          parameters: { projectId },
        },
      ];

      await this.executeInTransaction(operations, async (results) => {
        this.logger.info('Project space created successfully', { 
          projectId, 
          operationCount: results.length 
        });
        return true;
      });

      // Switch to the new space
      await this.graphDatabase.useSpace(projectId);

      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create project space: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphTransactionService', operation: 'createProjectSpace' }
      );
      return false;
    }
  }

  async deleteProjectSpace(projectId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Deleting project space', { projectId });

      const deleted = await this.graphDatabase.deleteSpace(projectId);
      if (deleted) {
        // Clear cache for this project
        this.cacheService.deleteByPattern(new RegExp(`^${projectId}_`));
        
        this.logger.info('Project space deleted successfully', { projectId });
      }

      return deleted;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete project space: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphTransactionService', operation: 'deleteProjectSpace' }
      );
      return false;
    }
  }

  async projectSpaceExists(projectId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.graphDatabase.spaceExists(projectId);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to check if project space exists: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphTransactionService', operation: 'projectSpaceExists' }
      );
      return false;
    }
  }

  async getTransactionStats(): Promise<{
    activeTransactions: number;
    averageOperationCount: number;
    averageDuration: number;
    successRate: number;
  }> {
    try {
      const transactionStats = this.transactionManager.getTransactionStats();
      
      // Calculate success rate from performance monitor
      const performanceMetrics = this.performanceMonitor.getMetrics();
      const batchStats = performanceMetrics.batchProcessingStats;
      const successRate = batchStats.totalBatches > 0 ? batchStats.successRate : 0;

      return {
        activeTransactions: transactionStats.activeCount,
        averageOperationCount: transactionStats.averageOperationCount,
        averageDuration: transactionStats.averageDuration,
        successRate,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get transaction stats: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphTransactionService', operation: 'getTransactionStats' }
      );
      return {
        activeTransactions: 0,
        averageOperationCount: 0,
        averageDuration: 0,
        successRate: 0,
      };
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  updateConfig(config: Partial<GraphTransactionConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Graph transaction configuration updated', { config });
  }

  getConfig(): GraphTransactionConfig {
    return { ...this.config };
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph transaction service');
      
      // Close the graph database service
      await this.graphDatabase.close();
      
      this.isInitialized = false;
      this.logger.info('Graph transaction service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to close graph transaction service: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphTransactionService', operation: 'close' }
      );
      throw error;
    }
  }

  private invalidateCacheForOperations(operations: TransactionOperation[]): void {
    for (const operation of operations) {
      if (operation.nGQL.includes('INSERT') || 
          operation.nGQL.includes('UPDATE') || 
          operation.nGQL.includes('DELETE')) {
        // Clear all cache for the current space on write operations
        const currentSpace = this.graphDatabase.getCurrentSpace();
        if (currentSpace) {
          this.cacheService.deleteByPattern(new RegExp(`^${currentSpace}_`));
        }
        break;
      }
    }
  }
}