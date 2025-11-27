import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';

export interface EmbeddingOptions {
  provider?: string;
  batchSize?: number;
  enableDeduplication?: boolean;
  enableCaching?: boolean;
  maxRetries?: number;
}

export interface EmbeddingProviderLimits {
  maxBatchSize: number;
  maxTokensPerBatch: number;
  maxRequestLength: number;
}

@injectable()
export class VectorEmbeddingService {
  private embeddingCache = new Map<string, number[]>();
  private readonly DEFAULT_CACHE_SIZE = 10000;

  constructor(
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) { }

  async generateEmbedding(
    content: string,
    options?: EmbeddingOptions
  ): Promise<number[]> {
    try {
      // 检查缓存
      if (options?.enableCaching !== false) {
        const cacheKey = this.generateCacheKey(content, options?.provider);
        const cached = this.embeddingCache.get(cacheKey);
        if (cached) {
          this.logger.debug('Embedding cache hit', { contentLength: content.length });
          return cached;
        }
      }

      // 生成嵌入
      const provider = options?.provider || 'default';
      const embedder = await this.embedderFactory.getEmbedder(provider);
      const result = await embedder.embed({ text: content });

      // 处理结果（可能是单个或数组）
      const embeddingVector = Array.isArray(result) ? result[0].vector : result.vector;

      // 缓存结果
      if (options?.enableCaching !== false) {
        this.cacheEmbedding(content, embeddingVector, options?.provider);
      }

      return embeddingVector;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorEmbeddingService',
        operation: 'generateEmbedding',
        contentLength: content.length,
        provider: options?.provider
      });
      throw error;
    }
  }

  async generateBatchEmbeddings(
    contents: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting enhanced batch embedding generation for ${contents.length} contents`, {
        provider: options?.provider,
        enableDeduplication: options?.enableDeduplication,
        enableCaching: options?.enableCaching
      });

      // 1. 内容预处理和去重
      const processedContents = options?.enableDeduplication !== false
        ? this.deduplicateContents(contents)
        : contents.map((content, index) => ({ content, originalIndex: index }));

      this.logger.debug('Content preprocessing completed', {
        originalCount: contents.length,
        uniqueCount: processedContents.length,
        deduplicationRate: ((contents.length - processedContents.length) / contents.length * 100).toFixed(1) + '%'
      });

      // 2. 智能批次大小计算
      const optimalBatchSize = await this.calculateOptimalBatchSize(
        processedContents.map(item => item.content),
        options
      );

      this.logger.debug('Calculated optimal batch size', {
        optimalBatchSize,
        provider: options?.provider
      });

      // 3. 使用优化的批处理策略
      const uniqueEmbeddings = await this.batchProcessor.executeBatch(
        processedContents.map(item => item.content),
        async (batch: string[]) => {
          return this.processBatchWithEmbedder(batch, options);
        },
        {
          batchSize: optimalBatchSize,
          maxConcurrency: 3,
          context: { domain: 'embedding', subType: 'batch' }
        }
      );

      // 4. 重建原始顺序的结果
      const embeddings = this.reconstructOriginalOrder(uniqueEmbeddings, processedContents, contents.length);

      const duration = Date.now() - startTime;
      this.logger.info(`Batch embedding generation completed`, {
        originalCount: contents.length,
        uniqueCount: processedContents.length,
        duration,
        cacheHits: this.getCacheStats().hits,
        cacheSize: this.embeddingCache.size
      });

      return embeddings;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorEmbeddingService',
        operation: 'generateBatchEmbeddings',
        contentCount: contents.length,
        provider: options?.provider,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * 内容去重
   */
  private deduplicateContents(contents: string[]): Array<{ content: string; originalIndex: number }> {
    const contentMap = new Map<string, number>();
    const uniqueContents: Array<{ content: string; originalIndex: number }> = [];

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      if (!contentMap.has(content)) {
        contentMap.set(content, i);
        uniqueContents.push({ content, originalIndex: i });
      }
    }

    return uniqueContents;
  }

  /**
   * 计算最优批次大小
   */
  private async calculateOptimalBatchSize(contents: string[], options?: EmbeddingOptions): Promise<number> {
    const provider = options?.provider || 'default';
    const embedderLimits = this.getEmbedderLimits(provider);
    
    // 基于内容长度计算
    const avgContentLength = contents.reduce((sum, content) => sum + content.length, 0) / contents.length;
    
    let optimalBatchSize: number;
    
    if (avgContentLength > 8000) {
      optimalBatchSize = Math.min(5, embedderLimits.maxBatchSize);
    } else if (avgContentLength > 4000) {
      optimalBatchSize = Math.min(10, embedderLimits.maxBatchSize);
    } else if (avgContentLength > 2000) {
      optimalBatchSize = Math.min(25, embedderLimits.maxBatchSize);
    } else if (avgContentLength > 1000) {
      optimalBatchSize = Math.min(50, embedderLimits.maxBatchSize);
    } else {
      optimalBatchSize = Math.min(100, embedderLimits.maxBatchSize);
    }

    // 考虑token限制
    const estimatedTokensPerContent = avgContentLength / 4; // 粗略估算
    const maxBatchByTokens = Math.floor(embedderLimits.maxTokensPerBatch / estimatedTokensPerContent);
    optimalBatchSize = Math.min(optimalBatchSize, maxBatchByTokens);

    // 确保最小批次大小
    optimalBatchSize = Math.max(1, optimalBatchSize);

    return optimalBatchSize;
  }

  /**
   * 使用embedder处理批次
   */
  private async processBatchWithEmbedder(
    batch: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    try {
      const provider = options?.provider || 'default';
      const embedder = await this.embedderFactory.getEmbedder(provider);
      
      // 准备输入数据
      const inputs = batch.map(content => ({ text: content }));
      
      // 批量生成嵌入
      const result = await embedder.embed(inputs);
      
      // 处理结果格式
      const embeddings = Array.isArray(result)
        ? result.map(r => r.vector)
        : [result.vector];

      // 缓存结果
      if (options?.enableCaching !== false) {
        batch.forEach((content, index) => {
          if (index < embeddings.length) {
            this.cacheEmbedding(content, embeddings[index], provider);
          }
        });
      }

      return embeddings;
    } catch (error) {
      this.logger.error('Batch embedding failed, falling back to individual processing', {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error)
      });

      // 降级到单个处理
      const embeddings: number[][] = [];
      for (const content of batch) {
        try {
          const embedding = await this.generateEmbedding(content, options);
          embeddings.push(embedding);
        } catch (individualError) {
          this.logger.error('Individual embedding failed', {
            content: content.substring(0, 100) + '...',
            error: individualError instanceof Error ? individualError.message : String(individualError)
          });
          // 可以选择抛出错误或返回空向量
          throw individualError;
        }
      }
      
      return embeddings;
    }
  }

  /**
   * 重建原始顺序的结果
   */
  private reconstructOriginalOrder(
    uniqueEmbeddings: number[][],
    uniqueContents: Array<{ content: string; originalIndex: number }>,
    originalLength: number
  ): number[][] {
    const result: number[][] = new Array(originalLength);
    
    uniqueContents.forEach((item, uniqueIndex) => {
      if (uniqueIndex < uniqueEmbeddings.length) {
        result[item.originalIndex] = uniqueEmbeddings[uniqueIndex];
      }
    });

    return result;
  }

  /**
   * 获取embedder限制
   */
  private getEmbedderLimits(provider: string): EmbeddingProviderLimits {
    // 这里可以根据不同的provider返回不同的限制
    const limits: Record<string, EmbeddingProviderLimits> = {
      'openai': {
        maxBatchSize: 2048,
        maxTokensPerBatch: 8192,
        maxRequestLength: 8192
      },
      'default': {
        maxBatchSize: 100,
        maxTokensPerBatch: 4096,
        maxRequestLength: 4096
      },
      'ollama': {
        maxBatchSize: 50,
        maxTokensPerBatch: 2048,
        maxRequestLength: 2048
      }
    };

    return limits[provider] || limits['default'];
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(content: string, provider?: string): string {
    const hash = this.simpleHash(content);
    return `${provider || 'default'}:${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 缓存嵌入向量
   */
  private cacheEmbedding(content: string, embedding: number[], provider?: string): void {
    // 检查缓存大小限制
    if (this.embeddingCache.size >= this.DEFAULT_CACHE_SIZE) {
      // 简单的LRU：删除最旧的条目
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) {
        this.embeddingCache.delete(firstKey);
      }
    }

    const cacheKey = this.generateCacheKey(content, provider);
    this.embeddingCache.set(cacheKey, embedding);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { hits: number; size: number; maxSize: number } {
    return {
      hits: 0, // 这里可以实现真正的命中统计
      size: this.embeddingCache.size,
      maxSize: this.DEFAULT_CACHE_SIZE
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.embeddingCache.clear();
    this.logger.info('Embedding cache cleared');
  }

  /**
   * 预热缓存
   */
  async warmupCache(contents: string[], options?: EmbeddingOptions): Promise<void> {
    this.logger.info(`Warming up cache with ${contents.length} contents`);
    
    try {
      await this.generateBatchEmbeddings(contents, {
        ...options,
        enableCaching: true,
        enableDeduplication: true
      });
      
      this.logger.info('Cache warmup completed', {
        cacheSize: this.embeddingCache.size
      });
    } catch (error) {
      this.logger.error('Cache warmup failed', { error });
    }
  }
}