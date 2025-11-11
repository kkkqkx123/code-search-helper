import { IndexService } from '../IndexService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../filesystem/ChangeDetectionService';
import { QdrantService } from '../../../database/qdrant/QdrantService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { QdrantConfigService } from '../../../config/service/QdrantConfigService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { TYPES } from '../../../types';
import { PerformanceOptimizerService } from '../../../infrastructure/batching/PerformanceOptimizerService';
import { ConfigService } from '../../../config/ConfigService';
import { Container } from 'inversify';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { IQdrantConnectionManager } from '../../../database/qdrant/QdrantConnectionManager';
import { IQdrantCollectionManager } from '../../../database/qdrant/QdrantCollectionManager';
import { IQdrantVectorOperations } from '../../../database/qdrant/QdrantVectorOperations';
import { IQdrantQueryUtils } from '../../../database/qdrant/QdrantQueryUtils';
import { IQdrantProjectManager } from '../../../database/qdrant/QdrantProjectManager';
import { ASTCodeSplitter } from '../../parser/processing/strategies/implementations/ASTCodeSplitter';
import { ProjectStateManager } from '../../project/ProjectStateManager';
import { DatabaseLoggerService } from '../../../database/common/DatabaseLoggerService';
import { PerformanceMonitor } from '../../../database/common/PerformanceMonitor';
import { ChunkToVectorCoordinationService } from '../../parser/ChunkToVectorCoordinationService';
import { IndexingLogicService } from '../IndexingLogicService';
import { FileTraversalService } from '../shared/FileTraversalService';
import { ConcurrencyService } from '../shared/ConcurrencyService';
import { IgnoreRuleManager } from '../../ignore/IgnoreRuleManager';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../filesystem/FileSystemTraversal');
jest.mock('../../filesystem/FileWatcherService');
jest.mock('../../filesystem/ChangeDetectionService');
jest.mock('../../../database/qdrant/QdrantService');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../../embedders/EmbedderFactory');
jest.mock('../../../embedders/EmbeddingCacheService');
jest.mock('../../../infrastructure/batching/PerformanceOptimizerService');
jest.mock('../../project/ProjectStateManager');

describe('IndexService', () => {
  let indexService: IndexService;
  let loggerService: LoggerService & jest.Mocked<LoggerService>;
  let errorHandlerService: ErrorHandlerService & jest.Mocked<ErrorHandlerService>;
  let fileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let fileWatcherService: jest.Mocked<FileWatcherService>;
  let changeDetectionService: jest.Mocked<ChangeDetectionService>;
  let qdrantService: jest.Mocked<QdrantService>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let embedderFactory: jest.Mocked<EmbedderFactory>;
  let embeddingCacheService: jest.Mocked<EmbeddingCacheService>;
  let performanceOptimizerService: jest.Mocked<PerformanceOptimizerService>;
  let astSplitter: jest.Mocked<ASTCodeSplitter>;
  let projectStateManager: jest.Mocked<ProjectStateManager>;
  let coordinationService: jest.Mocked<ChunkToVectorCoordinationService>;
  let indexingLogicService: jest.Mocked<IndexingLogicService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get mock instances
    // Create a mock ConfigService for testing
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'logging') {
          return { level: 'info' };
        }
        if (key === 'performance') {
          return {
            retry: {
              maxAttempts: 3,
              baseDelay: 1000,
              maxDelay: 30000,
              backoffFactor: 2,
              jitter: true
            },
            batch: {
              initialSize: 10,
              maxSize: 100,
              minSize: 1,
              adjustmentFactor: 0.1,
              performanceThreshold: 5000
            }
          };
        }
        return undefined;
      })
    } as unknown as ConfigService;

    // Create mock logger service instead of real instance
    loggerService = {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      getLogFilePath: jest.fn().mockReturnValue('./logs/test.log'),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoggerService>;
    errorHandlerService = new ErrorHandlerService(loggerService) as jest.Mocked<ErrorHandlerService>;
    fileSystemTraversal = new FileSystemTraversal(
      loggerService as unknown as LoggerService
    ) as jest.Mocked<FileSystemTraversal>;
    // Create mock file watcher service
    fileWatcherService = {
      startWatching: jest.fn(),
      stopWatching: jest.fn(),
      isWatchingPath: jest.fn(),
      getWatchedPaths: jest.fn(),
      setCallbacks: jest.fn(),
    } as unknown as jest.Mocked<FileWatcherService>;

    // Create mock change detection service
    changeDetectionService = {
      initialize: jest.fn(),
      isRunning: jest.fn(),
      setCallbacks: jest.fn(),
      getFileHistory: jest.fn(),
      flushEventQueue: jest.fn(),
      waitForEvents: jest.fn(),
    } as unknown as jest.Mocked<ChangeDetectionService>;
    // Create mock instances for the remaining QdrantService dependencies
    const mockConnectionManager = {} as jest.Mocked<IQdrantConnectionManager>;
    const mockCollectionManager = {} as jest.Mocked<IQdrantCollectionManager>;
    const mockVectorOperations = {} as jest.Mocked<IQdrantVectorOperations>;
    const mockQueryUtils = {} as jest.Mocked<IQdrantQueryUtils>;
    const mockProjectManager = {} as jest.Mocked<IQdrantProjectManager>;
    const mockDatabaseLoggerService = {
      logDatabaseEvent: jest.fn(),
      logConnectionEvent: jest.fn(),
      logBatchOperation: jest.fn(),
      logCollectionOperation: jest.fn(),
      logVectorOperation: jest.fn(),
      logQueryOperation: jest.fn(),
      logProjectOperation: jest.fn(),
    } as unknown as jest.Mocked<DatabaseLoggerService>;
    const mockPerformanceMonitor = {
      recordOperation: jest.fn(),
      getOperationStats: jest.fn(),
    } as unknown as jest.Mocked<PerformanceMonitor>;

    qdrantService = new QdrantService(
      {} as any, // ConfigService - will be mocked
      loggerService,
      errorHandlerService,
      projectIdManager,
      mockConnectionManager,
      mockCollectionManager,
      mockVectorOperations,
      mockQueryUtils,
      mockProjectManager,
      mockDatabaseLoggerService,
      mockPerformanceMonitor
    ) as jest.Mocked<QdrantService>;
    // Create mock config services
    const mockQdrantConfigService = {
      getCollectionNameForProject: jest.fn().mockImplementation((projectId: string) => `project-${projectId}`),
      validateNamingConvention: jest.fn().mockReturnValue(true),
      checkConfigurationConflict: jest.fn().mockReturnValue(false)
    } as unknown as jest.Mocked<QdrantConfigService>;

    const mockNebulaConfigService = {
      getSpaceNameForProject: jest.fn().mockImplementation((projectId: string) => `project_${projectId}`),
      validateNamingConvention: jest.fn().mockReturnValue(true),
      checkConfigurationConflict: jest.fn().mockReturnValue(false)
    } as unknown as jest.Mocked<NebulaConfigService>;

    // Create mock project ID manager
    projectIdManager = {
      generateProjectId: jest.fn(),
      getProjectId: jest.fn(),
      updateProjectTimestamp: jest.fn(),
      removeProjectId: jest.fn(),
      getAllProjectIds: jest.fn(),
      saveMapping: jest.fn().mockResolvedValue(undefined),
      getProjectPath: jest.fn(),
      getCollectionName: jest.fn(),
      getSpaceName: jest.fn(),
    } as unknown as jest.Mocked<ProjectIdManager>;

    // Create mock embedder factory
    embedderFactory = {
      createEmbedder: jest.fn(),
      getEmbedderDimensions: jest.fn(),
      getDefaultProvider: jest.fn().mockReturnValue('openai'),
      getProviderInfo: jest.fn().mockResolvedValue({
        name: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        available: true
      }),
      isProviderRegistered: jest.fn().mockReturnValue(true),
      getRegisteredProviders: jest.fn().mockReturnValue(['openai', 'ollama', 'siliconflow'])
    } as unknown as jest.Mocked<EmbedderFactory>;
    // Create mock embedding cache service
    embeddingCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
      stopCleanupInterval: jest.fn(),
    } as unknown as jest.Mocked<EmbeddingCacheService>;

    // Create mock performance optimizer service
    performanceOptimizerService = {
      executeWithRetry: jest.fn().mockImplementation(async (operation) => await operation()),
      executeWithMonitoring: jest.fn().mockImplementation(async (operation) => await operation()),
      processBatches: jest.fn().mockImplementation(async (items, processBatch) => {
        const results: any[] = [];
        for (let i = 0; i < items.length; i += 10) {
          const batch = items.slice(i, i + 10);
          const batchResults = await processBatch(batch);
          results.push(...batchResults);
        }
        return results;
      }),
      getPerformanceStats: jest.fn().mockReturnValue({
        count: 0,
        successRate: 1,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0
      }),
      getCurrentBatchSize: jest.fn().mockReturnValue(10),
      resetBatchSize: jest.fn(),
      stopMemoryMonitoring: jest.fn(),
    } as unknown as jest.Mocked<PerformanceOptimizerService>;

    astSplitter = {} as jest.Mocked<ASTCodeSplitter>;
    projectStateManager = {} as jest.Mocked<ProjectStateManager>;
    projectStateManager.createOrUpdateProjectState = jest.fn().mockResolvedValue({});

    // Create mock coordination service
    coordinationService = {
      processFileForEmbedding: jest.fn(),
      setProjectEmbedder: jest.fn(),
    } as unknown as jest.Mocked<ChunkToVectorCoordinationService>;

    // Create mock indexing logic service
    indexingLogicService = {
      indexFile: jest.fn(),
      removeFileFromIndex: jest.fn(),
      indexProject: jest.fn(),
      getEmbedderDimensions: jest.fn().mockResolvedValue(1024), // 添加缺失的mock
      cleanup: jest.fn().mockResolvedValue(undefined), // 添加cleanup方法
    } as unknown as jest.Mocked<IndexingLogicService>;

    // Create service instance
    // Create mock file traversal service
    const mockFileTraversalService = {
      getProjectFiles: jest.fn(),
      isCodeFile: jest.fn(),
    } as unknown as jest.Mocked<FileTraversalService>;

    // Create mock concurrency service
    const mockConcurrencyService = {
      processWithConcurrency: jest.fn(),
    } as unknown as jest.Mocked<ConcurrencyService>;

    const mockIgnoreRuleManager = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      once: jest.fn()
    } as any;

    // Create a test container for IndexService
    const testContainer = new Container();
    
    // Bind all dependencies
    testContainer.bind<LoggerService>(TYPES.LoggerService).toConstantValue(loggerService);
    testContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(errorHandlerService);
    testContainer.bind<FileWatcherService>(TYPES.FileWatcherService).toConstantValue(fileWatcherService);
    testContainer.bind<ChangeDetectionService>(TYPES.ChangeDetectionService).toConstantValue(changeDetectionService);
    testContainer.bind<QdrantService>(TYPES.QdrantService).toConstantValue(qdrantService);
    testContainer.bind<ProjectIdManager>(TYPES.ProjectIdManager).toConstantValue(projectIdManager);
    testContainer.bind<EmbedderFactory>(TYPES.EmbedderFactory).toConstantValue(embedderFactory);
    testContainer.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).toConstantValue(embeddingCacheService);
    testContainer.bind<BatchProcessingService>(TYPES.BatchProcessingService).toConstantValue(performanceOptimizerService as any);
    testContainer.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).toConstantValue(astSplitter);
    testContainer.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).toConstantValue(coordinationService);
    testContainer.bind<IndexingLogicService>(TYPES.IndexingLogicService).toConstantValue(indexingLogicService);
    testContainer.bind<FileTraversalService>(TYPES.FileTraversalService).toConstantValue(mockFileTraversalService);
    testContainer.bind<ConcurrencyService>(TYPES.ConcurrencyService).toConstantValue(mockConcurrencyService);
    testContainer.bind<IgnoreRuleManager>(TYPES.IgnoreRuleManager).toConstantValue(mockIgnoreRuleManager);
    
    // Bind missing dependencies
    testContainer.bind<any>(TYPES.ProjectHotReloadService).toConstantValue({} as any);
    testContainer.bind<any>(TYPES.INebulaClient).toConstantValue({} as any);
    
    // Bind IndexService itself
    testContainer.bind<IndexService>(TYPES.IndexService).to(IndexService).inSingletonScope();
    
    // Create IndexService instance
    indexService = testContainer.get<IndexService>(TYPES.IndexService);
  });

  // 在所有测试完成后清理资源
  afterAll(async () => {
    // 销毁IndexService实例
    if (indexService && typeof (indexService as any).destroy === 'function') {
      await (indexService as any).destroy();
    }

    // 清理所有mock的定时器和异步操作
    jest.clearAllTimers();
    jest.clearAllMocks();

    // 确保所有Promise都已完成
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('startIndexing', () => {
    it('should start indexing a project successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = { batchSize: 5 };

      // Mock dependencies
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      qdrantService.createCollectionForProject.mockResolvedValue(true);

      // Call the method
      const result = await indexService.startIndexing(projectPath, options);

      // Verify results
      expect(result).toBe(projectId);
      expect(projectIdManager.generateProjectId).toHaveBeenCalledWith(projectPath);
      expect(qdrantService.createCollectionForProject).toHaveBeenCalledWith(
        projectPath,
        1024,
        'Cosine'
      );
    });

    it('should throw error if project is already being indexed', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      qdrantService.createCollectionForProject.mockResolvedValue(true);

      // Start indexing first time
      await indexService.startIndexing(projectPath);

      // Try to start indexing again
      await expect(indexService.startIndexing(projectPath)).rejects.toThrow(
        `项目 ${projectPath} 正在索引中，请等待完成或停止当前索引`
      );
    });

    it('should throw error if collection creation fails', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      qdrantService.createCollectionForProject.mockResolvedValue(false);

      // Call the method and expect error
      await expect(indexService.startIndexing(projectPath)).rejects.toThrow(
        `Failed to create collection for project: ${projectPath}`
      );
    });
  });

  describe('handleFileChange', () => {
    it('should handle file added event', async () => {
      const filePath = '/test/project/file.js';
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      (indexService as any).indexFile = jest.fn().mockResolvedValue(undefined);

      // Simulate file added event
      await (indexService as any).handleFileChange(filePath, projectPath, 'added');

      // Verify results
      expect((indexService as any).indexFile).toHaveBeenCalledWith(projectPath, filePath);
      expect(projectIdManager.updateProjectTimestamp).toHaveBeenCalledWith(projectId);
    });

    it('should handle file deleted event', async () => {
      const filePath = '/test/project/file.js';
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      (indexService as any).removeFileFromIndex = jest.fn().mockResolvedValue(undefined);

      // Simulate file deleted event
      await (indexService as any).handleFileChange(filePath, projectPath, 'deleted');

      // Verify results
      expect((indexService as any).removeFileFromIndex).toHaveBeenCalledWith(projectPath, filePath);
      expect(projectIdManager.updateProjectTimestamp).toHaveBeenCalledWith(projectId);
    });

    it('should log warning if project ID not found', async () => {
      const filePath = '/test/project/file.js';
      const projectPath = '/test/project';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Simulate file change event
      await (indexService as any).handleFileChange(filePath, projectPath, 'added');

      // Verify warning was logged
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Project ID not found for path: ${projectPath}`
      );
    });
  });

  describe('indexFile', () => {
    it('should index a file successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';

      // Mock indexing logic service
      indexingLogicService.indexFile.mockResolvedValue(undefined);

      // Call the method
      await (indexService as any).indexFile(projectPath, filePath);

      // Verify results
      expect(indexingLogicService.indexFile).toHaveBeenCalledWith(projectPath, filePath);
    });

    it('should throw error if indexing fails', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const error = new Error('Indexing failed');

      // Mock indexing logic service to throw error
      indexingLogicService.indexFile.mockRejectedValue(error);

      // Call the method and expect error
      await expect((indexService as any).indexFile(projectPath, filePath)).rejects.toThrow(
        error // 应该抛出原始错误，而不是包装后的错误
      );
    });
  });

  describe('removeFileFromIndex', () => {
    it('should remove file from index successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';

      // Mock indexing logic service
      indexingLogicService.removeFileFromIndex.mockResolvedValue(undefined);

      // Call the method
      await (indexService as any).removeFileFromIndex(projectPath, filePath);

      // Verify results
      expect(indexingLogicService.removeFileFromIndex).toHaveBeenCalledWith(projectPath, filePath);
    });

    it('should throw error if remove file fails', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const error = new Error('Remove failed');

      // Mock indexing logic service to throw error
      indexingLogicService.removeFileFromIndex.mockRejectedValue(error);

      // Call the method and expect error
      await expect((indexService as any).removeFileFromIndex(projectPath, filePath)).rejects.toThrow(
        error // 应该抛出原始错误，而不是包装后的错误
      );
    });
  });

  describe('getIndexStatus', () => {
    it('should return index status for a project', () => {
      const projectId = 'test-project-id';
      const expectedStatus = {
        projectId,
        projectPath: '/test/project',
        isIndexing: true,
        lastIndexed: null,
        totalFiles: 10,
        indexedFiles: 5,
        failedFiles: 0,
        progress: 50
      };

      // Set index status
      (indexService as any).indexingProjects.set(projectId, expectedStatus);

      // Call the method
      const status = indexService.getIndexStatus(projectId);

      // Verify results
      expect(status).toEqual(expectedStatus);
    });

    it('should return null for non-existent project', () => {
      const projectId = 'non-existent-project';

      // Call the method
      const status = indexService.getIndexStatus(projectId);

      // Verify results
      expect(status).toBeNull();
    });
  });

  describe('stopIndexing', () => {
    it('should stop indexing a project successfully', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/test/project';
      const status = {
        projectId,
        projectPath,
        isIndexing: true,
        lastIndexed: null,
        totalFiles: 10,
        indexedFiles: 5,
        failedFiles: 0,
        progress: 50
      };

      // Set index status
      (indexService as any).indexingProjects.set(projectId, status);
      (indexService as any).indexingQueue = [{ projectPath }];

      // Mock projectIdManager.getProjectId to return the projectId for the projectPath
      projectIdManager.getProjectId.mockImplementation((path: string) => {
        return path === projectPath ? projectId : undefined;
      });

      // Call the method
      const result = await indexService.stopIndexing(projectId);

      // Verify results
      expect(result).toBe(true);
      expect(status.isIndexing).toBe(false);
      expect((indexService as any).indexingQueue).toHaveLength(0);
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

      // Call the method
      const result = await indexService.stopIndexing(projectId);

      // Verify results
      expect(result).toBe(false);
    });
  });

  describe('reindexProject', () => {
    it('should reindex a project successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = { batchSize: 5 };

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      qdrantService.deleteCollectionForProject.mockResolvedValue(true);
      indexService.startIndexing = jest.fn().mockResolvedValue(projectId);

      // Call the method
      const result = await indexService.reindexProject(projectPath, options);

      // Verify results
      expect(result).toBe(projectId);
      expect(qdrantService.deleteCollectionForProject).toHaveBeenCalledWith(projectPath);
      expect(indexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
    });

    it('should start indexing if project does not exist', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = { batchSize: 5 };

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(undefined);
      indexService.startIndexing = jest.fn().mockResolvedValue(projectId);

      // Call the method
      const result = await indexService.reindexProject(projectPath, options);

      // Verify results
      expect(result).toBe(projectId);
      expect(qdrantService.deleteCollectionForProject).not.toHaveBeenCalled();
      expect(indexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
    });
  });
});