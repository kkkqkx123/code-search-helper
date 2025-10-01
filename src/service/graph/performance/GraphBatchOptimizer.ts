import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';

export interface BatchOptimizerConfig {
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveBatchingEnabled: boolean;
  minBatchSize: number;
  performanceThreshold: number;
  adjustmentFactor: number;
}

export interface IGraphBatchOptimizer {
  getConfig(): BatchOptimizerConfig;
  updateConfig(config: Partial<BatchOptimizerConfig>): void;
  calculateOptimalBatchSize(itemsCount: number): number;
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number): number;
  shouldRetry(operation: () => Promise<any>, maxRetries?: number): Promise<any>;
  executeWithOptimalBatching<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<any[]>;
}

@injectable()
export class GraphBatchOptimizer implements IGraphBatchOptimizer {
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
    };
  }

  getConfig(): BatchOptimizerConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<BatchOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Batch optimizer configuration updated', { config });
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

    this.logger.debug('Calculated optimal batch size', {
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
      
      this.logger.info('Reducing batch size due to high execution time', {
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
      
      this.logger.info('Increasing batch size due to low execution time', {
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
          this.logger.info('Operation succeeded after retries', { attempt });
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          this.logger.warn('Operation failed, retrying', {
            attempt,
            maxRetries,
            error: lastError.message,
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        } else {
          this.logger.error('Operation failed after all retries', {
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
    
    this.logger.info('Starting optimal batching execution', {
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
        this.logger.error('Batch execution failed', {
          error: error instanceof Error ? error.message : String(error),
          batchRange: `${i} to ${Math.min(i + concurrency, batches.length)}`,
        });
        throw error;
      }
    }

    const executionTime = Date.now() - startTime;
    this.logger.info('Optimal batching execution completed', {
      itemCount: items.length,
      batchSize,
      executionTime,
      resultCount: results.length,
    });

    // Adjust batch size based on performance for future operations
    const adjustedBatchSize = this.adjustBatchSizeBasedOnPerformance(executionTime, batchSize);
    if (adjustedBatchSize !== batchSize) {
      this.logger.info('Adjusted batch size for future operations', {
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
      
      this.logger.debug('Resource check', {
        memoryUsedPercent: usedPercent,
        memoryThreshold: this.config.memoryThreshold,
        hasMemory,
      });
      
      return hasMemory;
    } catch (error) {
      this.logger.error(`Error checking resources: ${error}`);
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
      this.logger.warn('Waiting for sufficient resources', {
        waitedTime,
        maxWaitTime,
      });
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitedTime += checkInterval;
    }
    
    if (waitedTime >= maxWaitTime) {
      this.logger.error('Timed out waiting for sufficient resources');
      throw new Error('Insufficient system resources');
    }
    
    this.logger.info('Sufficient resources available, continuing execution');
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
      this.logger.warn('Batch size is below minimum threshold', {
        batchSize,
        minBatchSize: this.config.minBatchSize,
      });
      return false;
    }
    
    if (batchSize > this.config.maxBatchSize) {
      this.logger.warn('Batch size is above maximum threshold', {
        batchSize,
        maxBatchSize: this.config.maxBatchSize,
      });
      return false;
    }
    
    return true;
  }
}