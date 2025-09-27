import { IndexSyncService } from '../../service/index/IndexSyncService';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';
import { FileSystemTraversal } from '../../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../service/filesystem/ChangeDetectionService';
import { QdrantService } from '../../database/QdrantService';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { diContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import fs from 'fs/promises';
import path from 'path';

// Mock external dependencies
jest.mock('../../embedders/EmbedderFactory');
jest.mock('../../database/QdrantService');

describe('Filesystem-Qdrant Integration', () => {
  let tempDir: string;
  let indexSyncService: IndexSyncService;
  let projectStateManager: ProjectStateManager;
  let fileSystemTraversal: FileSystemTraversal;
  let fileWatcherService: FileWatcherService;
  let changeDetectionService: ChangeDetectionService;
  let qdrantService: jest.Mocked<QdrantService>;
  let projectIdManager: ProjectIdManager;
  let embedderFactory: jest.Mocked<EmbedderFactory>;
  let embeddingCacheService: EmbeddingCacheService;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, 'temp-test-files');
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get service instances from DI container
    loggerService = diContainer.get<LoggerService>(TYPES.LoggerService);
    errorHandlerService = diContainer.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
    configService = diContainer.get<ConfigService>(TYPES.ConfigService);
    projectIdManager = diContainer.get<ProjectIdManager>(TYPES.ProjectIdManager);
    fileSystemTraversal = diContainer.get<FileSystemTraversal>(TYPES.FileSystemTraversal);
    fileWatcherService = diContainer.get<FileWatcherService>(TYPES.FileWatcherService);
    changeDetectionService = diContainer.get<ChangeDetectionService>(TYPES.ChangeDetectionService);
    qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService) as jest.Mocked<QdrantService>;
    embedderFactory = diContainer.get<EmbedderFactory>(TYPES.EmbedderFactory) as jest.Mocked<EmbedderFactory>;
    embeddingCacheService = diContainer.get<EmbeddingCacheService>(TYPES.EmbeddingCacheService);
    indexSyncService = diContainer.get<IndexSyncService>(TYPES.IndexSyncService);
    projectStateManager = diContainer.get<ProjectStateManager>(TYPES.ProjectStateManager);

    // Initialize services
    await projectStateManager.initialize();

    // Mock Qdrant service methods
    qdrantService.createCollectionForProject.mockResolvedValue(true);
    qdrantService.upsertVectorsForProject.mockResolvedValue(true);
    qdrantService.getCollectionInfoForProject.mockResolvedValue({
      name: 'test-collection',
      vectors: { size: 1536, distance: 'Cosine' },
      pointsCount: 0,
      status: 'green'
    });
    qdrantService.getChunkIdsByFiles.mockResolvedValue([]);
    qdrantService.deletePoints.mockResolvedValue(true);

    // Mock embedder factory methods
    embedderFactory.embed.mockResolvedValue({
      vector: [0.1, 0.2, 0.3],
      dimensions: 1536,
      model: 'test-model',
      processingTime: 100
    });
  });

  describe('Project Indexing Workflow', () => {
    it('should successfully index a project and track its state', async () => {
      // Create test files
      const testFile1 = path.join(tempDir, 'test1.js');
      const testFile2 = path.join(tempDir, 'test2.py');
      await fs.writeFile(testFile1, 'console.log("Hello, world!");');
      await fs.writeFile(testFile2, 'print("Hello, world!")');

      // Start indexing the project
      const projectId = await indexSyncService.startIndexing(tempDir);

      // Verify project was created in state manager
      let projectState = projectStateManager.getProjectStateByPath(tempDir);
      expect(projectState).toBeTruthy();
      expect(projectState!.status).toBe('indexing');
      expect(projectState!.projectId).toBe(projectId);

      // Wait for indexing to complete (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify project state after indexing
      projectState = projectStateManager.getProjectStateByPath(tempDir);
      expect(projectState!.status).toBe('active');
      expect(projectState!.lastIndexedAt).toBeTruthy();

      // Verify Qdrant service was called
      expect(qdrantService.createCollectionForProject).toHaveBeenCalledWith(tempDir, 1536, 'Cosine');
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalled();
    });

    it('should handle file changes and update index accordingly', async () => {
      // Create initial test file
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("Initial content");');

      // Start indexing the project
      const projectId = await indexSyncService.startIndexing(tempDir);

      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Modify the file
      await fs.writeFile(testFile, 'console.log("Modified content");');

      // Wait for file watcher to detect changes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Qdrant service was called again for the updated file
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalledTimes(2);

      // Delete the file
      await fs.unlink(testFile);

      // Wait for file watcher to detect deletion
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Qdrant service was called to delete the file's vectors
      expect(qdrantService.deletePoints).toHaveBeenCalled();
    });

    it('should handle indexing errors gracefully', async () => {
      // Create test file
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("Hello, world!");');

      // Mock Qdrant service to throw error during upsert
      qdrantService.upsertVectorsForProject.mockRejectedValueOnce(new Error('Qdrant connection failed'));

      // Start indexing the project
      const projectId = await indexSyncService.startIndexing(tempDir);

      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify project state reflects the error
      const projectState = projectStateManager.getProjectStateByPath(tempDir);
      expect(projectState!.status).toBe('active'); // Should recover from error
      expect(projectState!.metadata?.lastError).toContain('Qdrant connection failed');
    });
  });

  describe('Project State Management', () => {
    it('should track project statistics correctly', async () => {
      // Create multiple test projects
      const projectDir1 = path.join(tempDir, 'project1');
      const projectDir2 = path.join(tempDir, 'project2');
      await fs.mkdir(projectDir1, { recursive: true });
      await fs.mkdir(projectDir2, { recursive: true });

      // Create test files in each project
      await fs.writeFile(path.join(projectDir1, 'test.js'), 'console.log("Project 1");');
      await fs.writeFile(path.join(projectDir2, 'test.py'), 'print("Project 2");');

      // Index both projects
      await indexSyncService.startIndexing(projectDir1);
      await indexSyncService.startIndexing(projectDir2);

      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get project statistics
      const stats = projectStateManager.getProjectStats();

      // Verify statistics
      expect(stats.totalProjects).toBe(2);
      expect(stats.activeProjects).toBe(2);
      expect(stats.indexingProjects).toBe(0);
    });

    it('should allow project activation and deactivation', async () => {
      // Create test project
      const projectDir = path.join(tempDir, 'test-project');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'test.js'), 'console.log("Test project");');

      // Index the project
      const projectId = await indexSyncService.startIndexing(projectDir);

      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Deactivate the project
      const deactivated = await projectStateManager.deactivateProject(projectId);
      expect(deactivated).toBe(true);

      let projectState = projectStateManager.getProjectState(projectId);
      expect(projectState!.status).toBe('inactive');

      // Reactivate the project
      const activated = await projectStateManager.activateProject(projectId);
      expect(activated).toBe(true);

      projectState = projectStateManager.getProjectState(projectId);
      expect(projectState!.status).toBe('active');
    });

    it('should persist project states across restarts', async () => {
      // Create test project
      const projectDir = path.join(tempDir, 'persistent-project');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'test.js'), 'console.log("Persistent project");');

      // Index the project
      const projectId = await indexSyncService.startIndexing(projectDir);

      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update project metadata
      await projectStateManager.createOrUpdateProjectState(projectDir, {
        metadata: { customField: 'customValue' }
      });

      // Get current state
      const originalState = projectStateManager.getProjectState(projectId);
      expect(originalState!.metadata?.customField).toBe('customValue');

      // Simulate service restart by creating a new project state manager
      const newProjectStateManager = new ProjectStateManager(
        loggerService,
        errorHandlerService,
        projectIdManager,
        indexSyncService,
        qdrantService,
        configService
      );

      // Initialize the new manager
      await newProjectStateManager.initialize();

      // Verify state was persisted
      const persistedState = newProjectStateManager.getProjectState(projectId);
      expect(persistedState).toBeTruthy();
      expect(persistedState!.metadata?.customField).toBe('customValue');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle large files efficiently', async () => {
      // Create a large test file (simulate with smaller file for testing)
      const largeFile = path.join(tempDir, 'large-file.js');
      const largeContent = Array(100).fill('console.log("This is a large file");\n').join('');
      await fs.writeFile(largeFile, largeContent);

      // Mock embedder to simulate processing time
      embedderFactory.embed.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate processing delay
        return {
          vector: [0.1, 0.2, 0.3],
          dimensions: 1536,
          model: 'test-model',
          processingTime: 100
        };
      });

      // Start indexing with small batch size
      const startTime = Date.now();
      await indexSyncService.startIndexing(tempDir, { batchSize: 1 });
      const endTime = Date.now();

      // Verify indexing completed in reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify all chunks were processed
      expect(embedderFactory.embed).toHaveBeenCalledTimes(100); // 100 lines, 1 line per chunk
    });

    it('should handle concurrent indexing requests', async () => {
      // Create multiple test projects
      const projectDirs = [
        path.join(tempDir, 'concurrent-project-1'),
        path.join(tempDir, 'concurrent-project-2'),
        path.join(tempDir, 'concurrent-project-3')
      ];

      for (const dir of projectDirs) {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'test.js'), 'console.log("Concurrent project");');
      }

      // Start indexing all projects concurrently
      const indexingPromises = projectDirs.map(dir =>
        indexSyncService.startIndexing(dir)
      );

      // Wait for all indexing to complete
      const projectIds = await Promise.all(indexingPromises);

      // Verify all projects were indexed
      expect(projectIds).toHaveLength(3);
      for (const projectId of projectIds) {
        const projectState = projectStateManager.getProjectState(projectId);
        expect(projectState).toBeTruthy();
        expect(projectState!.status).toBe('active');
      }
    });

    it('should recover from temporary Qdrant failures', async () => {
      // Create test file
      const testFile = path.join(tempDir, 'resilient-test.js');
      await fs.writeFile(testFile, 'console.log("Resilient test");');

      // Mock Qdrant to fail on first call, succeed on subsequent calls
      let callCount = 0;
      qdrantService.upsertVectorsForProject.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary Qdrant failure');
        }
        return true;
      });

      // Start indexing the project
      const projectId = await indexSyncService.startIndexing(tempDir);

      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify project was eventually indexed despite initial failure
      const projectState = projectStateManager.getProjectStateByPath(tempDir);
      expect(projectState!.status).toBe('active');
      expect(callCount).toBeGreaterThan(1); // Should have retried after failure
    });
  });
});