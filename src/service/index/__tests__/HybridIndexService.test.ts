import { Container } from 'inversify';
import 'reflect-metadata';
import { TYPES } from '../../../types';
import { HybridIndexService, IndexType } from '../HybridIndexService';
import { VectorIndexService } from '../VectorIndexService';
import { GraphIndexService } from '../GraphIndexService';
import { IndexServiceType } from '../IIndexService';
import { IndexSyncOptions } from '../IIndexService';
import { InfrastructureConfigService } from '../../../infrastructure/config/InfrastructureConfigService';

describe('HybridIndexService', () => {
  let container: Container;
  let hybridIndexService: HybridIndexService;
  let mockIndexService: jest.Mocked<VectorIndexService>;
  let mockGraphIndexService: jest.Mocked<GraphIndexService>;
  let mockConfigService: jest.Mocked<InfrastructureConfigService>;

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

    mockConfigService = {
      isGraphEnabled: jest.fn().mockReturnValue(true),
      isVectorEnabled: jest.fn().mockReturnValue(true),
      getGraphConfig: jest.fn(),
      getVectorConfig: jest.fn(),
      getEmbedderConfig: jest.fn(),
      getDatabaseConfig: jest.fn(),
      getSystemConfig: jest.fn(),
      updateConfig: jest.fn(),
      validateConfig: jest.fn().mockReturnValue(true),
      validateGraphConfiguration: jest.fn()
    } as any;

    const mockPerformanceMonitor = {
      recordMetric: jest.fn(),
      getPerformanceStats: jest.fn(),
      getAllPerformanceStats: jest.fn(),
      clearProjectStats: jest.fn(),
      clearAllStats: jest.fn()
    } as any;

    // 绑定依赖
    container.bind(TYPES.VectorIndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.GraphIndexService).toConstantValue(mockGraphIndexService);
    container.bind(TYPES.InfrastructureConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.GraphIndexPerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind(TYPES.HybridIndexService).to(HybridIndexService);

    hybridIndexService = container.get<HybridIndexService>(TYPES.HybridIndexService);
  });

  describe('startIndexing', () => {
    const projectPath = '/test/project';
    const projectId = 'test-project-id';
    const options: IndexSyncOptions = { embedder: 'test' };

    it('should start both vector and graph indexing when nebula is enabled', async () => {
      // 设置环境变量以确保使用混合策略
      const originalStrategy = process.env.DEFAULT_INDEXING_STRATEGY;
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      
      // 模拟配置服务启用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      mockIndexService.startIndexing.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockConfigService.isGraphEnabled).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });
      
      // 恢复环境变量
      process.env.DEFAULT_INDEXING_STRATEGY = originalStrategy;
    });

    it('should start only vector indexing when nebula is disabled', async () => {
      // 模拟配置服务禁用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(false);

      mockIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should start both vector and graph indexing when nebula env is undefined', async () => {
      // 设置环境变量以确保使用混合策略
      const originalStrategy = process.env.DEFAULT_INDEXING_STRATEGY;
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      
      // 模拟配置服务启用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      mockIndexService.startIndexing.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.startIndexing(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockConfigService.isGraphEnabled).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });
      
      // 恢复环境变量
      process.env.DEFAULT_INDEXING_STRATEGY = originalStrategy;
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
      // 模拟配置服务启用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      mockIndexService.reindexProject.mockResolvedValue(projectId);
      mockGraphIndexService.startIndexing.mockResolvedValue(projectId);

      const result = await hybridIndexService.reindexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.reindexProject).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });
    });

    it('should reindex only vector when nebula is disabled', async () => {
      // 模拟配置服务禁用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(false);

      mockIndexService.reindexProject.mockResolvedValue(projectId);

      const result = await hybridIndexService.reindexProject(projectPath, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.reindexProject).toHaveBeenCalledWith(projectPath, options);
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
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

    it('should handle removed Graph type by defaulting to Hybrid', async () => {
      // 设置环境变量以确保使用混合策略
      const originalStrategy = process.env.DEFAULT_INDEXING_STRATEGY;
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      
      // 模拟配置服务启用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Graph类型已移除，现在应该默认使用Hybrid
      const result = await hybridIndexService.indexByType(projectPath, 'graph' as any, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockConfigService.isGraphEnabled).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });
      
      // 恢复环境变量
      process.env.DEFAULT_INDEXING_STRATEGY = originalStrategy;
    });

    it('should index both vector and graph when type is Hybrid', async () => {
      // 设置环境变量以确保使用混合策略
      const originalStrategy = process.env.DEFAULT_INDEXING_STRATEGY;
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      
      // 模拟配置服务启用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      const result = await hybridIndexService.indexByType(projectPath, IndexType.Hybrid, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockConfigService.isGraphEnabled).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });
      
      // 恢复环境变量
      process.env.DEFAULT_INDEXING_STRATEGY = originalStrategy;
    });

    it('should default to hybrid when type is unknown', async () => {
      // 设置环境变量以确保使用混合策略
      const originalStrategy = process.env.DEFAULT_INDEXING_STRATEGY;
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      
      // 模拟配置服务启用图索引
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      const result = await hybridIndexService.indexByType(projectPath, 'unknown' as IndexType, options);

      expect(result).toBe(projectId);
      expect(mockIndexService.startIndexing).toHaveBeenCalledWith(projectPath, options);
      expect(mockConfigService.isGraphEnabled).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalledWith(projectPath, {
        ...options,
        enableGraphIndex: true
      });
      
      // 恢复环境变量
      process.env.DEFAULT_INDEXING_STRATEGY = originalStrategy;
    });
  });
});