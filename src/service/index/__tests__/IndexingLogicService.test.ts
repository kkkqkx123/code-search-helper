import { IndexingLogicService } from '../IndexingLogicService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { QdrantService } from '../../../database/qdrant/QdrantService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { PerformanceOptimizerService } from '../../../infrastructure/batching/PerformanceOptimizerService';
import { ASTCodeSplitter } from '../../parser/processing/strategies/impl/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from '../../parser/ChunkToVectorCoordinationService';
import { VectorPoint } from '../../../database/qdrant/IVectorStore';
import { IMemoryMonitorService } from '../../../service/memory/interfaces/IMemoryMonitorService';
import { FileInfo } from '../../filesystem/FileSystemTraversal';
import { ConfigService } from '../../../config/ConfigService';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../filesystem/FileSystemTraversal');
jest.mock('../../../database/qdrant/QdrantService');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../../embedders/EmbedderFactory');
jest.mock('../../../embedders/EmbeddingCacheService');
jest.mock('../../../infrastructure/batching/PerformanceOptimizerService');
jest.mock('../../parser/processing/strategies/impl/ASTCodeSplitter');
jest.mock('../../parser/ChunkToVectorCoordinationService');

describe('IndexingLogicService', () => {
  let indexingLogicService: IndexingLogicService;
  let loggerService: LoggerService & jest.Mocked<LoggerService>;
  let errorHandlerService: ErrorHandlerService & jest.Mocked<ErrorHandlerService>;
  let fileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let qdrantService: jest.Mocked<QdrantService>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let embedderFactory: jest.Mocked<EmbedderFactory>;
  let embeddingCacheService: jest.Mocked<EmbeddingCacheService>;
  let performanceOptimizerService: jest.Mocked<PerformanceOptimizerService>;
  let astSplitter: jest.Mocked<ASTCodeSplitter>;
  let coordinationService: jest.Mocked<ChunkToVectorCoordinationService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    loggerService = new LoggerService() as jest.Mocked<LoggerService>;
    errorHandlerService = new ErrorHandlerService(loggerService) as jest.Mocked<ErrorHandlerService>;
    fileSystemTraversal = new FileSystemTraversal(
      loggerService as unknown as LoggerService
    ) as jest.Mocked<FileSystemTraversal>;
    qdrantService = new QdrantService(
      {} as any,
      loggerService,
      errorHandlerService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<QdrantService>;
    projectIdManager = new ProjectIdManager(
      {} as any,
      {} as any,
      {} as any,
      loggerService,
      errorHandlerService,
      {} as any // Mock SqliteProjectManager
    ) as jest.Mocked<ProjectIdManager>;
    
    // Create a mock ConfigService for testing
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'logging') {
          return { level: 'info' };
        }
        return undefined;
      })
    } as unknown as ConfigService;
    
    embedderFactory = new EmbedderFactory(
      loggerService,
      errorHandlerService,
      embeddingCacheService,
      mockConfigService
    ) as jest.Mocked<EmbedderFactory>;
    embeddingCacheService = new EmbeddingCacheService(
      loggerService,
      errorHandlerService,
      {} as any
    ) as jest.Mocked<EmbeddingCacheService>;
    // 创建 IMemoryMonitorService 的模拟实现
    const mockMemoryMonitor: any = {
      getMemoryStatus: jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 500 * 1024 * 1024, // 500MB
        heapUsedPercent: 0.2,
        rss: 200 * 1024 * 1024, // 200MB
        external: 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'stable',
        averageUsage: 150 * 1024 * 1024, // 150MB
        timestamp: new Date()
      }),
      forceGarbageCollection: jest.fn(),
      triggerCleanup: jest.fn(),
      isWithinLimit: jest.fn().mockReturnValue(true),
      setMemoryLimit: jest.fn(),
      getMemoryStats: jest.fn().mockReturnValue({
        current: {
          heapUsed: 100 * 1024 * 1024,
          heapTotal: 500 * 1024 * 1024,
          heapUsedPercent: 0.2,
          rss: 200 * 1024 * 1024,
          external: 0,
          isWarning: false,
          isCritical: false,
          isEmergency: false,
          trend: 'stable',
          averageUsage: 150 * 1024 * 1024,
          timestamp: new Date()
        }
      })
    };
    
    performanceOptimizerService = new PerformanceOptimizerService(
      loggerService,
      errorHandlerService,
      {} as any,
      mockMemoryMonitor,
      {} as any
    ) as jest.Mocked<PerformanceOptimizerService>;
    astSplitter = {} as jest.Mocked<ASTCodeSplitter>;
    coordinationService = {
      processFileForEmbedding: jest.fn(),
      setProjectEmbedder: jest.fn(),
    } as unknown as jest.Mocked<ChunkToVectorCoordinationService>;

    // Mock the missing dependencies
    const graphService = {} as any;
    const graphMappingService = {} as any;
    const performanceDashboard = {
      recordMetric: jest.fn().mockResolvedValue(undefined)
    } as any;
    const optimizationAdvisor = {} as any;
    const batchProcessingOptimizer = {} as any;
    const concurrencyService = {
      processWithConcurrency: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock fs methods
    jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('test file content');
    jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 } as any);

    // Create service instance using dependency injection approach
    indexingLogicService = new IndexingLogicService();
    // Mock the injected properties
    (indexingLogicService as any).logger = loggerService;
    (indexingLogicService as any).errorHandler = errorHandlerService;
    (indexingLogicService as any).fileSystemTraversal = fileSystemTraversal;
    (indexingLogicService as any).qdrantService = qdrantService;
    (indexingLogicService as any).graphService = graphService;
    (indexingLogicService as any).graphMappingService = graphMappingService;
    (indexingLogicService as any).performanceDashboard = performanceDashboard;
    (indexingLogicService as any).optimizationAdvisor = optimizationAdvisor;
    (indexingLogicService as any).projectIdManager = projectIdManager;
    (indexingLogicService as any).embedderFactory = embedderFactory;
    (indexingLogicService as any).embeddingCacheService = embeddingCacheService;
    (indexingLogicService as any).performanceOptimizer = performanceOptimizerService;
    (indexingLogicService as any).astSplitter = astSplitter;
    (indexingLogicService as any).coordinationService = coordinationService;
    (indexingLogicService as any).concurrencyService = concurrencyService;
  });

  describe('indexProject', () => {
    it('should index a project successfully', async () => {
      const projectPath = '/test/project';
      const files: FileInfo[] = [
        {
          path: '/test/project/file1.js',
          relativePath: 'file1.js',
          name: 'file1.js',
          extension: '.js',
          size: 1024,
          hash: 'abc123',
          lastModified: new Date(),
          language: 'javascript',
          isBinary: false
        },
        {
          path: '/test/project/file2.js',
          relativePath: 'file2.js',
          name: 'file2.js',
          extension: '.js',
          size: 2048,
          hash: 'def456',
          lastModified: new Date(),
          language: 'javascript',
          isBinary: false
        }
      ];

      // Mock dependencies
      fileSystemTraversal.traverseDirectory.mockResolvedValue({ files, errors: [], directories: [], totalSize: 3072, processingTime: 100 });
      performanceOptimizerService.executeWithRetry.mockImplementation(async (fn) => {
        return await fn();
      });
      performanceOptimizerService.getCurrentBatchSize.mockReturnValue(10);
      performanceOptimizerService.processBatches.mockImplementation(async (items, processor) => {
        await processor([files[0]]);
        await processor([files[1]]);
        return [];
      });
      coordinationService.processFileForEmbedding.mockResolvedValue([
        {
          id: 'chunk1',
          vector: [0.1, 0.2],
          payload: {
            content: 'test content',
            filePath: 'file1.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ]);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);

      // Call the method
      await indexingLogicService.indexProject(projectPath);

      // Verify results
      expect(fileSystemTraversal.traverseDirectory).toHaveBeenCalledWith(projectPath, {
        includePatterns: undefined,
        excludePatterns: undefined
      });
      expect(coordinationService.processFileForEmbedding).toHaveBeenCalledTimes(2);
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during project indexing', async () => {
      const projectPath = '/test/project';
      const error = new Error('Traversal failed');

      // Mock dependencies to throw error
      fileSystemTraversal.traverseDirectory.mockRejectedValue(error);
      performanceOptimizerService.executeWithRetry.mockImplementation(async (fn) => {
        // When the underlying function throws an error, executeWithRetry should also throw
        try {
          await fn();
        } catch (e) {
          throw e;
        }
      });
      errorHandlerService.handleError = jest.fn();

      // Call the method and expect error
      await expect(indexingLogicService.indexProject(projectPath)).rejects.toThrow('Traversal failed');

      // Verify error handling
      expect(errorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('getEmbedderDimensions', () => {
    it('should return embedder dimensions successfully', async () => {
      const embedderProvider = 'openai';
      const providerInfo = { name: 'OpenAI Embeddings', model: 'text-embedding-ada-002', dimensions: 1536, available: true };

      // Mock dependencies
      embedderFactory.getProviderInfo.mockResolvedValue(providerInfo);

      // Call the method
      const dimensions = await indexingLogicService.getEmbedderDimensions(embedderProvider);

      // Verify results
      expect(dimensions).toBe(1536);
      expect(embedderFactory.getProviderInfo).toHaveBeenCalledWith(embedderProvider);
    });

    it('should fallback to environment variables when provider info fails', async () => {
      const embedderProvider = 'openai';
      const error = new Error('Provider not found');

      // Mock dependencies to throw error
      embedderFactory.getProviderInfo.mockRejectedValue(error);

      // Mock environment variable
      process.env.OPENAI_DIMENSIONS = '1536';

      // Call the method
      const dimensions = await indexingLogicService.getEmbedderDimensions(embedderProvider);

      // Verify results
      expect(dimensions).toBe(1536);
      expect(embedderFactory.getProviderInfo).toHaveBeenCalledWith(embedderProvider);
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should use default dimensions when no environment variables are set', async () => {
      const embedderProvider = 'unknown';
      const error = new Error('Provider not found');

      // Mock dependencies to throw error
      embedderFactory.getProviderInfo.mockRejectedValue(error);

      // Clear environment variables
      delete process.env.OPENAI_DIMENSIONS;
      delete process.env.OLLAMA_DIMENSIONS;
      delete process.env.GEMINI_DIMENSIONS;
      delete process.env.MISTRAL_DIMENSIONS;
      delete process.env.SILICONFLOW_DIMENSIONS;

      // Call the method
      const dimensions = await indexingLogicService.getEmbedderDimensions(embedderProvider);

      // Verify results
      expect(dimensions).toBe(1024); // Default value
      expect(embedderFactory.getProviderInfo).toHaveBeenCalledWith(embedderProvider);
      expect(loggerService.warn).toHaveBeenCalled();
    });
  });

  describe('indexFile', () => {
    it('should index a file successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const vectorPoints: VectorPoint[] = [
        {
          id: 'chunk1',
          vector: [0.1, 0.2],
          payload: {
            content: 'test content',
            filePath: 'file.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ];

      // Mock dependencies
      coordinationService.processFileForEmbedding.mockResolvedValue(vectorPoints);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);
      jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 } as any);

      // Call the method
      await indexingLogicService.indexFile(projectPath, filePath);

      // Verify results
      expect(coordinationService.processFileForEmbedding).toHaveBeenCalledWith(filePath, projectPath);
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalledWith(projectPath, vectorPoints);
      expect(loggerService.debug).toHaveBeenCalled();
    });

    it('should handle errors during file indexing', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const error = new Error('Indexing failed');

      // Mock dependencies to throw error
      coordinationService.processFileForEmbedding.mockRejectedValue(error);
      errorHandlerService.handleError = jest.fn();

      // Call the method and expect error
      await expect(indexingLogicService.indexFile(projectPath, filePath)).rejects.toThrow(error);

      // Verify error handling
      expect(errorHandlerService.handleError).toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('removeFileFromIndex', () => {
    it('should remove file from index successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const projectId = 'test-project-id';
      const collectionName = 'project-test-project-id';
      const chunkIds = ['chunk1', 'chunk2'];

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      projectIdManager.getCollectionName.mockReturnValue(collectionName);
      qdrantService.getChunkIdsByFiles.mockResolvedValue(chunkIds);
      qdrantService.deletePoints.mockResolvedValue(true);

      // Call the method
      await indexingLogicService.removeFileFromIndex(projectPath, filePath);

      // Verify results
      expect(projectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
      expect(projectIdManager.getCollectionName).toHaveBeenCalledWith(projectId);
      expect(qdrantService.getChunkIdsByFiles).toHaveBeenCalledWith(collectionName, [filePath]);
      expect(qdrantService.deletePoints).toHaveBeenCalledWith(collectionName, chunkIds);
      expect(loggerService.debug).toHaveBeenCalled();
    });

    it('should handle errors when removing file from index', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const error = new Error('Removal failed');

      // Mock dependencies to throw error
      projectIdManager.getProjectId.mockImplementation(() => {
        throw error;
      });
      errorHandlerService.handleError = jest.fn();

      // Call the method and expect error
      await expect(indexingLogicService.removeFileFromIndex(projectPath, filePath)).rejects.toThrow(error);

      // Verify error handling
      expect(errorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});