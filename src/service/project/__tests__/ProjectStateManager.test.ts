import { ProjectStateManager } from '../ProjectStateManager';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { QdrantService } from '../../../database/qdrant/QdrantService';
import { ConfigService } from '../../../config/ConfigService';
import { diContainer } from '../../../core/DIContainer';
import { TYPES } from '../../../types';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../filesystem/ChangeDetectionService';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { QdrantConfigService } from '../../../config/service/QdrantConfigService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { PerformanceOptimizerService } from '../../../infrastructure/batching/PerformanceOptimizerService';
import { IQdrantConnectionManager } from '../../../database/qdrant/QdrantConnectionManager';
import { IQdrantCollectionManager } from '../../../database/qdrant/QdrantCollectionManager';
import { IQdrantVectorOperations } from '../../../database/qdrant/QdrantVectorOperations';
import { IQdrantQueryUtils } from '../../../database/qdrant/QdrantQueryUtils';
import { IQdrantProjectManager } from '../../../database/qdrant/QdrantProjectManager';
import { ASTCodeSplitter } from '../../parser/splitting/ASTCodeSplitter';
import { DatabaseLoggerService } from '../../../database/common/DatabaseLoggerService';
import { PerformanceMonitor } from '../../../database/common/PerformanceMonitor';
import { IndexService } from '../../index/IndexService';
import { ChunkToVectorCoordinationService } from '../../parser/ChunkToVectorCoordinationService';
import { IndexingLogicService } from '../../index/IndexingLogicService';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../index/IndexSyncService');
jest.mock('../../../database/qdrant/QdrantService');
jest.mock('../../../config/ConfigService');
jest.mock('fs/promises');

describe('ProjectStateManager', () => {
  let projectStateManager: ProjectStateManager;
  let loggerService: jest.Mocked<LoggerService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let indexSyncService: jest.Mocked<IndexService>;
  let qdrantService: jest.Mocked<QdrantService>;
  let configService: jest.Mocked<ConfigService>;
  let mockFs: jest.Mocked<typeof import('fs/promises')>;
  let astSplitter: jest.Mocked<ASTCodeSplitter>;
  let coordinationService: jest.Mocked<ChunkToVectorCoordinationService>;
  let indexingLogicService: jest.Mocked<IndexingLogicService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get mock instances
    loggerService = new LoggerService() as jest.Mocked<LoggerService>;
    errorHandlerService = new ErrorHandlerService(loggerService) as jest.Mocked<ErrorHandlerService>;

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

    projectIdManager = new ProjectIdManager(
      configService,
      mockQdrantConfigService,
      mockNebulaConfigService,
      loggerService,
      errorHandlerService
    ) as jest.Mocked<ProjectIdManager>;
    // Create mock file system traversal
    const mockFileSystemTraversal = {
      defaultOptions: {},
      traverseDirectory: jest.fn(),
      traverseRecursive: jest.fn(),
      processDirectory: jest.fn(),
    } as unknown as jest.Mocked<FileSystemTraversal>;

    // Create mock file watcher service
    const mockFileWatcherService = {
      setCallbacks: jest.fn(),
      startWatching: jest.fn(),
      stopWatching: jest.fn(),
      isWatchingPath: jest.fn(),
      getWatchedPaths: jest.fn(),
    } as unknown as jest.Mocked<FileWatcherService>;

    // Create mock change detection service
    const mockChangeDetectionService = {
      setCallbacks: jest.fn(),
      initialize: jest.fn(),
      stop: jest.fn(),
      getFileHash: jest.fn(),
      getFileHistory: jest.fn(),
      getAllFileHashes: jest.fn(),
      isFileTracked: jest.fn(),
      getTrackedFilesCount: jest.fn(),
      isServiceRunning: jest.fn(),
      getStats: jest.fn(),
      resetStats: jest.fn(),
      isTestMode: jest.fn(),
      waitForFileProcessing: jest.fn(),
      waitForAllProcessing: jest.fn(),
      flushPendingChanges: jest.fn(),
      on: jest.fn(),
      eventNames: jest.fn(),
      getMaxListeners: jest.fn(),
      listenerCount: jest.fn(),
      listeners: jest.fn(),
      off: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      rawListeners: jest.fn(),
      removeAllListeners: jest.fn(),
      removeListener: jest.fn(),
      setMaxListeners: jest.fn(),
      addListener: jest.fn(),
      emit: jest.fn(),
      once: jest.fn(),
    } as unknown as jest.Mocked<ChangeDetectionService>;

    // Create mock embedder factory
    const mockEmbedderFactory = {
      embed: jest.fn(),
    } as unknown as jest.Mocked<EmbedderFactory>;

    // Create mock embedding cache service
    const mockEmbeddingCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      size: jest.fn(),
    } as unknown as jest.Mocked<EmbeddingCacheService>;

    // Create mock ast splitter
    const mockAstSplitter = {
      split: jest.fn(),
    } as unknown as jest.Mocked<ASTCodeSplitter>;

    // Create mock coordination service
    const mockCoordinationService = {
      processFileForEmbedding: jest.fn(),
      setProjectEmbedder: jest.fn(),
    } as unknown as jest.Mocked<ChunkToVectorCoordinationService>;

    // Create mock performance optimizer service
    const mockPerformanceOptimizerService = {
      executeWithRetry: jest.fn(),
      executeWithMonitoring: jest.fn(),
      processBatches: jest.fn(),
      getPerformanceStats: jest.fn(),
      getMemoryStats: jest.fn(),
      optimizeMemory: jest.fn(),
      getCurrentBatchSize: jest.fn(),
      resetBatchSize: jest.fn(),
      updateRetryOptions: jest.fn(),
      updateBatchOptions: jest.fn(),
    } as unknown as jest.Mocked<PerformanceOptimizerService>;

    // Create mock indexing logic service
    const mockIndexingLogicService = {
      indexProject: jest.fn(),
      getEmbedderDimensions: jest.fn(),
      indexFile: jest.fn(),
      removeFileFromIndex: jest.fn(),
      recordMetrics: jest.fn(),
      recordError: jest.fn(),
      processWithConcurrency: jest.fn(),
    } as unknown as jest.Mocked<IndexingLogicService>;

    indexSyncService = new IndexService(
      loggerService,
      errorHandlerService,
      mockFileSystemTraversal,
      mockFileWatcherService,
      mockChangeDetectionService,
      qdrantService,
      projectIdManager,
      mockEmbedderFactory,
      mockEmbeddingCacheService,
      mockPerformanceOptimizerService,
      mockAstSplitter,
      mockCoordinationService,
      mockIndexingLogicService
    ) as jest.Mocked<IndexService>;
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
      configService,
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
    // 创建模拟的ConfigService
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'project') {
          return { statePath: './data/project-states.json' };
        }
        return {};
      }),
      getAll: jest.fn().mockReturnValue({}),
      initialize: jest.fn().mockResolvedValue(undefined)
    } as any;
    mockFs = require('fs/promises') as jest.Mocked<typeof import('fs/promises')>;

    // 为fs模块的方法添加mock实现
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
    mockFs.writeFile = jest.fn().mockResolvedValue(undefined);
    mockFs.unlink = jest.fn().mockResolvedValue(undefined);
    mockFs.rename = jest.fn().mockResolvedValue(undefined);

    // Mock config service
    configService.get = jest.fn().mockImplementation((key: string) => {
      if (key === 'project') {
        return { statePath: './data/project-states.json' };
      }
      return {};
    });

    // Create service instance
    projectStateManager = new ProjectStateManager(
      loggerService,
      errorHandlerService,
      projectIdManager,
      indexSyncService,
      qdrantService,
      configService
    );
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

      // Call the method
      await projectStateManager.initialize();

      // Verify results
      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(mockFs.readFile).toHaveBeenCalledWith('./data/project-states.json', 'utf-8');
      expect(loggerService.info).toHaveBeenCalledWith('Project state manager initialized', expect.any(Object));
    });

    it('should load existing project states', async () => {
      const existingStates = [
        {
          projectId: 'test-project-1',
          projectPath: '/test/project1',
          name: 'Test Project 1',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        }
      ];

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStates));

      // Call the method
      await projectStateManager.initialize();

      // Verify results
      expect(mockFs.readFile).toHaveBeenCalledWith('./data/project-states.json', 'utf-8');
      expect(loggerService.info).toHaveBeenCalledWith('Loaded 1 valid project states, skipped 0 invalid states');
    });

    it('should handle duplicate project paths when loading states', async () => {
      const existingStates = [
        {
          projectId: 'test-project-1',
          projectPath: '/test/project',
          name: 'Test Project 1',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        },
        {
          projectId: 'test-project-2',
          projectPath: '/test/project', // Same path as above (normalized)
          name: 'Test Project 2',
          status: 'inactive' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        }
      ];

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStates));

      // Call the method
      await projectStateManager.initialize();

      // Verify results - should only load the first project, skip the duplicate
      expect(mockFs.readFile).toHaveBeenCalledWith('./data/project-states.json', 'utf-8');
      expect(loggerService.info).toHaveBeenCalledWith('Loaded 1 valid project states, skipped 1 invalid states');
      expect(loggerService.warn).toHaveBeenCalledWith('Skipping duplicate project path: /test/project', expect.any(Object));

      // Verify only one project was loaded
      const allStates = projectStateManager.getAllProjectStates();
      expect(allStates.length).toBe(1);
      expect(allStates[0].projectId).toBe('test-project-1');
    });

    it('should handle different path formats as duplicates when loading states', async () => {
      const existingStates = [
        {
          projectId: 'test-project-1',
          projectPath: '/test/project',
          name: 'Test Project 1',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        },
        {
          projectId: 'test-project-2',
          projectPath: '/test/project/', // Same path with trailing slash
          name: 'Test Project 2',
          status: 'inactive' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        },
        {
          projectId: 'test-project-3',
          projectPath: '\\test\\project', // Same path with Windows separators
          name: 'Test Project 3',
          status: 'inactive' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        }
      ];

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStates));

      // Call the method
      await projectStateManager.initialize();

      // Verify results - should only load the first project, skip the duplicates
      expect(mockFs.readFile).toHaveBeenCalledWith('./data/project-states.json', 'utf-8');
      expect(loggerService.info).toHaveBeenCalledWith('Loaded 1 valid project states, skipped 2 invalid states');
      expect(loggerService.warn).toHaveBeenCalledWith('Detected and skipped 2 duplicate project paths');

      // Verify only one project was loaded
      const allStates = projectStateManager.getAllProjectStates();
      expect(allStates.length).toBe(1);
      expect(allStates[0].projectId).toBe('test-project-1');
    });

    it('should handle file system errors', async () => {
      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Call the method and expect error
      await expect(projectStateManager.initialize()).rejects.toThrow('Permission denied');
    });

    it('should skip states with invalid projectPath', async () => {
      const existingStates = [
        {
          projectId: 'test-project-1',
          projectPath: '/test/project1',
          name: 'Test Project 1',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        },
        {
          projectId: 'test-project-2',
          projectPath: '', // Empty projectPath
          name: 'Test Project 2',
          status: 'inactive' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        },
        {
          projectId: 'test-project-3',
          projectPath: '   ', // Whitespace only projectPath
          name: 'Test Project 3',
          status: 'inactive' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        }
      ];

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStates));

      // Call the method
      await projectStateManager.initialize();

      // Verify results - should only load the valid project, skip the invalid ones
      expect(mockFs.readFile).toHaveBeenCalledWith('./data/project-states.json', 'utf-8');
      expect(loggerService.info).toHaveBeenCalledWith('Loaded 1 valid project states, skipped 2 invalid states');

      // Verify only one project was loaded
      const allStates = projectStateManager.getAllProjectStates();
      expect(allStates.length).toBe(1);
      expect(allStates[0].projectId).toBe('test-project-1');
    });

    it('should skip states with missing projectPath', async () => {
      const existingStates = [
        {
          projectId: 'test-project-1',
          projectPath: '/test/project1',
          name: 'Test Project 1',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        },
        {
          projectId: 'test-project-2',
          // Missing projectPath
          name: 'Test Project 2',
          status: 'inactive' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: { autoIndex: true, watchChanges: true }
        }
      ];

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStates));

      // Call the method
      await projectStateManager.initialize();

      // Verify results - should only load the valid project, skip the invalid one
      expect(mockFs.readFile).toHaveBeenCalledWith('./data/project-states.json', 'utf-8');
      expect(loggerService.info).toHaveBeenCalledWith('Loaded 1 valid project states, skipped 1 invalid states');

      // Verify only one project was loaded
      const allStates = projectStateManager.getAllProjectStates();
      expect(allStates.length).toBe(1);
      expect(allStates[0].projectId).toBe('test-project-1');
    });
  });

  describe('createOrUpdateProjectState', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();
    });

    it('should create a new project state', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = {
        name: 'Test Project',
        description: 'A test project',
        settings: { autoIndex: false }
      };

      // Mock dependencies
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Call the method
      const result = await projectStateManager.createOrUpdateProjectState(projectPath, options);

      // Verify results
      expect(result.projectId).toBe(projectId);
      expect(result.projectPath).toBe(projectPath);
      expect(result.name).toBe('Test Project');
      expect(result.description).toBe('A test project');
      expect(result.status).toBe('inactive');
      expect(result.settings.autoIndex).toBe(false);
      // collectionInfo 可能在异步更新后才有值，这里不强制检查
      expect(mockFs.writeFile).toHaveBeenCalled();
    });


    it('should update an existing project state', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = {
        name: 'Updated Project',
        settings: { autoIndex: false }
      };

      // Mock dependencies for create
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Create initial state
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project',
        description: 'A test project'
      });

      // Mock dependencies for update
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Call the method
      const result = await projectStateManager.createOrUpdateProjectState(projectPath, {
        ...options,
        allowReindex: true
      });
      // Verify results
      expect(result.name).toBe('Updated Project');
      expect(result.description).toBe('A test project'); // Should remain unchanged
      expect(result.settings.autoIndex).toBe(false);
    });

    it('should handle errors during state creation', async () => {
      const projectPath = '/test/project';

      // Mock dependencies to throw error
      projectIdManager.generateProjectId.mockRejectedValue(new Error('Generation failed'));

      // Call the method and expect error
      await expect(projectStateManager.createOrUpdateProjectState(projectPath)).rejects.toThrow(
        'Generation failed'
      );
    });

    it('should prevent creating project with duplicate projectPath', async () => {
      const projectPath = '/test/project';
      const projectId1 = 'test-project-id-1';
      const projectId2 = 'test-project-id-2';

      // Mock dependencies for first project
      projectIdManager.generateProjectId.mockResolvedValue(projectId1);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId1;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId1) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id-1',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Create first project
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project 1'
      });

      // Mock dependencies for second project (with different projectId but same path)
      projectIdManager.generateProjectId.mockResolvedValue(projectId2);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId1;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId1) return projectPath;
        if (id === projectId2) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id-2',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Try to create second project with same path - should fail
      await expect(projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project 2'
      })).rejects.toThrow(`项目路径 "${projectPath}" 已被项目 "${projectId1}" 使用，不能重复添加`);
    });

    it('should handle different path formats correctly', async () => {
      const projectPath1 = '/test/project';
      const projectPath2 = '/test/project/'; // Same path with trailing slash
      const projectPath3 = '\\test\\project'; // Same path with Windows separators
      const projectId = 'test-project-id';

      // Mock dependencies for first project
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath1 || path === projectPath2 || path === projectPath3) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath1;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Create first project
      await projectStateManager.createOrUpdateProjectState(projectPath1, {
        name: 'Test Project'
      });

      // Mock dependencies for subsequent attempts
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath1 || path === projectPath2 || path === projectPath3) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath1;
        return undefined;
      });

      // Try to create project with same path but different format - should succeed (update existing project)
      const result2 = await projectStateManager.createOrUpdateProjectState(projectPath2, {
        name: 'Test Project 2'
      });
      expect(result2).toBeTruthy();
      expect(result2!.name).toBe('Test Project 2');

      const result3 = await projectStateManager.createOrUpdateProjectState(projectPath3, {
        name: 'Test Project 3'
      });
      expect(result3).toBeTruthy();
      expect(result3!.name).toBe('Test Project 3');
    });
  });

  describe('getProjectState', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create a test project
      projectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === 'test-project-id') return '/test/project';
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should return project state for existing project', () => {
      const projectId = 'test-project-id';

      // Call the method - project was already created in beforeEach
      const result = projectStateManager.getProjectState(projectId);

      // Verify results
      expect(result).toBeTruthy();
      expect(result!.projectId).toBe(projectId);
      // collectionInfo 可能为undefined，这里不强制检查
    });

    it('should return null for non-existent project', () => {
      const projectId = 'non-existent-project';

      // Call the method
      const result = projectStateManager.getProjectState(projectId);

      // Verify results
      expect(result).toBeNull();
    });
  });


  describe('getProjectStateByPath', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create a test project
      projectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === 'test-project-id') return '/test/project';
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should return project state for existing path', () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });

      // Call the method
      const result = projectStateManager.getProjectStateByPath(projectPath);
      // Verify results
      expect(result).toBeTruthy();
      expect(result!.projectPath).toBe(projectPath);
    });

    it('should return null for non-existent path', () => {
      const projectPath = '/non-existent/project';

      // Mock dependencies - for non-existent path, getProjectId should return undefined
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Call the method
      const result = projectStateManager.getProjectStateByPath(projectPath);

      // Verify results
      expect(result).toBeNull();
    });
  });

  describe('deleteProjectState', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create a test project
      projectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should delete project state successfully', async () => {
      const projectId = 'test-project-id';

      // Mock dependencies
      const projectPath = '/test/project';
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });

      // Call the method
      const result = await projectStateManager.deleteProjectState(projectId);

      // Verify results
      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

      // Mock dependencies - for non-existent project, getProjectId should return undefined
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Reset the mock call count since beforeEach creates a project
      (mockFs.writeFile as jest.Mock).mockClear();

      // Call the method
      const result = await projectStateManager.deleteProjectState(projectId);

      // Verify results
      expect(result).toBe(false);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('getProjectStats', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create test projects
      projectIdManager.generateProjectId.mockResolvedValueOnce('test-project-id-1').mockResolvedValueOnce('test-project-id-2');
      projectIdManager.getProjectId.mockReturnValue(undefined);
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id-1',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });
      await projectStateManager.createOrUpdateProjectState('/test/project1', {
        name: 'Test Project 1'
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id-2',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });
      await projectStateManager.createOrUpdateProjectState('/test/project2', {
        name: 'Test Project 2'
      });
    });

    it('should return correct project statistics', () => {
      // Call the method
      const stats = projectStateManager.getProjectStats();

      // Verify results
      expect(stats.totalProjects).toBe(2);
      expect(stats.activeProjects).toBe(0);
      expect(stats.indexingProjects).toBe(0);
      expect(stats.totalVectors).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.averageIndexingProgress).toBe(0);
    });
  });


  describe('activateProject', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create a test project
      projectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should activate project successfully', async () => {
      const projectId = 'test-project-id';

      // Mock dependencies
      const projectPath = '/test/project';
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });

      // Call the method
      const result = await projectStateManager.activateProject(projectId);
      // Verify results
      expect(result).toBe(true);

      const state = projectStateManager.getProjectState(projectId);
      expect(state!.status).toBe('active');
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

      // Mock dependencies - for non-existent project, getProjectId should return undefined
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Call the method
      const result = await projectStateManager.activateProject(projectId);

      // Verify results
      expect(result).toBe(false);
    });
  });


  describe('deactivateProject', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create and activate a test project
      const projectPath = '/test/project';
      projectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project'
      });
      const projectId = 'test-project-id';
      projectIdManager.getProjectId.mockReturnValue(projectId);
      await projectStateManager.activateProject(projectId);
    });

    it('should deactivate project successfully', async () => {
      const projectId = 'test-project-id';

      // Mock dependencies
      const projectPath = '/test/project';
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });

      // Call the method
      const result = await projectStateManager.deactivateProject(projectId);
      // Verify results
      expect(result).toBe(true);

      const state = projectStateManager.getProjectState(projectId);
      expect(state!.status).toBe('inactive');
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

      // Mock dependencies - for non-existent project, getProjectId should return undefined
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Call the method
      const result = await projectStateManager.deactivateProject(projectId);

      // Verify results
      expect(result).toBe(false);
    });
  });


  describe('refreshProjectState', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create a test project
      projectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should refresh project state successfully', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/test/project';

      // Mock dependencies
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Call the method
      const result = await projectStateManager.refreshProjectState(projectId);
      // Verify results
      expect(result).toBeTruthy();
      expect(result!.collectionInfo).toEqual({
        name: 'project-test-project-id',
        vectorsCount: 100,
        status: 'green'
      });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should return null for non-existent project', async () => {
      const projectId = 'non-existent-project';

      // Mock dependencies - for non-existent project, getProjectId should return undefined
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Call the method
      const result = await projectStateManager.refreshProjectState(projectId);

      // Verify results
      expect(result).toBeNull();
    });
  });

  describe('reindex scenarios', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();
    });

    it('should allow creating project with same path when allowReindex is true', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies for first project
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Create first project
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project 1'
      });

      // Mock dependencies for second project (with allowReindex flag)
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Try to create second project with same path but allowReindex flag - should succeed
      const resultProjectId = await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project 2',
        allowReindex: true
      });

      // Should return the same project ID since it's the same project path
      expect(resultProjectId.projectId).toBe(projectId);

      // Verify the project was updated
      const state = projectStateManager.getProjectState(projectId);
      expect(state).toBeTruthy();
      expect(state!.name).toBe('Test Project 2');
    });

    it('should update existing project when allowReindex is true', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies for first project
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return undefined;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Create first project
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Original Project',
        settings: {
          autoIndex: true,
          watchChanges: false
        }
      });

      // Mock dependencies for update (with allowReindex flag)
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Update project with allowReindex flag
      const updatedProjectId = await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Updated Project',
        settings: {
          autoIndex: false,
          watchChanges: true
        },
        allowReindex: true
      });

      // Should return the same project ID
      expect(updatedProjectId.projectId).toBe(projectId);

      // Get the updated project state
      const updatedState = projectStateManager.getProjectState(projectId);
      expect(updatedState).toBeTruthy();
      expect(updatedState!.name).toBe('Updated Project');
      expect(updatedState!.settings.autoIndex).toBe(false);
      expect(updatedState!.settings.watchChanges).toBe(true);
    });

    it('should still prevent duplicate projects when allowReindex is false', async () => {
      const projectPath = '/test/project';
      const projectId1 = 'test-project-id-1';
      const projectId2 = 'test-project-id-2';

      // Mock dependencies for first project
      projectIdManager.generateProjectId.mockResolvedValue(projectId1);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return undefined;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId1) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id-1',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Create first project
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project 1'
      });

      // Mock dependencies for second project (without allowReindex flag)
      projectIdManager.generateProjectId.mockResolvedValue(projectId2);
      projectIdManager.getProjectId.mockImplementation((path) => {
        if (path === projectPath) return projectId1;
        return undefined;
      });
      projectIdManager.getProjectPath.mockImplementation((id) => {
        if (id === projectId1) return projectPath;
        if (id === projectId2) return projectPath;
        return undefined;
      });
      qdrantService.getCollectionInfoForProject.mockResolvedValue({
        name: 'project-test-project-id-2',
        vectors: {
          size: 1536,
          distance: 'Cosine'
        },
        pointsCount: 100,
        status: 'green'
      });

      // Try to create second project with same path without allowReindex flag - should fail
      await expect(projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project 2'
      })).rejects.toThrow(`项目路径 "${projectPath}" 已被项目 "${projectId1}" 使用，不能重复添加`);
    });
  });
});