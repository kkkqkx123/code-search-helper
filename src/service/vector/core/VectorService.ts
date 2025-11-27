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
    
    try {
      this.logger.info(`Starting enhanced batch processing for ${operations.length} operations`);
      
      // 1. 按操作类型分组
      const operationGroups = this.groupOperationsByType(operations);
      
      this.logger.debug('Operations grouped by type', {
        total: operations.length,
        create: operationGroups.create.length,
        delete: operationGroups.delete.length
      });

      // 2. 并行处理不同类型的操作
      const groupResults = await Promise.allSettled([
        this.processCreateOperations(operationGroups.create),
        this.processDeleteOperations(operationGroups.delete)
      ]);

      // 3. 聚合结果
      return this.aggregateBatchResults(groupResults, startTime);
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'batchProcess',
        operationCount: operations.length
      });
      throw error;
    }
  }

  /**
   * 按操作类型分组
   */
  private groupOperationsByType(operations: VectorOperation[]): {
    create: VectorOperation[];
    delete: VectorOperation[];
  } {
    return operations.reduce((groups: { create: VectorOperation[]; delete: VectorOperation[] }, op) => {
      switch (op.type) {
        case 'create':
          groups.create.push(op);
          break;
        case 'delete':
          groups.delete.push(op);
          break;
      }
      return groups;
    }, { create: [], delete: [] });
  }

  /**
   * 处理创建操作
   */
  private async processCreateOperations(operations: VectorOperation[]): Promise<{
    processed: number;
    failed: number;
    errors: Error[];
  }> {
    if (operations.length === 0) {
      return { processed: 0, failed: 0, errors: [] };
    }

    this.logger.debug(`Processing ${operations.length} create operations`);

    // 分批处理创建操作
    const batchSize = 50; // 向量操作可以使用更大的批次
    const batches: VectorOperation[][] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    let totalProcessed = 0;
    let totalFailed = 0;
    const allErrors: Error[] = [];

    // 并行处理批次
    const batchPromises = batches.map(async (batch, batchIndex) => {
      try {
        // 尝试批量创建
        const vectors = batch.map(op => op.data as Vector);
        await this.repository.createBatch(vectors);
        
        this.logger.debug(`Successfully processed create batch ${batchIndex + 1}`, {
          batchIndex: batchIndex + 1,
          batchSize: batch.length
        });
        
        return { processed: batch.length, failed: 0, errors: [] };
      } catch (batchError) {
        this.logger.warn(`Batch create failed, falling back to individual operations`, {
          batchIndex: batchIndex + 1,
          batchSize: batch.length,
          error: batchError instanceof Error ? batchError.message : String(batchError)
        });

        // 降级到单个操作处理
        return this.processIndividualOperations(batch, 'create');
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        totalProcessed += result.value.processed;
        totalFailed += result.value.failed;
        allErrors.push(...result.value.errors);
      } else {
        // 整个批次失败
        const batchSize = batches[batchResults.indexOf(result)]?.length || 0;
        totalFailed += batchSize;
        allErrors.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
      }
    }

    return {
      processed: totalProcessed,
      failed: totalFailed,
      errors: allErrors
    };
  }

  /**
   * 处理删除操作
   */
  private async processDeleteOperations(operations: VectorOperation[]): Promise<{
    processed: number;
    failed: number;
    errors: Error[];
  }> {
    if (operations.length === 0) {
      return { processed: 0, failed: 0, errors: [] };
    }

    this.logger.debug(`Processing ${operations.length} delete operations`);

    // 分批处理删除操作
    const batchSize = 100; // 删除操作可以使用更大的批次
    const batches: VectorOperation[][] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    let totalProcessed = 0;
    let totalFailed = 0;
    const allErrors: Error[] = [];

    // 并行处理批次
    const batchPromises = batches.map(async (batch, batchIndex) => {
      try {
        // 尝试批量删除
        const vectorIds = batch.map(op => op.data as string);
        await this.repository.deleteBatch(vectorIds);
        
        this.logger.debug(`Successfully processed delete batch ${batchIndex + 1}`, {
          batchIndex: batchIndex + 1,
          batchSize: batch.length
        });
        
        return { processed: batch.length, failed: 0, errors: [] };
      } catch (batchError) {
        this.logger.warn(`Batch delete failed, falling back to individual operations`, {
          batchIndex: batchIndex + 1,
          batchSize: batch.length,
          error: batchError instanceof Error ? batchError.message : String(batchError)
        });

        // 降级到单个操作处理
        return this.processIndividualOperations(batch, 'delete');
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        totalProcessed += result.value.processed;
        totalFailed += result.value.failed;
        allErrors.push(...result.value.errors);
      } else {
        // 整个批次失败
        const batchSize = batches[batchResults.indexOf(result)]?.length || 0;
        totalFailed += batchSize;
        allErrors.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
      }
    }

    return {
      processed: totalProcessed,
      failed: totalFailed,
      errors: allErrors
    };
  }

  /**
   * 处理单个操作（降级方案）
   */
  private async processIndividualOperations(
    operations: VectorOperation[],
    operationType: 'create' | 'delete'
  ): Promise<{
    processed: number;
    failed: number;
    errors: Error[];
  }> {
    let processed = 0;
    let failed = 0;
    const errors: Error[] = [];

    for (const op of operations) {
      try {
        switch (operationType) {
          case 'create':
            const vector = op.data as Vector;
            await this.repository.create(vector);
            break;
          case 'delete':
            await this.repository.delete(op.data as string);
            break;
        }
        processed++;
      } catch (error) {
        failed++;
        errors.push(error as Error);
      }
    }

    return { processed, failed, errors };
  }

  /**
   * 聚合批处理结果
   */
  private aggregateBatchResults(
    groupResults: PromiseSettledResult<{
      processed: number;
      failed: number;
      errors: Error[];
    }>[],
    startTime: number
  ): BatchResult {
    let totalProcessed = 0;
    let totalFailed = 0;
    const allErrors: Error[] = [];

    for (const result of groupResults) {
      if (result.status === 'fulfilled') {
        totalProcessed += result.value.processed;
        totalFailed += result.value.failed;
        allErrors.push(...result.value.errors);
      } else {
        // 整个操作组失败
        totalFailed++;
        allErrors.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
      }
    }

    const executionTime = Date.now() - startTime;
    const success = totalFailed === 0;

    this.logger.info(`Batch processing completed`, {
      totalProcessed,
      totalFailed,
      executionTime,
      success
    });

    return {
      success,
      processedCount: totalProcessed,
      failedCount: totalFailed,
      errors: allErrors.length > 0 ? allErrors : undefined,
      executionTime
    };
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