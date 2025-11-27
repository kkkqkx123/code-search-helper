import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { BatchProcessingService } from './BatchProcessingService';
import { FileChangeEvent } from '../../service/filesystem/ChangeDetectionService';
import { BatchContext, BatchProcessingOptions } from './types';

/**
 * 统一的索引批处理结果
 */
export interface IndexProcessResult {
  processed: number;
  failed: number;
}

/**
 * 索引批处理器基类
 * 提供通用的批处理逻辑，减少代码重复
 */
@injectable()
export abstract class BaseIndexBatchProcessor {
  constructor(
    @inject(TYPES.LoggerService) protected logger: LoggerService,
    @inject(TYPES.BatchProcessingService) protected batchService: BatchProcessingService
  ) {}

  /**
   * 处理索引变更的通用方法
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

    const context = this.getBatchContext();
    const batchOptions: BatchProcessingOptions = {
      batchSize: options?.batchSize || this.getDefaultBatchSize(),
      maxConcurrency: options?.maxConcurrency || this.getDefaultMaxConcurrency(),
      context,
      enableRetry: true
    };

    this.logger.debug(`Starting ${this.getProcessorType()} index batch processing`, {
      changeCount: changes.length,
      batchSize: batchOptions.batchSize,
      maxConcurrency: batchOptions.maxConcurrency
    });

    try {
      // 使用统一的批处理服务
      const results = await this.batchService.executeBatch(
        changes,
        async (batch) => this.processBatch(batch),
        batchOptions
      );

      // 统计结果
      const processed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.debug(`${this.getProcessorType()} index batch processing completed`, {
        processed,
        failed
      });

      return { processed, failed };
    } catch (error) {
      this.logger.error(`${this.getProcessorType()} index batch processing failed:`, error);
      return { processed: 0, failed: changes.length };
    }
  }

  /**
   * 处理单个批次 - 子类实现具体逻辑
   */
  protected abstract processBatch(batch: FileChangeEvent[]): Promise<Array<{ success: boolean; error?: string }>>;

  /**
   * 获取批处理上下文 - 子类提供具体上下文
   */
  protected abstract getBatchContext(): BatchContext;

  /**
   * 获取处理器类型 - 用于日志
   */
  protected abstract getProcessorType(): string;

  /**
   * 获取默认批处理大小 - 子类可覆盖
   */
  protected getDefaultBatchSize(): number {
    return 20;
  }

  /**
   * 获取默认最大并发数 - 子类可覆盖
   */
  protected getDefaultMaxConcurrency(): number {
    return 3;
  }
}