import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { FileChangeEvent } from '../../service/filesystem/ChangeDetectionService';
import { ChangeGroupingService, GroupedChanges } from './ChangeGroupingService';
import { VectorIndexBatchProcessor } from '../../service/vector/batching/VectorIndexBatchProcessor';
import { GraphIndexBatchProcessor } from '../../service/graph/batching/GraphIndexBatchProcessor';
import { BatchConfigManager } from './BatchConfigManager';
import { IndexProcessResult } from './BaseIndexBatchProcessor';

/**
 * 热重载批处理结果
 */
export interface HotReloadResult {
  totalChanges: number;
  processedChanges: number;
  failedChanges: number;
  executionTime: number;
}

/**
 * 热重载批处理器
 * 负责处理文件变更的批处理和热重载更新
 */
@injectable()
export class HotReloadBatchProcessor {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(ChangeGroupingService) private groupingService: ChangeGroupingService,
    @inject(VectorIndexBatchProcessor) private vectorProcessor: VectorIndexBatchProcessor,
    @inject(GraphIndexBatchProcessor) private graphProcessor: GraphIndexBatchProcessor,
    @inject(BatchConfigManager) private configManager: BatchConfigManager
  ) {}

  /**
   * 处理热重载变更
   */
  async processChanges(
    projectId: string,
    changes: FileChangeEvent[],
    options?: {
      maxConcurrency?: number;
      batchSize?: number;
      priority?: 'high' | 'medium' | 'low';
    }
  ): Promise<HotReloadResult> {
    const startTime = Date.now();

    this.logger.debug('Starting hot reload batch processing', {
      projectId,
      changeCount: changes.length,
      options
    });

    // 按变更类型分组处理
    const groupedChanges = this.groupingService.groupChangesByTarget(changes);

    try {
      // 并发处理不同类型的变更
      const results = await Promise.allSettled([
        this.processVectorChanges(groupedChanges.vectorChanges, options),
        this.processGraphChanges(groupedChanges.graphChanges, options)
      ]);

      // 聚合结果
      const aggregatedResult = this.aggregateResults(results, groupedChanges);
      const executionTime = Date.now() - startTime;

      this.logger.debug('Hot reload batch processing completed', {
        projectId,
        totalChanges: changes.length,
        processedChanges: aggregatedResult.processedChanges,
        failedChanges: aggregatedResult.failedChanges,
        executionTime
      });

      return {
        totalChanges: changes.length,
        processedChanges: aggregatedResult.processedChanges,
        failedChanges: aggregatedResult.failedChanges,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Hot reload batch processing failed:', error);
      return {
        totalChanges: changes.length,
        processedChanges: 0,
        failedChanges: changes.length,
        executionTime
      };
    }
  }

  /**
   * 处理向量变更
   */
  private async processVectorChanges(
    changes: FileChangeEvent[],
    options?: { maxConcurrency?: number; batchSize?: number }
  ): Promise<IndexProcessResult> {
    if (changes.length === 0) {
      return { processed: 0, failed: 0 };
    }

    return this.vectorProcessor.processChanges(changes, {
      batchSize: options?.batchSize,
      maxConcurrency: options?.maxConcurrency
    });
  }

  /**
   * 处理图变更
   */
  private async processGraphChanges(
    changes: FileChangeEvent[],
    options?: { maxConcurrency?: number; batchSize?: number }
  ): Promise<IndexProcessResult> {
    if (changes.length === 0) {
      return { processed: 0, failed: 0 };
    }

    return this.graphProcessor.processChanges(changes, {
      batchSize: options?.batchSize,
      maxConcurrency: options?.maxConcurrency
    });
  }

  /**
   * 聚合处理结果
   */
  private aggregateResults(
    results: PromiseSettledResult<IndexProcessResult>[],
    groupedChanges: GroupedChanges
  ): { processedChanges: number; failedChanges: number } {
    let processedChanges = 0;
    let failedChanges = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        processedChanges += result.value.processed;
        failedChanges += result.value.failed;
      } else {
        this.logger.error(`Batch processing failed for group ${index}:`, result.reason);
        const groupSize = index === 0 
          ? groupedChanges.vectorChanges.length 
          : groupedChanges.graphChanges.length;
        failedChanges += groupSize;
      }
    });

    return { processedChanges, failedChanges };
  }
}