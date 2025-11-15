import { injectable, inject } from 'inversify';
import { IVectorRepository } from './IVectorRepository';
import { IVectorStore } from '../../../database/qdrant/IVectorStore';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import {
  Vector,
  SearchOptions,
  SearchResult,
  VectorFilter,
  VectorStats,
  IndexOptions,
  VectorError,
  VectorErrorCode,
  VectorTypeConverter
} from '../types/VectorTypes';

/**
 * 向量仓库实现
 * 封装对Qdrant数据库的访问
 */
@injectable()
export class VectorRepository implements IVectorRepository {
  constructor(
    @inject(TYPES.IVectorStore) private vectorStore: IVectorStore,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) { }

  async create(vector: Vector): Promise<string> {
    try {
      const projectId = vector.metadata.projectId;
      if (!projectId) {
        throw new VectorError('Project ID is required', VectorErrorCode.VALIDATION_ERROR);
      }

      const vectorPoint = this.convertToVectorPoint(vector);
      const success = await this.vectorStore.upsertVectors(
        projectId,
        [vectorPoint]
      );

      if (!success) {
        throw new VectorError('Failed to create vector', VectorErrorCode.DATABASE_ERROR);
      }

      return vector.id;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'create'
      });
      throw error;
    }
  }

  async createBatch(vectors: Vector[]): Promise<string[]> {
    try {
      if (vectors.length === 0) return [];

      const projectId = vectors[0].metadata.projectId;
      if (!projectId) {
        throw new VectorError('Project ID is required', VectorErrorCode.VALIDATION_ERROR);
      }

      const vectorPoints = vectors.map(v => this.convertToVectorPoint(v));

      const success = await this.vectorStore.upsertVectors(projectId, vectorPoints);

      if (!success) {
        throw new VectorError('Failed to create vectors batch', VectorErrorCode.DATABASE_ERROR);
      }

      return vectors.map(v => v.id);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'createBatch'
      });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // 通过ID在payload中查找向量（需要Qdrant支持按payload删除）
      // 由于Qdrant不支持直接按ID删除，这里需要使用过滤条件
      // 暂时返回false，因为Qdrant不支持此操作
      throw new VectorError('Direct delete by ID is not supported by Qdrant', VectorErrorCode.OPERATION_NOT_SUPPORTED);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'delete'
      });
      throw error;
    }
  }

  async deleteBatch(ids: string[]): Promise<boolean> {
    try {
      if (ids.length === 0) return true;

      // Qdrant不支持直接按ID批量删除
      throw new VectorError('Batch delete by IDs is not supported by Qdrant', VectorErrorCode.OPERATION_NOT_SUPPORTED);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'deleteBatch'
      });
      throw error;
    }
  }

  async searchByVector(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const projectId = options?.filter?.projectId;
      if (!projectId) {
        throw new VectorError('Project ID is required for search', VectorErrorCode.VALIDATION_ERROR);
      }

      const results = await this.vectorStore.searchVectors(projectId, query, {
        limit: options?.limit || 10,
        scoreThreshold: options?.scoreThreshold,
        filter: this.convertFilter(options?.filter)
      });

      return results.map((r: any) => ({
        id: r.id,
        score: r.score,
        metadata: r.payload
      }));
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'searchByVector'
      });
      throw error;
    }
  }

  async count(filter?: VectorFilter): Promise<number> {
    try {
      if (!filter?.projectId) return 0;
      const info = await this.vectorStore.getCollectionInfo(filter.projectId);
      return info?.pointsCount || 0;
    } catch (error) {
      return 0;
    }
  }

  async getStats(projectId?: string): Promise<VectorStats> {
    try {
      if (!projectId) {
        return {
          totalCount: 0,
          projectCount: 0,
          averageVectorSize: 0,
          indexCount: 0,
          storageSize: 0,
          lastUpdateTime: new Date()
        };
      }

      const info = await this.vectorStore.getCollectionInfo(projectId);

      return {
        totalCount: info?.pointsCount || 0,
        projectCount: 1,
        averageVectorSize: info?.vectors?.size || 0,
        indexCount: 1,
        storageSize: 0,
        lastUpdateTime: new Date()
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'getStats'
      });
      throw error;
    }
  }

  async createIndex(projectId: string, options?: IndexOptions): Promise<boolean> {
    try {
      await this.vectorStore.createCollection(
        projectId,
        options?.vectorSize || 1536,
        options?.distance || 'Cosine'
      );
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'createIndex'
      });
      throw error;
    }
  }

  async deleteIndex(projectId: string): Promise<boolean> {
    try {
      await this.vectorStore.deleteCollection(projectId);
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'deleteIndex'
      });
      throw error;
    }
  }

  async indexExists(projectId: string): Promise<boolean> {
    try {
      return await this.vectorStore.collectionExists(projectId);
    } catch (error) {
      return false;
    }
  }

  private convertToVectorPoint(vector: Vector): any {
    // 使用统一的类型转换器，简化转换逻辑
    return VectorTypeConverter.toVectorPoint(
      VectorTypeConverter.toUnifiedVectorPoint(vector)
    );
  }

  private convertFilter(filter?: VectorFilter): any {
    if (!filter) return undefined;

    const conditions: any[] = [];

    if (filter.language && filter.language.length > 0) {
      conditions.push({
        key: 'language',
        match: { any: filter.language }
      });
    }

    if (filter.chunkType && filter.chunkType.length > 0) {
      conditions.push({
        key: 'chunkType',
        match: { any: filter.chunkType }
      });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }
}