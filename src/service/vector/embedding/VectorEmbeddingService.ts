import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { LoggerService } from '../../../utils/LoggerService';

export interface EmbeddingOptions {
  provider?: string;
  batchSize?: number;
}

@injectable()
export class VectorEmbeddingService {
  constructor(
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) { }

  async generateEmbedding(
    content: string,
    options?: EmbeddingOptions
  ): Promise<number[]> {
    // 生成嵌入
    const provider = options?.provider || 'default';
    const embedder = await this.embedderFactory.getEmbedder(provider);
    const result = await embedder.embed({ text: content });

    // 处理结果（可能是单个或数组）
    const embeddingVector = Array.isArray(result) ? result[0].vector : result.vector;

    return embeddingVector;
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
}