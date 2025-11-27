import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { FileChangeEvent } from '../../service/filesystem/ChangeDetectionService';
import { ChangeGroupingService, GroupedChanges } from './ChangeGroupingService';
import { VectorIndexBatchProcessor } from '../../service/vector/batching/VectorIndexBatchProcessor';
import { GraphIndexBatchProcessor } from '../../service/graph/batching/GraphIndexBatchProcessor';
import { BatchConfigManager } from './BatchConfigManager';

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
  ) { }

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
    const config = this.configManager.getConfig();
    const startTime = Date.now();

    this.logger.debug('Starting hot reload batch processing', {
      projectId,
      changeCount: changes.length,
      options
    });

    // 按变更类型分组处理
    const groupedChanges = this.groupingService.groupChangesByTarget(changes);

    let processedCount = 0;
    let failedCount = 0;

    try {
      // 并发处理不同类型的变更
      const results = await Promise.allSettled([
        this.vectorProcessor.processChanges(groupedChanges.vectorChanges, {
          batchSize: options?.batchSize,
          maxConcurrency: options?.maxConcurrency
        }),
        this.graphProcessor.processChanges(groupedChanges.graphChanges, {
          batchSize: options?.batchSize,
          maxConcurrency: options?.maxConcurrency
        })
      ]);

      // 统计结果
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          processedCount += result.value.processed;
          failedCount += result.value.failed;
        } else {
          this.logger.error(`Batch processing failed for group ${index}:`, result.reason);
          const groupSize = index === 0
            ? groupedChanges.vectorChanges.length
            : groupedChanges.graphChanges.length;
          failedCount += groupSize;
        }
      });

      const executionTime = Date.now() - startTime;

      this.logger.debug('Hot reload batch processing completed', {
        projectId,
        totalChanges: changes.length,
        processedChanges: processedCount,
        failedChanges: failedCount,
        executionTime
      });

      return {
        totalChanges: changes.length,
        processedChanges: processedCount,
        failedChanges: failedCount,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Hot reload batch processing failed:', error);
      return {
        totalChanges: changes.length,
        processedChanges: processedCount,
        failedChanges: changes.length - processedCount,
        executionTime
      };
    }
  }
}
