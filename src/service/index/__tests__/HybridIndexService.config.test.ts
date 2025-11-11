import { HybridIndexService } from '../HybridIndexService';
import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { IndexService } from '../IndexService';
import { GraphIndexService } from '../GraphIndexService';
import { InfrastructureConfigService } from '../../../infrastructure/config/InfrastructureConfigService';
import { IGraphIndexPerformanceMonitor } from '../../../infrastructure/monitoring/GraphIndexMetrics';

describe('HybridIndexService Configuration', () => {
  let service: HybridIndexService;
  let container: Container;
  let mockIndexService: jest.Mocked<IndexService>;
  let mockGraphIndexService: jest.Mocked<GraphIndexService>;
  let mockConfigService: jest.Mocked<InfrastructureConfigService>;
  let mockPerformanceMonitor: jest.Mocked<IGraphIndexPerformanceMonitor>;

  beforeEach(() => {
    container = new Container();
    
    // 创建模拟对象
    mockIndexService = {
      startIndexing: jest.fn().mockResolvedValue('test-project-id'),
      getIndexStatus: jest.fn(),
      stopIndexing: jest.fn(),
      reindexProject: jest.fn()
    } as any;

    mockGraphIndexService = {
      startIndexing: jest.fn().mockResolvedValue('test-project-id'),
      getGraphStatus: jest.fn(),
      stopIndexing: jest.fn(),
      reindexProject: jest.fn()
    } as any;

    mockConfigService = {
      validateGraphConfiguration: jest.fn(),
      isGraphEnabled: jest.fn().mockReturnValue(false),
      getGraphConfiguration: jest.fn().mockReturnValue({})
    } as any;

    mockPerformanceMonitor = {
      recordMetric: jest.fn()
    } as any;

    // 绑定依赖
    container.bind(TYPES.IndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.GraphIndexService).toConstantValue(mockGraphIndexService);
    container.bind(TYPES.InfrastructureConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.GraphIndexPerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind<HybridIndexService>(TYPES.HybridIndexService).to(HybridIndexService);

    service = container.get<HybridIndexService>(TYPES.HybridIndexService);
  });

  afterEach(() => {
    // 恢复环境变量
    delete process.env.VECTOR_INDEX_ENABLED;
    delete process.env.GRAPH_INDEX_ENABLED;
    delete process.env.DEFAULT_INDEXING_STRATEGY;
  });

  describe('Environment Configuration', () => {
    it('should use hybrid strategy when both vector and graph are enabled', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'true';
      process.env.GRAPH_INDEX_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });

    it('should use vector-only strategy when graph is disabled', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'true';
      process.env.GRAPH_INDEX_ENABLED = 'false';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(false);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should use graph-only strategy when vector is disabled', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'false';
      process.env.GRAPH_INDEX_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).not.toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });

    it('should respect explicit vector strategy from environment', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'true';
      process.env.GRAPH_INDEX_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'vector';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should respect explicit graph strategy from environment', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'true';
      process.env.GRAPH_INDEX_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'graph';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).not.toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });

    it('should handle options override for vector-only', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'true';
      process.env.GRAPH_INDEX_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project', { enableGraphIndex: false });

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should handle options override for graph-only', async () => {
      // Arrange
      process.env.VECTOR_INDEX_ENABLED = 'true';
      process.env.GRAPH_INDEX_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project', { enableVectorIndex: false });

      // Assert
      expect(mockIndexService.startIndexing).not.toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });
  });
});