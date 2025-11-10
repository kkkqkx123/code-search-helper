import { injectable, inject } from 'inversify';
import { BaseBatchCalculator } from '../BaseBatchCalculator';
import { BatchCalculatorType } from '../types/BatchCalculatorTypes';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult, SimilarityError } from '../../types/SimilarityTypes';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { EmbedderFactory } from '../../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../../embedders/EmbeddingCacheService';
import { EmbeddingResult } from '../../../../embedders/BaseEmbedder';

/**
 * 语义优化批处理计算器
 * 专门优化语义相似度策略的API调用，将O(n²)的API调用优化为O(1)
 */
@injectable()
export class SemanticOptimizedBatchCalculator extends BaseBatchCalculator {
  readonly name = 'Semantic Optimized Batch Calculator';
  readonly type = 'semantic-optimized' as BatchCalculatorType;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.EmbedderFactory) private embedderFactory?: EmbedderFactory,
    @inject(TYPES.EmbeddingCacheService) private embeddingCache?: EmbeddingCacheService
  ) {
    super(logger);
  }

  /**
   * 批量计算相似度
   * 通过批量生成嵌入向量来优化API调用
   */
  async calculateBatch(
    contents: string[], 
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const startTime = Date.now();
    let cacheHits = 0;
    let apiCalls = 0;
    let calculatedPairs = 0;

    try {
      // 验证输入
      this.validateInput(contents, strategy, options);

      // 检查策略是否支持
      if (!this.isSupported(strategy)) {
        throw new SimilarityError(
          `Strategy ${strategy.type} is not supported by semantic optimized batch calculator`,
          'STRATEGY_NOT_SUPPORTED',
          { strategy: strategy.type }
        );
      }

      // 步骤1：批量生成所有嵌入向量（关键优化点）
      const { embeddings, cacheHits: embeddingCacheHits, apiCalls: embeddingApiCalls } = 
        await this.batchGenerateEmbeddings(contents, options);
      
      cacheHits += embeddingCacheHits;
      apiCalls += embeddingApiCalls;

      // 步骤2：本地计算相似度矩阵（无需额外API调用）
      const { matrix, pairs } = this.calculateSimilarityMatrix(embeddings, contents, options);
      calculatedPairs = pairs.length;

      const executionTime = Date.now() - startTime;
      
      // 记录性能指标
      this.logPerformanceMetrics(contents, {
        totalTime: executionTime,
        apiCalls,
        cacheHits,
        calculatedPairs,
        calculatorType: this.type
      });

      this.logger?.info(`Semantic optimized batch calculation completed`, {
        contentCount: contents.length,
        calculatedPairs,
        apiCalls,
        cacheHits,
        executionTime,
        efficiency: calculatedPairs > 0 ? apiCalls / calculatedPairs : 0
      });

      return {
        matrix,
        pairs,
        executionTime,
        cacheHits
      };
    } catch (error) {
      this.logger?.error('Error in semantic optimized batch calculation:', error);
      throw error;
    }
  }

  /**
   * 批量生成嵌入向量
   * 这是性能优化的核心：将n*(n-1)/2次API调用减少到1次
   */
  private async batchGenerateEmbeddings(
    contents: string[], 
    options?: SimilarityOptions
  ): Promise<{
    embeddings: number[][];
    cacheHits: number;
    apiCalls: number;
  }> {
    if (!this.embedderFactory) {
      throw new SimilarityError(
        'EmbedderFactory is required for semantic batch calculation',
        'MISSING_DEPENDENCY',
        { dependency: 'EmbedderFactory' }
      );
    }

    let cacheHits = 0;
    let apiCalls = 0;

    try {
      // 获取嵌入器
      const provider = options?.embedderProvider || options?.language || 'default';
      const embedder = await this.embedderFactory.getEmbedder(provider);

      // 检查缓存
      const cachedEmbeddings: number[][] = [];
      const uncachedContents: string[] = [];
      const uncachedIndices: number[] = [];

      if (this.embeddingCache) {
        for (let i = 0; i < contents.length; i++) {
          const cached = await this.embeddingCache.get(contents[i], embedder.getModelName());
          if (cached) {
            cachedEmbeddings[i] = cached.vector;
            cacheHits++;
          } else {
            uncachedContents.push(contents[i]);
            uncachedIndices.push(i);
          }
        }
      } else {
        // 如果没有缓存服务，所有内容都需要生成嵌入
        uncachedContents.push(...contents);
        uncachedIndices.push(...contents.map((_, i) => i));
      }

      // 批量生成未缓存的嵌入向量
      let uncachedEmbeddings: number[][] = [];
      if (uncachedContents.length > 0) {
        const embeddingInputs = uncachedContents.map(text => ({ text }));
        const results = await embedder.embed(embeddingInputs) as EmbeddingResult[];
        uncachedEmbeddings = results.map(result => result.vector);
        apiCalls++;

        // 缓存新生成的嵌入向量
        if (this.embeddingCache) {
          for (let i = 0; i < uncachedContents.length; i++) {
            await this.embeddingCache.set(
              uncachedContents[i], 
              embedder.getModelName(), 
              {
                vector: uncachedEmbeddings[i],
                dimensions: embedder.getDimensions(),
                model: embedder.getModelName(),
                processingTime: 0
              }
            );
          }
        }
      }

      // 合并缓存和新生成的嵌入向量
      const embeddings: number[][] = new Array(contents.length);
      for (let i = 0; i < cachedEmbeddings.length; i++) {
        if (cachedEmbeddings[i]) {
          embeddings[i] = cachedEmbeddings[i];
        }
      }

      let uncachedIndex = 0;
      for (const index of uncachedIndices) {
        embeddings[index] = uncachedEmbeddings[uncachedIndex++];
      }

      return { embeddings, cacheHits, apiCalls };
    } catch (error) {
      this.logger?.error('Error in batch embedding generation:', error);
      throw new SimilarityError(
        'Failed to generate batch embeddings',
        'EMBEDDING_GENERATION_ERROR',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * 本地计算相似度矩阵
   * 使用余弦相似度计算所有内容对之间的相似度
   */
  private calculateSimilarityMatrix(
    embeddings: number[][], 
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
    const n = embeddings.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const pairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }> = [];

    const threshold = options?.threshold || 0.8;

    // 计算相似度矩阵（利用对称性）
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // 对角线为1
      
      for (let j = i + 1; j < n; j++) {
        const similarity = this.calculateCosineSimilarity(embeddings[i], embeddings[j]);
        matrix[i][j] = similarity;
        matrix[j][i] = similarity; // 利用对称性

        // 记录相似对
        pairs.push({
          index1: i,
          index2: j,
          similarity,
          isSimilar: similarity >= threshold
        });
      }
    }

    return { matrix, pairs };
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
   * 检查是否支持指定的策略
   */
  isSupported(strategy: ISimilarityStrategy): boolean {
    return strategy.type === 'semantic';
  }

  /**
   * 获取推荐的批量大小
   * 对于语义计算，考虑API限制和内存使用
   */
  getRecommendedBatchSize(contents: string[], strategy: ISimilarityStrategy): number {
    const contentCount = contents.length;
    
    // 考虑嵌入器的批处理限制
    const maxApiBatchSize = this.getMaxApiBatchSize();
    
    if (contentCount <= maxApiBatchSize) {
      return contentCount;
    } else if (contentCount <= maxApiBatchSize * 2) {
      return maxApiBatchSize;
    } else {
      // 对于大量内容，建议分批处理
      return Math.min(maxApiBatchSize, 100);
    }
  }

  /**
   * 获取API批处理大小限制
   */
  private getMaxApiBatchSize(): number {
    // 从环境变量或配置获取，默认使用保守值
    return parseInt(process.env.EMBEDDING_BATCH_SIZE || '50');
  }

  /**
   * 估算性能提升
   */
  estimatePerformanceGain(contents: string[]): {
    originalApiCalls: number;
    optimizedApiCalls: number;
    reduction: number;
    efficiency: number;
  } {
    const n = contents.length;
    const originalApiCalls = n * (n - 1); // 每对内容需要2次API调用
    const optimizedApiCalls = Math.ceil(n / this.getMaxApiBatchSize()); // 批量处理
    const reduction = originalApiCalls - optimizedApiCalls;
    const efficiency = originalApiCalls > 0 ? reduction / originalApiCalls : 0;

    return {
      originalApiCalls,
      optimizedApiCalls,
      reduction,
      efficiency
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
  } {
    return {
      name: this.name,
      type: this.type,
      supportedStrategies: ['semantic'],
      maxRecommendedBatchSize: this.getMaxApiBatchSize(),
      performanceOptimization: 'O(n²) to O(1) API calls'
    };
  }
}