import { ProjectStateManager } from '../ProjectStateManager';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { IndexSyncService } from '../../index/IndexSyncService';
import { QdrantService } from '../../../database/QdrantService';
import { ConfigService } from '../../../config/ConfigService';
import { diContainer } from '../../../core/DIContainer';
import { TYPES } from '../../../types';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../filesystem/ChangeDetectionService';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { PerformanceOptimizerService } from '../../resilience/ResilientBatchingService';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../index/IndexSyncService');
jest.mock('../../../database/QdrantService');
jest.mock('../../../config/ConfigService');
jest.mock('fs/promises');

describe('ProjectStateManager', () => {
  let projectStateManager: ProjectStateManager;
  let loggerService: jest.Mocked<LoggerService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let indexSyncService: jest.Mocked<IndexSyncService>;
  let qdrantService: jest.Mocked<QdrantService>;
  let configService: jest.Mocked<ConfigService>;
  let mockFs: jest.Mocked<typeof import('fs/promises')>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get mock instances
    loggerService = new LoggerService(configService) as jest.Mocked<LoggerService>;
    errorHandlerService = new ErrorHandlerService(loggerService) as jest.Mocked<ErrorHandlerService>;
    projectIdManager = new ProjectIdManager() as jest.Mocked<ProjectIdManager>;
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
    
    indexSyncService = new IndexSyncService(
      loggerService,
      errorHandlerService,
      mockFileSystemTraversal,
      mockFileWatcherService,
      mockChangeDetectionService,
      qdrantService,
      projectIdManager,
      mockEmbedderFactory,
      mockEmbeddingCacheService,
      mockPerformanceOptimizerService
    ) as jest.Mocked<IndexSyncService>;
    qdrantService = new QdrantService(
      configService,
      loggerService,
      errorHandlerService,
      projectIdManager
    ) as jest.Mocked<QdrantService>;
    configService = ConfigService.getInstance() as jest.Mocked<ConfigService>;
    mockFs = require('fs/promises') as jest.Mocked<typeof import('fs/promises')>;

    // Mock config service
    configService.get.mockReturnValue({});

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
      expect(loggerService.info).toHaveBeenCalledWith('Project state manager initialized');
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
      expect(loggerService.info).toHaveBeenCalledWith('Loaded 1 project states');
    });

    it('should handle file system errors', async () => {
      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Call the method and expect error
      await expect(projectStateManager.initialize()).rejects.toThrow('Permission denied');
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
      expect(result.collectionInfo).toEqual({
        name: 'project-test-project-id',
        vectorsCount: 100,
        status: 'green'
      });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should update an existing project state', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = {
        name: 'Updated Project',
        settings: { autoIndex: false }
      };

      // Create initial state
      await projectStateManager.createOrUpdateProjectState(projectPath, {
        name: 'Test Project',
        description: 'A test project'
      });

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
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
  });

  describe('getProjectState', () => {
    beforeEach(async () => {
      // Initialize the service
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);
      mockFs.writeFile.mockResolvedValue(undefined);
      await projectStateManager.initialize();

      // Create a test project
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should return project state for existing project', () => {
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);

      // Call the method
      const result = projectStateManager.getProjectState(projectId);

      // Verify results
      expect(result).toBeTruthy();
      expect(result!.projectId).toBe(projectId);
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
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should return project state for existing path', () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);

      // Call the method
      const result = projectStateManager.getProjectStateByPath(projectPath);

      // Verify results
      expect(result).toBeTruthy();
      expect(result!.projectPath).toBe(projectPath);
    });

    it('should return null for non-existent path', () => {
      const projectPath = '/non-existent/project';

      // Mock dependencies
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
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should delete project state successfully', async () => {
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);

      // Call the method
      const result = await projectStateManager.deleteProjectState(projectId);

      // Verify results
      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

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
      await projectStateManager.createOrUpdateProjectState('/test/project1', {
        name: 'Test Project 1'
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
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should activate project successfully', async () => {
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);

      // Call the method
      const result = await projectStateManager.activateProject(projectId);

      // Verify results
      expect(result).toBe(true);
      
      const state = projectStateManager.getProjectState(projectId);
      expect(state!.status).toBe('active');
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

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
      projectIdManager.getProjectId.mockReturnValue(projectId);

      // Call the method
      const result = await projectStateManager.deactivateProject(projectId);

      // Verify results
      expect(result).toBe(true);
      
      const state = projectStateManager.getProjectState(projectId);
      expect(state!.status).toBe('inactive');
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

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
      await projectStateManager.createOrUpdateProjectState('/test/project', {
        name: 'Test Project'
      });
    });

    it('should refresh project state successfully', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/test/project';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      projectIdManager.getProjectPath.mockReturnValue(projectPath);
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

      // Call the method
      const result = await projectStateManager.refreshProjectState(projectId);

      // Verify results
      expect(result).toBeNull();
    });
  });
});