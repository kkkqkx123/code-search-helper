import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { IBatchStrategy, BatchContext } from '../types';
import { ISimilarityStrategy, SimilarityOptions } from '../../../service/similarity/types/SimilarityTypes';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { EmbeddingResult } from '../../../embedders/BaseEmbedder';

/**
 * 语义相似度批处理策略
 * 实现将O(n²)API调用优化为O(1)的关键算法
 */
@injectable()
export class SemanticBatchStrategy implements IBatchStrategy {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.EmbedderFactory) private embedderFactory?: EmbedderFactory,
    @inject(TYPES.EmbeddingCacheService) private embeddingCache?: EmbeddingCacheService
  ) {}

  /**
   * 计算最优批大小
   * 考虑API限制和内存使用
   */
  calculateOptimalBatchSize(itemsCount: number, context?: BatchContext): number {
    // 从环境变量或配置获取API批处理限制
    const maxApiBatchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50');
    
    if (itemsCount <= maxApiBatchSize) {
      return itemsCount;
    } else if (itemsCount <= maxApiBatchSize * 2) {
      return maxApiBatchSize;
    } else {
      // 对于大量内容，建议分批处理
      return Math.min(maxApiBatchSize, 100);
    }
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(error: Error, attempt: number, context?: BatchContext): boolean {
    // 对于API错误，应该重试
    if (error.message.includes('rate limit') || 
        error.message.includes('timeout') ||
        error.message.includes('network')) {
      return attempt < 3; // 最多重试3次
    }
    
    // 对于其他错误，不重试
    return false;
  }

  /**
   * 获取重试延迟
   */
  getRetryDelay(attempt: number, context?: BatchContext): number {
    // 指数退避，基础延迟1秒
    return Math.pow(2, attempt - 1) * 1000;
  }

  /**
   * 根据性能调整批大小
   */
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number, context?: BatchContext): number {
    const performanceThreshold = 5000; // 5秒阈值
    
    if (executionTime > performanceThreshold) {
      // 执行时间过长，减少批大小
      return Math.max(10, Math.floor(batchSize * 0.8));
    } else if (executionTime < performanceThreshold * 0.5) {
      // 执行时间较短，可以增加批大小
      return Math.min(100, Math.floor(batchSize * 1.2));
    }
    
    return batchSize;
  }

  /**
   * 批量生成嵌入向量
   * 这是性能优化的核心：将n*(n-1)/2次API调用减少到1次
   */
  async batchGenerateEmbeddings(
    contents: string[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<{
    embeddings: number[][];
    cacheHits: number;
    apiCalls: number;
  }> {
    if (!this.embedderFactory) {
      throw new Error('EmbedderFactory is required for semantic batch processing');
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
      this.logger.error('Error in batch embedding generation:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 本地计算相似度矩阵
   * 使用余弦相似度计算所有内容对之间的相似度
   */
  calculateSimilarityMatrix(
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
      throw new Error(`Vector dimensions must match: ${vec1.length} vs ${vec2.length}`);
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
   * 估算性能提升
   */
  estimatePerformanceGain(contents: number[]): {
    originalApiCalls: number;
    optimizedApiCalls: number;
    reduction: number;
    efficiency: number;
  } {
    const n = contents.length;
    const originalApiCalls = n * (n - 1); // 每对内容需要2次API调用
    const optimizedApiCalls = Math.ceil(n / this.calculateOptimalBatchSize(n)); // 批量处理
    const reduction = originalApiCalls - optimizedApiCalls;
    const efficiency = originalApiCalls > 0 ? reduction / originalApiCalls : 0;

    return {
      originalApiCalls,
      optimizedApiCalls,
      reduction,
      efficiency
    };
  }
}