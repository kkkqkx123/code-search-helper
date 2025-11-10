import { injectable, inject } from 'inversify';
import { BaseBatchCalculator } from '../BaseBatchCalculator';
import { BatchCalculatorType } from '../types/BatchCalculatorTypes';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult, SimilarityError } from '../../types/SimilarityTypes';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 混合优化批处理计算器
 * 专门优化混合相似度策略，结合多种策略的批量计算优势
 */
@injectable()
export class HybridOptimizedBatchCalculator extends BaseBatchCalculator {
  readonly name = 'Hybrid Optimized Batch Calculator';
  readonly type = 'hybrid-optimized' as BatchCalculatorType;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    super(logger);
  }

  /**
   * 批量计算相似度
   * 优化混合策略的多维度计算
   */
  async calculateBatch(
    contents: string[], 
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const startTime = Date.now();
    let cacheHits = 0;
    let calculatedPairs = 0;

    try {
      // 验证输入
      this.validateInput(contents, strategy, options);

      // 检查策略是否支持
      if (!this.isSupported(strategy)) {
        throw new SimilarityError(
          `Strategy ${strategy.type} is not supported by hybrid optimized batch calculator`,
          'STRATEGY_NOT_SUPPORTED',
          { strategy: strategy.type }
        );
      }

      // 获取混合策略的子策略
      const subStrategies = this.getSubStrategies(strategy);
      if (!subStrategies || subStrategies.length === 0) {
        throw new SimilarityError(
          'Hybrid strategy must have sub-strategies',
          'INVALID_HYBRID_STRATEGY'
        );
      }

      // 并行计算各子策略的相似度矩阵
      const strategyMatrices = await this.calculateSubStrategyMatrices(contents, subStrategies, options);
      
      // 合并策略矩阵
      const { matrix, pairs } = this.mergeStrategyMatrices(strategyMatrices, contents, options);
      calculatedPairs = pairs.length;

      const executionTime = Math.max(1, Date.now() - startTime);
      
      // 记录性能指标
      this.logPerformanceMetrics(contents, {
        totalTime: executionTime,
        apiCalls: 0, // 混合策略的API调用由子策略处理
        cacheHits,
        calculatedPairs,
        calculatorType: this.type
      });

      this.logger?.info(`Hybrid optimized batch calculation completed`, {
        contentCount: contents.length,
        calculatedPairs,
        subStrategies: subStrategies.length,
        executionTime
      });

      return {
        matrix,
        pairs,
        executionTime,
        cacheHits
      };
    } catch (error) {
      this.logger?.error('Error in hybrid optimized batch calculation:', error);
      throw error;
    }
  }

  /**
   * 获取混合策略的子策略
   */
  private getSubStrategies(strategy: ISimilarityStrategy): ISimilarityStrategy[] {
    // 这里假设混合策略有获取子策略的方法
    // 实际实现可能需要根据具体的混合策略类来调整
    if ('getSubStrategies' in strategy && typeof strategy.getSubStrategies === 'function') {
      return (strategy as any).getSubStrategies();
    }
    
    // 如果没有明确的子策略方法，返回空数组
    return [];
  }

  /**
   * 并行计算各子策略的相似度矩阵
   */
  private async calculateSubStrategyMatrices(
    contents: string[], 
    subStrategies: ISimilarityStrategy[],
    options?: SimilarityOptions
  ): Promise<Array<{
    strategy: ISimilarityStrategy;
    matrix: number[][];
    weight: number;
  }>> {
    const strategyMatrices: Array<{
      strategy: ISimilarityStrategy;
      matrix: number[][];
      weight: number;
    }> = [];

    // 并行计算所有子策略
    const matrixPromises = subStrategies.map(async (subStrategy) => {
      try {
        // 使用通用批量计算方法计算子策略矩阵
        const matrix = await this.calculateStrategyMatrix(contents, subStrategy, options);
        const weight = this.getStrategyWeight(subStrategy, options);
        
        return {
          strategy: subStrategy,
          matrix,
          weight
        };
      } catch (error) {
        this.logger?.warn(`Failed to calculate matrix for sub-strategy ${subStrategy.type}:`, error);
        return null;
      }
    });

    const results = await Promise.all(matrixPromises);
    
    // 过滤掉失败的结果
    return results.filter(result => result !== null) as Array<{
      strategy: ISimilarityStrategy;
      matrix: number[][];
      weight: number;
    }>;
  }

  /**
   * 计算单个策略的相似度矩阵
   */
  private async calculateStrategyMatrix(
    contents: string[], 
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<number[][]> {
    const n = contents.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    // 计算相似度矩阵（利用对称性）
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // 对角线为1
      
      for (let j = i + 1; j < n; j++) {
        const similarity = await strategy.calculate(contents[i], contents[j], options);
        matrix[i][j] = similarity;
        matrix[j][i] = similarity; // 利用对称性
      }
    }

    return matrix;
  }

  /**
   * 获取策略权重
   */
  private getStrategyWeight(strategy: ISimilarityStrategy, options?: SimilarityOptions): number {
    // 默认权重配置
    const defaultWeights: Record<string, number> = {
      'levenshtein': 0.4,
      'semantic': 0.4,
      'keyword': 0.2
    };

    // 从选项中获取自定义权重
    if (options && 'weights' in options && options.weights) {
      const weights = options.weights as any;
      return weights[strategy.type] ?? defaultWeights[strategy.type] ?? 0.33;
    }

    return defaultWeights[strategy.type] ?? 0.33;
  }

  /**
   * 合并策略矩阵
   */
  private mergeStrategyMatrices(
    strategyMatrices: Array<{
      strategy: ISimilarityStrategy;
      matrix: number[][];
      weight: number;
    }>,
    contents: string[],
    options?: SimilarityOptions
  ): {
    matrix: number[][];
    pairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }>;
  } {
    if (strategyMatrices.length === 0) {
      throw new SimilarityError(
        'No valid strategy matrices to merge',
        'NO_VALID_MATRICES'
      );
    }

    const n = contents.length;
    const mergedMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const threshold = options?.threshold || 0.8;

    // 标准化权重
    const totalWeight = strategyMatrices.reduce((sum, item) => sum + item.weight, 0);
    const normalizedWeights = strategyMatrices.map(item => ({
      ...item,
      normalizedWeight: item.weight / totalWeight
    }));

    // 加权合并矩阵
    for (let i = 0; i < n; i++) {
      mergedMatrix[i][i] = 1.0; // 对角线始终为1
      
      for (let j = i + 1; j < n; j++) {
        let weightedSum = 0;
        
        for (const { matrix, normalizedWeight } of normalizedWeights) {
          weightedSum += matrix[i][j] * normalizedWeight;
        }
        
        mergedMatrix[i][j] = weightedSum;
        mergedMatrix[j][i] = weightedSum; // 利用对称性
      }
    }

    // 构建相似对数组
    const pairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }> = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push({
          index1: i,
          index2: j,
          similarity: mergedMatrix[i][j],
          isSimilar: mergedMatrix[i][j] >= threshold
        });
      }
    }

    return { matrix: mergedMatrix, pairs };
  }

  /**
   * 检查是否支持指定的策略
   */
  isSupported(strategy: ISimilarityStrategy): boolean {
    return strategy.type === 'hybrid';
  }

  /**
   * 获取推荐的批量大小
   * 混合策略需要考虑多个子策略的计算开销
   */
  getRecommendedBatchSize(contents: string[], strategy: ISimilarityStrategy): number {
    const contentCount = contents.length;
    const subStrategies = this.getSubStrategies(strategy);
    
    // 根据子策略数量调整批量大小
    const strategyMultiplier = Math.max(1, subStrategies.length);
    
    if (contentCount <= 10) {
      return contentCount;
    } else if (contentCount <= 50) {
      return Math.min(contentCount, Math.floor(20 / strategyMultiplier));
    } else {
      return Math.min(50, Math.floor(100 / strategyMultiplier));
    }
  }

  /**
   * 估算计算时间
   */
  estimateCalculationTime(contents: string[], strategy: ISimilarityStrategy): number {
    const subStrategies = this.getSubStrategies(strategy);
    const pairCount = (contents.length * (contents.length - 1)) / 2;
    
    // 基于子策略类型的估算时间
    const timePerPair: Record<string, number> = {
      'levenshtein': 0.5,
      'semantic': 100, // 语义计算包含API调用时间
      'keyword': 0.2
    };

    let totalTime = 0;
    for (const subStrategy of subStrategies) {
      totalTime += pairCount * (timePerPair[subStrategy.type] || 0.5);
    }

    return Math.round(totalTime);
  }

  /**
   * 获取计算器统计信息
   */
  getCalculatorStats(): {
    name: string;
    type: BatchCalculatorType;
    supportedStrategies: string[];
    maxRecommendedBatchSize: number;
    performanceOptimization: string;
  } {
    return {
      name: this.name,
      type: this.type,
      supportedStrategies: ['hybrid'],
      maxRecommendedBatchSize: 50,
      performanceOptimization: 'Parallel sub-strategy calculation'
    };
  }
}