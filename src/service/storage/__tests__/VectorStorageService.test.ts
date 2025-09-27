import { VectorStorageService } from '../vector/VectorStorageService';
import { QdrantClientWrapper } from '../../../database/qdrant/QdrantClientWrapper';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { BatchProcessingMetrics } from '../../monitoring/BatchProcessingMetrics';
import { CodeChunk } from '../../parser/types';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { BatchProcessingService } from '../BatchProcessingService';
import { EmbeddingService } from '../EmbeddingService';

describe('VectorStorageService', () => {
  let vectorStorageService: VectorStorageService;
  let mockQdrantClient: jest.Mocked<QdrantClientWrapper>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockBatchMetrics: jest.Mocked<BatchProcessingMetrics>;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockBatchProcessingService: jest.Mocked<BatchProcessingService>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;

  beforeEach(() => {
    // Create mocks
    mockQdrantClient = {
      upsertPoints: jest.fn(),
      deletePoints: jest.fn(),
      getPoint: jest.fn(),
      searchVectors: jest.fn(),
      createCollection: jest.fn(),
      clearCollection: jest.fn(),
      getCollectionInfo: jest.fn(),
      getPointCount: jest.fn(),
      collectionExists: jest.fn(),
      connect: jest.fn(),
      close: jest.fn(),
      isConnectedToDatabase: jest.fn(),
      getExistingChunkIds: jest.fn(),
      getChunkIdsByFiles: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn().mockReturnValue({ id: 'test-error-id' }),
    } as any;

    mockBatchMetrics = {
      startBatchOperation: jest.fn(),
      updateBatchOperation: jest.fn(),
      endBatchOperation: jest.fn(),
    } as any;

    mockEmbedderFactory = {
      getEmbedder: jest.fn(),
      embed: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
      getAvailableProviders: jest.fn(),
      autoSelectProvider: jest.fn(),
    } as any;

    mockBatchProcessingService = {
      checkMemoryUsage: jest.fn().mockReturnValue(true),
      processWithTimeout: jest.fn(),
      retryOperation: jest.fn().mockImplementation((operation) => operation()),
      calculateOptimalBatchSize: jest.fn().mockReturnValue(100),
      getMaxConcurrentOperations: jest.fn().mockReturnValue(5),
      getDefaultBatchSize: jest.fn().mockReturnValue(100),
      getProcessingTimeout: jest.fn().mockReturnValue(300000),
      getRetryAttempts: jest.fn().mockReturnValue(3),
      getRetryDelay: jest.fn().mockReturnValue(1000),
    } as any;

    mockEmbeddingService = {
      convertChunksToVectorPoints: jest.fn().mockResolvedValue([]),
      generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
      convertChunksToVectorPointsOptimized: jest.fn().mockImplementation((chunks: any[]) => {
        // 返回模拟的vector points，模拟实际转换逻辑
        return Promise.resolve(chunks.map(chunk => ({
          id: chunk.id,
          vector: Array(1536).fill(0.1),
          payload: {
            content: chunk.content,
            filePath: chunk.metadata.filePath,
            language: chunk.metadata.language,
            chunkType: chunk.type,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            metadata: chunk.metadata,
            timestamp: new Date()
          }
        })));
      }),
    } as any;

    // 移除了对generateEmbedding的mock，因为现在使用的是EmbedderFactory

    // Setup mock config
    mockConfigService.get.mockImplementation((key: string): any => {
      switch (key) {
        case 'qdrant':
          return {
            host: 'localhost',
            port: 6333,
            collection: 'codebase_vectors',
            vectorSize: 1536,
            recreateCollection: false,
            distance: 'Cosine',
          };
        case 'batchProcessing':
          return {
            enabled: true,
            maxConcurrentOperations: 5,
            defaultBatchSize: 100,
            maxBatchSize: 1000,
            memoryThreshold: 80,
            processingTimeout: 300000,
            retryAttempts: 3,
            retryDelay: 1000,
            continueOnError: false,
            adaptiveBatching: {
              enabled: true,
              minBatchSize: 10,
              maxBatchSize: 1000,
              adjustmentInterval: 1000,
              performanceThreshold: 0.8,
              adjustmentFactor: 1.5,
            },
            monitoring: {
              enabled: true,
              metricsInterval: 5000,
              alertThresholds: {
                highLatency: 10000,
                lowThroughput: 10,
                highErrorRate: 0.05,
                highMemoryUsage: 80,
                criticalMemoryUsage: 90,
                highCpuUsage: 80,
                criticalCpuUsage: 90,
              },
            },
          };
        case 'embedding':
          return {
            enabled: true,
            provider: 'openai',
            openai: {
              apiKey: 'test-key',
              model: 'text-embedding-3-small',
              dimensions: 1536,
            },
          };
        default:
          return undefined;
      }
    });

    // 直接实例化服务
    vectorStorageService = new VectorStorageService(
      mockQdrantClient,
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService,
      mockBatchMetrics,
      mockEmbedderFactory,
      mockBatchProcessingService,
      mockEmbeddingService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully when collection exists', async () => {
      // Reset the initialized flag by accessing private property
      (vectorStorageService as any).isInitialized = false;
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.getCollectionInfo.mockResolvedValue({
        name: 'codebase_vectors',
        status: 'green' as const,
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 0,
      });

      const result = await vectorStorageService.initialize();

      expect(result).toBe(true);
      expect(mockQdrantClient.connect).toHaveBeenCalled();
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });

    it('should create collection when it does not exist', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(false);
      mockQdrantClient.createCollection.mockResolvedValue(true);
      mockQdrantClient.getCollectionInfo.mockResolvedValue({
        name: 'codebase_vectors',
        status: 'green' as const,
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 0,
      });

      const result = await vectorStorageService.initialize();

      expect(result).toBe(true);
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
        'codebase_vectors',
        1536,
        'Cosine',
        false
      );
    });

    it('should handle connection failure', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(false);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle collection creation failure', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(false);
      mockQdrantClient.createCollection.mockResolvedValue(false);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(false);
    });

    it('should skip initialization if already connected', async () => {
      // Set the initialized flag to true to simulate already initialized state
      (vectorStorageService as any).isInitialized = true;
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(true);
      expect(mockQdrantClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('storeChunks', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.upsertPoints.mockResolvedValue(true);
      // Mock memory check to pass
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100000000,
        heapTotal: 150000000,
        heapUsed: 50000000,
        external: 10000000,
        arrayBuffers: 0,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should store code chunks as vectors', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'function test() { return true; }',
          type: 'function',
          startLine: 1,
          endLine: 3,
          startByte: 0,
          endByte: 50,
          imports: [],
          exports: [],
          metadata: {
            filePath: '/src/test.ts',
            language: 'typescript',
            functionName: 'test',
          },
        },
      ];

      // Reset initialized flag and initialize
      (vectorStorageService as any).isInitialized = false;
      await vectorStorageService.initialize();
      const result = await vectorStorageService.storeChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(1);
      expect(mockQdrantClient.upsertPoints).toHaveBeenCalled();
    });

    it('should store multiple vectors with metadata', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'function test1() { return true; }',
          type: 'function',
          startLine: 1,
          endLine: 5,
          startByte: 0,
          endByte: 50,
          imports: [],
          exports: [],
          metadata: {
            filePath: '/src/test1.ts',
            language: 'typescript',
            functionName: 'test1',
          },
        },
        {
          id: 'chunk-2',
          content: 'function test2() { return false; }',
          type: 'function',
          startLine: 6,
          endLine: 10,
          startByte: 51,
          endByte: 100,
          imports: [],
          exports: [],
          metadata: {
            filePath: '/src/test2.ts',
            language: 'typescript',
            functionName: 'test2',
          },
        },
      ];

      mockQdrantClient.upsertPoints.mockResolvedValue(true);

      // Reset initialized flag and initialize
      (vectorStorageService as any).isInitialized = false;
      await vectorStorageService.initialize();
      const result = await vectorStorageService.storeChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(2);
      expect(mockQdrantClient.upsertPoints).toHaveBeenCalledWith(
        'codebase_vectors',
        expect.any(Array)
      );
    });

    it('should handle empty chunks array', async () => {
      const chunks: CodeChunk[] = [];

      // Reset initialized flag and initialize
      (vectorStorageService as any).isInitialized = false;
      await vectorStorageService.initialize();
      const result = await vectorStorageService.storeChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(0);
      expect(mockQdrantClient.upsertPoints).not.toHaveBeenCalled();
    });
  });

  describe('updateChunks', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.upsertPoints.mockResolvedValue(true);
      // Mock memory check to pass
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100000000,
        heapTotal: 150000000,
        heapUsed: 50000000,
        external: 10000000,
        arrayBuffers: 0,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should update existing chunks with new vectors', async () => {
      const chunks = [
        {
          id: 'existing-1',
          content: 'updated function content',
          type: 'function',
          startLine: 1,
          endLine: 5,
          startByte: 0,
          endByte: 50,
          imports: [],
          exports: [],
          metadata: {
            filePath: '/src/updated.ts',
            language: 'typescript',
            functionName: 'updatedFunction',
          },
        },
      ];

      mockQdrantClient.upsertPoints.mockResolvedValue(true);
      mockQdrantClient.getExistingChunkIds.mockResolvedValue(['existing-1']);

      // Mock batch processing service methods used in updateChunks
      mockBatchProcessingService.retryOperation.mockImplementation((operation) => operation());

      // Reset initialized flag and initialize
      (vectorStorageService as any).isInitialized = false;
      await vectorStorageService.initialize();
      const result = await vectorStorageService.updateChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(1);
      expect(mockQdrantClient.upsertPoints).toHaveBeenCalled();
    });
  });

  describe('deleteChunks', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
    });

    it('should delete chunks by IDs', async () => {
      const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];

      mockQdrantClient.deletePoints.mockResolvedValue(true);

      await vectorStorageService.initialize();
      const result = await vectorStorageService.deleteChunks(chunkIds);

      expect(result).toBe(true);
      expect(mockQdrantClient.deletePoints).toHaveBeenCalledWith('codebase_vectors', chunkIds);
    });

    it('should handle empty chunks array', async () => {
      mockQdrantClient.deletePoints.mockResolvedValue(true);
      await vectorStorageService.initialize();
      const result = await vectorStorageService.deleteChunks([]);

      expect(result).toBe(true);
      expect(mockQdrantClient.deletePoints).toHaveBeenCalledWith('codebase_vectors', []);
    });

    it('should handle deletion errors gracefully', async () => {
      const chunkIds = ['chunk-1'];

      mockQdrantClient.deletePoints.mockRejectedValue(new Error('Deletion failed'));

      await vectorStorageService.initialize();
      const result = await vectorStorageService.deleteChunks(chunkIds);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('searchVectors', () => {
    beforeEach(async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      await vectorStorageService.initialize();
    });

    it('should search for similar vectors', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options = {
        limit: 10,
        scoreThreshold: 0.8,
      };

      const mockResults = [
        {
          id: 'vector-1',
          score: 0.95,
          payload: {
            content: 'function test() { return true; }',
            filePath: '/src/test.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 5,
            functionName: 'test',
            metadata: { functionName: 'test' },
            timestamp: new Date('2024-01-01'),
          },
        },
      ];

      mockQdrantClient.searchVectors.mockResolvedValue(mockResults);

      const result = await vectorStorageService.searchVectors(queryVector, options);

      expect(mockQdrantClient.searchVectors).toHaveBeenCalledWith('codebase_vectors', queryVector, {
        limit: 10,
        scoreThreshold: 0.8,
      });
      expect(result).toEqual(mockResults);
    });

    it('should return empty array when search fails', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options = { limit: 5 };

      mockQdrantClient.searchVectors.mockRejectedValue(new Error('Search failed'));

      const result = await vectorStorageService.searchVectors(queryVector, options);

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('getCollectionStats', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
    });

    it('should return collection statistics', async () => {
      const collectionInfo = {
        name: 'codebase_vectors',
        status: 'green' as const,
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 1500,
      };

      mockQdrantClient.getCollectionInfo.mockResolvedValue(collectionInfo);
      mockQdrantClient.getPointCount.mockResolvedValue(1500);

      await vectorStorageService.initialize();
      const stats = await vectorStorageService.getCollectionStats();

      expect(stats.totalPoints).toBe(1500);
      expect(stats.collectionInfo).toEqual(collectionInfo);
    });

    it('should handle errors when getting stats', async () => {
      mockQdrantClient.getCollectionInfo.mockRejectedValue(new Error('Collection not found'));

      await vectorStorageService.initialize();
      const stats = await vectorStorageService.getCollectionStats();

      expect(stats.totalPoints).toBe(0);
      expect(stats.collectionInfo).toBeNull();
    });
  });

  describe('clearCollection', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.clearCollection.mockResolvedValue(true);
    });

    it('should clear the collection', async () => {
      await vectorStorageService.initialize();
      const result = await vectorStorageService.clearCollection();

      expect(result).toBe(true);
      expect(mockQdrantClient.clearCollection).toHaveBeenCalledWith('codebase_vectors');
    });

    it('should handle clear collection errors', async () => {
      mockQdrantClient.clearCollection.mockRejectedValue(new Error('Clear failed'));

      await vectorStorageService.initialize();
      const result = await vectorStorageService.clearCollection();

      expect(result).toBe(false);
    });
  });
});
