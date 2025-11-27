import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { PerformanceMetricsManager } from './PerformanceMetricsManager';
import { RetryOptions } from './types';

/**
 * 批处理执行引擎
 * 负责执行、重试和监控操作
 */
@injectable()
export class BatchExecutionEngine {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(PerformanceMetricsManager) private metricsManager: PerformanceMetricsManager
  ) {}

  /**
   * 执行带监控的操作
   */
  async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;

    try {
      const result = await operation();
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      throw error;
    } finally {
      const processingTime = Date.now() - startTime;
      this.metricsManager.recordMetric(operationName, processingTime, success, error);
    }
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryOptions: RetryOptions
  ): Promise<T> {
    const { maxAttempts, baseDelay } = retryOptions;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeWithMonitoring(
          operation,
          `${operationName}-attempt-${attempt}`
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts) {
          this.logger.error(`Operation failed after ${maxAttempts} attempts`, {
            operationName,
            error: lastError.message
          });
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1); // 指数退避
        this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
          operationName,
          attempt,
          error: lastError.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * 创建批次
   */
  createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 并发执行批次处理
   */
  async executeBatchesConcurrently<T, R>(
    batches: T[][],
    processor: (batch: T[]) => Promise<R[]>,
    maxConcurrency: number,
    enableRetry: boolean,
    retryOptions?: RetryOptions
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);

      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const operationName = `batch-${i + batchIndex}`;

        if (enableRetry && retryOptions) {
          return this.executeWithRetry(
            () => processor(batch),
            operationName,
            retryOptions
          );
        } else {
          return this.executeWithMonitoring(
            () => processor(batch),
            operationName
          );
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    return results;
  }
}
