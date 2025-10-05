import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseType } from '../types';
import {
  IBatchOptimizer,
  BatchOptimizerConfig,
  GraphOperation,
  BatchResult,
  BatchOperationResult
} from './types';

export interface VectorData {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}

export interface SearchRequest {
  vector: number[];
  collectionName: string;
  topK: number;
  filter?: Record<string, any>;
}

@injectable()
export class VectorBatchOptimizer implements IBatchOptimizer {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private config: BatchOptimizerConfig;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;

    // Initialize with default configuration
    this.config = {
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      memoryThreshold: 80,
      processingTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 1000,
      adaptiveBatchingEnabled: true,
      minBatchSize: 10,
      performanceThreshold: 1000, // 1 second
      adjustmentFactor: 0.1, // 10% adjustment
      databaseSpecific: {}
    };

    // Initialize database-specific configurations with defaults
    this.config.databaseSpecific[DatabaseType.QDRANT] = {
      defaultBatchSize: 100,
      maxBatchSize: 1000,
      minBatchSize: 5
    };

    this.config.databaseSpecific[DatabaseType.NEBULA] = {
      defaultBatchSize: 50,
      maxBatchSize: 500,
      minBatchSize: 10
    };
  }
  calculateOptimalGraphBatchSize(operationCount: number, databaseType: DatabaseType): number {
    throw new Error('Method not implemented.');
  }

  getConfig(): BatchOptimizerConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<BatchOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Vector batch optimizer configuration updated', { config });
  }

  calculateOptimalBatchSize(itemsCount: number): number {
    if (!this.config.adaptiveBatchingEnabled) {
      return this.config.defaultBatchSize;
    }

    // Start with default batch size
    let batchSize = this.config.defaultBatchSize;

    // Adjust based on items count
    if (itemsCount < this.config.minBatchSize) {
      batchSize = Math.max(itemsCount, this.config.minBatchSize);
    } else if (itemsCount > this.config.maxBatchSize) {
      batchSize = this.config.maxBatchSize;
    } else {
      // Scale batch size based on items count but keep within bounds
      batchSize = Math.min(
        Math.max(
          Math.floor(itemsCount * 0.1), // Use 10% of items as a base
          this.config.minBatchSize
        ),
        this.config.maxBatchSize
      );
    }

    this.logger.debug('Calculated optimal vector batch size', {
      itemsCount,
      calculatedBatchSize: batchSize,
      config: {
        minBatchSize: this.config.minBatchSize,
        maxBatchSize: this.config.maxBatchSize,
        defaultBatchSize: this.config.defaultBatchSize,
      },
    });

    return batchSize;
  }

  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number): number {
    if (!this.config.adaptiveBatchingEnabled) {
      return batchSize;
    }

    // If execution time is too high, reduce batch size
    if (executionTime > this.config.performanceThreshold) {
      const reduction = Math.floor(batchSize * this.config.adjustmentFactor);
      const newBatchSize = Math.max(batchSize - reduction, this.config.minBatchSize);

      this.logger.info('Reducing vector batch size due to high execution time', {
        oldBatchSize: batchSize,
        newBatchSize,
        executionTime,
        threshold: this.config.performanceThreshold,
      });

      return newBatchSize;
    }
    // If execution time is low, consider increasing batch size
    else if (executionTime < this.config.performanceThreshold * 0.5 && batchSize < this.config.maxBatchSize) {
      const increase = Math.floor(batchSize * this.config.adjustmentFactor);
      const newBatchSize = Math.min(batchSize + increase, this.config.maxBatchSize);

      this.logger.info('Increasing vector batch size due to low execution time', {
        oldBatchSize: batchSize,
        newBatchSize,
        executionTime,
      });

      return newBatchSize;
    }

    return batchSize;
  }

  async shouldRetry<T>(operation: () => Promise<T>, maxRetries: number = this.config.retryAttempts): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          this.logger.info('Vector operation succeeded after retries', { attempt });
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          this.logger.warn('Vector operation failed, retrying', {
            attempt,
            maxRetries,
            error: lastError.message,
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        } else {
          this.logger.error('Vector operation failed after all retries', {
            attempts: maxRetries,
            error: lastError.message,
          });
        }
      }
    }

    throw lastError!;
  }

  async executeWithOptimalBatching<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<any[]> {
    const startTime = Date.now();
    const batchSize = options?.batchSize || this.calculateOptimalBatchSize(items.length);
    const concurrency = options?.concurrency || this.config.maxConcurrentOperations;

    this.logger.info('Starting optimal vector batching execution', {
      itemCount: items.length,
      batchSize,
      concurrency,
    });

    // Split items into batches
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Execute batches with limited concurrency
    const results: any[] = [];
    for (let i = 0; i < batches.length; i += concurrency) {
      const concurrentBatches = batches.slice(i, i + concurrency);

      const batchPromises = concurrentBatches.map(batch =>
        this.shouldRetry(() => operation(batch))
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        this.logger.error('Vector batch execution failed', {
          error: error instanceof Error ? error.message : String(error),
          batchRange: `${i} to ${Math.min(i + concurrency, batches.length)}`,
        });
        throw error;
      }
    }

    const executionTime = Date.now() - startTime;
    this.logger.info('Optimal vector batching execution completed', {
      itemCount: items.length,
      batchSize,
      executionTime,
      resultCount: results.length,
    });

    // Adjust batch size based on performance for future operations
    const adjustedBatchSize = this.adjustBatchSizeBasedOnPerformance(executionTime, batchSize);
    if (adjustedBatchSize !== batchSize) {
      this.logger.info('Adjusted vector batch size for future operations', {
        oldBatchSize: batchSize,
        newBatchSize: adjustedBatchSize,
      });
    }

    return results;
  }

  /**
   * Checks if the system has enough resources to process a batch
   */
  hasSufficientResources(): boolean {
    try {
      const memoryUsage = process.memoryUsage();
      const usedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      const hasMemory = usedPercent < this.config.memoryThreshold;

      this.logger.debug('Vector batch resource check', {
        memoryUsedPercent: usedPercent,
        memoryThreshold: this.config.memoryThreshold,
        hasMemory,
      });

      return hasMemory;
    } catch (error) {
      this.logger.error(`Error checking vector batch resources: ${error}`);
      return false;
    }
  }

  /**
   * Waits until system resources are within acceptable limits
   */
  async waitForResources(): Promise<void> {
    const checkInterval = 1000; // 1 second
    const maxWaitTime = 30000; // 30 seconds

    let waitedTime = 0;
    while (!this.hasSufficientResources() && waitedTime < maxWaitTime) {
      this.logger.warn('Waiting for sufficient resources for vector batch', {
        waitedTime,
        maxWaitTime,
      });

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitedTime += checkInterval;
    }

    if (waitedTime >= maxWaitTime) {
      this.logger.error('Timed out waiting for sufficient resources for vector batch');
      throw new Error('Insufficient system resources');
    }

    this.logger.info('Sufficient resources available for vector batch, continuing execution');
  }

  /**
   * Estimates the processing time for a batch
   */
  estimateProcessingTime(itemCount: number, avgTimePerItem: number): number {
    return itemCount * avgTimePerItem;
  }

  /**
   * Validates if a batch size is appropriate for the current system state
   */
  isBatchSizeAppropriate(batchSize: number): boolean {
    if (batchSize < this.config.minBatchSize) {
      this.logger.warn('Vector batch size is below minimum threshold', {
        batchSize,
        minBatchSize: this.config.minBatchSize,
      });
      return false;
    }

    if (batchSize > this.config.maxBatchSize) {
      this.logger.warn('Vector batch size is above maximum threshold', {
        batchSize,
        maxBatchSize: this.config.maxBatchSize,
      });
      return false;
    }

    return true;
  }

  // 专门用于向量插入的批处理优化
  async optimizeVectorInsertions(
    vectors: VectorData[],
    collectionName: string
  ): Promise<BatchResult> {
    // 计算最优批大小
    const batchSize = this.calculateOptimalVectorBatchSize(vectors.length, 1536); // 假设维度为1536

    // 创建批次
    const batches: VectorData[][] = [];
    for (let i = 0; i < vectors.length; i += batchSize) {
      batches.push(vectors.slice(i, i + batchSize));
    }

    const results: BatchOperationResult[] = [];
    let totalProcessed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchId = `vector_insert_batch_${i}_${Date.now()}`;
      const startTime = Date.now();

      try {
        // 执行向量插入批次
        const result = await this.executeVectorInsertBatch(batch, collectionName);
        const duration = Date.now() - startTime;

        results.push({
          batchId,
          success: true,
          duration,
          processedCount: batch.length,
          result
        });

        totalProcessed += batch.length;

        // 根据执行时间动态调整批大小
        this.adjustVectorBatchSize(duration, batchSize);

      } catch (error) {
        const duration = Date.now() - startTime;

        results.push({
          batchId,
          success: false,
          duration,
          processedCount: 0,
          error: error instanceof Error ? error : new Error(String(error))
        });

        this.logger.error('Vector insertion batch failed', {
          batchId,
          error: (error as Error).message,
          duration
        });

        // 出错时减小批大小
        this.decreaseVectorBatchSize();
      }
    }

    return {
      totalOperations: vectors.length,
      successfulOperations: totalProcessed,
      failedOperations: vectors.length - totalProcessed,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      results
    };
  }

  // 专门用于向量搜索的批处理优化
  async optimizeVectorSearches(
    searchRequests: SearchRequest[],
    collectionName: string
  ): Promise<BatchResult> {
    // 计算最优批大小
    const batchSize = this.calculateOptimalVectorBatchSize(searchRequests.length, searchRequests[0]?.vector?.length || 1536);

    // 创建批次
    const batches: SearchRequest[][] = [];
    for (let i = 0; i < searchRequests.length; i += batchSize) {
      batches.push(searchRequests.slice(i, i + batchSize));
    }

    const results: BatchOperationResult[] = [];
    let totalProcessed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchId = `vector_search_batch_${i}_${Date.now()}`;
      const startTime = Date.now();

      try {
        // 执行向量搜索批次
        const result = await this.executeVectorSearchBatch(batch, collectionName);
        const duration = Date.now() - startTime;

        results.push({
          batchId,
          success: true,
          duration,
          processedCount: batch.length,
          result
        });

        totalProcessed += batch.length;

        // 根据执行时间动态调整批大小
        this.adjustVectorBatchSize(duration, batchSize);

      } catch (error) {
        const duration = Date.now() - startTime;

        results.push({
          batchId,
          success: false,
          duration,
          processedCount: 0,
          error: error instanceof Error ? error : new Error(String(error))
        });

        this.logger.error('Vector search batch failed', {
          batchId,
          error: (error as Error).message,
          duration
        });

        // 出错时减小批大小
        this.decreaseVectorBatchSize();
      }
    }

    return {
      totalOperations: searchRequests.length,
      successfulOperations: totalProcessed,
      failedOperations: searchRequests.length - totalProcessed,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      results
    };
  }

  // 计算向量操作的最佳批处理大小
  calculateOptimalVectorBatchSize(vectorCount: number, dimension: number): number {
    // 获取Qdrant特定配置
    const dbConfig = this.config.databaseSpecific[DatabaseType.QDRANT] || {
      defaultBatchSize: this.config.defaultBatchSize,
      maxBatchSize: this.config.maxBatchSize
    };

    let baseSize = dbConfig.defaultBatchSize;

    // 根据维度调整批大小（维度越高，批大小越小）
    if (dimension > 2048) {
      baseSize = Math.floor(baseSize * 0.5);
    } else if (dimension > 1024) {
      baseSize = Math.floor(baseSize * 0.75);
    }

    // 根据向量数量调整
    if (vectorCount < 10) {
      baseSize = Math.min(baseSize, 5); // 小批量时减少批大小
    } else if (vectorCount > 10000) {
      baseSize = Math.min(baseSize * 2, dbConfig.maxBatchSize); // 大批量时增加批大小
    }

    return Math.max(baseSize, this.config.minBatchSize);
  }

  private async executeVectorInsertBatch(batch: VectorData[], collectionName: string): Promise<any> {
    return this.shouldRetry(async () => {
      // 模拟向量插入操作
      this.logger.debug('Executing vector insertion batch', {
        batchSize: batch.length,
        collectionName
      });

      // 模拟操作成功
      return { success: true, inserted: batch.length };
    });
  }

  private async executeVectorSearchBatch(batch: SearchRequest[], collectionName: string): Promise<any> {
    return this.shouldRetry(async () => {
      // 模拟向量搜索操作
      this.logger.debug('Executing vector search batch', {
        batchSize: batch.length,
        collectionName
      });

      // 模拟操作成功
      return { success: true, searched: batch.length };
    });
  }

  private adjustVectorBatchSize(duration: number, currentBatchSize: number): void {
    // 根据执行时间调整批大小
    const maxBatchSize = this.config.databaseSpecific[DatabaseType.QDRANT]?.maxBatchSize || this.config.maxBatchSize;
    const minBatchSize = this.config.databaseSpecific[DatabaseType.QDRANT]?.minBatchSize || this.config.minBatchSize;

    // 如果执行时间过长，减小批大小
    if (duration > this.config.performanceThreshold) {
      const newBatchSize = Math.max(
        Math.floor(currentBatchSize * (1 - this.config.adjustmentFactor)),
        minBatchSize
      );
      this.logger.info('Reducing vector batch size due to high execution time', {
        oldBatchSize: currentBatchSize,
        newBatchSize,
        duration
      });

      // 更新Qdrant特定配置
      if (!this.config.databaseSpecific[DatabaseType.QDRANT]) {
        this.config.databaseSpecific[DatabaseType.QDRANT] = {
          defaultBatchSize: newBatchSize,
          maxBatchSize,
          minBatchSize
        };
      } else {
        this.config.databaseSpecific[DatabaseType.QDRANT]!.defaultBatchSize = newBatchSize;
      }
    }
    // 如果执行时间较短，可以增加批大小
    else if (duration < this.config.performanceThreshold * 0.5 && currentBatchSize < maxBatchSize) {
      const newBatchSize = Math.min(
        Math.floor(currentBatchSize * (1 + this.config.adjustmentFactor)),
        maxBatchSize
      );
      this.logger.info('Increasing vector batch size due to low execution time', {
        oldBatchSize: currentBatchSize,
        newBatchSize,
        duration
      });

      // 更新Qdrant特定配置
      if (!this.config.databaseSpecific[DatabaseType.QDRANT]) {
        this.config.databaseSpecific[DatabaseType.QDRANT] = {
          defaultBatchSize: newBatchSize,
          maxBatchSize,
          minBatchSize
        };
      } else {
        this.config.databaseSpecific[DatabaseType.QDRANT]!.defaultBatchSize = newBatchSize;
      }
    }
  }

  private decreaseVectorBatchSize(): void {
    const currentSize = this.config.databaseSpecific[DatabaseType.QDRANT]?.defaultBatchSize || this.config.defaultBatchSize;
    const minBatchSize = this.config.databaseSpecific[DatabaseType.QDRANT]?.minBatchSize || this.config.minBatchSize;

    // 将批大小减小20%
    const newSize = Math.max(
      Math.floor(currentSize * 0.8),
      minBatchSize
    );

    // 更新Qdrant特定配置
    if (!this.config.databaseSpecific[DatabaseType.QDRANT]) {
      // 获取默认的maxBatchSize值
      const qdrantConfig = this.config.databaseSpecific[DatabaseType.QDRANT];
      // 使用类型断言解决TypeScript推断问题
      const qdrantConfigTyped = qdrantConfig as { maxBatchSize?: number } | undefined;
      const defaultMaxBatchSize = qdrantConfigTyped?.maxBatchSize ?? this.config.maxBatchSize;
      this.config.databaseSpecific[DatabaseType.QDRANT] = {
        defaultBatchSize: newSize,
        maxBatchSize: defaultMaxBatchSize,
        minBatchSize
      };
    } else {
      this.config.databaseSpecific[DatabaseType.QDRANT]!.defaultBatchSize = newSize;
    }

    this.logger.info('Decreased vector batch size after failure', {
      oldBatchSize: currentSize,
      newBatchSize: newSize
    });
  }
}