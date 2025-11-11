import { VectorIndexService } from '../VectorIndexService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../../project/ProjectStateManager';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { QdrantService } from '../../../database/qdrant/QdrantService';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { TYPES } from '../../../types';
import { Container } from 'inversify';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../project/ProjectStateManager');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../../database/qdrant/QdrantService');
jest.mock('../../../embedders/EmbedderFactory');
jest.mock('../../filesystem/FileSystemTraversal');
jest.mock('../../../infrastructure/batching/BatchProcessingService');

describe('VectorIndexService', () => {
  let vectorIndexService: VectorIndexService;
  let loggerService: LoggerService & jest.Mocked<LoggerService>;
  let errorHandlerService: ErrorHandlerService & jest.Mocked<ErrorHandlerService>;
  let projectStateManager: jest.Mocked<ProjectStateManager>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let qdrantService: jest.Mocked<QdrantService>;
  let embedderFactory: jest.Mocked<EmbedderFactory>;
  let fileTraversalService: jest.Mocked<FileSystemTraversal>;
  let batchProcessor: jest.Mocked<BatchProcessingService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    loggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    errorHandlerService = new ErrorHandlerService(loggerService) as jest.Mocked<ErrorHandlerService>;

    projectStateManager = {
      startVectorIndexing: jest.fn(),
      completeVectorIndexing: jest.fn(),
      failVectorIndexing: jest.fn(),
      updateVectorIndexingProgress: jest.fn(),
      getVectorStatus: jest.fn(),
    } as unknown as jest.Mocked<ProjectStateManager>;

    projectIdManager = {
      generateProjectId: jest.fn(),
      getProjectId: jest.fn(),
      getProjectPath: jest.fn(),
    } as unknown as jest.Mocked<ProjectIdManager>;

    qdrantService = {
      createCollectionForProject: jest.fn(),
      deleteCollectionForProject: jest.fn(),
    } as unknown as jest.Mocked<QdrantService>;

    embedderFactory = {
      getDefaultProvider: jest.fn().mockReturnValue('openai'),
      getProviderInfo: jest.fn().mockResolvedValue({
        name: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        available: true
      }),
    } as unknown as jest.Mocked<EmbedderFactory>;


    fileTraversalService = {
      traverseDirectory: jest.fn(),
    } as unknown as jest.Mocked<FileSystemTraversal>;


    batchProcessor = {
      processBatches: jest.fn(),
    } as unknown as jest.Mocked<BatchProcessingService>;

    // Create service instance using DI container
    const testContainer = new Container();
    
    testContainer.bind<LoggerService>(TYPES.LoggerService).toConstantValue(loggerService);
    testContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(errorHandlerService);
    testContainer.bind<ProjectStateManager>(TYPES.ProjectStateManager).toConstantValue(projectStateManager);
    testContainer.bind<ProjectIdManager>(TYPES.ProjectIdManager).toConstantValue(projectIdManager);
    testContainer.bind<QdrantService>(TYPES.QdrantService).toConstantValue(qdrantService);
    testContainer.bind<EmbedderFactory>(TYPES.EmbedderFactory).toConstantValue(embedderFactory);
    testContainer.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).toConstantValue(fileTraversalService);
    testContainer.bind<BatchProcessingService>(TYPES.BatchProcessingService).toConstantValue(batchProcessor);

    testContainer.bind<VectorIndexService>(TYPES.VectorIndexService).to(VectorIndexService).inSingletonScope();

    vectorIndexService = testContainer.get<VectorIndexService>(TYPES.VectorIndexService);
  });

  describe('startIndexing', () => {
    it('should start vector indexing successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectPath.mockReturnValue(projectPath);
      fileTraversalService.traverseDirectory.mockResolvedValue({
        files: [
          { path: '/test/project/file1.js', relativePath: 'file1.js', name: 'file1.js', extension: '.js', size: 1000, hash: 'hash1', lastModified: new Date(), language: 'javascript', isBinary: false },
          { path: '/test/project/file2.js', relativePath: 'file2.js', name: 'file2.js', extension: '.js', size: 1000, hash: 'hash2', lastModified: new Date(), language: 'javascript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 2000,
        processingTime: 100
      });
      qdrantService.createCollectionForProject.mockResolvedValue(true);
      embedderFactory.getDefaultProvider.mockReturnValue('openai');

      const result = await vectorIndexService.startIndexing(projectPath);

      expect(result).toBe(projectId);
      expect(projectIdManager.generateProjectId).toHaveBeenCalledWith(projectPath);
      expect(qdrantService.createCollectionForProject).toHaveBeenCalledWith(projectPath, 1536, 'Cosine');
    });

    it('should throw error if collection creation fails', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      
      projectIdManager.generateProjectId.mockResolvedValue(projectId);
      projectIdManager.getProjectId.mockReturnValue(projectId);
      fileTraversalService.traverseDirectory.mockResolvedValue({
        files: [
          { path: '/test/project/file1.js', relativePath: 'file1.js', name: 'file1.js', extension: '.js', size: 1000, hash: 'hash1', lastModified: new Date(), language: 'javascript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 1000,
        processingTime: 50
      });
      qdrantService.createCollectionForProject.mockResolvedValue(false);

      await expect(vectorIndexService.startIndexing(projectPath)).rejects.toThrow(
        'Failed to create collection for project:'
      );
    });
  });

  describe('stopIndexing', () => {
    it('should return false for non-existent project', async () => {
      const result = await vectorIndexService.stopIndexing('non-existent-project');
      expect(result).toBe(false);
    });
  });

  describe('getIndexStatus', () => {
    it('should return null for non-existent project', () => {
      projectStateManager.getVectorStatus.mockReturnValue(null);
      
      const result = vectorIndexService.getIndexStatus('non-existent-project');
      expect(result).toBeNull();
    });
  });

  describe('reindexProject', () => {
    it('should reindex a project successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      
      projectIdManager.getProjectId.mockReturnValue(projectId);
      qdrantService.deleteCollectionForProject.mockResolvedValue(true);
      vectorIndexService.startIndexing = jest.fn().mockResolvedValue(projectId);

      const result = await vectorIndexService.reindexProject(projectPath);

      expect(result).toBe(projectId);
      expect(qdrantService.deleteCollectionForProject).toHaveBeenCalledWith(projectPath);
      expect(vectorIndexService.startIndexing).toHaveBeenCalledWith(projectPath, undefined);
    });
  });
});