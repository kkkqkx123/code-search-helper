import { inject, injectable } from 'inversify';
import { BaseSimilarityStrategy } from './BaseSimilarityStrategy';
import { SimilarityOptions, SimilarityStrategyType, SimilarityError } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';

/**
 * 语义相似度策略
 * 基于向量嵌入计算语义相似度
 */
@injectable()
export class SemanticSimilarityStrategy extends BaseSimilarityStrategy {
  readonly name = 'Semantic Similarity';
  readonly type = 'semantic' as SimilarityStrategyType;

  constructor(
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.EmbeddingCacheService) private embeddingCache: EmbeddingCacheService
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

    // 检查内容长度 - 太短的内容不适合语义分析
    const minLength = 10;
    if (content1.length < minLength || content2.length < minLength) {
      // 对于短内容，回退到简单的词汇重叠
      return this.calculateKeywordOverlap(content1, content2);
    }

    try {
      // 获取嵌入器
      const embedder = this.embedderFactory.getEmbedder(options?.language || 'default');
      
      // 生成嵌入向量
      const [embedding1, embedding2] = await Promise.all([
        this.getEmbedding(embedder, content1, options),
        this.getEmbedding(embedder, content2, options)
      ]);

      // 计算余弦相似度
      const similarity = this.calculateCosineSimilarity(embedding1, embedding2);
      return this.normalizeScore(similarity);
    } catch (error) {
      // 如果语义分析失败，回退到关键词重叠
      console.warn('Semantic similarity calculation failed, falling back to keyword overlap:', error);
      return this.calculateKeywordOverlap(content1, content2);
    }
  }

  /**
   * 获取内容的嵌入向量
   */
  private async getEmbedding(
    embedder: any,
    content: string,
    options?: SimilarityOptions
  ): Promise<number[]> {
    // 检查缓存
    const cacheKey = this.generateEmbeddingCacheKey(content, options);
    const cachedEmbedding = await this.embeddingCache.get(cacheKey);
    
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    // 生成新的嵌入
    const embedding = await embedder.generateEmbedding(content);
    
    // 缓存结果
    await this.embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  }

  /**
   * 生成嵌入缓存键
   */
  private generateEmbeddingCacheKey(content: string, options?: SimilarityOptions): string {
    const contentHash = this.generateContentHash(content);
    const language = options?.language || 'default';
    return `semantic:${language}:${contentHash}`;
  }

  /**
   * 计算余弦相似度
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new SimilarityError(
        'Vector dimensions must match',
        'DIMENSION_MISMATCH',
        { dim1: vec1.length, dim2: vec2.length }
      );
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 计算关键词重叠度（作为回退方案）
   */
  private calculateKeywordOverlap(content1: string, content2: string): number {
    const words1 = this.extractKeywords(content1);
    const words2 = this.extractKeywords(content2);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    // 简单的关键词提取 - 实际项目中可以使用更复杂的NLP技术
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2) // 过滤短词
      .filter(word => !this.isStopWord(word)); // 过滤停用词
  }

  /**
   * 检查是否为停用词
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
      'why', 'how', 'not', 'no', 'yes'
    ]);
    
    return stopWords.has(word);
  }

  /**
   * 获取默认阈值 - 语义相似度使用中等阈值
   */
  getDefaultThreshold(): number {
    return 0.75;
  }

  /**
   * 检查是否支持指定的内容类型
   */
  isSupported(contentType: string, language?: string): boolean {
    // 语义相似度适用于文档和代码
    return contentType === 'document' || contentType === 'code' || contentType === 'generic';
  }
}