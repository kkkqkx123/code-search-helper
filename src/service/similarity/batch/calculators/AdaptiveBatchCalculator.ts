import { injectable, inject } from 'inversify';
import { BaseBatchCalculator } from '../BaseBatchCalculator';
import { BatchCalculatorType, IBatchCalculatorFactory, IBatchSimilarityCalculator } from '../types/BatchCalculatorTypes';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult, SimilarityError } from '../../types/SimilarityTypes';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 自适应批处理计算器
 * 根据策略类型和内容特征自动选择最优的批处理算法
 */
@injectable()
export class AdaptiveBatchCalculator extends BaseBatchCalculator {
  readonly name = 'Adaptive Batch Calculator';
  readonly type = 'adaptive' as BatchCalculatorType;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject('IBatchCalculatorFactory') private calculatorFactory?: IBatchCalculatorFactory
  ) {
    super(logger);
  }

  /**
   * 批量计算相似度
   * 自动选择最优的计算器进行计算
   */
  async calculateBatch(
    contents: string[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const startTime = Date.now();

    try {
      // 验证输入
      this.validateInput(contents, strategy, options);

      // 分析内容特征
      const contentAnalysis = this.analyzeContents(contents);

      // 选择最优计算器
      const optimalCalculatorType = this.selectOptimalCalculator(strategy, contentAnalysis);

      this.logger?.debug(`Adaptive calculator selected optimal type: ${optimalCalculatorType}`, {
        strategyType: strategy.type,
        contentCount: contents.length,
        avgLength: contentAnalysis.avgLength,
        complexity: contentAnalysis.complexity
      });

      // 获取最优计算器
      let optimalCalculator;
      if (this.calculatorFactory) {
        optimalCalculator = this.calculatorFactory.createCalculator(optimalCalculatorType);
      } else {
        // 如果没有工厂，回退到内置逻辑
        optimalCalculator = this.createFallbackCalculator(optimalCalculatorType);
      }

      // 使用最优计算器进行计算
      const result = await optimalCalculator.calculateBatch(contents, strategy, options);

      const executionTime = Date.now() - startTime;

      // 记录自适应选择的性能指标
      this.logAdaptiveMetrics(contents, strategy, optimalCalculatorType, executionTime, contentAnalysis);

      return result;
    } catch (error) {
      this.logger?.error('Error in adaptive batch calculation:', error);

      // 如果自适应计算失败，尝试回退到通用计算器
      if (this.calculatorFactory) {
        try {
          this.logger?.info('Falling back to generic calculator');
          const fallbackCalculator = this.calculatorFactory.createCalculator('generic');
          return await fallbackCalculator.calculateBatch(contents, strategy, options);
        } catch (fallbackError) {
          this.logger?.error('Fallback calculator also failed:', fallbackError);
        }
      }

      throw error;
    }
  }

  /**
   * 分析内容特征
   */
  private analyzeContents(contents: string[]): {
    count: number;
    avgLength: number;
    maxLength: number;
    minLength: number;
    complexity: 'low' | 'medium' | 'high';
    hasCode: boolean;
    hasSpecialChars: boolean;
  } {
    const count = contents.length;
    const lengths = contents.map(content => content.length);
    const avgLength = lengths.reduce((sum, length) => sum + length, 0) / count;
    const maxLength = Math.max(...lengths);
    const minLength = Math.min(...lengths);

    // 分析复杂度
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (avgLength > 1000 || maxLength > 5000) {
      complexity = 'high';
    } else if (avgLength > 100 || maxLength > 1000) {
      complexity = 'medium';
    }

    // 检查是否包含代码
    const hasCode = contents.some(content =>
      /function|class|const|let|var|if|for|while|import|export/.test(content)
    );

    // 检查是否包含特殊字符
    const hasSpecialChars = contents.some(content =>
      /[^\w\s\u4e00-\u9fff]/.test(content)
    );

    return {
      count,
      avgLength,
      maxLength,
      minLength,
      complexity,
      hasCode,
      hasSpecialChars
    };
  }

  /**
   * 选择最优计算器
   */
  private selectOptimalCalculator(
    strategy: ISimilarityStrategy,
    contentAnalysis: ReturnType<AdaptiveBatchCalculator['analyzeContents']>
  ): BatchCalculatorType {
    const strategyType = strategy.type;
    const { count, avgLength, complexity, hasCode } = contentAnalysis;

    // 基于策略类型和内容特征的综合选择逻辑
    switch (strategyType) {
      case 'semantic':
        // 语义策略优先选择语义优化计算器
        if (count > 3 && avgLength > 10) {
          return 'semantic-optimized';
        } else {
          return 'generic'; // 小批量或短内容使用通用计算器
        }
      case 'hybrid':
        // 混合策略根据内容复杂度选择
        if (count > 5 && complexity === 'high') {
          return 'hybrid-optimized';
        } else {
          return 'generic';
        }
      case 'levenshtein':
      case 'keyword':
        // 本地计算策略使用通用计算器
        return 'generic';
      case 'structure':
        // 结构策略根据内容特征选择
        if (count > 100) {
          // 大批量内容使用通用计算器
          return 'generic';
        } else if (complexity === 'high' && count > 20) {
          // 高复杂度内容使用通用计算器
          return 'generic';
        } else {
          return 'generic'; // 结构策略通常使用通用计算器
        }
      default:
        // 默认使用通用计算器
        return 'generic';
    }
  }

  /**
   * 创建回退计算器（当没有工厂时使用）
   */
  private createFallbackCalculator(type: BatchCalculatorType): IBatchSimilarityCalculator {
    // 这里应该创建实际的计算器实例，但为了简化，我们抛出错误
    // 在实际实现中，应该直接实例化相应的计算器类
    throw new SimilarityError(
      `Cannot create calculator of type '${type}' without factory`,
      'MISSING_FACTORY',
      { calculatorType: type }
    );
  }

  /**
   * 记录自适应选择的性能指标
   */
  private logAdaptiveMetrics(
    contents: string[],
    strategy: ISimilarityStrategy,
    selectedCalculatorType: BatchCalculatorType,
    executionTime: number,
    contentAnalysis: ReturnType<AdaptiveBatchCalculator['analyzeContents']>
  ): void {
    this.logger?.info('Adaptive batch calculation completed', {
      strategyType: strategy.type,
      contentCount: contents.length,
      selectedCalculator: selectedCalculatorType,
      executionTime,
      contentAnalysis: {
        avgLength: Math.round(contentAnalysis.avgLength),
        complexity: contentAnalysis.complexity,
        hasCode: contentAnalysis.hasCode
      },
      efficiency: executionTime > 0 ? contents.length / executionTime : 0
    });
  }

  /**
   * 检查是否支持指定的策略
   * 自适应计算器支持所有策略
   */
  isSupported(strategy: ISimilarityStrategy): boolean {
    return true;
  }

  /**
   * 获取推荐的批量大小
   * 根据策略和内容特征动态调整
   */
  getRecommendedBatchSize(contents: string[], strategy: ISimilarityStrategy): number {
    const contentAnalysis = this.analyzeContents(contents);
    const optimalCalculatorType = this.selectOptimalCalculator(strategy, contentAnalysis);

    // 根据选择的计算器类型返回相应的推荐批量大小
    switch (optimalCalculatorType) {
      case 'semantic-optimized':
        return Math.min(contents.length, 50); // 语义计算受API限制
      case 'hybrid-optimized':
        return Math.min(contents.length, 30); // 混合计算较复杂
      case 'generic':
      default:
        return Math.min(contents.length, 100); // 通用计算可以处理更大批量
    }
  }

  /**
   * 预测性能
   */
  predictPerformance(
    contents: string[],
    strategy: ISimilarityStrategy
  ): {
    recommendedCalculator: BatchCalculatorType;
    estimatedTime: number;
    confidence: number;
    reasoning: string;
  } {
    const contentAnalysis = this.analyzeContents(contents);
    const recommendedCalculator = this.selectOptimalCalculator(strategy, contentAnalysis);

    let estimatedTime = 0;
    let confidence = 0.8;
    let reasoning = '';

    // 基于计算器类型估算时间
    switch (recommendedCalculator) {
      case 'semantic-optimized':
        estimatedTime = Math.ceil(contents.length / 50) * 1000; // 假设API调用1秒
        confidence = 0.9;
        reasoning = 'Semantic optimization reduces API calls from O(n²) to O(1)';
        break;
      case 'hybrid-optimized':
        estimatedTime = contents.length * contents.length * 0.1; // 假设每对0.1ms
        confidence = 0.7;
        reasoning = 'Hybrid optimization uses parallel sub-strategy calculation';
        break;
      case 'generic':
      default:
        estimatedTime = contents.length * contents.length * 0.5; // 假设每对0.5ms
        confidence = 0.8;
        reasoning = 'Generic calculator uses optimized symmetric calculation';
        break;
    }

    // 根据内容复杂度调整估算
    if (contentAnalysis.complexity === 'high') {
      estimatedTime *= 1.5;
      confidence -= 0.1;
    }

    return {
      recommendedCalculator,
      estimatedTime: Math.round(estimatedTime),
      confidence: Math.max(0.1, confidence),
      reasoning
    };
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
    adaptiveFeatures: string[];
  } {
    return {
      name: this.name,
      type: this.type,
      supportedStrategies: ['all'], // 支持所有策略
      maxRecommendedBatchSize: 100,
      performanceOptimization: 'Automatic calculator selection',
      adaptiveFeatures: [
        'Content analysis',
        'Strategy-aware selection',
        'Performance prediction',
        'Fallback mechanisms'
      ]
    };
  }
}