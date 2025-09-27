import { IndexSyncService } from '../IndexSyncService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../filesystem/ChangeDetectionService';
import { QdrantService } from '../../../database/QdrantService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { diContainer } from '../../../core/DIContainer';
import { TYPES } from '../../../types';
import { PerformanceOptimizerService } from '../../resilience/ResilientBatchingService';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../filesystem/FileSystemTraversal');
jest.mock('../../filesystem/FileWatcherService');
jest.mock('../../filesystem/ChangeDetectionService');
jest.mock('../../../database/QdrantService');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../../embedders/EmbedderFactory');
jest.mock('../../../embedders/EmbeddingCacheService');
jest.mock('../../performance/PerformanceOptimizerService');

describe('IndexSyncService', () => {
  let indexSyncService: IndexSyncService;
  let loggerService: jest.Mocked<LoggerService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let fileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let fileWatcherService: jest.Mocked<FileWatcherService>;
  let changeDetectionService: jest.Mocked<ChangeDetectionService>;
  let qdrantService: jest.Mocked<QdrantService>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let embedderFactory: jest.Mocked<EmbedderFactory>;
  let embeddingCacheService: jest.Mocked<EmbeddingCacheService>;
  let performanceOptimizerService: jest.Mocked<PerformanceOptimizerService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get mock instances
    loggerService = new LoggerService() as jest.Mocked<LoggerService>;
    errorHandlerService = new ErrorHandlerService() as jest.Mocked<ErrorHandlerService>;
    fileSystemTraversal = new FileSystemTraversal(
      loggerService,
      errorHandlerService,
      diContainer
    ) as jest.Mocked<FileSystemTraversal>;
    fileWatcherService = new FileWatcherService(
      loggerService,
      errorHandlerService,
      changeDetectionService
    ) as jest.Mocked<FileWatcherService>;
    changeDetectionService = new ChangeDetectionService(
      loggerService,
      errorHandlerService,
      fileWatcherService
    ) as jest.Mocked<ChangeDetectionService>;
    qdrantService = new QdrantService(
      diContainer.get(TYPES.ConfigService),
      loggerService,
      errorHandlerService,
      projectIdManager
    ) as jest.Mocked<QdrantService>;
    projectIdManager = new ProjectIdManager(
      loggerService,
      errorHandlerService,
      diContainer.get(TYPES.ConfigService)
    ) as jest.Mocked<ProjectIdManager>;
    embedderFactory = new EmbedderFactory(
      loggerService,
      errorHandlerService,
      embeddingCacheService
    ) as jest.Mocked<EmbedderFactory>;
    embeddingCacheService = new EmbeddingCacheService(
      loggerService,
      errorHandlerService
    ) as jest.Mocked<EmbeddingCacheService>;

    performanceOptimizerService = new PerformanceOptimizerService(
      loggerService,
      errorHandlerService
    ) as jest.Mocked<PerformanceOptimizerService>;

    // Create service instance
    indexSyncService = new IndexSyncService(
      loggerService,
      errorHandlerService,
      fileSystemTraversal,
      fileWatcherService,
      changeDetectionService,
      qdrantService,
      projectIdManager,
      embedderFactory,
      embeddingCacheService,
      performanceOptimizerService
    );
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
      const result = await indexSyncService.startIndexing(projectPath, options);

      // Verify results
      expect(result).toBe(projectId);
      expect(projectIdManager.generateProjectId).toHaveBeenCalledWith(projectPath);
      expect(qdrantService.createCollectionForProject).toHaveBeenCalledWith(
        projectPath,
        1536,
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
      await indexSyncService.startIndexing(projectPath);

      // Try to start indexing again
      await expect(indexSyncService.startIndexing(projectPath)).rejects.toThrow(
        `Project ${projectId} is already being indexed`
      );
    });

    it('should throw error if collection creation fails', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      qdrantService.createCollectionForProject.mockResolvedValue(false);

      // Call the method and expect error
      await expect(indexSyncService.startIndexing(projectPath)).rejects.toThrow(
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
      indexSyncService.indexFile = jest.fn().mockResolvedValue(undefined);

      // Simulate file added event
      await (indexSyncService as any).handleFileChange(filePath, projectPath, 'added');

      // Verify results
      expect(indexSyncService.indexFile).toHaveBeenCalledWith(projectPath, filePath);
      expect(projectIdManager.updateProjectTimestamp).toHaveBeenCalledWith(projectId);
    });

    it('should handle file deleted event', async () => {
      const filePath = '/test/project/file.js';
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      indexSyncService.removeFileFromIndex = jest.fn().mockResolvedValue(undefined);

      // Simulate file deleted event
      await (indexSyncService as any).handleFileChange(filePath, projectPath, 'deleted');

      // Verify results
      expect(indexSyncService.removeFileFromIndex).toHaveBeenCalledWith(projectPath, filePath);
      expect(projectIdManager.updateProjectTimestamp).toHaveBeenCalledWith(projectId);
    });

    it('should log warning if project ID not found', async () => {
      const filePath = '/test/project/file.js';
      const projectPath = '/test/project';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Simulate file change event
      await (indexSyncService as any).handleFileChange(filePath, projectPath, 'added');

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
      const fileContent = 'console.log("Hello, world!");';
      const chunks = [
        {
          content: fileContent,
          filePath,
          startLine: 1,
          endLine: 1,
          language: 'javascript',
          chunkType: 'code'
        }
      ];
      const vectorPoints = [
        {
          id: `${filePath}:1-1`,
          vector: [0.1, 0.2, 0.3],
          payload: {
            content: fileContent,
            filePath,
            language: 'javascript',
            chunkType: 'code',
            startLine: 1,
            endLine: 1,
            timestamp: new Date(),
            projectId: 'test-project-id'
          }
        }
      ];

      // Mock dependencies
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(fileContent);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);

      // Mock chunking and conversion methods
      jest.spyOn(indexSyncService as any, 'chunkFile').mockReturnValue(chunks);
      jest.spyOn(indexSyncService as any, 'convertChunksToVectorPoints').mockResolvedValue(vectorPoints);
      projectIdManager.getProjectId.mockReturnValue('test-project-id');

      // Call the method
      await indexSyncService.indexFile(projectPath, filePath);

      // Verify results
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalledWith(projectPath, vectorPoints);
    });

    it('should throw error if file reading fails', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';

      // Mock dependencies
      jest.spyOn(require('fs/promises'), 'readFile').mockRejectedValue(new Error('File not found'));

      // Call the method and expect error
      await expect(indexSyncService.indexFile(projectPath, filePath)).rejects.toThrow(
        'File not found'
      );
    });

    it('should throw error if vector upsert fails', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const fileContent = 'console.log("Hello, world!");';

      // Mock dependencies
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(fileContent);
      qdrantService.upsertVectorsForProject.mockResolvedValue(false);

      // Mock chunking and conversion methods
      jest.spyOn(indexSyncService as any, 'chunkFile').mockReturnValue([
        {
          content: fileContent,
          filePath,
          startLine: 1,
          endLine: 1,
          language: 'javascript',
          chunkType: 'code'
        }
      ]);
      jest.spyOn(indexSyncService as any, 'convertChunksToVectorPoints').mockResolvedValue([
        {
          id: `${filePath}:1-1`,
          vector: [0.1, 0.2, 0.3],
          payload: {
            content: fileContent,
            filePath,
            language: 'javascript',
            chunkType: 'code',
            startLine: 1,
            endLine: 1,
            timestamp: new Date(),
            projectId: 'test-project-id'
          }
        }
      ]);
      projectIdManager.getProjectId.mockReturnValue('test-project-id');

      // Call the method and expect error
      await expect(indexSyncService.indexFile(projectPath, filePath)).rejects.toThrow(
        `Failed to upsert vectors for file: ${filePath}`
      );
    });
  });

  describe('removeFileFromIndex', () => {
    it('should remove file from index successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const projectId = 'test-project-id';
      const collectionName = 'project-test-project-id';
      const chunkIds = [`${filePath}:1-1`];

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      projectIdManager.getCollectionName.mockReturnValue(collectionName);
      qdrantService.getChunkIdsByFiles.mockResolvedValue(chunkIds);
      qdrantService.deletePoints.mockResolvedValue(true);

      // Call the method
      await indexSyncService.removeFileFromIndex(projectPath, filePath);

      // Verify results
      expect(qdrantService.getChunkIdsByFiles).toHaveBeenCalledWith(collectionName, [filePath]);
      expect(qdrantService.deletePoints).toHaveBeenCalledWith(collectionName, chunkIds);
    });

    it('should throw error if project ID not found', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(undefined);

      // Call the method and expect error
      await expect(indexSyncService.removeFileFromIndex(projectPath, filePath)).rejects.toThrow(
        `Project ID not found for path: ${projectPath}`
      );
    });

    it('should throw error if collection name not found', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const projectId = 'test-project-id';

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      projectIdManager.getCollectionName.mockReturnValue(undefined);

      // Call the method and expect error
      await expect(indexSyncService.removeFileFromIndex(projectPath, filePath)).rejects.toThrow(
        `Collection name not found for project: ${projectId}`
      );
    });
  });

  describe('chunkFile', () => {
    it('should chunk file content correctly', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      const filePath = '/test/project/file.js';

      // Call the method
      const chunks = (indexSyncService as any).chunkFile(content, filePath);

      // Verify results
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].filePath).toBe(filePath);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(5);
      expect(chunks[0].language).toBe('javascript');
      expect(chunks[0].chunkType).toBe('code');
    });

    it('should detect language correctly', () => {
      const filePath = '/test/project/file.py';

      // Call the method
      const language = (indexSyncService as any).detectLanguage(filePath);

      // Verify results
      expect(language).toBe('python');
    });

    it('should return unknown for unsupported file types', () => {
      const filePath = '/test/project/file.xyz';

      // Call the method
      const language = (indexSyncService as any).detectLanguage(filePath);

      // Verify results
      expect(language).toBe('unknown');
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
      (indexSyncService as any).indexingProjects.set(projectId, expectedStatus);

      // Call the method
      const status = indexSyncService.getIndexStatus(projectId);

      // Verify results
      expect(status).toEqual(expectedStatus);
    });

    it('should return null for non-existent project', () => {
      const projectId = 'non-existent-project';

      // Call the method
      const status = indexSyncService.getIndexStatus(projectId);

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
      (indexSyncService as any).indexingProjects.set(projectId, status);
      (indexSyncService as any).indexingQueue = [{ projectPath }];

      // Call the method
      const result = await indexSyncService.stopIndexing(projectId);

      // Verify results
      expect(result).toBe(true);
      expect(status.isIndexing).toBe(false);
      expect((indexSyncService as any).indexingQueue).toHaveLength(0);
    });

    it('should return false for non-existent project', async () => {
      const projectId = 'non-existent-project';

      // Call the method
      const result = await indexSyncService.stopIndexing(projectId);

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
      indexSyncService.startIndexing = jest.fn().mockResolvedValue(projectId);

      // Call the method
      const result = await indexSyncService.reindexProject(projectPath, options);

      // Verify results
      expect(result).toBe(projectId);
      expect(qdrantService.deleteCollectionForProject).toHaveBeenCalledWith(projectPath);
      expect(indexSyncService.startIndexing).toHaveBeenCalledWith(projectPath, options);
    });

    it('should start indexing if project does not exist', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const options = { batchSize: 5 };

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(undefined);
      indexSyncService.startIndexing = jest.fn().mockResolvedValue(projectId);

      // Call the method
      const result = await indexSyncService.reindexProject(projectPath, options);

      // Verify results
      expect(result).toBe(projectId);
      expect(qdrantService.deleteCollectionForProject).not.toHaveBeenCalled();
      expect(indexSyncService.startIndexing).toHaveBeenCalledWith(projectPath, options);
    });
  });
});