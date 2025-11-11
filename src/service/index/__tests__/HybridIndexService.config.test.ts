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
    delete process.env.DEFAULT_INDEXING_STRATEGY;
    delete process.env.NEBULA_ENABLED;
  });

  describe('Environment Configuration', () => {
    it('should use hybrid strategy when NEBULA_ENABLED is true', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });

    it('should use vector-only strategy when NEBULA_ENABLED is false', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'false';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(false);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should respect explicit vector strategy from environment', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'vector';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should fallback to vector when NEBULA_ENABLED is undefined', async () => {
      // Arrange
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(false);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should handle options override for vector-only', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';
      process.env.DEFAULT_INDEXING_STRATEGY = 'hybrid';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project', { enableGraphIndex: false });

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });
  });

  describe('Index Type Strategy', () => {
    it('should handle Vector index type correctly', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';

      // Act
      await service.indexByType('/test/project', 'vector' as any);

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).not.toHaveBeenCalled();
    });

    it('should handle Graph index type as hybrid', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.indexByType('/test/project', 'graph' as any);

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });

    it('should handle Hybrid index type correctly', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.indexByType('/test/project', 'hybrid' as any);

      // Assert
      expect(mockIndexService.startIndexing).toHaveBeenCalled();
      expect(mockGraphIndexService.startIndexing).toHaveBeenCalled();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate graph configuration when graph is enabled', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'true';
      mockConfigService.isGraphEnabled.mockReturnValue(true);

      // Act
      await service.startIndexing('/test/project');

      // Assert
      expect(mockConfigService.validateGraphConfiguration).toHaveBeenCalled();
    });

    it('should skip graph validation when graph is disabled', async () => {
      // Arrange
      process.env.NEBULA_ENABLED = 'false';
      mockConfigService.isGraphEnabled.mockReturnValue(false);

      // Act
      await service.startIndexing('/test/project', { enableGraphIndex: false });

      // Assert
      expect(mockConfigService.validateGraphConfiguration).not.toHaveBeenCalled();
    });
  });
});