import { injectable, inject } from 'inversify';
import { IVectorService } from './IVectorService';
import { IVectorRepository } from '../repository/IVectorRepository';
import { VectorConversionService } from '../conversion/VectorConversionService';
import { VectorEmbeddingService } from '../embedding/VectorEmbeddingService';
import { ProcessingCoordinator } from '../../parser/processing/coordinator/ProcessingCoordinator';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { VectorPoint, VectorTypeConverter } from '../types/VectorTypes';
import { ICacheService } from '../../../infrastructure/caching/types';
import {
  Vector,
  VectorOptions,
  SearchOptions,
  SearchResult,
  VectorOperation,
  BatchResult,
  ProjectOptions,
  VectorStats,
  PerformanceMetrics,
  ServiceStatus,
} from '../types/VectorTypes';
import * as fs from 'fs/promises';

/**
 * 向量服务核心实现
 * 直接对接 parser 模块，移除中间协调层
 */
@injectable()
export class VectorService implements IVectorService {
  private initialized = false;

  constructor(
    @inject(TYPES.IVectorRepository) private repository: IVectorRepository,
    @inject(TYPES.CacheService) private cacheService: ICacheService,
    @inject(TYPES.VectorConversionService) private conversionService: VectorConversionService,
    @inject(TYPES.VectorEmbeddingService) private embeddingService: VectorEmbeddingService,
    @inject(TYPES.UnifiedProcessingCoordinator) private processingCoordinator: ProcessingCoordinator,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) { }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing VectorService with direct parser integration');
      this.initialized = true;
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'initialize'
      });
      return false;
    }
  }

  async close(): Promise<void> {
    this.logger.info('Closing VectorService');
    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  async getStatus(): Promise<ServiceStatus> {
    const stats = await this.getVectorStats();
    const cacheStats = this.cacheService.getCacheStats();

    return {
      healthy: this.initialized,
      connected: this.initialized,
      stats: {
        totalVectors: stats.totalCount,
        totalProjects: stats.projectCount,
        cacheHitRate: cacheStats.hitRate,
        averageResponseTime: 0
      }
    };
  }

  /**
   * 处理文件并创建向量
   * 直接使用 ProcessingCoordinator，移除中间协调层
   */
  async processFileForEmbedding(filePath: string, projectPath: string): Promise<VectorPoint[]> {
    try {
      this.logger.info(`Processing file for embedding: ${filePath}`);

      // 1. 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      // 2. 直接使用 ProcessingCoordinator 处理代码
      const processingResult = await this.processingCoordinator.process(content, 'unknown', filePath);

      if (!processingResult.success) {
        throw new Error(`Processing failed: ${processingResult.error}`);
      }

      // 3. 生成嵌入向量
      const contents = processingResult.chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateBatchEmbeddings(contents, {
        provider: 'default',
        batchSize: 100
      });

      // 4. 使用增强的 VectorConversionService 转换为向量
      const vectors = await this.conversionService.convertChunksToVectors(
        processingResult.chunks,
        embeddings,
        projectPath
      );

      // 5. 转换为向量点
      const vectorPoints = vectors.map(vector => VectorTypeConverter.toUnifiedVectorPoint(vector));

      // 6. 批量存储向量
      await this.repository.createBatch(vectors);

      this.logger.info(`Successfully processed file ${filePath}, created ${vectorPoints.length} vectors`);
      return vectorPoints;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'processFileForEmbedding',
        filePath,
        projectPath
      });
      throw error;
    }
  }

  async createVectors(content: string[], options?: VectorOptions): Promise<Vector[]> {
    try {
      this.logger.info(`Creating vectors for ${content.length} contents`);

      // 1. 生成嵌入向量
      const embeddings = await this.embeddingService.generateBatchEmbeddings(content, {
        provider: options?.embedderProvider,
        batchSize: options?.batchSize || 100
      });

      // 2. 创建向量对象
      const vectors: Vector[] = content.map((text, index) => ({
        id: this.generateVectorId(text, options),
        vector: embeddings[index],
        content: text,
        metadata: {
          projectId: options?.projectId,
          ...options?.metadata
        },
        timestamp: new Date()
      }));

      // 3. 存储向量
      await this.repository.createBatch(vectors);

      this.logger.info(`Successfully created ${vectors.length} vectors`);
      return vectors;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'createVectors',
        contentCount: content.length
      });
      throw error;
    }
  }

  async deleteVectors(vectorIds: string[]): Promise<boolean> {
    try {
      this.logger.info(`Deleting ${vectorIds.length} vectors`);
      await this.repository.deleteBatch(vectorIds);
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'deleteVectors'
      });
      throw error;
    }
  }

  async searchSimilarVectors(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    try {
      // 检查缓存
      const cacheKey = this.generateSearchCacheKey(query, options);
      const cached = await this.cacheService.getFromCache<SearchResult[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // 执行搜索
      const results = await this.repository.searchByVector(query, options);

      // 缓存结果
      await this.cacheService.setCache(cacheKey, results, 300000); // 5分钟TTL

      return results;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'searchSimilarVectors'
      });
      throw error;
    }
  }

  async searchByContent(content: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      // 生成查询向量
      const embeddings = await this.embeddingService.generateEmbedding(content);
      return await this.searchSimilarVectors(embeddings, options);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'searchByContent'
      });
      throw error;
    }
  }

  async batchProcess(operations: VectorOperation[]): Promise<BatchResult> {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const errors: Error[] = [];

    try {
      for (const op of operations) {
        try {
          switch (op.type) {
            case 'create':
              const vector = op.data as Vector;
              await this.repository.create(vector);
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
        component: 'VectorService',
        operation: 'batchProcess'
      });
      throw error;
    }
  }

  async createProjectIndex(projectId: string, options?: ProjectOptions): Promise<boolean> {
    try {
      this.logger.info(`Creating index for project: ${projectId}`);
      await this.repository.createIndex(projectId, options);
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'createProjectIndex',
        projectId
      });
      throw error;
    }
  }

  async deleteProjectIndex(projectId: string): Promise<boolean> {
    try {
      this.logger.info(`Deleting index for project: ${projectId}`);
      await this.repository.deleteIndex(projectId);
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'deleteProjectIndex',
        projectId
      });
      throw error;
    }
  }

  async getVectorStats(projectId?: string): Promise<VectorStats> {
    try {
      return await this.repository.getStats(projectId);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'getVectorStats'
      });
      throw error;
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      operationCounts: {},
      averageResponseTimes: {},
      cacheHitRates: {},
      errorRates: {},
      throughput: {
        operationsPerSecond: 0,
        vectorsPerSecond: 0
      }
    };
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
}