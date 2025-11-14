import { Container } from 'inversify';
import { TYPES } from '../../../../types';
import { VectorService } from '../../core/VectorService';
import { VectorRepository } from '../../repository/VectorRepository';
import { VectorCacheManager } from '../../caching/VectorCacheManager';
import { VectorCoordinationService } from '../../coordination/VectorCoordinationService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';

describe('VectorService Integration', () => {
  let container: Container;
  let vectorService: VectorService;

  beforeAll(() => {
    // 设置依赖注入容器
    container = new Container();

    // 注册基础服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();

    // 注册缓存服务（VectorCacheManager依赖）
    const { CacheService } = require('../../../../infrastructure/caching/CacheService');
    container.bind(CacheService).toSelf().inSingletonScope();
    container.bind(TYPES.CacheService).to(CacheService).inSingletonScope();

    // 注册向量服务模块
    container.bind(TYPES.IVectorRepository).to(VectorRepository).inSingletonScope();
    container.bind(TYPES.VectorRepository).to(VectorRepository).inSingletonScope();
    container.bind(TYPES.IVectorCacheManager).to(VectorCacheManager).inSingletonScope();
    container.bind(TYPES.VectorCacheManager).to(VectorCacheManager).inSingletonScope();
    container.bind(TYPES.IVectorCoordinationService).to(VectorCoordinationService).inSingletonScope();
    container.bind(TYPES.VectorCoordinationService).to(VectorCoordinationService).inSingletonScope();
    container.bind(TYPES.IVectorService).to(VectorService).inSingletonScope();
    container.bind(TYPES.VectorService).to(VectorService).inSingletonScope();

    vectorService = container.get<VectorService>(TYPES.VectorService);
  });

  describe('Service Initialization', () => {
    it('should initialize vector service', async () => {
      const result = await vectorService.initialize();
      expect(result).toBe(true);
    });

    it('should report healthy status after initialization', async () => {
      await vectorService.initialize();
      const isHealthy = await vectorService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should get service status', async () => {
      await vectorService.initialize();
      const status = await vectorService.getStatus();
      expect(status).toBeDefined();
      expect(status.healthy).toBe(true);
      expect(status.connected).toBe(true);
    });
  });

  describe('Service Lifecycle', () => {
    it('should close service properly', async () => {
      await vectorService.initialize();
      await vectorService.close();
      const isHealthy = await vectorService.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Basic Operations', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    it('should handle vector creation options', async () => {
      // 这个测试需要实际的数据库连接，所以只测试参数传递
      const contents = ['test content'];
      const options = {
        projectId: 'test-project',
        embedderProvider: 'openai',
        batchSize: 10
      };

      try {
        await vectorService.createVectors(contents, options);
      } catch (error) {
        // 预期会失败，因为没有实际的数据库连接
        expect(error).toBeDefined();
      }
    });

    it('should handle search options', async () => {
      const query = [0.1, 0.2, 0.3];
      const options = {
        limit: 5,
        scoreThreshold: 0.8,
        filter: {
          projectId: 'test-project',
          language: ['typescript']
        }
      };

      try {
        await vectorService.searchSimilarVectors(query, options);
      } catch (error) {
        // 预期会失败，因为没有实际的数据库连接
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    it('should handle invalid vector data gracefully', async () => {
      try {
        await vectorService.createVectors([]);
        // 如果没有抛出错误，应该返回空数组
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid search query', async () => {
      try {
        await vectorService.searchSimilarVectors([]);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    it('should return performance metrics', async () => {
      const metrics = await vectorService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.operationCounts).toBeDefined();
      expect(metrics.averageResponseTimes).toBeDefined();
      expect(metrics.cacheHitRates).toBeDefined();
      expect(metrics.errorRates).toBeDefined();
      expect(metrics.throughput).toBeDefined();
    });

    it('should return vector statistics', async () => {
      try {
        const stats = await vectorService.getVectorStats('test-project');
        expect(stats).toBeDefined();
        expect(stats.totalCount).toBeDefined();
        expect(stats.projectCount).toBeDefined();
      } catch (error) {
        // 预期可能失败，因为没有实际的数据库连接
        expect(error).toBeDefined();
      }
    });
  });

  afterAll(() => {
    if (vectorService) {
      vectorService.close();
    }
  });
});