import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';

import { DatabaseType } from '../types';
import { FileChangeEvent } from '../../service/filesystem/ChangeDetectionService';

import {
  IBatchProcessingService,
  BatchContext,
  BatchProcessingOptions,
  EmbeddingOptions,
  DatabaseBatchOptions,
  BatchResult,
  RetryOptions
} from './types';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult } from '../../service/similarity/types/SimilarityTypes';
import { EmbeddingInput, EmbeddingResult, Embedder } from '../../embedders/BaseEmbedder';
import { BatchStrategyFactory } from './strategies/BatchStrategyFactory';
import { SemanticBatchStrategy } from './strategies/SemanticBatchStrategy';

// 导入新的模块
import { BatchConfigManager, BatchProcessingConfig } from './BatchConfigManager';
export { BatchProcessingConfig } from './BatchConfigManager';
import { BatchExecutionEngine } from './BatchExecutionEngine';
import { PerformanceMetricsManager } from './PerformanceMetricsManager';
import { HotReloadBatchProcessor } from './HotReloadBatchProcessor';

/**
 * 统一批处理服务
 * 整合所有批处理功能，包括数据库操作、相似度计算和嵌入器API调用
 */
@injectable()
export class BatchProcessingService implements IBatchProcessingService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(BatchStrategyFactory) private strategyFactory: BatchStrategyFactory,
    @inject(SemanticBatchStrategy) private semanticStrategy: SemanticBatchStrategy,
    @inject(BatchConfigManager) private configManager: BatchConfigManager,
    @inject(BatchExecutionEngine) private executionEngine: BatchExecutionEngine,
    @inject(PerformanceMetricsManager) private metricsManager: PerformanceMetricsManager,
    @inject(HotReloadBatchProcessor) private hotReloadProcessor: HotReloadBatchProcessor,
    config?: BatchProcessingConfig
  ) {
    if (config) {
      this.configManager.updateConfig(config);
    }
    this.logger.info('BatchProcessingService created');
  }

  /**
   * 核心批处理方法 - 统一的批处理入口
   */
  async executeBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchProcessingOptions
  ): Promise<R[]> {
    const config = this.configManager.getConfig();
    const context = options?.context || { domain: 'database' };
    const strategy = this.strategyFactory.getStrategy(context);
    const batchSize = options?.batchSize || strategy.calculateOptimalBatchSize(items.length, context);
    const maxConcurrency = options?.maxConcurrency || config.maxConcurrentOperations;

    this.logger.debug('Starting batch processing', {
      itemCount: items.length,
      batchSize,
      maxConcurrency,
      context
    });

    const batches = this.executionEngine.createBatches(items, batchSize);

    return this.executionEngine.executeBatchesConcurrently(
      batches,
      processor,
      maxConcurrency,
      options?.enableRetry !== false,
      options?.enableRetry !== false ? {
        maxAttempts: options?.maxRetries || config.retryAttempts,
        baseDelay: options?.retryDelay || config.retryDelay
      } : undefined
    );
  }

  /**
   * 便捷方法：数据库批处理
   */
  async executeDatabaseBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: DatabaseBatchOptions
  ): Promise<R[]> {
    return this.executeBatch(items, processor, {
      ...options,
      context: { domain: 'database', subType: options?.databaseType || DatabaseType.QDRANT }
    });
  }

  /**
   * 便捷方法：嵌入器批处理
   */
  async executeEmbeddingBatch(
    inputs: EmbeddingInput[],
    embedder: Embedder,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    return this.executeBatch(inputs, async (batch) => {
      const result = await embedder.embed(batch);
      return Array.isArray(result) ? result : [result];
    }, {
      ...options,
      context: { domain: 'embedding' }
    });
  }

  /**
   * 便捷方法：相似度计算批处理
   */
  async executeSimilarityBatch(
    items: any[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const config = this.configManager.getConfig();
    const defaultBatchSize = config.defaultBatchSize;

    this.logger.debug('Starting similarity batch processing', {
      itemCount: items.length,
      batchSize: defaultBatchSize
    });

    const startTime = Date.now();
    const matrix: number[][] = [];
    const pairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }> = [];

    // Process similarity calculation for all pairs
    for (let i = 0; i < items.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < items.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const similarity = await strategy.calculate(items[i], items[j], options);
          matrix[i][j] = similarity;
          if (i < j) {
            pairs.push({
              index1: i,
              index2: j,
              similarity,
              isSimilar: similarity >= (options?.threshold || 0.5)
            });
          }
        }
      }
    }

    return {
      matrix,
      pairs,
      executionTime: Date.now() - startTime,
      cacheHits: 0
    };
  }

  /**
   * 便捷方法：热重载变更批处理
   */
  async executeHotReloadBatch(
    projectId: string,
    changes: FileChangeEvent[],
    options?: {
      maxConcurrency?: number;
      batchSize?: number;
      priority?: 'high' | 'medium' | 'low';
    }
  ): Promise<{
    totalChanges: number;
    processedChanges: number;
    failedChanges: number;
    executionTime: number;
  }> {
    return this.hotReloadProcessor.processChanges(projectId, changes, options);
  }

  /**
   * 便捷方法：带重试的批处理
   */
  async executeBatchWithRetry<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchProcessingOptions
  ): Promise<R[]> {
    return this.executeBatch(items, processor, {
      ...options,
      enableRetry: true
    });
  }

  /**
   * 便捷方法：带监控的批处理
   */
  async executeBatchWithMonitoring<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    operationName: string,
    options?: BatchProcessingOptions
  ): Promise<R[]> {
    return this.executeBatch(items, async (batch) => {
      return this.executionEngine.executeWithMonitoring(
        () => processor(batch),
        `${operationName}-batch`
      );
    }, options);
  }

  // ========== 配置和监控方法 ==========

  /**
   * 获取当前批处理大小
   */
  getCurrentBatchSize(context?: BatchContext): number {
    return this.metricsManager.getCurrentBatchSize(context);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(operationName?: string) {
    return this.metricsManager.getStats(operationName);
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.metricsManager.resetStats();
  }

  /**
   * 优化批处理大小
   */
  async optimizeBatchSize(context: BatchContext): Promise<number> {
    const config = this.configManager.getConfig();
    const strategy = this.strategyFactory.getStrategy(context);
    const baseSize = strategy.calculateOptimalBatchSize(100, context);
    return this.metricsManager.optimizeBatchSize(context, baseSize, config);
  }

  /**
   * 内存优化
   */
  async optimizeMemory(): Promise<void> {
    const config = this.configManager.getConfig();
    return this.metricsManager.optimizeMemory(config);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchProcessingConfig>): void {
    this.configManager.updateConfig(config);
  }

  /**
   * 执行带监控的操作（委托给执行引擎）
   */
  async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return this.executionEngine.executeWithMonitoring(operation, operationName);
  }

  /**
   * 执行带重试的操作（委托给执行引擎）
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const config = this.configManager.getConfig();
    const retryOptions = {
      maxAttempts: options?.maxAttempts || config.retryAttempts,
      baseDelay: options?.baseDelay || config.retryDelay
    };
    return this.executionEngine.executeWithRetry(operation, operationName, retryOptions);
  }
}
