import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { HybridIndexService, IndexType } from '../HybridIndexService';
import { IndexService } from '../IndexService';
import { GraphIndexService } from '../GraphIndexService';
import { IndexServiceType } from '../IIndexService';
import { IndexSyncOptions } from '../IndexService';

describe('HybridIndexService', () => {
  let container: Container;
  let hybridIndexService: HybridIndexService;
  let mockIndexService: jest.Mocked<IndexService>;
  let mockGraphIndexService: jest.Mocked<GraphIndexService>;

  beforeEach(() => {
    container = new Container();

    // 创建模拟对象
    mockIndexService = {
      startIndexing: jest.fn(),
      getIndexStatus: jest.fn(),
      stopIndexing: jest.fn(),
      reindexProject: jest.fn(),
      indexProject: jest.fn()
    } as any;

    mockGraphIndexService = {
      startIndexing: jest.fn(),
      getGraphStatus: jest.fn(),
      stopIndexing: jest.fn(),
      reindexProject: jest.fn(),
      indexGraph: jest.fn(),
      batchIndexGraph: jest.fn()
    } as any;

    // 绑定依赖
    container.bind(TYPES.IndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.GraphIndexService).toConstantValue(mockGraphIndexService);
    container.bind(TYPES.HybridIndexService).to(HybridIndexService);

    hybridIndexService = container.get(HybridIndexService);
  });

  describe('startIndexing', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options: IndexSyncOptions = { embedder: 'test' };

    it('should start both vector and graph indexing when nebula is enabled', async () => {
      // 设置环境变量启用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'true';

      mockIndexService.startIndexing.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });

    it('should start only vector indexing when nebula is disabled', async () => {
      // 设置环境变量禁用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'false';

      mockIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });

    it('should start both vector and graph indexing when nebula env is undefined', async () => {
      // 设置环境变量为undefined
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      delete process.env.NEBULA_ENABLED;

      mockIndexService.startIndexing.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });

      // 恢复环境变量
      if (originalNebulaEnabled !== undefined) {
        process.env.NEBULA_ENABLED = originalNebulaEnabled;
      }
    });
  });

  describe('indexProject', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options: IndexSyncOptions = { embedder: 'test' };

    it('should delegate to startIndexing', async () => {
      mockIndexService.startIndexing.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.indexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
    });
  });

  describe('getIndexStatus', () => {
    const projectId = 'test-project-id';

    it('should return combined status when both services are available', async () => {
      const vectorStatus = {
        projectId,
        projectPath: '/test/project',
        isIndexing: false,
        progress: 100,
        totalFiles: 10,
        indexedFiles: 10,
        failedFiles: 0,
        lastIndexed: new Date(),
        serviceType: IndexServiceType.VECTOR
      };

      const graphStatus = {
        projectId,
        isIndexing: true,
        progress: 50,
        totalFiles: 10,
        indexedFiles: 5,
        failedFiles: 0
      };

      mockIndexService.getIndexStatus.mockReturnValue(vectorStatus);
      mockGraphIndexService.getGraphStatus.mockResolvedValue(graphStatus);

      const result = await hybridIndexService.getIndexStatus(projectId);

      expect(result).toEqual({
        projectId,
        vectorStatus,
        graphStatus,
        overallStatus: 'indexing'
      });
    });

    it('should return combined status when only vector is indexing', async () => {
      const vectorStatus = {
        projectId,
        projectPath: '/test/project',
        isIndexing: true,
        progress: 50,
        totalFiles: 10,
        indexedFiles: 5,
        failedFiles: 0,
        lastIndexed: new Date(),
        serviceType: IndexServiceType.VECTOR
      };

      mockIndexService.getIndexStatus.mockReturnValue(vectorStatus);
      mockGraphIndexService.getGraphStatus.mockRejectedValue(new Error('Graph service unavailable'));

      const result = await hybridIndexService.getIndexStatus(projectId);

      expect(result).toEqual({
        projectId,
        vectorStatus,
        graphStatus: null,
        overallStatus: 'indexing'
      });
    });

    it('should return combined status when only graph is indexing', async () => {
      const vectorStatus = {
        projectId,
        projectPath: '/test/project',
        isIndexing: false,
        progress: 100,
        totalFiles: 10,
        indexedFiles: 10,
        failedFiles: 0,
        lastIndexed: new Date(),
        serviceType: IndexServiceType.VECTOR
      };

      const graphStatus = {
        projectId,
        isIndexing: true,
        progress: 50,
        totalFiles: 10,
        indexedFiles: 5,
        failedFiles: 0
      };

      mockIndexService.getIndexStatus.mockReturnValue(vectorStatus);
      mockGraphIndexService.getGraphStatus.mockResolvedValue(graphStatus);

      const result = await hybridIndexService.getIndexStatus(projectId);

      expect(result).toEqual({
        projectId,
        vectorStatus,
        graphStatus,
        overallStatus: 'indexing'
      });
    });

    it('should return completed status when neither is indexing', async () => {
      const vectorStatus = {
        projectId,
        projectPath: '/test/project',
        isIndexing: false,
        progress: 100,
        totalFiles: 10,
        indexedFiles: 10,
        failedFiles: 0,
        lastIndexed: new Date(),
        serviceType: IndexServiceType.VECTOR
      };

      const graphStatus = {
        projectId,
        isIndexing: false,
        progress: 100,
        totalFiles: 10,
        indexedFiles: 10,
        failedFiles: 0
      };

      mockIndexService.getIndexStatus.mockReturnValue(vectorStatus);
      mockGraphIndexService.getGraphStatus.mockResolvedValue(graphStatus);

      const result = await hybridIndexService.getIndexStatus(projectId);

      expect(result).toEqual({
        projectId,
        vectorStatus,
        graphStatus,
        overallStatus: 'completed'
      });
    });
  });

  describe('stopIndexing', () => {
    const projectId = 'test-project-id';

    it('should return true if either service stops successfully', async () => {
      mockIndexService.stopIndexing.mockResolvedValue(false);
      mockGraphIndexService.stopIndexing.mockResolvedValue(true);

      const result = await hybridIndexService.stopIndexing(projectId);

      expect(result).toBe(true);
      expect(mockIndexService.stopIndexing).toHaveBeenCalledWith(projectId);
      expect(mockGraphIndexService.stopIndexing).toHaveBeenCalledWith(projectId);
    });

    it('should return true if both services stop successfully', async () => {
      mockIndexService.stopIndexing.mockResolvedValue(true);
      mockGraphIndexService.stopIndexing.mockResolvedValue(true);

      const result = await hybridIndexService.stopIndexing(projectId);

      expect(result).toBe(true);
    });

    it('should return false if both services fail to stop', async () => {
      mockIndexService.stopIndexing.mockResolvedValue(false);
      mockGraphIndexService.stopIndexing.mockResolvedValue(false);

      const result = await hybridIndexService.stopIndexing(projectId);

      expect(result).toBe(false);
    });
  });

  describe('reindexProject', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options: IndexSyncOptions = { embedder: 'test' };

    it('should reindex both vector and graph when nebula is enabled', async () => {
      // 设置环境变量启用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'true';

      mockIndexService.reindexProject.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.reindexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.reindexProject).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });

    it('should reindex only vector when nebula is disabled', async () => {
      // 设置环境变量禁用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'false';

      mockIndexService.reindexProject.mockResolvedValue(projectId);

      const result = await hybridIndexService.reindexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.reindexProject).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });
  });

  describe('indexByType', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options: IndexSyncOptions = { embedder: 'test' };

    beforeEach(() => {
      mockIndexService.startIndexing.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);
    });

    it('should index only vector when type is Vector', async () => {
      const result = await hybridIndexService.indexByType(projectPath, IndexType.Vector, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should index both vector and graph when type is Graph', async () => {
      // 设置环境变量启用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'true';

      const result = await hybridIndexService.indexByType(projectPath, IndexType.Graph, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });

    it('should index both vector and graph when type is Hybrid', async () => {
      // 设置环境变量启用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'true';

      const result = await hybridIndexService.indexByType(projectPath, IndexType.Hybrid, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });

    it('should default to hybrid when type is unknown', async () => {
      // 设置环境变量启用nebula
      const originalNebulaEnabled = process.env.NEBULA_ENABLED;
      process.env.NEBULA_ENABLED = 'true';

      const result = await hybridIndexService.indexByType(projectPath, 'unknown' as IndexType, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });

      // 恢复环境变量
      process.env.NEBULA_ENABLED = originalNebulaEnabled;
    });
  });
});