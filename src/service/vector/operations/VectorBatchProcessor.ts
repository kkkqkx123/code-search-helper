import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { LoggerService } from '../../../utils/LoggerService';

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
}

@injectable()
export class VectorBatchProcessor {
  constructor(
    @inject(TYPES.BatchProcessingService) private batchService: BatchProcessingService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchOptions
  ): Promise<R[]> {
    const batchSize = options?.batchSize || 100;
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const batchResults = await this.processBatchWithRetry(batch, processor, options?.retryAttempts || 3);
      results.push(...batchResults);
    }

    return results;
  }

  private async processBatchWithRetry<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>,
    retryAttempts: number
  ): Promise<R[]> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        return await processor(batch);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Batch processing attempt ${attempt + 1} failed`, { error: lastError.message });
        
        if (attempt < retryAttempts - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Batch processing failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}