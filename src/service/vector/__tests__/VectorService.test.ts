import { VectorService } from '../core/VectorService';
import { IVectorRepository } from '../repository/IVectorRepository';
import { IVectorCacheManager } from '../caching/IVectorCacheManager';
import { VectorConversionService } from '../conversion/VectorConversionService';
import { VectorEmbeddingService } from '../embedding/VectorEmbeddingService';
import { ProcessingCoordinator } from '../../parser/processing/coordinator/ProcessingCoordinator';
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
  ServiceStatus
} from '../types/VectorTypes';

describe('VectorService', () => {
  let vectorService: VectorService;
  let mockRepository: jest.Mocked<IVectorRepository>;
  let mockCacheManager: jest.Mocked<IVectorCacheManager>;
  let mockConversionService: jest.Mocked<VectorConversionService>;
  let mockEmbeddingService: jest.Mocked<VectorEmbeddingService>;
  let mockProcessingCoordinator: jest.Mocked<ProcessingCoordinator>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      createBatch: jest.fn(),
      delete: jest.fn(),
      deleteBatch: jest.fn(),
      searchByVector: jest.fn(),
      count: jest.fn(),
      getStats: jest.fn(),
      createIndex: jest.fn(),
      deleteIndex: jest.fn(),
      indexExists: jest.fn(),
    } as any;

    mockCacheManager = {
      getVector: jest.fn(),
      setVector: jest.fn(),
      getSearchResult: jest.fn(),
      setSearchResult: jest.fn(),
      delete: jest.fn(),
      deleteByPattern: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
    } as any;

    mockConversionService = {
      convertChunksToVectors: jest.fn(),
      convertVectorToPoint: jest.fn(),
    } as any;

    mockEmbeddingService = {
      generateBatchEmbeddings: jest.fn(),
      generateEmbedding: jest.fn(),
    } as any;

    mockProcessingCoordinator = {
      process: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    vectorService = new VectorService(
      mockRepository,
      mockCacheManager,
      mockConversionService,
      mockEmbeddingService,
      mockProcessingCoordinator,
      mockLoggerService,
      mockErrorHandlerService
    );
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Act
      const result = await vectorService.initialize();

      // Assert
      expect(result).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Initializing VectorService');
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Initialization failed');
      mockLoggerService.info.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await vectorService.initialize();

      // Assert
      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'initialize'
      });
    });
  });

  describe('close', () => {
    it('should close service successfully', async () => {
      // Act
      await vectorService.close();

      // Assert
      expect(mockLoggerService.info).toHaveBeenCalledWith('Closing VectorService');
    });
  });

  describe('isHealthy', () => {
    it('should return true when service is initialized', async () => {
      // Arrange
      await vectorService.initialize();

      // Act
      const result = await vectorService.isHealthy();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when service is not initialized', async () => {
      // Act
      const result = await vectorService.isHealthy();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      // Arrange
      await vectorService.initialize();
      const vectorStats: VectorStats = {
        totalCount: 100,
        projectCount: 5,
        averageVectorSize: 1536,
        indexCount: 5,
        storageSize: 1000000,
        lastUpdateTime: new Date()
      };
      const cacheStats = {
        hitCount: 80,
        missCount: 20,
        hitRate: 0.8,
        totalEntries: 100,
        memoryUsage: 50000
      };

      mockRepository.getStats.mockResolvedValue(vectorStats);
      mockCacheManager.getStats.mockResolvedValue(cacheStats);

      // Act
      const result = await vectorService.getStatus();

      // Assert
      expect(result).toEqual({
        healthy: true,
        connected: true,
        stats: {
          totalVectors: 100,
          totalProjects: 5,
          cacheHitRate: 0.8,
          averageResponseTime: 0
        }
      });
    });
  });

  describe('createVectors', () => {
    it('should create vectors successfully', async () => {
      // Arrange
      const content = ['function test() { return true; }'];
      const options: VectorOptions = { projectId: 'test-project' };
      const expectedVectors: Vector[] = [
        {
          id: 'vector-1',
          vector: [0.1, 0.2, 0.3, 0.4],
          content: content[0],
          metadata: { projectId: 'test-project' },
          timestamp: new Date()
        }
      ];

      mockEmbeddingService.generateBatchEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3, 0.4]]);
      mockRepository.createBatch.mockResolvedValue(true as any);

      // Act
      const result = await vectorService.createVectors(content, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Creating vectors for 1 contents');
      expect(mockLoggerService.info).toHaveBeenCalledWith('Successfully created 1 vectors');
    });

    it('should handle errors during vector creation', async () => {
      // Arrange
      const content = ['function test() { return true; }'];
      const error = new Error('Vector creation failed');

      mockEmbeddingService.generateBatchEmbeddings.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.createVectors(content)).rejects.toThrow('Vector creation failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'createVectors',
        contentCount: 1
      });
    });
  });

  describe('deleteVectors', () => {
    it('should delete vectors successfully', async () => {
      // Arrange
      const vectorIds = ['vector-1', 'vector-2'];
      mockRepository.deleteBatch.mockResolvedValue(true);

      // Act
      const result = await vectorService.deleteVectors(vectorIds);

      // Assert
      expect(result).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Deleting 2 vectors');
      expect(mockRepository.deleteBatch).toHaveBeenCalledWith(vectorIds);
    });

    it('should handle errors during vector deletion', async () => {
      // Arrange
      const vectorIds = ['vector-1'];
      const error = new Error('Vector deletion failed');

      mockRepository.deleteBatch.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.deleteVectors(vectorIds)).rejects.toThrow('Vector deletion failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'deleteVectors'
      });
    });
  });

  describe('searchSimilarVectors', () => {
    it('should search similar vectors successfully', async () => {
      // Arrange
      const query = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = { limit: 10 };
      const expectedResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      mockCacheManager.getSearchResult.mockResolvedValue(null);
      mockRepository.searchByVector.mockResolvedValue(expectedResults);
      mockCacheManager.setSearchResult.mockResolvedValue(true as any);

      // Act
      const result = await vectorService.searchSimilarVectors(query, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockRepository.searchByVector).toHaveBeenCalledWith(query, options);
    });

    it('should handle errors during vector search', async () => {
      // Arrange
      const query = [0.1, 0.2, 0.3, 0.4];
      const error = new Error('Vector search failed');

      mockCacheManager.getSearchResult.mockResolvedValue(null);
      mockRepository.searchByVector.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.searchSimilarVectors(query)).rejects.toThrow('Vector search failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'searchSimilarVectors'
      });
    });
  });

  describe('searchByContent', () => {
    it('should search by content successfully', async () => {
      // Arrange
      const content = 'function test()';
      const options: SearchOptions = { limit: 10 };
      const expectedResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockCacheManager.getSearchResult.mockResolvedValue(null);
      mockRepository.searchByVector.mockResolvedValue(expectedResults);

      // Act
      const result = await vectorService.searchByContent(content, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(content);
    });

    it('should handle errors during content search', async () => {
      // Arrange
      const content = 'function test()';
      const error = new Error('Content search failed');

      mockEmbeddingService.generateEmbedding.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.searchByContent(content)).rejects.toThrow('Content search failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'searchByContent'
      });
    });
  });

  describe('batchProcess', () => {
    it('should process batch operations successfully', async () => {
      // Arrange
      const operations: VectorOperation[] = [
        { type: 'create', data: { id: 'v1', vector: [0.1], content: 'test', metadata: {}, timestamp: new Date() } as Vector },
        { type: 'delete', data: 'vector-id' }
      ];

      mockRepository.create.mockResolvedValue(true as any);
      mockRepository.delete.mockResolvedValue(true);

      // Act
      const result = await vectorService.batchProcess(operations);

      // Assert
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalled();
    });

    it('should handle errors during batch processing', async () => {
      // Arrange
      const operations: VectorOperation[] = [];
      const error = new Error('Batch processing failed');

      // Empty operations should complete successfully
      // Act

      // Act & Assert
      await expect(vectorService.batchProcess(operations)).rejects.toThrow('Batch processing failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'batchProcess'
      });
    });
  });

  describe('createProjectIndex', () => {
    it('should create project index successfully', async () => {
      // Arrange
      const projectId = 'test-project';
      const options: ProjectOptions = { vectorSize: 1536 };
      mockRepository.createIndex.mockResolvedValue(true);

      // Act
      const result = await vectorService.createProjectIndex(projectId, options);

      // Assert
      expect(result).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith(`Creating index for project: ${projectId}`);
      expect(mockRepository.createIndex).toHaveBeenCalledWith(projectId, options);
    });

    it('should handle errors during index creation', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Index creation failed');

      mockRepository.createIndex.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.createProjectIndex(projectId)).rejects.toThrow('Index creation failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'createProjectIndex',
        projectId
      });
    });
  });

  describe('deleteProjectIndex', () => {
    it('should delete project index successfully', async () => {
      // Arrange
      const projectId = 'test-project';
      mockRepository.deleteIndex.mockResolvedValue(true);

      // Act
      const result = await vectorService.deleteProjectIndex(projectId);

      // Assert
      expect(result).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith(`Deleting index for project: ${projectId}`);
      expect(mockRepository.deleteIndex).toHaveBeenCalledWith(projectId);
    });

    it('should handle errors during index deletion', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Index deletion failed');

      mockRepository.deleteIndex.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.deleteProjectIndex(projectId)).rejects.toThrow('Index deletion failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'deleteProjectIndex',
        projectId
      });
    });
  });

  describe('getVectorStats', () => {
    it('should get vector statistics successfully', async () => {
      // Arrange
      const projectId = 'test-project';
      const expectedStats: VectorStats = {
        totalCount: 100,
        projectCount: 1,
        averageVectorSize: 1536,
        indexCount: 1,
        storageSize: 1000000,
        lastUpdateTime: new Date()
      };

      mockRepository.getStats.mockResolvedValue(expectedStats);

      // Act
      const result = await vectorService.getVectorStats(projectId);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockRepository.getStats).toHaveBeenCalledWith(projectId);
    });

    it('should handle errors during stats retrieval', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Stats retrieval failed');

      mockRepository.getStats.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorService.getVectorStats(projectId)).rejects.toThrow('Stats retrieval failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'getVectorStats'
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      // Act
      const result = await vectorService.getPerformanceMetrics();

      // Assert
      expect(result).toEqual({
        operationCounts: {},
        averageResponseTimes: {},
        cacheHitRates: {},
        errorRates: {},
        throughput: {
          operationsPerSecond: 0,
          vectorsPerSecond: 0
        }
      });
    });
  });
});