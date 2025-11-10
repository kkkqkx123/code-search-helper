import { injectable, inject } from 'inversify';
import { BaseBatchCalculator } from '../BaseBatchCalculator';
import { BatchCalculatorType } from '../types/BatchCalculatorTypes';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult, SimilarityError } from '../../types/SimilarityTypes';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 通用批处理计算器
 * 适用于本地计算策略（如 Levenshtein、Keyword 等）
 * 保持原有的批量计算逻辑，利用对称性优化计算
 */
@injectable()
export class GenericBatchCalculator extends BaseBatchCalculator {
  readonly name = 'Generic Batch Calculator';
  readonly type = 'generic' as BatchCalculatorType;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    super(logger);
  }

  /**
   * 批量计算相似度
   * 使用原有的对称性优化算法
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
          `Strategy ${strategy.type} is not supported by generic batch calculator`,
          'STRATEGY_NOT_SUPPORTED',
          { strategy: strategy.type }
        );
      }

      const matrix: number[][] = [];
      const pairs: Array<{
        index1: number;
        index2: number;
        similarity: number;
        isSimilar: boolean;
      }> = [];

      // 计算相似度矩阵（利用对称性）
      for (let i = 0; i < contents.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < contents.length; j++) {
          if (i === j) {
            matrix[i][j] = 1.0; // 对角线为1
          } else if (i > j) {
            // 利用对称性，避免重复计算
            matrix[i][j] = matrix[j][i];
          } else {
            // 计算相似度
            const similarity = await strategy.calculate(contents[i], contents[j], options);
            matrix[i][j] = similarity;
            calculatedPairs++;

            // 记录相似对
            const threshold = options?.threshold || strategy.getDefaultThreshold();
            pairs.push({
              index1: i,
              index2: j,
              similarity,
              isSimilar: similarity >= threshold
            });
          }
        }
      }

      const executionTime = Date.now() - startTime;
      
      // 记录性能指标
      this.logPerformanceMetrics(contents, {
        totalTime: executionTime,
        apiCalls: 0, // 通用计算器不涉及API调用
        cacheHits,
        calculatedPairs,
        calculatorType: this.type
      });

      this.logger?.info(`Generic batch similarity calculation completed`, {
        contentCount: contents.length,
        calculatedPairs,
        executionTime,
        strategy: strategy.type
      });

      return {
        matrix,
        pairs,
        executionTime,
        cacheHits
      };
    } catch (error) {
      this.logger?.error('Error in generic batch similarity calculation:', error);
      throw error;
    }
  }

  /**
   * 检查是否支持指定的策略
   * 通用计算器支持所有本地计算策略
   */
  isSupported(strategy: ISimilarityStrategy): boolean {
    // 通用计算器支持所有非API策略
    const supportedStrategies = ['levenshtein', 'keyword', 'structure'];
    return supportedStrategies.includes(strategy.type);
  }

  /**
   * 获取推荐的批量大小
   * 对于本地计算，可以处理较大的批量
   */
  getRecommendedBatchSize(contents: string[], strategy: ISimilarityStrategy): number {
    const contentCount = contents.length;
    
    // 对于本地计算，可以处理更大的批量
    if (contentCount <= 20) {
      return contentCount;
    } else if (contentCount <= 100) {
      return 50;
    } else if (contentCount <= 500) {
      return 100;
    } else {
      // 对于非常大的批量，建议分批处理
      return 200;
    }
  }

  /**
   * 分批处理大量内容
   * 当内容数量超过推荐批量大小时使用
   */
  async calculateLargeBatch(
    contents: string[], 
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const recommendedBatchSize = this.getRecommendedBatchSize(contents, strategy);
    
    if (contents.length <= recommendedBatchSize) {
      return this.calculateBatch(contents, strategy, options);
    }

    this.logger?.info(`Processing large batch in chunks`, {
      totalContents: contents.length,
      chunkSize: recommendedBatchSize,
      chunks: Math.ceil(contents.length / recommendedBatchSize)
    });

    // 分批处理
    const allMatrices: number[][][] = [];
    const allPairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }> = [];
    let totalExecutionTime = 0;
    let totalCacheHits = 0;

    for (let i = 0; i < contents.length; i += recommendedBatchSize) {
      const chunk = contents.slice(i, i + recommendedBatchSize);
      const chunkResult = await this.calculateBatch(chunk, strategy, options);
      
      allMatrices.push(chunkResult.matrix);
      allPairs.push(...chunkResult.pairs.map(pair => ({
        ...pair,
        index1: pair.index1 + i,
        index2: pair.index2 + i
      })));
      
      totalExecutionTime += chunkResult.executionTime;
      totalCacheHits += chunkResult.cacheHits;
    }

    // 合并矩阵（简化实现，实际可能需要更复杂的合并逻辑）
    const finalMatrix = this.mergeMatrices(allMatrices, contents.length);

    return {
      matrix: finalMatrix,
      pairs: allPairs,
      executionTime: totalExecutionTime,
      cacheHits: totalCacheHits
    };
  }

  /**
   * 合并多个矩阵
   * 这是一个简化实现，实际可能需要考虑跨批次的相似度计算
   */
  private mergeMatrices(matrices: number[][][], totalSize: number): number[][] {
    const finalMatrix: number[][] = Array(totalSize).fill(0).map(() => Array(totalSize).fill(0));
    
    let offset = 0;
    for (const matrix of matrices) {
      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          finalMatrix[offset + i][offset + j] = matrix[i][j];
        }
      }
      offset += matrix.length;
    }

    return finalMatrix;
  }

  /**
   * 估算计算时间
   */
  estimateCalculationTime(contents: string[], strategy: ISimilarityStrategy): number {
    const pairCount = (contents.length * (contents.length - 1)) / 2;
    
    // 基于策略类型的估算时间（毫秒）
    const timePerPair: Record<string, number> = {
      'levenshtein': 0.5,
      'keyword': 0.2,
      'structure': 1.0
    };

    const estimatedTime = pairCount * (timePerPair[strategy.type] || 0.5);
    return Math.round(estimatedTime);
  }

  /**
   * 获取计算器统计信息
   */
  getCalculatorStats(): {
    name: string;
    type: BatchCalculatorType;
    supportedStrategies: string[];
    maxRecommendedBatchSize: number;
  } {
    return {
      name: this.name,
      type: this.type,
      supportedStrategies: ['levenshtein', 'keyword', 'structure'],
      maxRecommendedBatchSize: 200
    };
  }
}