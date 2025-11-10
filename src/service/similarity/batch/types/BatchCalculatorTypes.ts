/**
 * 批处理相似度计算器相关类型定义
 */

import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult } from '../../types/SimilarityTypes';

// 批处理计算器类型
export type BatchCalculatorType = 'generic' | 'semantic-optimized' | 'hybrid-optimized' | 'adaptive';

// 批处理计算器接口
export interface IBatchSimilarityCalculator {
  /**
   * 批量计算相似度
   * @param contents 要计算的内容数组
   * @param strategy 使用的相似度策略
   * @param options 计算选项
   * @returns 批量相似度计算结果
   */
  calculateBatch(
    contents: string[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult>;

  /**
   * 获取计算器名称
   */
  readonly name: string;

  /**
   * 获取计算器类型
   */
  readonly type: BatchCalculatorType;

  /**
   * 检查是否支持指定的策略
   * @param strategy 相似度策略
   * @returns 是否支持
   */
  isSupported(strategy: ISimilarityStrategy): boolean;

  /**
   * 获取推荐的批量大小
   * @param contents 内容数组
   * @param strategy 相似度策略
   * @returns 推荐的批量大小
   */
  getRecommendedBatchSize(contents: string[], strategy: ISimilarityStrategy): number;
}

// 批处理计算器工厂接口
export interface IBatchCalculatorFactory {
  /**
   * 创建批处理计算器
   * @param type 计算器类型
   * @returns 批处理计算器实例
   */
  createCalculator(type: BatchCalculatorType): IBatchSimilarityCalculator;

  /**
   * 获取可用的计算器类型列表
   * @returns 计算器类型列表
   */
  getAvailableCalculators(): BatchCalculatorType[];

  /**
   * 根据策略自动选择最优的计算器
   * @param strategy 相似度策略
   * @param contents 内容数组
   * @returns 推荐的计算器类型
   */
  selectOptimalCalculator(strategy: ISimilarityStrategy, contents: string[]): BatchCalculatorType;
}

// 批处理计算选项
export interface BatchCalculationOptions extends SimilarityOptions {
  /**
   * 是否启用并行处理
   */
  enableParallel?: boolean;

  /**
   * 最大并行度
   */
  maxConcurrency?: number;

  /**
   * 批处理大小限制
   */
  batchSizeLimit?: number;

  /**
   * 是否启用进度回调
   */
  enableProgressCallback?: boolean;

  /**
   * 进度回调函数
   */
  onProgress?: (progress: number, current: number, total: number) => void;
}

// 批处理计算统计信息
export interface BatchCalculationStats {
  /**
   * 总计算时间（毫秒）
   */
  totalTime: number;

  /**
   * API调用次数
   */
  apiCalls: number;

  /**
   * 缓存命中次数
   */
  cacheHits: number;

  /**
   * 实际计算的相似度对数
   */
  calculatedPairs: number;

  /**
   * 使用的计算器类型
   */
  calculatorType: BatchCalculatorType;

  /**
   * 内存使用峰值（字节）
   */
  peakMemoryUsage?: number;
}

// 扩展的批量相似度结果
export interface ExtendedBatchSimilarityResult extends BatchSimilarityResult {
  /**
   * 批处理计算统计信息
   */
  stats: BatchCalculationStats;

  /**
   * 使用的计算器信息
   */
  calculator: {
    name: string;
    type: BatchCalculatorType;
  };
}