import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { IVectorCacheManager } from '../caching/IVectorCacheManager';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { LoggerService } from '../../../utils/LoggerService';

export interface EmbeddingOptions {
  provider?: string;
  batchSize?: number;
  useCache?: boolean;
}

@injectable()
export class VectorEmbeddingService {
  constructor(
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.VectorCacheManager) private cacheManager: IVectorCacheManager,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async generateEmbedding(
    content: string,
    options?: EmbeddingOptions
  ): Promise<number[]> {
    // 检查缓存
    if (options?.useCache !== false) {
      const cacheKey = this.generateCacheKey(content, options?.provider);
      const cached = await this.cacheManager.getCachedEmbedding(cacheKey);
      if (cached) {
        this.logger.debug('Embedding cache hit', { cacheKey });
        return cached;
      }
    }

    // 生成嵌入
    const provider = options?.provider || 'default';
    const embedder = await this.embedderFactory.getEmbedder(provider);
    const result = await embedder.embed({ text: content });

    // 缓存结果
    if (options?.useCache !== false) {
      const cacheKey = this.generateCacheKey(content, options?.provider);
      await this.cacheManager.cacheEmbedding(cacheKey, result.vector);
    }

    return result.vector;
  }

  async generateBatchEmbeddings(
    contents: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    return this.batchProcessor.processBatches(
      contents,
      async (batch) => {
        return Promise.all(
          batch.map(content => this.generateEmbedding(content, options))
        );
      },
      { batchSize: options?.batchSize || 100 }
    );
  }

  private generateCacheKey(content: string, provider?: string): string {
    const hash = this.hashContent(content);
    return `embedding:${provider || 'default'}:${hash}`;
  }

  private hashContent(content: string): string {
    // 简单哈希实现
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}