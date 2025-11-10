import { inject, injectable } from 'inversify';
import { BaseSimilarityStrategy } from './BaseSimilarityStrategy';
import { SimilarityOptions, SimilarityStrategyType, AdvancedSimilarityOptions } from '../types/SimilarityTypes';
import { StrategyCost } from '../coordination/types/CoordinationTypes';
import { TYPES } from '../../../types';
import { LevenshteinSimilarityStrategy } from './LevenshteinSimilarityStrategy';
import { SemanticSimilarityStrategy } from './SemanticSimilarityStrategy';
import { KeywordSimilarityStrategy } from './KeywordSimilarityStrategy';

/**
 * 简化的混合相似度策略
 * 仅负责纯计算功能，协调逻辑移至SimilarityCoordinator
 */
@injectable()
export class HybridSimilarityStrategy extends BaseSimilarityStrategy {
  readonly name = 'Hybrid Similarity';
  readonly type = 'hybrid' as SimilarityStrategyType;

  constructor(
    @inject(LevenshteinSimilarityStrategy) private levenshteinStrategy: LevenshteinSimilarityStrategy,
    @inject(SemanticSimilarityStrategy) private semanticStrategy: SemanticSimilarityStrategy,
    @inject(KeywordSimilarityStrategy) private keywordStrategy: KeywordSimilarityStrategy
  ) {
    super();
  }

  async calculate(content1: string, content2: string, options?: SimilarityOptions): Promise<number> {
    // 验证输入
    this.validateInput(content1, content2, options);

    // 快速检查完全相同
    if (await this.isIdentical(content1, content2)) {
      return 1.0;
    }

    // 获取权重配置
    const weights = this.getWeights(options as AdvancedSimilarityOptions);
    
    // 并行计算各种相似度
    const [levenshteinSim, semanticSim, keywordSim] = await Promise.all([
      this.calculateStrategy(this.levenshteinStrategy, content1, content2, options),
      this.calculateStrategy(this.semanticStrategy, content1, content2, options),
      this.calculateStrategy(this.keywordStrategy, content1, content2, options)
    ]);

    // 计算加权平均
    const hybridSimilarity =
      (levenshteinSim * weights.content) +
      (semanticSim * weights.semantic) +
      (keywordSim * weights.keywords);

    return this.normalizeScore(hybridSimilarity);
  }

  /**
   * 计算单个策略的相似度
   */
  private async calculateStrategy(
    strategy: BaseSimilarityStrategy,
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<number> {
    try {
      // 检查策略是否支持当前内容类型
      if (!strategy.isSupported(options?.contentType || 'generic', options?.language)) {
        return 0;
      }
      
      return await strategy.calculate(content1, content2, options);
    } catch (error) {
      // 如果策略失败，返回0而不是使用回退机制
      // 回退机制现在由协调器处理
      return 0;
    }
  }

  /**
   * 获取权重配置
   */
  private getWeights(options?: AdvancedSimilarityOptions): {
    content: number;
    semantic: number;
    keywords: number;
  } {
    // 默认权重
    const defaultWeights = {
      content: 0.4,
      semantic: 0.4,
      keywords: 0.2
    };

    if (!options || !options.weights) {
      return defaultWeights;
    }

    // 合并用户自定义权重
    const userWeights = options.weights;
    const totalWeight = (userWeights.content || 0) +
                       (userWeights.semantic || 0) +
                       (userWeights.keywords || 0);

    // 如果用户权重总和为0或无效，使用默认权重
    if (totalWeight === 0) {
      return defaultWeights;
    }

    // 标准化权重
    return {
      content: (userWeights.content || defaultWeights.content) / totalWeight,
      semantic: (userWeights.semantic || defaultWeights.semantic) / totalWeight,
      keywords: (userWeights.keywords || defaultWeights.keywords) / totalWeight
    };
  }

  /**
   * 获取默认阈值
   */
  getDefaultThreshold(): number {
    return 0.7; // 混合策略使用中等阈值
  }

  /**
   * 检查是否支持指定的内容类型
   */
  isSupported(contentType: string, language?: string): boolean {
    // 混合策略支持所有类型，因为它会自动选择合适的子策略
    return true;
  }

  /**
   * 获取策略成本信息
   */
  getStrategyCost(): StrategyCost {
    return {
      computational: 0.8,  // 高计算成本（包含多个策略）
      memory: 0.6,         // 高内存使用
      time: 800,           // 约800ms
      total: 0.8
    };
  }

  /**
   * 预估执行时间（毫秒）
   */
  estimateExecutionTime(content1: string, content2: string): number {
    const baseTime = this.getStrategyCost().time;
    const avgLength = (content1.length + content2.length) / 2;
    
    // 混合策略的执行时间受内容长度影响较大
    if (avgLength < 100) {
      return baseTime * 0.5;
    } else if (avgLength > 1000) {
      return baseTime * 2.5;
    }
    
    return baseTime;
  }

  /**
   * 获取策略优先级
   */
  getPriority(): number {
    return 3; // 混合策略优先级中等
  }

  /**
   * 获取策略统计信息
   */
  getStrategyStats(): {
    name: string;
    supportedStrategies: string[];
    defaultWeights: { content: number; semantic: number; keywords: number };
  } {
    return {
      name: this.name,
      supportedStrategies: [
        this.levenshteinStrategy.name,
        this.semanticStrategy.name,
        this.keywordStrategy.name
      ],
      defaultWeights: {
        content: 0.4,
        semantic: 0.4,
        keywords: 0.2
      }
    };
  }
}