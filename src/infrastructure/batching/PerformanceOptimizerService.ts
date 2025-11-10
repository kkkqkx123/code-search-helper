import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

import { IMemoryMonitorService } from '../../service/memory/interfaces/IMemoryMonitorService';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

export interface BatchOptions {
  initialSize: number;
  maxSize: number;
  minSize: number;
  adjustmentFactor: number;
  performanceThreshold: number;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

@injectable()
export class PerformanceOptimizerService {
  private performanceMetrics: PerformanceMetrics[] = [];
  private retryOptions: RetryOptions;
  private batchOptions: BatchOptions;
  private currentBatchSize: number;
  private isOptimizing: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.MemoryMonitorService) private memoryMonitor: IMemoryMonitorService
  ) {
    // 从配置服务获取批处理配置
    const batchConfig = this.configService.get('batchProcessing');

    this.retryOptions = {
      maxAttempts: batchConfig.retryAttempts,
      baseDelay: batchConfig.retryDelay,
      maxDelay: 30000, // Default value, could be added to config if needed
      backoffFactor: 2, // Default value, could be added to config if needed
      jitter: true // Default value, could be added to config if needed
    };

    // Initialize batch options from config service
    this.batchOptions = {
      initialSize: batchConfig.defaultBatchSize,
      maxSize: batchConfig.maxBatchSize,
      minSize: Math.max(1, Math.floor(batchConfig.defaultBatchSize * 0.1)), // Using 10% of default as minimum
      adjustmentFactor: 0.1, // This value is not in the config, using default
      performanceThreshold: batchConfig.monitoring?.alertThresholds?.highLatency || 5000
    };

    // Set initial batch size
    this.currentBatchSize = this.batchOptions.initialSize;

    this.logger.info('Performance optimizer service initialized', {
      retryOptions: this.retryOptions,
      batchOptions: this.batchOptions
    });
  }

  /**
   * 执行带有重试逻辑的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const retryConfig = { ...this.retryOptions, ...options };
    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();

        // Record successful operation
        this.recordPerformanceMetric({
          operation: operationName,
          duration: Date.now() - startTime,
          success: true,
          timestamp: new Date(),
          metadata: { attempts: attempt }
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failed operation
        this.recordPerformanceMetric({
          operation: operationName,
          duration: Date.now() - startTime,
          success: false,
          timestamp: new Date(),
          metadata: { attempts: attempt, error: lastError.message }
        });

        // If this is the last attempt, throw the error
        if (attempt === retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, retryConfig);

        this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
          operation: operationName,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          error: lastError.message,
          nextRetryIn: delay
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // All attempts failed
    throw lastError;
  }

  /**
   * 执行带有性能监控的操作
   */
  async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let success = false;
    let error: Error | null = null;

    try {
      result = await operation();
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      success = false;
      throw error;
    } finally {
      // Record performance metric
      this.recordPerformanceMetric({
        operation: operationName,
        duration: Date.now() - startTime,
        success,
        timestamp: new Date(),
        metadata: error ? { error: error.message } : undefined
      });
    }
  }

  /**
   * 批量处理操作，带有自适应批处理大小
   */
  async processBatches<T, R>(
    items: T[],
    processBatch: (batch: T[]) => Promise<R[]>,
    operationName: string
  ): Promise<R[]> {
    const results: R[] = [];
    let batchIndex = 0;

    while (batchIndex < items.length) {
      const batchSize = Math.min(this.currentBatchSize, items.length - batchIndex);
      const batch = items.slice(batchIndex, batchIndex + batchSize);

      const batchStartTime = Date.now();
      let batchSuccess = false;
      let batchError: Error | null = null;

      try {
        const batchResults = await this.executeWithRetry(
          () => processBatch(batch),
          `${operationName}-batch-${batchIndex / this.currentBatchSize}`
        );

        results.push(...batchResults);
        batchSuccess = true;
      } catch (error) {
        batchError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Batch processing failed`, {
          operation: operationName,
          batchIndex: batchIndex / this.currentBatchSize,
          batchSize,
          error: batchError.message
        });
        throw batchError;
      } finally {
        // Adjust batch size based on performance
        const batchDuration = Date.now() - batchStartTime;
        this.adjustBatchSize(batchDuration, batchSuccess);
      }

      batchIndex += batchSize;
    }

    return results;
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    // Calculate exponential backoff delay
    let delay = options.baseDelay * Math.pow(options.backoffFactor || 2, attempt - 1);

    // Cap at maximum delay
    delay = Math.min(delay, options.maxDelay || 30000);

    // Add jitter if enabled
    if (options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * 调整批处理大小
   */
  private adjustBatchSize(batchDuration: number, success: boolean): void {
    if (!success) {
      // Reduce batch size on failure
      this.currentBatchSize = Math.max(
        this.batchOptions.minSize,
        Math.floor(this.currentBatchSize * (1 - this.batchOptions.adjustmentFactor))
      );

      this.logger.debug('Reduced batch size due to failure', {
        oldSize: this.currentBatchSize + Math.floor(this.currentBatchSize * this.batchOptions.adjustmentFactor / (1 - this.batchOptions.adjustmentFactor)),
        newSize: this.currentBatchSize,
        batchDuration
      });

      return;
    }

    // Adjust batch size based on performance threshold
    if (batchDuration > this.batchOptions.performanceThreshold) {
      // Reduce batch size if processing is too slow
      this.currentBatchSize = Math.max(
        this.batchOptions.minSize,
        Math.floor(this.currentBatchSize * (1 - this.batchOptions.adjustmentFactor))
      );

      this.logger.debug('Reduced batch size due to slow performance', {
        oldSize: this.currentBatchSize + Math.floor(this.currentBatchSize * this.batchOptions.adjustmentFactor / (1 - this.batchOptions.adjustmentFactor)),
        newSize: this.currentBatchSize,
        batchDuration,
        threshold: this.batchOptions.performanceThreshold
      });
    } else {
      // Increase batch size if processing is fast
      this.currentBatchSize = Math.min(
        this.batchOptions.maxSize,
        Math.floor(this.currentBatchSize * (1 + this.batchOptions.adjustmentFactor))
      );

      this.logger.debug('Increased batch size due to good performance', {
        oldSize: this.currentBatchSize - Math.floor(this.currentBatchSize * this.batchOptions.adjustmentFactor / (1 + this.batchOptions.adjustmentFactor)),
        newSize: this.currentBatchSize,
        batchDuration,
        threshold: this.batchOptions.performanceThreshold
      });
    }
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);

    // Keep only the last 1000 metrics to prevent memory issues
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(operationName?: string): {
    count: number;
    successRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
  } {
    let metrics = this.performanceMetrics;

    // Filter by operation name if provided
    if (operationName) {
      metrics = metrics.filter(m => m.operation === operationName);
    }

    if (metrics.length === 0) {
      return {
        count: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const successCount = metrics.filter(m => m.success).length;

    return {
      count: metrics.length,
      successRate: successCount / metrics.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)]
    };
  }

  /**
   * 优化内存使用
   */
  optimizeMemory(): void {
    if (this.isOptimizing) {
      return;
    }

    this.isOptimizing = true;

    try {
      // Use the unified memory monitor service for garbage collection
      this.memoryMonitor.forceGarbageCollection();

      // Clear old performance metrics
      if (this.performanceMetrics.length > 500) {
        this.performanceMetrics = this.performanceMetrics.slice(-500);
        this.logger.debug('Cleared old performance metrics');
      }

      // Reduce batch size if memory usage is high
      const memoryStats = this.memoryMonitor.getMemoryStats();
      if (memoryStats.current.heapUsedPercent > 0.8) {
        const oldBatchSize = this.currentBatchSize;
        this.currentBatchSize = Math.max(
          this.batchOptions.minSize,
          Math.floor(this.currentBatchSize * 0.8)
        );

        if (oldBatchSize !== this.currentBatchSize) {
          this.logger.info('Reduced batch size due to high memory usage', {
            oldSize: oldBatchSize,
            newSize: this.currentBatchSize,
            memoryUsage: Math.round(memoryStats.current.heapUsedPercent * 100) / 10
          });
        }
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to optimize memory: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'PerformanceOptimizerService', operation: 'optimizeMemory' }
      );
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 获取当前批处理大小
   */
  getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * 重置批处理大小为初始值
   */
  resetBatchSize(): void {
    this.currentBatchSize = this.batchOptions.initialSize;
    this.logger.debug('Reset batch size to initial value', {
      initialSize: this.batchOptions.initialSize
    });
  }

  /**
   * 临时设置批处理大小
   */
  setBatchSize(size: number): number {
    const oldSize = this.currentBatchSize;
    this.currentBatchSize = Math.max(this.batchOptions.minSize, Math.min(this.batchOptions.maxSize, size));
    this.logger.debug('Temporarily set batch size', {
      oldSize,
      newSize: this.currentBatchSize
    });
    return oldSize;
  }

  /**
   * 更新重试选项
   */
  updateRetryOptions(options: Partial<RetryOptions>): void {
    this.retryOptions = { ...this.retryOptions, ...options };
    this.logger.info('Updated retry options', { retryOptions: this.retryOptions });
  }

  /**
   * 更新批处理选项
   */
  updateBatchOptions(options: Partial<BatchOptions>): void {
    this.batchOptions = { ...this.batchOptions, ...options };
    this.logger.info('Updated batch options', { batchOptions: this.batchOptions });
  }

  /**
     * 睡眠函数
     */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}