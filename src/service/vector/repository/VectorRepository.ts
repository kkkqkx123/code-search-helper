import { injectable, inject } from 'inversify';
import { IVectorRepository } from './IVectorRepository';
import { QdrantService } from '../../../database/qdrant/QdrantService';
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
  VectorErrorCode
} from '../types/VectorTypes';
import { VectorPoint } from '../../../database/qdrant/IVectorStore';

/**
 * 向量仓库实现
 * 封装对Qdrant数据库的访问
 */
@injectable()
export class VectorRepository implements IVectorRepository {
  constructor(
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  async create(vector: Vector): Promise<string> {
    try {
      const projectId = vector.metadata.projectId;
      if (!projectId) {
        throw new VectorError('Project ID is required', VectorErrorCode.VALIDATION_ERROR);
      }
      
      const vectorPoint = this.convertToVectorPoint(vector);
      const success = await this.qdrantService.upsertVectorsForProject(
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
      
      const success = await this.qdrantService.upsertVectorsForProject(projectId, vectorPoints);
      
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

      const results = await this.qdrantService.searchVectors(projectId, query, {
        limit: options?.limit || 10,
        scoreThreshold: options?.scoreThreshold,
        filter: this.convertFilter(options?.filter)
      });

      return results.map(r => ({
        id: r.id,
        score: r.score,
        metadata: r.payload as any
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
      const info = await this.qdrantService.getCollectionInfo(filter.projectId);
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

      const info = await this.qdrantService.getCollectionInfo(projectId);
      
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
      await this.qdrantService.createCollection(
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
      await this.qdrantService.deleteCollection(projectId);
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
      return await this.qdrantService.collectionExists(projectId);
    } catch (error) {
      return false;
    }
  }

  private convertToVectorPoint(vector: Vector): VectorPoint {
    return {
      id: vector.id,
      vector: vector.vector,
      payload: {
        content: vector.content,
        filePath: vector.metadata.filePath || '',
        language: vector.metadata.language || 'unknown',
        chunkType: vector.metadata.chunkType || ['code'],
        startLine: vector.metadata.startLine || 0,
        endLine: vector.metadata.endLine || 0,
        functionName: vector.metadata.functionName,
        className: vector.metadata.className,
        snippetMetadata: vector.metadata.snippetMetadata,
        metadata: vector.metadata.customFields || {},
        timestamp: vector.timestamp,
        projectId: vector.metadata.projectId
      }
    };
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