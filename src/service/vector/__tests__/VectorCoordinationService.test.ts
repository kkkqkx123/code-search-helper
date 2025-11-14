import { VectorCoordinationService } from '../coordination/VectorCoordinationService';
import { IVectorRepository } from '../repository/IVectorRepository';
import { IVectorCacheManager } from '../caching/IVectorCacheManager';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
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
  BatchOptions
} from '../types/VectorTypes';
import { BaseEmbedder } from '../../../embedders/BaseEmbedder';

describe('VectorCoordinationService', () => {
  let vectorCoordinationService: VectorCoordinationService;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockRepository: jest.Mocked<IVectorRepository>;
  let mockCacheManager: jest.Mocked<IVectorCacheManager>;
  let mockBatchService: jest.Mocked<BatchProcessingService>;
  let mockProjectIdManager: jest.Mocked<ProjectIdManager>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockEmbedder: jest.Mocked<BaseEmbedder>;

  beforeEach(() => {
    mockEmbedderFactory = {
      getEmbedder: jest.fn(),
    } as any;

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

    mockBatchService = {
      processBatches: jest.fn(),
    } as any;

    mockProjectIdManager = {
      getProjectId: jest.fn(),
      generateProjectId: jest.fn(),
      getProjectPath: jest.fn(),
      getCollectionName: jest.fn(),
      getSpaceName: jest.fn(),
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

    mockEmbedder = {
      embed: jest.fn(),
    } as any;

    vectorCoordinationService = new VectorCoordinationService(
      mockEmbedderFactory,
      mockRepository,
      mockCacheManager,
      mockBatchService,
      mockProjectIdManager,
      mockLoggerService,
      mockErrorHandlerService
    );
  });

  describe('coordinateVectorCreation', () => {
    it('should coordinate vector creation successfully', async () => {
      // Arrange
      const contents = ['function test() { return true; }'];
      const options: VectorOptions = {
        projectId: 'test-project',
        metadata: { language: 'javascript' }
      };
      const embeddings = [[0.1, 0.2, 0.3, 0.4]];
      const expectedVectors: Vector[] = [
        {
          id: expect.any(String),
          vector: embeddings[0],
          content: contents[0],
          metadata: {
            projectId: options.projectId,
            language: 'javascript'
          },
          timestamp: expect.any(Date)
        }
      ];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue({ 
        vector: embeddings[0],
        dimensions: 4,
        model: 'test-model',
        processingTime: 100
      });
      mockRepository.createBatch.mockResolvedValue(['vector-id']);

      // Act
      const result = await vectorCoordinationService.coordinateVectorCreation(contents, options);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(contents[0]);
      expect(result[0].vector).toEqual(embeddings[0]);
      expect(result[0].metadata.projectId).toBe(options.projectId);
      expect(mockRepository.createBatch).toHaveBeenCalled();
      expect(mockCacheManager.setVector).toHaveBeenCalled();
    });

    it('should handle errors during vector creation', async () => {
      // Arrange
      const contents = ['function test() { return true; }'];
      const error = new Error('Embedding generation failed');

      mockEmbedderFactory.getEmbedder.mockRejectedValue(error);

      // Act & Assert
      await expect(
        vectorCoordinationService.coordinateVectorCreation(contents)
      ).rejects.toThrow('Embedding generation failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorCoordinationService',
        operation: 'coordinateVectorCreation'
      });
    });
  });

  describe('coordinateVectorSearch', () => {
    it('should coordinate vector search with query vector', async () => {
      // Arrange
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = {
        limit: 10,
        filter: { projectId: 'test-project' }
      };
      const expectedResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      mockCacheManager.getSearchResult.mockResolvedValue(null);
      mockRepository.searchByVector.mockResolvedValue(expectedResults);

      // Act
      const result = await vectorCoordinationService.coordinateVectorSearch(queryVector, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockCacheManager.getSearchResult).toHaveBeenCalled();
      expect(mockRepository.searchByVector).toHaveBeenCalledWith(queryVector, options);
      expect(mockCacheManager.setSearchResult).toHaveBeenCalled();
    });

    it('should return cached search results when available', async () => {
      // Arrange
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = { limit: 10 };
      const cachedResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      mockCacheManager.getSearchResult.mockResolvedValue(cachedResults);

      // Act
      const result = await vectorCoordinationService.coordinateVectorSearch(queryVector, options);

      // Assert
      expect(result).toEqual(cachedResults);
      expect(mockRepository.searchByVector).not.toHaveBeenCalled();
      expect(mockCacheManager.setSearchResult).not.toHaveBeenCalled();
    });

    it('should coordinate vector search with string query', async () => {
      // Arrange
      const queryString = 'function test()';
      const options: SearchOptions = { limit: 10 };
      const embeddings = [[0.1, 0.2, 0.3, 0.4]];
      const expectedResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue({ 
        vector: embeddings[0],
        dimensions: 4,
        model: 'test-model',
        processingTime: 100
      });
      mockCacheManager.getSearchResult.mockResolvedValue(null);
      mockRepository.searchByVector.mockResolvedValue(expectedResults);

      // Act
      const result = await vectorCoordinationService.coordinateVectorSearch(queryString, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockEmbedder.embed).toHaveBeenCalledWith({ text: queryString });
      expect(mockRepository.searchByVector).toHaveBeenCalledWith(embeddings[0], options);
    });

    it('should handle errors during vector search', async () => {
      // Arrange
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const error = new Error('Search failed');

      mockCacheManager.getSearchResult.mockResolvedValue(null);
      mockRepository.searchByVector.mockRejectedValue(error);

      // Act & Assert
      await expect(
        vectorCoordinationService.coordinateVectorSearch(queryVector)
      ).rejects.toThrow('Search failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorCoordinationService',
        operation: 'coordinateVectorSearch'
      });
    });
  });

  describe('coordinateBatchOperations', () => {
    it('should coordinate batch operations successfully', async () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };
      const operations: VectorOperation[] = [
        { type: 'create', data: vector },
        { type: 'delete', data: 'vector-id' }
      ];

      mockRepository.create.mockResolvedValue('created-id');
      mockRepository.delete.mockResolvedValue(true);

      // Act
      const result = await vectorCoordinationService.coordinateBatchOperations(operations);

      // Assert
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toBeUndefined();
      expect(mockRepository.create).toHaveBeenCalledWith(vector);
      expect(mockRepository.delete).toHaveBeenCalledWith('vector-id');
    });

    it('should handle partial failures in batch operations', async () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };
      const operations: VectorOperation[] = [
        { type: 'create', data: vector },
        { type: 'delete', data: 'vector-id' }
      ];
      const error = new Error('Delete failed');

      mockRepository.create.mockResolvedValue('created-id');
      mockRepository.delete.mockRejectedValue(error);

      // Act
      const result = await vectorCoordinationService.coordinateBatchOperations(operations);

      // Assert
      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toBe(error);
    });

    it('should handle errors during batch coordination', async () => {
      // Arrange
      const operations: VectorOperation[] = [];
      const error = new Error('Batch coordination failed');

      mockRepository.create.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(
        vectorCoordinationService.coordinateBatchOperations(operations)
      ).rejects.toThrow('Batch coordination failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorCoordinationService',
        operation: 'coordinateBatchOperations'
      });
    });
  });

  describe('handleEmbeddingGeneration', () => {
    it('should generate embeddings for multiple contents', async () => {
      // Arrange
      const contents = ['content1', 'content2'];
      const options: EmbeddingOptions = { provider: 'test-provider' };
      const embeddings = [[0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8]];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed
        .mockResolvedValueOnce({ 
          vector: embeddings[0],
          dimensions: 4,
          model: 'test-model',
          processingTime: 100
        })
        .mockResolvedValueOnce({ 
          vector: embeddings[1],
          dimensions: 4,
          model: 'test-model',
          processingTime: 100
        });

      // Act
      const result = await vectorCoordinationService.handleEmbeddingGeneration(contents, options);

      // Assert
      expect(result).toEqual(embeddings);
      expect(mockEmbedderFactory.getEmbedder).toHaveBeenCalledWith('test-provider');
      expect(mockEmbedder.embed).toHaveBeenCalledTimes(2);
    });

    it('should use default provider when not specified', async () => {
      // Arrange
      const contents = ['content1'];
      const embeddings = [[0.1, 0.2, 0.3, 0.4]];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue({ 
        vector: embeddings[0],
        dimensions: 4,
        model: 'test-model',
        processingTime: 100
      });

      // Act
      const result = await vectorCoordinationService.handleEmbeddingGeneration(contents);

      // Assert
      expect(result).toEqual(embeddings);
      expect(mockEmbedderFactory.getEmbedder).toHaveBeenCalledWith('default');
    });

    it('should handle array result from embedder', async () => {
      // Arrange
      const contents = ['content1'];
      const embeddings = [[0.1, 0.2, 0.3, 0.4]];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue([{ 
        vector: embeddings[0],
        dimensions: 4,
        model: 'test-model',
        processingTime: 100
      }]);

      // Act
      const result = await vectorCoordinationService.handleEmbeddingGeneration(contents);

      // Assert
      expect(result).toEqual(embeddings);
    });

    it('should handle errors during embedding generation', async () => {
      // Arrange
      const contents = ['content1'];
      const error = new Error('Embedding generation failed');

      mockEmbedderFactory.getEmbedder.mockRejectedValue(error);

      // Act & Assert
      await expect(
        vectorCoordinationService.handleEmbeddingGeneration(contents)
      ).rejects.toThrow('Embedding generation failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorCoordinationService',
        operation: 'handleEmbeddingGeneration'
      });
    });
  });

  describe('optimizeBatchProcessing', () => {
    it('should delegate to batch service', async () => {
      // Arrange
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['result1', 'result2', 'result3']);
      const options: BatchOptions = { batchSize: 10 };
      const expectedResults = ['result1', 'result2', 'result3'];

      mockBatchService.processBatches.mockResolvedValue(expectedResults);

      // Act
      const result = await vectorCoordinationService.optimizeBatchProcessing(items, processor, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockBatchService.processBatches).toHaveBeenCalledWith(items, processor, options);
    });
  });

  describe('private methods', () => {
    describe('generateVectorId', () => {
      it('should generate consistent vector IDs', () => {
        // Arrange
        const content = 'test content';
        const options: VectorOptions = { projectId: 'test-project' };

        // Act
        const id1 = (vectorCoordinationService as any).generateVectorId(content, options);
        const id2 = (vectorCoordinationService as any).generateVectorId(content, options);

        // Assert
        expect(id1).toBe(id2);
        expect(id1).toContain('test-project');
      });

      it('should use default project ID when not provided', () => {
        // Arrange
        const content = 'test content';

        // Act
        const id = (vectorCoordinationService as any).generateVectorId(content);

        // Assert
        expect(id).toContain('default');
      });
    });

    describe('simpleHash', () => {
      it('should generate consistent hash for same string', () => {
        // Arrange
        const str = 'test string';

        // Act
        const hash1 = (vectorCoordinationService as any).simpleHash(str);
        const hash2 = (vectorCoordinationService as any).simpleHash(str);

        // Assert
        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
      });

      it('should generate different hashes for different strings', () => {
        // Arrange
        const str1 = 'string1';
        const str2 = 'string2';

        // Act
        const hash1 = (vectorCoordinationService as any).simpleHash(str1);
        const hash2 = (vectorCoordinationService as any).simpleHash(str2);

        // Assert
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('generateSearchCacheKey', () => {
      it('should generate consistent cache key', () => {
        // Arrange
        const query = [0.1, 0.2, 0.3, 0.4];
        const options: SearchOptions = { limit: 10 };

        // Act
        const key1 = (vectorCoordinationService as any).generateSearchCacheKey(query, options);
        const key2 = (vectorCoordinationService as any).generateSearchCacheKey(query, options);

        // Assert
        expect(key1).toBe(key2);
        expect(key1).toContain('search:');
      });

      it('should generate different keys for different queries', () => {
        // Arrange
        const query1 = [0.1, 0.2, 0.3, 0.4];
        const query2 = [0.5, 0.6, 0.7, 0.8];
        const options: SearchOptions = { limit: 10 };

        // Act
        const key1 = (vectorCoordinationService as any).generateSearchCacheKey(query1, options);
        const key2 = (vectorCoordinationService as any).generateSearchCacheKey(query2, options);

        // Assert
        expect(key1).not.toBe(key2);
      });
    });
  });
});