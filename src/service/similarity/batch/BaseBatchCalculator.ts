import { injectable, inject } from 'inversify';
import { 
  IBatchSimilarityCalculator, 
  BatchCalculatorType, 
  BatchCalculationOptions,
  BatchCalculationStats,
  ExtendedBatchSimilarityResult
} from './types/BatchCalculatorTypes';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult, SimilarityError } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 批处理相似度计算器基类
 * 提供通用的批处理计算功能和默认实现
 */
@injectable()
export abstract class BaseBatchCalculator implements IBatchSimilarityCalculator {
  abstract readonly name: string;
  abstract readonly type: BatchCalculatorType;

  constructor(
    @inject(TYPES.LoggerService) protected logger?: LoggerService
  ) {}

  /**
   * 批量计算相似度 - 子类必须实现
   */
  abstract calculateBatch(
    contents: string[], 
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult>;

  /**
   * 检查是否支持指定的策略 - 默认实现支持所有策略
   */
  isSupported(strategy: ISimilarityStrategy): boolean {
    return true;
  }

  /**
   * 获取推荐的批量大小 - 默认实现
   */
  getRecommendedBatchSize(contents: string[], strategy: ISimilarityStrategy): number {
    // 默认推荐批量大小
    const defaultBatchSize = 50;
    
    // 根据内容数量调整
    if (contents.length <= 10) {
      return contents.length;
    } else if (contents.length <= 50) {
      return Math.min(contents.length, 20);
    } else {
      return defaultBatchSize;
    }
  }

  /**
   * 验证输入参数
   */
  protected validateInput(contents: string[], strategy: ISimilarityStrategy, options?: SimilarityOptions): void {
    if (!contents || contents.length < 2) {
      throw new SimilarityError(
        'At least 2 contents are required for batch similarity calculation',
        'INSUFFICIENT_INPUT',
        { count: contents?.length || 0 }
      );
    }

    if (!strategy) {
      throw new SimilarityError(
        'Strategy is required for batch similarity calculation',
        'MISSING_STRATEGY'
      );
    }

    // 检查内容是否为空
    const emptyContents = contents.filter(content => !content || content.trim().length === 0);
    if (emptyContents.length > 0) {
      throw new SimilarityError(
        'Content cannot be empty',
        'INVALID_INPUT',
        { emptyCount: emptyContents.length }
      );
    }

    // 验证阈值
    if (options?.threshold !== undefined && (options.threshold < 0 || options.threshold > 1)) {
      throw new SimilarityError(
        'Threshold must be between 0 and 1',
        'INVALID_THRESHOLD',
        { threshold: options.threshold }
      );
    }
  }

  /**
   * 构建相似度对数组
   */
  protected buildPairsFromMatrix(
    matrix: number[][], 
    contents: string[], 
    options?: SimilarityOptions
  ): Array<{
    index1: number;
    index2: number;
    similarity: number;
    isSimilar: boolean;
  }> {
    const pairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }> = [];

    const threshold = options?.threshold || 0.8;

    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix[i].length; j++) {
        pairs.push({
          index1: i,
          index2: j,
          similarity: matrix[i][j],
          isSimilar: matrix[i][j] >= threshold
        });
      }
    }

    return pairs;
  }

  /**
   * 创建扩展的批量相似度结果
   */
  protected createExtendedResult(
    baseResult: BatchSimilarityResult,
    stats: BatchCalculationStats
  ): ExtendedBatchSimilarityResult {
    return {
      ...baseResult,
      stats,
      calculator: {
        name: this.name,
        type: this.type
      }
    };
  }

  /**
   * 创建批处理统计信息
   */
  protected createStats(
    startTime: number,
    apiCalls: number = 0,
    cacheHits: number = 0,
    calculatedPairs: number = 0
  ): BatchCalculationStats {
    return {
      totalTime: Date.now() - startTime,
      apiCalls,
      cacheHits,
      calculatedPairs,
      calculatorType: this.type
    };
  }

  /**
   * 测量执行时间
   */
  protected async measureExecutionTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    
    return { result, executionTime };
  }

  /**
   * 分批处理大量内容
   */
  protected async processInBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[], batchIndex: number) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch, Math.floor(i / batchSize));
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * 并行处理（如果支持）
   */
  protected async processInParallel<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    maxConcurrency: number = 5
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results: R[] = new Array(items.length);
    const executing: Promise<void>[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const promise = processor(items[i], i).then(result => {
        results[i] = result;
      });
      
      executing.push(promise);
      
      if (executing.length >= maxConcurrency) {
        // 等待至少一个 promise 完成
        await Promise.race(executing.map((p, idx) =>
          p.then(() => idx)
        )).then(completedIdx => {
          // 从执行队列中移除已完成的 promise
          executing.splice(completedIdx, 1);
        });
      }
    }
    
    await Promise.all(executing);
    return results;
  }

  /**
   * 计算内存使用情况（简化实现）
   */
  protected estimateMemoryUsage(contents: string[]): number {
    // 简单的内存估算：内容长度 + 相似度矩阵大小
    const contentSize = contents.reduce((sum, content) => sum + content.length * 2, 0); // UTF-16
    const matrixSize = contents.length * contents.length * 8; // double precision
    
    return contentSize + matrixSize;
  }

  /**
   * 记录性能指标
   */
  protected logPerformanceMetrics(
    contents: string[], 
    stats: BatchCalculationStats
  ): void {
    this.logger?.info(`Batch similarity calculation completed`, {
      calculator: this.name,
      type: this.type,
      contentCount: contents.length,
      totalTime: stats.totalTime,
      apiCalls: stats.apiCalls,
      cacheHits: stats.cacheHits,
      calculatedPairs: stats.calculatedPairs,
      avgTimePerPair: stats.calculatedPairs > 0 ? stats.totalTime / stats.calculatedPairs : 0,
      memoryUsage: stats.peakMemoryUsage
    });
  }
}