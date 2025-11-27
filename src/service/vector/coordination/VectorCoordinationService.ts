import { injectable, inject } from 'inversify';
import { IVectorCoordinationService } from './IVectorCoordinationService';
import { IVectorRepository } from '../repository/IVectorRepository';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import {
  Vector,
  VectorOptions,
  SearchOptions,
  SearchResult,
  VectorOperation,
  BatchResult,
  EmbeddingOptions,
  BatchOptions,
} from '../types/VectorTypes';
import { EmbeddingInput } from '../../../embedders/BaseEmbedder';

/**
 * 向量协调服务实现
 */
@injectable()
export class VectorCoordinationService implements IVectorCoordinationService {
  constructor(
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.IVectorRepository) private repository: IVectorRepository,
    @inject(TYPES.CacheService) private cacheService: any,
    @inject(TYPES.BatchProcessingService) private batchService: BatchProcessingService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  async coordinateVectorCreation(contents: string[], options?: VectorOptions): Promise<Vector[]> {
    try {
      this.logger.info(`Coordinating vector creation for ${contents.length} contents`);
      
      // 1. 生成嵌入向量
      const embeddings = await this.handleEmbeddingGeneration(contents, options);
      
      // 2. 创建向量对象
      const vectors = contents.map((content, index) => ({
        id: this.generateVectorId(content, options),
        vector: embeddings[index],
        content,
        metadata: {
          projectId: options?.projectId || 'default',
          ...options?.metadata
        },
        timestamp: new Date()
      }));
      
      // 3. 批量存储向量
      await this.repository.createBatch(vectors);
      
      // 4. 缓存结果
      await this.cacheVectors(vectors);
      
      return vectors;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorCoordinationService',
        operation: 'coordinateVectorCreation'
      });
      throw error;
    }
  }

  async coordinateVectorSearch(query: number[] | string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      let queryVector: number[];
      
      if (typeof query === 'string') {
        const embeddings = await this.handleEmbeddingGeneration([query]);
        queryVector = embeddings[0];
      } else {
        queryVector = query;
      }
      
      // 检查缓存
      const cacheKey = this.generateSearchCacheKey(queryVector, options);
      const cached = await this.cacheService.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
      
      // 执行搜索
      const results = await this.repository.searchByVector(queryVector, options);
      
      // 缓存结果
      await this.cacheService.setCache(cacheKey, results);
      
      return results;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorCoordinationService',
        operation: 'coordinateVectorSearch'
      });
      throw error;
    }
  }

  async coordinateBatchOperations(operations: VectorOperation[]): Promise<BatchResult> {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const errors: Error[] = [];

    try {
      for (const op of operations) {
        try {
          switch (op.type) {
            case 'create':
              await this.repository.create(op.data as Vector);
              break;
            case 'delete':
              await this.repository.delete(op.data as string);
              break;
          }
          processedCount++;
        } catch (error) {
          failedCount++;
          errors.push(error as Error);
        }
      }

      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors: errors.length > 0 ? errors : undefined,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorCoordinationService',
        operation: 'coordinateBatchOperations'
      });
      throw error;
    }
  }

  async handleEmbeddingGeneration(contents: string[], options?: EmbeddingOptions): Promise<number[][]> {
    try {
      const embeddingInputs: EmbeddingInput[] = contents.map(text => ({ text }));
      
      const provider = options?.provider || 'default';
      const embedder = await this.embedderFactory.getEmbedder(provider);
      
      const results: number[][] = [];
      
      for (const input of embeddingInputs) {
        const result = await embedder.embed(input);
        const vector = Array.isArray(result) ? result[0].vector : result.vector;
        results.push(vector);
      }
      
      return results;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorCoordinationService',
        operation: 'handleEmbeddingGeneration'
      });
      throw error;
    }
  }

  async optimizeBatchProcessing<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchOptions
  ): Promise<R[]> {
    return await this.batchService.executeBatch(items, processor, options);
  }

  private generateVectorId(content: string, options?: VectorOptions): string {
    const projectId = options?.projectId || 'default';
    const timestamp = Date.now();
    const hash = this.simpleHash(content);
    return `${projectId}_${timestamp}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private generateSearchCacheKey(query: number[], options?: SearchOptions): string {
    const queryHash = this.simpleHash(query.join(','));
    const optionsHash = this.simpleHash(JSON.stringify(options || {}));
    return `search:${queryHash}:${optionsHash}`;
  }

  private async cacheVectors(vectors: Vector[]): Promise<void> {
    for (const vector of vectors) {
      await this.cacheService.setCache(vector.id, vector);
    }
  }
}