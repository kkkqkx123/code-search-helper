import { VectorService } from '../../core/VectorService';
import { IVectorRepository } from '../../repository/IVectorRepository';
import { IVectorCoordinationService } from '../../coordination/IVectorCoordinationService';
import { IVectorCacheManager } from '../../caching/IVectorCacheManager';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { Vector, VectorOptions, SearchResult } from '../../types/VectorTypes';

describe('VectorService', () => {
  let vectorService: VectorService;
  let mockRepository: jest.Mocked<IVectorRepository>;
  let mockCoordinator: jest.Mocked<IVectorCoordinationService>;
  let mockCacheManager: jest.Mocked<IVectorCacheManager>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;

  beforeEach(() => {
    // 创建mock对象
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
      indexExists: jest.fn()
    } as any;

    mockCoordinator = {
      coordinateVectorCreation: jest.fn(),
      coordinateVectorSearch: jest.fn(),
      coordinateBatchOperations: jest.fn(),
      handleEmbeddingGeneration: jest.fn(),
      optimizeBatchProcessing: jest.fn()
    } as any;

    mockCacheManager = {
      getVector: jest.fn(),
      setVector: jest.fn(),
      getSearchResult: jest.fn(),
      setSearchResult: jest.fn(),
      delete: jest.fn(),
      deleteByPattern: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    // 创建服务实例
    vectorService = new VectorService(
      mockRepository,
      mockCoordinator,
      mockCacheManager,
      mockLogger,
      mockErrorHandler
    );
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await vectorService.initialize();
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing VectorService');
    });
  });

  describe('close', () => {
    it('should close successfully', async () => {
      await vectorService.close();
      expect(mockLogger.info).toHaveBeenCalledWith('Closing VectorService');
    });
  });

  describe('isHealthy', () => {
    it('should return true when initialized', async () => {
      await vectorService.initialize();
      const result = await vectorService.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when not initialized', async () => {
      const result = await vectorService.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('createVectors', () => {
    it('should create vectors successfully', async () => {
      const contents = ['content1', 'content2'];
      const options: VectorOptions = { projectId: 'test-project' };
      const expectedVectors: Vector[] = [
        {
          id: '1',
          vector: [0.1, 0.2, 0.3],
          content: 'content1',
          metadata: { projectId: 'test-project' },
          timestamp: new Date()
        },
        {
          id: '2',
          vector: [0.4, 0.5, 0.6],
          content: 'content2',
          metadata: { projectId: 'test-project' },
          timestamp: new Date()
        }
      ];

      mockCoordinator.coordinateVectorCreation.mockResolvedValue(expectedVectors);

      const result = await vectorService.createVectors(contents, options);

      expect(result).toEqual(expectedVectors);
      expect(mockCoordinator.coordinateVectorCreation).toHaveBeenCalledWith(contents, options);
      expect(mockLogger.info).toHaveBeenCalledWith('Creating vectors for 2 contents');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully created 2 vectors');
    });

    it('should handle errors gracefully', async () => {
      const contents = ['content1'];
      const error = new Error('Creation failed');
      
      mockCoordinator.coordinateVectorCreation.mockRejectedValue(error);

      await expect(vectorService.createVectors(contents)).rejects.toThrow(error);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'createVectors',
        contentCount: 1
      });
    });
  });

  describe('searchSimilarVectors', () => {
    it('should search vectors successfully', async () => {
      const query = [0.1, 0.2, 0.3];
      const options = { limit: 10 };
      const expectedResults: SearchResult[] = [
        { id: '1', score: 0.9 },
        { id: '2', score: 0.8 }
      ];

      mockCoordinator.coordinateVectorSearch.mockResolvedValue(expectedResults);

      const result = await vectorService.searchSimilarVectors(query, options);

      expect(result).toEqual(expectedResults);
      expect(mockCoordinator.coordinateVectorSearch).toHaveBeenCalledWith(query, options);
    });

    it('should handle search errors', async () => {
      const query = [0.1, 0.2, 0.3];
      const error = new Error('Search failed');
      
      mockCoordinator.coordinateVectorSearch.mockRejectedValue(error);

      await expect(vectorService.searchSimilarVectors(query)).rejects.toThrow(error);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorService',
        operation: 'searchSimilarVectors'
      });
    });
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      const mockStats = {
        totalCount: 100,
        projectCount: 5,
        averageVectorSize: 1536,
        indexCount: 5,
        storageSize: 1000000,
        lastUpdateTime: new Date()
      };

      const mockCacheStats = {
        hitCount: 80,
        missCount: 20,
        hitRate: 0.8,
        totalEntries: 100,
        memoryUsage: 1000000
      };

      mockRepository.getStats.mockResolvedValue(mockStats);
      mockCacheManager.getStats.mockResolvedValue(mockCacheStats);

      await vectorService.initialize();
      const status = await vectorService.getStatus();

      expect(status).toEqual({
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
});