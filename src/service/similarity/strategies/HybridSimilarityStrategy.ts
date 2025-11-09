import { inject, injectable } from 'inversify';
import { BaseSimilarityStrategy } from './BaseSimilarityStrategy';
import { SimilarityOptions, SimilarityStrategyType, AdvancedSimilarityOptions } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { LevenshteinSimilarityStrategy } from './LevenshteinSimilarityStrategy';
import { SemanticSimilarityStrategy } from './SemanticSimilarityStrategy';
import { KeywordSimilarityStrategy } from './KeywordSimilarityStrategy';

/**
 * 混合相似度策略
 * 结合多种相似度计算方法，提供更准确的结果
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
      this.calculateWithFallback(this.levenshteinStrategy, content1, content2, options),
      this.calculateWithFallback(this.semanticStrategy, content1, content2, options),
      this.calculateWithFallback(this.keywordStrategy, content1, content2, options)
    ]);

    // 计算加权平均
    const hybridSimilarity = 
      (levenshteinSim * weights.content) +
      (semanticSim * weights.semantic) +
      (keywordSim * weights.keywords);

    return this.normalizeScore(hybridSimilarity);
  }

  /**
   * 带回退机制的相似度计算
   */
  private async calculateWithFallback(
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
      console.warn(`Strategy ${strategy.name} failed, using fallback:`, error);
      // 如果策略失败，使用简单的字符重叠作为回退
      return this.calculateSimpleOverlap(content1, content2);
    }
  }

  /**
   * 简单的字符重叠计算（作为最后的回退）
   */
  private calculateSimpleOverlap(content1: string, content2: string): number {
    const chars1 = new Set(content1.toLowerCase());
    const chars2 = new Set(content2.toLowerCase());
    
    const intersection = new Set([...chars1].filter(char => chars2.has(char)));
    const union = new Set([...chars1, ...chars2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
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
   * 根据内容类型调整权重
   */
  private adjustWeightsByContentType(
    weights: { content: number; semantic: number; keywords: number },
    contentType?: string
  ): { content: number; semantic: number; keywords: number } {
    switch (contentType) {
      case 'code':
        // 代码更注重结构和关键词
        return {
          content: 0.3,
          semantic: 0.3,
          keywords: 0.4
        };
      
      case 'document':
        // 文档更注重语义
        return {
          content: 0.3,
          semantic: 0.5,
          keywords: 0.2
        };
      
      default:
        return weights;
    }
  }

  /**
   * 根据内容长度调整权重
   */
  private adjustWeightsByContentLength(
    weights: { content: number; semantic: number; keywords: number },
    content1: string,
    content2: string
  ): { content: number; semantic: number; keywords: number } {
    const avgLength = (content1.length + content2.length) / 2;
    
    if (avgLength < 50) {
      // 短内容更依赖关键词
      return {
        content: 0.2,
        semantic: 0.2,
        keywords: 0.6
      };
    } else if (avgLength > 500) {
      // 长内容更依赖语义
      return {
        content: 0.3,
        semantic: 0.5,
        keywords: 0.2
      };
    }
    
    return weights;
  }

  /**
   * 计算详细相似度分析（用于调试和优化）
   */
  async calculateDetailedSimilarity(
    content1: string,
    content2: string,
    options?: AdvancedSimilarityOptions
  ): Promise<{
    overall: number;
    details: {
      levenshtein: number;
      semantic: number;
      keyword: number;
      weights: {
        content: number;
        semantic: number;
        keywords: number;
      };
    };
  }> {
    const weights = this.getWeights(options);
    
    const [levenshteinSim, semanticSim, keywordSim] = await Promise.all([
      this.calculateWithFallback(this.levenshteinStrategy, content1, content2, options),
      this.calculateWithFallback(this.semanticStrategy, content1, content2, options),
      this.calculateWithFallback(this.keywordStrategy, content1, content2, options)
    ]);

    const overall = 
      (levenshteinSim * weights.content) +
      (semanticSim * weights.semantic) +
      (keywordSim * weights.keywords);

    return {
      overall: this.normalizeScore(overall),
      details: {
        levenshtein: levenshteinSim,
        semantic: semanticSim,
        keyword: keywordSim,
        weights
      }
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