import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { GraphIndexService } from '../GraphIndexService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../../project/ProjectStateManager';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { IGraphDataService } from '../../graph/core/IGraphDataService';
import { NebulaProjectManager } from '../../../database/nebula/NebulaProjectManager';
import { VectorIndexService } from '../VectorIndexService';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { IGraphIndexPerformanceMonitor } from '../../../infrastructure/monitoring/GraphIndexMetrics';
import { IndexServiceError, IndexServiceErrorType } from '../errors/IndexServiceErrors';
import { IGraphConstructionService } from '../../graph/construction/IGraphConstructionService';

describe('GraphIndexService', () => {
  let container: Container;
  let graphIndexService: GraphIndexService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockProjectStateManager: jest.Mocked<ProjectStateManager>;
  let mockProjectIdManager: jest.Mocked<ProjectIdManager>;
  let mockGraphDataService: jest.Mocked<IGraphDataService>;
  let mockNebulaProjectManager: jest.Mocked<NebulaProjectManager>;
  let mockIndexService: jest.Mocked<VectorIndexService>;
  let mockFileTraversalService: jest.Mocked<FileSystemTraversal>;
  let mockBatchProcessor: jest.Mocked<BatchProcessingService>;
  let mockPerformanceMonitor: jest.Mocked<IGraphIndexPerformanceMonitor>;
  let mockGraphConstructionService: jest.Mocked<IGraphConstructionService>;

  beforeEach(() => {
    container = new Container();

    // 创建模拟对象
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    mockProjectStateManager = {
      startGraphIndexing: jest.fn(),
      updateGraphIndexingProgress: jest.fn(),
      completeGraphIndexing: jest.fn(),
      failGraphIndexing: jest.fn(),
      getGraphStatus: jest.fn()
    } as any;

    mockProjectIdManager = {
      generateProjectId: jest.fn(),
      getProjectId: jest.fn(),
      getProjectPath: jest.fn(),
      updateProjectTimestamp: jest.fn(),
      saveMapping: jest.fn()
    } as any;

    mockGraphDataService = {
      storeParsedFiles: jest.fn(),
      isServiceInitialized: jest.fn().mockReturnValue(true)
    } as any;

    mockNebulaProjectManager = {
      createSpaceForProject: jest.fn().mockResolvedValue(true),
      clearSpaceForProject: jest.fn().mockResolvedValue(true)
    } as any;

    mockIndexService = {
      startIndexing: jest.fn(),
      stopIndexing: jest.fn(),
      getIndexStatus: jest.fn(),
      reindexProject: jest.fn()
    } as any;

    mockFileTraversalService = {
      traverseDirectory: jest.fn()
    } as any;

    mockBatchProcessor = {
      processBatches: jest.fn()
    } as any;

    mockPerformanceMonitor = {
      recordMetric: jest.fn(),
      getPerformanceStats: jest.fn(),
      getAllPerformanceStats: jest.fn(),
      clearProjectStats: jest.fn(),
      clearAllStats: jest.fn()
    } as any;

    mockGraphConstructionService = {
      buildGraphStructure: jest.fn(),
      convertToGraphNodes: jest.fn(),
      convertToGraphRelationships: jest.fn()
    } as any;

    // 绑定依赖
    container.bind(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind(TYPES.ProjectStateManager).toConstantValue(mockProjectStateManager);
    container.bind(TYPES.ProjectIdManager).toConstantValue(mockProjectIdManager);
    container.bind(TYPES.GraphDataService).toConstantValue(mockGraphDataService);
    container.bind(TYPES.INebulaProjectManager).toConstantValue(mockNebulaProjectManager);
    container.bind(TYPES.IndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.FileTraversalService).toConstantValue(mockFileTraversalService);
    container.bind(TYPES.BatchProcessingService).toConstantValue(mockBatchProcessor);
    container.bind(TYPES.GraphIndexPerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind(TYPES.VectorIndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.FileSystemTraversal).toConstantValue(mockFileTraversalService);
    container.bind(TYPES.GraphConstructionService).toConstantValue(mockGraphConstructionService);
    container.bind(TYPES.GraphIndexService).to(GraphIndexService);

    graphIndexService = container.get<GraphIndexService>(TYPES.GraphIndexService);
  });

  describe('startIndexing', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options = { enableGraphIndex: true };

    beforeEach(() => {
      mockProjectIdManager.generateProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getProjectPath.mockReturnValue(projectPath);
      mockFileTraversalService.traverseDirectory.mockResolvedValue({
        files: [
          { path: 'file1.js', relativePath: 'file1.js', name: 'file1.js', extension: '.js', size: 1000, hash: 'hash1', lastModified: new Date(), language: 'javascript', isBinary: false },
          { path: 'file2.ts', relativePath: 'file2.ts', name: 'file2.ts', extension: '.ts', size: 1000, hash: 'hash2', lastModified: new Date(), language: 'typescript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 2000,
        processingTime: 100
      });
      mockProjectStateManager.getGraphStatus.mockReturnValue(null);
    });

    it('should start indexing successfully', async () => {
      const result = await graphIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockProjectStateManager.startGraphIndexing).toHaveBeenCalledWith(projectId, 2);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'startIndexing',
          projectId,
          success: true
        })
      );
    });

    it('should throw error when graph indexing is disabled', async () => {
      const disabledOptions = { enableGraphIndex: false };

      await expect(graphIndexService.startIndexing(projectPath, disabledOptions))
        .rejects.toThrow(IndexServiceError);

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'startIndexing',
          success: false
        })
      );
    });

    it('should throw error when project already indexing', async () => {
      // 模拟项目正在索引
      mockProjectStateManager.getGraphStatus.mockReturnValue({
        status: 'indexing',
        progress: 50,
        lastUpdated: new Date()
      } as any);

      await expect(graphIndexService.startIndexing(projectPath, options))
        .rejects.toThrow(IndexServiceError);
    });

    it('should throw error when no files found', async () => {
      mockFileTraversalService.traverseDirectory.mockResolvedValue({
        files: [],
        directories: [],
        errors: [],
        totalSize: 0,
        processingTime: 0
      });

      await expect(graphIndexService.startIndexing(projectPath, options))
        .rejects.toThrow(IndexServiceError);
    });
  });

  describe('stopIndexing', () => {
    const projectId = 'test-project-id';

    it('should stop indexing successfully', async () => {
      // 模拟有活跃操作
      mockProjectStateManager.getGraphStatus.mockReturnValue({
        status: 'indexing',
        progress: 50,
        lastUpdated: new Date()
      } as any);

      const result = await graphIndexService.stopIndexing(projectId);

      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return false when no active operation', async () => {
      mockProjectStateManager.getGraphStatus.mockReturnValue(null);

      const result = await graphIndexService.stopIndexing(projectId);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // 模拟有活跃操作，这样stopIndexing会尝试更新进度
      mockProjectStateManager.getGraphStatus.mockReturnValue({
        status: 'indexing',
        progress: 50,
        processedFiles: 10,
        failedFiles: 0,
        lastUpdated: new Date()
      } as any);
      
      mockProjectStateManager.updateGraphIndexingProgress.mockRejectedValue(new Error('Test error'));

      const result = await graphIndexService.stopIndexing(projectId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getIndexStatus', () => {
    const projectId = 'test-project-id';
    const projectPath = '/test/project';

    beforeEach(() => {
      mockProjectIdManager.getProjectPath.mockReturnValue(projectPath);
    });

    it('should return status when project exists', () => {
      const mockStatus = {
        status: 'completed' as const,
        progress: 100,
        totalFiles: 10,
        processedFiles: 10,
        failedFiles: 0,
        lastUpdated: new Date(),
        lastCompleted: new Date()
      };

      mockProjectStateManager.getGraphStatus.mockReturnValue(mockStatus);

      const result = graphIndexService.getIndexStatus(projectId);

      expect(result).toEqual({
        projectId,
        projectPath,
        isIndexing: false,
        lastIndexed: mockStatus.lastCompleted,
        totalFiles: 10,
        indexedFiles: 10,
        failedFiles: 0,
        progress: 100,
        serviceType: 'graph',
        error: undefined
      });
    });

    it('should return null when project does not exist', () => {
      mockProjectStateManager.getGraphStatus.mockReturnValue(null);

      const result = graphIndexService.getIndexStatus(projectId);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      mockProjectStateManager.getGraphStatus.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = graphIndexService.getIndexStatus(projectId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('reindexProject', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options = { enableGraphIndex: true };

    beforeEach(() => {
      mockProjectIdManager.getProjectId.mockReturnValue(projectId);
      mockProjectIdManager.getProjectPath.mockReturnValue(projectPath);
      mockNebulaProjectManager.clearSpaceForProject.mockResolvedValue(true);
    });

    it('should reindex project successfully', async () => {
      mockProjectStateManager.getGraphStatus.mockReturnValue(null);
      mockProjectIdManager.generateProjectId.mockResolvedValue(projectId);
      mockFileTraversalService.traverseDirectory.mockResolvedValue({
        files: [
          { path: 'file1.js', relativePath: 'file1.js', name: 'file1.js', extension: '.js', size: 1000, hash: 'hash1', lastModified: new Date(), language: 'javascript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 1000,
        processingTime: 50
      });

      const result = await graphIndexService.reindexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockNebulaProjectManager.clearSpaceForProject).toHaveBeenCalledWith(projectPath);
    });

    it('should handle new project', async () => {
      mockProjectIdManager.getProjectId.mockReturnValue(undefined);
      mockProjectIdManager.generateProjectId.mockResolvedValue(projectId);
      mockFileTraversalService.traverseDirectory.mockResolvedValue({
        files: [
          { path: 'file1.js', relativePath: 'file1.js', name: 'file1.js', extension: '.js', size: 1000, hash: 'hash1', lastModified: new Date(), language: 'javascript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 1000,
        processingTime: 50
      });

      const result = await graphIndexService.reindexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockNebulaProjectManager.clearSpaceForProject).not.toHaveBeenCalled();
    });
  });

  describe('getLanguageFromPath', () => {
    it('should return correct language for known extensions', () => {
      expect((graphIndexService as any).getLanguageFromPath('test.js')).toBe('javascript');
      expect((graphIndexService as any).getLanguageFromPath('test.ts')).toBe('typescript');
      expect((graphIndexService as any).getLanguageFromPath('test.py')).toBe('python');
      expect((graphIndexService as any).getLanguageFromPath('test.java')).toBe('java');
    });

    it('should return unknown for unknown extensions', () => {
      expect((graphIndexService as any).getLanguageFromPath('test.unknown')).toBe('unknown');
      expect((graphIndexService as any).getLanguageFromPath('test')).toBe('unknown');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage information', () => {
      const memoryUsage = (graphIndexService as any).getMemoryUsage();

      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('percentage');
      expect(memoryUsage.percentage).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.percentage).toBeLessThanOrEqual(1);
    });
  });
});