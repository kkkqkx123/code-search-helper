import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { BatchExecutionEngine } from './BatchExecutionEngine';
import { FileChangeEvent } from '../../service/filesystem/ChangeDetectionService';

/**
 * 图索引批处理结果
 */
export interface IndexProcessResult {
  processed: number;
  failed: number;
}

/**
 * 图索引批处理器
 * 负责处理与图索引相关的文件变更
 */
@injectable()
export class GraphIndexBatchProcessor {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(BatchExecutionEngine) private executionEngine: BatchExecutionEngine
  ) {}

  /**
   * 处理图索引变更
   */
  async processChanges(
    changes: FileChangeEvent[],
    options?: {
      maxConcurrency?: number;
      batchSize?: number;
    }
  ): Promise<IndexProcessResult> {
    if (changes.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const batchSize = options?.batchSize || 15;
    const maxConcurrency = options?.maxConcurrency || 2;

    this.logger.debug('Starting graph index batch processing', {
      changeCount: changes.length,
      batchSize,
      maxConcurrency
    });

    const batches = this.executionEngine.createBatches(changes, batchSize);
    let totalProcessed = 0;
    let totalFailed = 0;

    // 并发处理批次
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);

      const batchPromises = concurrentBatches.map(async (batch) => {
        const results = await Promise.allSettled(
          batch.map(change => this.processGraphIndexChange(change))
        );

        let processed = 0;
        let failed = 0;

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            processed++;
          } else {
            failed++;
            this.logger.warn('Graph index change processing failed:', result.reason);
          }
        });

        return { processed, failed };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        totalProcessed += result.processed;
        totalFailed += result.failed;
      });
    }

    this.logger.debug('Graph index batch processing completed', {
      processed: totalProcessed,
      failed: totalFailed
    });

    return { processed: totalProcessed, failed: totalFailed };
  }

  /**
   * 处理单个图索引变更
   */
  private async processGraphIndexChange(change: FileChangeEvent): Promise<void> {
    // 这里应该调用实际的图索引更新逻辑
    // 目前作为占位符实现
    this.logger.debug(`Processing graph index change: ${change.type} - ${change.path}`);

    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}
