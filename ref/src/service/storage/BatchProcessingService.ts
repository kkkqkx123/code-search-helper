import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { TYPES } from '../../types';
import { BatchProcessingMetrics } from '../monitoring/BatchProcessingMetrics';

export interface BatchProcessingConfig {
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveBatchingEnabled: boolean;
}

@injectable()
export class BatchProcessingService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;

  // Batch processing configuration
  private maxConcurrentOperations: number = 5;
  private defaultBatchSize: number = 100;
  private maxBatchSize: number = 1000;
  private memoryThreshold: number = 80;
  private processingTimeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private adaptiveBatchingEnabled: boolean = true;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.batchMetrics = batchMetrics;

    this.initializeBatchProcessingConfig();
  }

  private initializeBatchProcessingConfig(): void {
    const batchConfig = this.configService.get('batchProcessing');

    this.maxConcurrentOperations =
      batchConfig?.maxConcurrentOperations ?? this.maxConcurrentOperations;
    this.defaultBatchSize = batchConfig?.defaultBatchSize ?? this.defaultBatchSize;
    this.maxBatchSize = batchConfig?.maxBatchSize ?? this.maxBatchSize;
    this.memoryThreshold = batchConfig?.memoryThreshold ?? this.memoryThreshold;
    this.processingTimeout = batchConfig?.processingTimeout ?? this.processingTimeout;
    this.retryAttempts = batchConfig?.retryAttempts ?? this.retryAttempts;
    this.retryDelay = batchConfig?.retryDelay ?? this.retryDelay;
    this.adaptiveBatchingEnabled =
      batchConfig?.adaptiveBatching?.enabled ?? this.adaptiveBatchingEnabled;

    this.logger.info('Batch processing configuration initialized', {
      maxConcurrentOperations: this.maxConcurrentOperations,
      defaultBatchSize: this.defaultBatchSize,
      maxBatchSize: this.maxBatchSize,
      memoryThreshold: this.memoryThreshold,
      processingTimeout: this.processingTimeout,
      adaptiveBatchingEnabled: this.adaptiveBatchingEnabled,
    });
  }

  checkMemoryUsage(): boolean {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memoryUsagePercent > this.memoryThreshold) {
      this.logger.warn('Memory usage exceeds threshold', {
        memoryUsagePercent,
        threshold: this.memoryThreshold,
      });
      return false;
    }

    return true;
  }

  async processWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
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

  async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.retryAttempts,
    delayMs: number = this.retryDelay
  ): Promise<T> {
    let lastError: Error = new Error(`Operation failed after ${maxAttempts} attempts.`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          this.logger.debug('Operation failed, retrying', {
            attempt,
            maxAttempts,
            error: lastError.message,
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }

  calculateOptimalBatchSize(totalItems: number): number {
    if (!this.adaptiveBatchingEnabled) {
      return Math.min(this.defaultBatchSize, totalItems);
    }

    // For vector operations, use a different strategy based on item count
    const config = this.configService.get('batchProcessing');
    const adaptiveConfig = config?.adaptiveBatching;

    // Start with a reasonable batch size based on total items
    let batchSize = Math.min(this.defaultBatchSize, totalItems);

    // Adjust based on item count - smaller batches for very large item counts
    if (totalItems > 1000 && adaptiveConfig?.minBatchSize) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 2, totalItems);
    } else if (totalItems > 500 && adaptiveConfig?.minBatchSize) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 3, totalItems);
    }

    const minBatchSize = adaptiveConfig?.minBatchSize ?? 10;
    const maxBatchSize = adaptiveConfig?.maxBatchSize ?? 200;
    return Math.max(minBatchSize, Math.min(batchSize, maxBatchSize));
  }

  getMaxConcurrentOperations(): number {
    return this.maxConcurrentOperations;
  }

  getDefaultBatchSize(): number {
    return this.defaultBatchSize;
  }

  getProcessingTimeout(): number {
    return this.processingTimeout;
  }

  getRetryAttempts(): number {
    return this.retryAttempts;
  }

  getRetryDelay(): number {
    return this.retryDelay;
  }
}
