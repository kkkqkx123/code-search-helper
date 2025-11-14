import { injectable, inject } from 'inversify';
import { IVectorService } from './IVectorService';
import { IVectorRepository } from '../repository/IVectorRepository';
import { IVectorCoordinationService } from '../coordination/IVectorCoordinationService';
import { IVectorCacheManager } from '../caching/IVectorCacheManager';
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
  ProjectOptions,
  VectorStats,
  PerformanceMetrics,
  ServiceStatus,
  VectorError,
  VectorErrorCode
} from '../types/VectorTypes';

/**
 * 向量服务核心实现
 */
@injectable()
export class VectorService implements IVectorService {
  private initialized = false;

  constructor(
    @inject(TYPES.IVectorRepository) private repository: IVectorRepository,
    @inject(TYPES.IVectorCoordinationService) private coordinator: IVectorCoordinationService,
    @inject(TYPES.IVectorCacheManager) private cacheManager: IVectorCacheManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing VectorService');
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
    const cacheStats = await this.cacheManager.getStats();
    
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

  async createVectors(content: string[], options?: VectorOptions): Promise<Vector[]> {
    try {
      this.logger.info(`Creating vectors for ${content.length} contents`);
      const vectors = await this.coordinator.coordinateVectorCreation(content, options);
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

  async updateVectors(vectors: Vector[]): Promise<boolean> {
    try {
      this.logger.info(`Updating ${vectors.length} vectors`);
      for (const vector of vectors) {
        await this.repository.update(vector.id, vector);
      }
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'updateVectors'
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
      return await this.coordinator.coordinateVectorSearch(query, options);
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
      return await this.coordinator.coordinateVectorSearch(content, options);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'searchByContent'
      });
      throw error;
    }
  }

  async batchProcess(operations: VectorOperation[]): Promise<BatchResult> {
    try {
      return await this.coordinator.coordinateBatchOperations(operations);
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
}