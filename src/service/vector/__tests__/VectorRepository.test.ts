import { VectorRepository } from '../repository/VectorRepository';
import { QdrantService } from '../../../database/qdrant/QdrantService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
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
import { SearchResult as QdrantSearchResult } from '../../../database/qdrant/IVectorStore';

describe('VectorRepository', () => {
  let vectorRepository: VectorRepository;
  let mockQdrantService: jest.Mocked<QdrantService>;
  let mockProjectIdManager: jest.Mocked<ProjectIdManager>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;

  beforeEach(() => {
    mockQdrantService = {
      upsertVectorsForProject: jest.fn(),
      searchVectors: jest.fn(),
      getCollectionInfo: jest.fn(),
      createCollection: jest.fn(),
      deleteCollection: jest.fn(),
      collectionExists: jest.fn(),
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

    vectorRepository = new VectorRepository(
      mockQdrantService,
      mockProjectIdManager,
      mockLoggerService,
      mockErrorHandlerService
    );
  });

  describe('create', () => {
    it('should create vector successfully', async () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: {
          projectId: 'test-project',
          filePath: '/test/file.js',
          language: 'javascript'
        },
        timestamp: new Date()
      };

      mockQdrantService.upsertVectorsForProject.mockResolvedValue(true);

      // Act
      const result = await vectorRepository.create(vector);

      // Assert
      expect(result).toBe(vector.id);
      expect(mockQdrantService.upsertVectorsForProject).toHaveBeenCalledWith(
        'test-project',
        [expect.objectContaining({
          id: vector.id,
          vector: vector.vector,
          payload: expect.objectContaining({
            content: vector.content,
            filePath: vector.metadata.filePath,
            language: vector.metadata.language,
            projectId: vector.metadata.projectId
          })
        })]
      );
    });

    it('should throw error when project ID is missing', async () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: {}, // No projectId
        timestamp: new Date()
      };

      // Act & Assert
      await expect(vectorRepository.create(vector)).rejects.toThrow(VectorError);
      await expect(vectorRepository.create(vector)).rejects.toThrow('Project ID is required');
    });

    it('should throw error when upsert fails', async () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: {
          projectId: 'test-project'
        },
        timestamp: new Date()
      };

      mockQdrantService.upsertVectorsForProject.mockResolvedValue(false);

      // Act & Assert
      await expect(vectorRepository.create(vector)).rejects.toThrow(VectorError);
      await expect(vectorRepository.create(vector)).rejects.toThrow('Failed to create vector');
    });

    it('should handle errors during vector creation', async () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: {
          projectId: 'test-project'
        },
        timestamp: new Date()
      };
      const error = new Error('Database error');

      mockQdrantService.upsertVectorsForProject.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorRepository.create(vector)).rejects.toThrow('Database error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorRepository',
        operation: 'create'
      });
    });
  });

  describe('createBatch', () => {
    it('should create vectors in batch successfully', async () => {
      // Arrange
      const vectors: Vector[] = [
        {
          id: 'vector-1',
          vector: [0.1, 0.2, 0.3, 0.4],
          content: 'content 1',
          metadata: {
            projectId: 'test-project',
            filePath: '/test/file1.js',
            language: 'javascript'
          },
          timestamp: new Date()
        },
        {
          id: 'vector-2',
          vector: [0.5, 0.6, 0.7, 0.8],
          content: 'content 2',
          metadata: {
            projectId: 'test-project',
            filePath: '/test/file2.js',
            language: 'javascript'
          },
          timestamp: new Date()
        }
      ];

      mockQdrantService.upsertVectorsForProject.mockResolvedValue(true);

      // Act
      const result = await vectorRepository.createBatch(vectors);

      // Assert
      expect(result).toEqual(['vector-1', 'vector-2']);
      expect(mockQdrantService.upsertVectorsForProject).toHaveBeenCalledWith(
        'test-project',
        [
          expect.objectContaining({ id: 'vector-1' }),
          expect.objectContaining({ id: 'vector-2' })
        ]
      );
    });

    it('should return empty array for empty input', async () => {
      // Arrange
      const vectors: Vector[] = [];

      // Act
      const result = await vectorRepository.createBatch(vectors);

      // Assert
      expect(result).toEqual([]);
      expect(mockQdrantService.upsertVectorsForProject).not.toHaveBeenCalled();
    });

    it('should throw error when project ID is missing in batch', async () => {
      // Arrange
      const vectors: Vector[] = [
        {
          id: 'vector-1',
          vector: [0.1, 0.2, 0.3, 0.4],
          content: 'content 1',
          metadata: {}, // No projectId
          timestamp: new Date()
        }
      ];

      // Act & Assert
      await expect(vectorRepository.createBatch(vectors)).rejects.toThrow(VectorError);
      await expect(vectorRepository.createBatch(vectors)).rejects.toThrow('Project ID is required');
    });

    it('should throw error when batch upsert fails', async () => {
      // Arrange
      const vectors: Vector[] = [
        {
          id: 'vector-1',
          vector: [0.1, 0.2, 0.3, 0.4],
          content: 'content 1',
          metadata: {
            projectId: 'test-project'
          },
          timestamp: new Date()
        }
      ];

      mockQdrantService.upsertVectorsForProject.mockResolvedValue(false);

      // Act & Assert
      await expect(vectorRepository.createBatch(vectors)).rejects.toThrow(VectorError);
      await expect(vectorRepository.createBatch(vectors)).rejects.toThrow('Failed to create vectors batch');
    });
  });

  describe('delete', () => {
    it('should throw operation not supported error', async () => {
      // Arrange
      const id = 'test-vector-id';

      // Act & Assert
      await expect(vectorRepository.delete(id)).rejects.toThrow(VectorError);
      await expect(vectorRepository.delete(id)).rejects.toThrow('Direct delete by ID is not supported by Qdrant');
      const error = await vectorRepository.delete(id).catch(e => e);
      expect(error).toBeInstanceOf(VectorError);
      expect((error as VectorError).code).toBe(VectorErrorCode.OPERATION_NOT_SUPPORTED);
    });
  });

  describe('deleteBatch', () => {
    it('should throw operation not supported error', async () => {
      // Arrange
      const ids = ['vector-1', 'vector-2'];

      // Act & Assert
      await expect(vectorRepository.deleteBatch(ids)).rejects.toThrow(VectorError);
      await expect(vectorRepository.deleteBatch(ids)).rejects.toThrow('Batch delete by IDs is not supported by Qdrant');
      const error = await vectorRepository.deleteBatch(ids).catch(e => e);
      expect(error).toBeInstanceOf(VectorError);
      expect((error as VectorError).code).toBe(VectorErrorCode.OPERATION_NOT_SUPPORTED);
    });

    it('should return true for empty ids array', async () => {
      // Arrange
      const ids: string[] = [];

      // Act
      const result = await vectorRepository.deleteBatch(ids);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('searchByVector', () => {
    it('should search vectors successfully', async () => {
      // Arrange
      const query = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = {
        limit: 10,
        scoreThreshold: 0.5,
        filter: {
          projectId: 'test-project',
          language: ['javascript']
        }
      };
      const qdrantResults: QdrantSearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          payload: {
            content: 'result content',
            filePath: '/test/file.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date(),
            projectId: 'test-project'
          }
        }
      ];

      mockQdrantService.searchVectors.mockResolvedValue(qdrantResults);

      // Act
      const result = await vectorRepository.searchByVector(query, options);

      // Assert
      expect(result).toEqual([
        {
          id: 'result-1',
          score: 0.9,
          metadata: qdrantResults[0].payload
        }
      ]);
      expect(mockQdrantService.searchVectors).toHaveBeenCalledWith(
        'test-project',
        query,
        {
          limit: 10,
          scoreThreshold: 0.5,
          filter: {
            must: [
              {
                key: 'language',
                match: { any: ['javascript'] }
              }
            ]
          }
        }
      );
    });

    it('should throw error when project ID is missing in filter', async () => {
      // Arrange
      const query = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = {};

      // Act & Assert
      await expect(vectorRepository.searchByVector(query, options)).rejects.toThrow(VectorError);
      await expect(vectorRepository.searchByVector(query, options)).rejects.toThrow('Project ID is required for search');
    });

    it('should handle search with minimal options', async () => {
      // Arrange
      const query = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = {
        filter: { projectId: 'test-project' }
      };
      const qdrantResults: QdrantSearchResult[] = [];

      mockQdrantService.searchVectors.mockResolvedValue(qdrantResults);

      // Act
      const result = await vectorRepository.searchByVector(query, options);

      // Assert
      expect(result).toEqual([]);
      expect(mockQdrantService.searchVectors).toHaveBeenCalledWith(
        'test-project',
        query,
        {
          limit: 10,
          scoreThreshold: undefined,
          filter: undefined
        }
      );
    });

    it('should handle errors during search', async () => {
      // Arrange
      const query = [0.1, 0.2, 0.3, 0.4];
      const options: SearchOptions = {
        filter: { projectId: 'test-project' }
      };
      const error = new Error('Search failed');

      mockQdrantService.searchVectors.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorRepository.searchByVector(query, options)).rejects.toThrow('Search failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorRepository',
        operation: 'searchByVector'
      });
    });
  });

  describe('count', () => {
    it('should return count for valid project', async () => {
      // Arrange
      const filter: VectorFilter = { projectId: 'test-project' };
      const collectionInfo = {
        name: 'test-project',
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 100,
        status: 'green' as const
      };

      mockQdrantService.getCollectionInfo.mockResolvedValue(collectionInfo);

      // Act
      const result = await vectorRepository.count(filter);

      // Assert
      expect(result).toBe(100);
      expect(mockQdrantService.getCollectionInfo).toHaveBeenCalledWith('test-project');
    });

    it('should return 0 when no project filter', async () => {
      // Arrange
      const filter: VectorFilter = {};

      // Act
      const result = await vectorRepository.count(filter);

      // Assert
      expect(result).toBe(0);
      expect(mockQdrantService.getCollectionInfo).not.toHaveBeenCalled();
    });

    it('should return 0 on error', async () => {
      // Arrange
      const filter: VectorFilter = { projectId: 'test-project' };
      const error = new Error('Collection not found');

      mockQdrantService.getCollectionInfo.mockRejectedValue(error);

      // Act
      const result = await vectorRepository.count(filter);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return stats for valid project', async () => {
      // Arrange
      const projectId = 'test-project';
      const collectionInfo = {
        name: 'test-project',
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 100,
        status: 'green' as const
      };

      mockQdrantService.getCollectionInfo.mockResolvedValue(collectionInfo);

      // Act
      const result = await vectorRepository.getStats(projectId);

      // Assert
      expect(result).toEqual({
        totalCount: 100,
        projectCount: 1,
        averageVectorSize: 1536,
        indexCount: 1,
        storageSize: 0,
        lastUpdateTime: expect.any(Date)
      });
      expect(mockQdrantService.getCollectionInfo).toHaveBeenCalledWith('test-project');
    });

    it('should return empty stats when no project ID', async () => {
      // Act
      const result = await vectorRepository.getStats();

      // Assert
      expect(result).toEqual({
        totalCount: 0,
        projectCount: 0,
        averageVectorSize: 0,
        indexCount: 0,
        storageSize: 0,
        lastUpdateTime: expect.any(Date)
      });
      expect(mockQdrantService.getCollectionInfo).not.toHaveBeenCalled();
    });

    it('should handle null collection info', async () => {
      // Arrange
      const projectId = 'test-project';

      mockQdrantService.getCollectionInfo.mockResolvedValue(null);

      // Act
      const result = await vectorRepository.getStats(projectId);

      // Assert
      expect(result).toEqual({
        totalCount: 0,
        projectCount: 1,
        averageVectorSize: 0,
        indexCount: 1,
        storageSize: 0,
        lastUpdateTime: expect.any(Date)
      });
    });

    it('should handle errors during stats retrieval', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Stats retrieval failed');

      mockQdrantService.getCollectionInfo.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorRepository.getStats(projectId)).rejects.toThrow('Stats retrieval failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorRepository',
        operation: 'getStats'
      });
    });
  });

  describe('createIndex', () => {
    it('should create index successfully', async () => {
      // Arrange
      const projectId = 'test-project';
      const options: IndexOptions = {
        vectorSize: 1536,
        distance: 'Euclid'
      };

      mockQdrantService.createCollection.mockResolvedValue(true);

      // Act
      const result = await vectorRepository.createIndex(projectId, options);

      // Assert
      expect(result).toBe(true);
      expect(mockQdrantService.createCollection).toHaveBeenCalledWith(
        projectId,
        1536,
        'Euclid'
      );
    });

    it('should use default options when not provided', async () => {
      // Arrange
      const projectId = 'test-project';

      mockQdrantService.createCollection.mockResolvedValue(true);

      // Act
      const result = await vectorRepository.createIndex(projectId);

      // Assert
      expect(result).toBe(true);
      expect(mockQdrantService.createCollection).toHaveBeenCalledWith(
        projectId,
        1536,
        'Cosine'
      );
    });

    it('should handle errors during index creation', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Index creation failed');

      mockQdrantService.createCollection.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorRepository.createIndex(projectId)).rejects.toThrow('Index creation failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorRepository',
        operation: 'createIndex'
      });
    });
  });

  describe('deleteIndex', () => {
    it('should delete index successfully', async () => {
      // Arrange
      const projectId = 'test-project';

      mockQdrantService.deleteCollection.mockResolvedValue(true);

      // Act
      const result = await vectorRepository.deleteIndex(projectId);

      // Assert
      expect(result).toBe(true);
      expect(mockQdrantService.deleteCollection).toHaveBeenCalledWith(projectId);
    });

    it('should handle errors during index deletion', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Index deletion failed');

      mockQdrantService.deleteCollection.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorRepository.deleteIndex(projectId)).rejects.toThrow('Index deletion failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error, {
        component: 'VectorRepository',
        operation: 'deleteIndex'
      });
    });
  });

  describe('indexExists', () => {
    it('should return true when index exists', async () => {
      // Arrange
      const projectId = 'test-project';

      mockQdrantService.collectionExists.mockResolvedValue(true);

      // Act
      const result = await vectorRepository.indexExists(projectId);

      // Assert
      expect(result).toBe(true);
      expect(mockQdrantService.collectionExists).toHaveBeenCalledWith(projectId);
    });

    it('should return false when index does not exist', async () => {
      // Arrange
      const projectId = 'test-project';

      mockQdrantService.collectionExists.mockResolvedValue(false);

      // Act
      const result = await vectorRepository.indexExists(projectId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      // Arrange
      const projectId = 'test-project';
      const error = new Error('Check failed');

      mockQdrantService.collectionExists.mockRejectedValue(error);

      // Act
      const result = await vectorRepository.indexExists(projectId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('convertToVectorPoint', () => {
    it('should convert vector to vector point correctly', () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: {
          projectId: 'test-project',
          filePath: '/test/file.js',
          language: 'javascript',
          chunkType: ['code'],
          startLine: 1,
          endLine: 10,
          functionName: 'testFunction',
          className: 'TestClass',
          snippetMetadata: { test: 'data' },
          customFields: { custom: 'field' }
        },
        timestamp: new Date()
      };

      // Act
      const result = (vectorRepository as any).convertToVectorPoint(vector);

      // Assert
      expect(result).toEqual({
        id: vector.id,
        vector: vector.vector,
        payload: {
          content: vector.content,
          filePath: vector.metadata.filePath,
          language: vector.metadata.language,
          chunkType: vector.metadata.chunkType,
          startLine: vector.metadata.startLine,
          endLine: vector.metadata.endLine,
          functionName: vector.metadata.functionName,
          className: vector.metadata.className,
          snippetMetadata: vector.metadata.snippetMetadata,
          metadata: vector.metadata.customFields,
          timestamp: vector.timestamp,
          projectId: vector.metadata.projectId
        }
      });
    });

    it('should handle missing optional fields', () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: {
          projectId: 'test-project'
        },
        timestamp: new Date()
      };

      // Act
      const result = (vectorRepository as any).convertToVectorPoint(vector);

      // Assert
      expect(result.payload.filePath).toBe('');
      expect(result.payload.language).toBe('unknown');
      expect(result.payload.chunkType).toEqual(['code']);
      expect(result.payload.startLine).toBe(0);
      expect(result.payload.endLine).toBe(0);
      expect(result.payload.functionName).toBeUndefined();
      expect(result.payload.className).toBeUndefined();
      expect(result.payload.snippetMetadata).toBeUndefined();
      expect(result.payload.metadata).toEqual({});
    });
  });

  describe('convertFilter', () => {
    it('should convert filter with language and chunk type', () => {
      // Arrange
      const filter: VectorFilter = {
        projectId: 'test-project',
        language: ['javascript', 'typescript'],
        chunkType: ['function', 'class']
      };

      // Act
      const result = (vectorRepository as any).convertFilter(filter);

      // Assert
      expect(result).toEqual({
        must: [
          {
            key: 'language',
            match: { any: ['javascript', 'typescript'] }
          },
          {
            key: 'chunkType',
            match: { any: ['function', 'class'] }
          }
        ]
      });
    });

    it('should return undefined for empty filter', () => {
      // Arrange
      const filter: VectorFilter = {};

      // Act
      const result = (vectorRepository as any).convertFilter(filter);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle filter with only language', () => {
      // Arrange
      const filter: VectorFilter = {
        language: ['javascript']
      };

      // Act
      const result = (vectorRepository as any).convertFilter(filter);

      // Assert
      expect(result).toEqual({
        must: [
          {
            key: 'language',
            match: { any: ['javascript'] }
          }
        ]
      });
    });

    it('should handle filter with only chunk type', () => {
      // Arrange
      const filter: VectorFilter = {
        chunkType: ['function']
      };

      // Act
      const result = (vectorRepository as any).convertFilter(filter);

      // Assert
      expect(result).toEqual({
        must: [
          {
            key: 'chunkType',
            match: { any: ['function'] }
          }
        ]
      });
    });
  });
});