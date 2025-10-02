import { GraphCacheService, IGraphCacheService } from '../GraphCacheService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { CacheEntry, GraphAnalysisResult } from '../../core/types';

// 创建模拟服务
const mockLoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as LoggerService;

const mockErrorHandlerService = {
  handleError: jest.fn(),
} as unknown as ErrorHandlerService;

const mockConfigService = {
  get: jest.fn().mockReturnValue({
    defaultTTL: 30000,
    maxSize: 1000,
    cleanupInterval: 300,
  }),
} as unknown as ConfigService;

describe('GraphCacheService', () => {
  let cacheService: IGraphCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    cacheService = new GraphCacheService(
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('应该使用默认配置初始化', () => {
      expect(cacheService).toBeInstanceOf(GraphCacheService);
      expect(mockConfigService.get).toHaveBeenCalledWith('caching');
    });
  });

  describe('getFromCache', () => {
    it('应该返回缓存的值', () => {
      const key = 'testKey';
      const value = { data: 'testValue' };
      
      // 先设置缓存
      cacheService.setCache(key, value);
      
      // 然后获取缓存
      const result = cacheService.getFromCache(key);
      
      expect(result).toEqual(value);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(`Cache hit for key: ${key}`);
    });

    it('应该返回null如果键不存在', () => {
      const key = 'nonExistentKey';
      const result = cacheService.getFromCache(key);
      
      expect(result).toBeNull();
      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });

    it('应该返回null如果键已过期', () => {
      const key = 'expiredKey';
      const value = { data: 'expiredValue' };
      
      // 设置一个很短的TTL
      cacheService.setCache(key, value, 1); // 1ms TTL
      
      // 等待过期
      jest.advanceTimersByTime(2);
      
      const result = cacheService.getFromCache(key);
      
      expect(result).toBeNull();
      expect(mockLoggerService.debug).toHaveBeenCalledWith(`Cache entry expired for key: ${key}`);
    });

    it('应该处理错误情况', () => {
      const key = 'errorKey';
      
      // 创建一个模拟的缓存服务，使其在get方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟内部缓存对象的get方法
      jest.spyOn((mockCacheService as any).cache, 'get').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = mockCacheService.getFromCache(key);
      
      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error getting from cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Cache retrieval failed: Test error'),
        { component: 'GraphCacheService', operation: 'getFromCache', key }
      );
    });
  });

  describe('setCache', () => {
    it('应该设置缓存值', () => {
      const key = 'testKey';
      const value = { data: 'testValue' };
      
      cacheService.setCache(key, value);
      
      expect(mockLoggerService.debug).toHaveBeenCalledWith(`Cache set for key: ${key}, TTL: 30000ms`);
    });

    it('应该使用自定义TTL', () => {
      const key = 'testKey';
      const value = { data: 'testValue' };
      const customTTL = 60000;
      
      cacheService.setCache(key, value, customTTL);
      
      expect(mockLoggerService.debug).toHaveBeenCalledWith(`Cache set for key: ${key}, TTL: ${customTTL}ms`);
    });

    it('应该处理错误情况', () => {
      const key = 'errorKey';
      const value = { data: 'testValue' };
      
      // 创建一个模拟的缓存服务，使其在set方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟内部缓存对象的set方法
      jest.spyOn((mockCacheService as any).cache, 'set').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      mockCacheService.setCache(key, value);
      
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error setting cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Cache setting failed: Test error'),
        { component: 'GraphCacheService', operation: 'setCache', key }
      );
    });
  });

  describe('invalidateCache', () => {
    it('应该删除缓存项', () => {
      const key = 'testKey';
      const value = { data: 'testValue' };
      
      // 先设置缓存
      cacheService.setCache(key, value);
      
      // 然后删除缓存
      cacheService.invalidateCache(key);
      
      expect(mockLoggerService.debug).toHaveBeenCalledWith(`Cache invalidated for key: ${key}`);
      
      // 验证缓存已被删除
      const result = cacheService.getFromCache(key);
      expect(result).toBeNull();
    });

    it('应该处理错误情况', () => {
      const key = 'errorKey';
      
      // 创建一个模拟的缓存服务，使其在delete方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟内部缓存对象的delete方法
      jest.spyOn((mockCacheService as any).cache, 'delete').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      mockCacheService.invalidateCache(key);
      
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error invalidating cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Cache invalidation failed: Test error'),
        { component: 'GraphCacheService', operation: 'invalidateCache', key }
      );
    });
  });

  describe('clearAllCache', () => {
    it('应该清空所有缓存项', () => {
      // 设置多个缓存项
      cacheService.setCache('key1', { data: 'value1' });
      cacheService.setCache('key2', { data: 'value2' });
      
      // 清空缓存
      cacheService.clearAllCache();
      
      expect(mockLoggerService.info).toHaveBeenCalledWith('All graph cache cleared');
      
      // 验证所有缓存已被清空
      expect(cacheService.getFromCache('key1')).toBeNull();
      expect(cacheService.getFromCache('key2')).toBeNull();
    });

    it('应该处理错误情况', () => {
      // 创建一个模拟的缓存服务，使其在clear方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟内部缓存对象的clear方法
      jest.spyOn((mockCacheService as any).cache, 'clear').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      mockCacheService.clearAllCache();
      
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error clearing cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Cache clearing failed: Test error'),
        { component: 'GraphCacheService', operation: 'clearAllCache' }
      );
    });
  });

  describe('getCacheStats', () => {
    it('应该返回正确的统计信息', () => {
      const stats = cacheService.getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.size).toBe('number');
    });
  });

  describe('getGraphStatsCache', () => {
    it('应该返回缓存的图统计信息', () => {
      const stats: GraphAnalysisResult = {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: 0,
          totalEdges: 0,
          averageDegree: 0,
          maxDepth: 0,
          componentCount: 0,
        },
        summary: {
          projectFiles: 0,
          functions: 0,
          classes: 0,
          imports: 0,
          externalDependencies: 0,
        },
      };
      
      // 设置图统计缓存
      cacheService.setGraphStatsCache(stats);
      
      // 获取图统计缓存
      const result = cacheService.getGraphStatsCache();
      
      expect(result).toEqual(stats);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Graph stats cache hit');
    });

    it('应该返回null如果图统计缓存不存在', () => {
      const result = cacheService.getGraphStatsCache();
      
      expect(result).toBeNull();
    });

    it('应该返回null如果图统计缓存已过期', () => {
      const stats: GraphAnalysisResult = {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: 0,
          totalEdges: 0,
          averageDegree: 0,
          maxDepth: 0,
          componentCount: 0,
        },
        summary: {
          projectFiles: 0,
          functions: 0,
          classes: 0,
          imports: 0,
          externalDependencies: 0,
        },
      };
      
      // 设置图统计缓存
      cacheService.setGraphStatsCache(stats);
      
      // 等待过期 - 注意：setGraphStatsCache使用的默认TTL是300000ms
      jest.advanceTimersByTime(300001);
      
      const result = cacheService.getGraphStatsCache();
      
      expect(result).toBeNull();
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Graph stats cache expired');
    });

    it('应该处理错误情况', () => {
      // 创建一个模拟的缓存服务，使其在getGraphStatsCache方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用Object.defineProperty来模拟内部graphStatsCache属性
      Object.defineProperty(mockCacheService, 'graphStatsCache', {
        get: () => { throw new Error('Test error'); },
        configurable: true
      });
      
      const result = mockCacheService.getGraphStatsCache();
      
      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error getting graph stats cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Graph stats cache retrieval failed: Test error'),
        { component: 'GraphCacheService', operation: 'getGraphStatsCache' }
      );
    });
  });

  describe('setGraphStatsCache', () => {
    it('应该设置图统计缓存', () => {
      const stats: GraphAnalysisResult = {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: 0,
          totalEdges: 0,
          averageDegree: 0,
          maxDepth: 0,
          componentCount: 0,
        },
        summary: {
          projectFiles: 0,
          functions: 0,
          classes: 0,
          imports: 0,
          externalDependencies: 0,
        },
      };
      
      cacheService.setGraphStatsCache(stats);
      
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Graph stats cache set');
    });

    it('应该处理错误情况', () => {
      const stats: GraphAnalysisResult = {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: 0,
          totalEdges: 0,
          averageDegree: 0,
          maxDepth: 0,
          componentCount: 0,
        },
        summary: {
          projectFiles: 0,
          functions: 0,
          classes: 0,
          imports: 0,
          externalDependencies: 0,
        },
      };
      
      // 创建一个模拟的缓存服务，使其在setGraphStatsCache方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用Object.defineProperty来模拟内部graphStatsCache属性
      Object.defineProperty(mockCacheService, 'graphStatsCache', {
        set: () => { throw new Error('Test error'); },
        configurable: true
      });
      
      mockCacheService.setGraphStatsCache(stats);
      
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error setting graph stats cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Graph stats cache setting failed: Test error'),
        { component: 'GraphCacheService', operation: 'setGraphStatsCache' }
      );
    });
  });

  describe('cleanupExpired', () => {
    it('应该清理过期的缓存项', () => {
      // 设置一个即将过期的缓存项
      cacheService.setCache('expiredKey', { data: 'expiredValue' }, 1);
      
      // 设置一个未过期的缓存项
      cacheService.setCache('validKey', { data: 'validValue' }, 10000);
      
      // 等待过期
      jest.advanceTimersByTime(2);
      
      // 清理过期缓存
      cacheService.cleanupExpired();
      
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Cleaned up 1 expired cache entries');
      
      // 验证过期缓存已被清理
      expect(cacheService.getFromCache('expiredKey')).toBeNull();
      expect(cacheService.getFromCache('validKey')).not.toBeNull();
    });

    it('应该处理错误情况', () => {
      // 创建一个模拟的缓存服务，使其在entries方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟内部缓存对象的entries方法
      jest.spyOn((mockCacheService as any).cache, 'entries').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      mockCacheService.cleanupExpired();
      
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error cleaning up cache: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Cache cleanup failed: Test error'),
        { component: 'GraphCacheService', operation: 'cleanupExpired' }
      );
    });
  });

  describe('getCacheUsage', () => {
    it('应该返回正确的缓存使用情况', () => {
      const usage = cacheService.getCacheUsage();
      
      expect(usage).toHaveProperty('total');
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('percentage');
      expect(typeof usage.total).toBe('number');
      expect(typeof usage.used).toBe('number');
      expect(typeof usage.percentage).toBe('number');
    });
  });

  describe('isNearCapacity', () => {
    it('应该返回true如果缓存接近容量限制', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中返回高使用率
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockReturnValue({
        total: 100,
        used: 90,
        percentage: 90,
      });
      
      const result = mockCacheService.isNearCapacity();
      
      expect(result).toBe(true);
    });

    it('应该返回false如果缓存未接近容量限制', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中返回低使用率
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockReturnValue({
        total: 100,
        used: 70,
        percentage: 70,
      });
      
      const result = mockCacheService.isNearCapacity();
      
      expect(result).toBe(false);
    });
  });

  describe('evictOldestEntries', () => {
    it('应该删除最旧的条目', () => {
      // 设置多个缓存项
      cacheService.setCache('key1', { data: 'value1' });
      cacheService.setCache('key2', { data: 'value2' });
      cacheService.setCache('key3', { data: 'value3' });
      
      // 创建一个模拟的缓存服务，使其在isNearCapacity方法中返回true
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 设置缓存项
      mockCacheService.setCache('key1', { data: 'value1' });
      mockCacheService.setCache('key2', { data: 'value2' });
      mockCacheService.setCache('key3', { data: 'value3' });
      
      // 使用jest.spyOn来模拟isNearCapacity方法
      jest.spyOn(mockCacheService, 'isNearCapacity').mockReturnValue(true);
      
      // 删除最旧的条目
      mockCacheService.evictOldestEntries(0.5);
      
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Evicted 1 oldest cache entries');
    });

    it('不应该删除条目如果缓存未接近容量限制', () => {
      // 创建一个模拟的缓存服务，使其在isNearCapacity方法中返回false
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 设置缓存项
      mockCacheService.setCache('key1', { data: 'value1' });
      mockCacheService.setCache('key2', { data: 'value2' });
      
      // 使用jest.spyOn来模拟isNearCapacity方法
      jest.spyOn(mockCacheService, 'isNearCapacity').mockReturnValue(false);
      
      // 清除之前的调用记录
      (mockLoggerService.debug as jest.Mock).mockClear();
      
      // 尝试删除最旧的条目
      mockCacheService.evictOldestEntries(0.5);
      
      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });

    it('应该处理错误情况', () => {
      // 创建一个模拟的缓存服务，使其在isNearCapacity方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟isNearCapacity方法
      jest.spyOn(mockCacheService, 'isNearCapacity').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      mockCacheService.evictOldestEntries(0.5);
      
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error evicting oldest entries: Error: Test error`);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        new Error('Cache eviction failed: Test error'),
        { component: 'GraphCacheService', operation: 'evictOldestEntries' }
      );
    });
  });

  describe('isHealthy', () => {
    it('应该返回true如果缓存服务健康', () => {
      const result = cacheService.isHealthy();
      
      expect(result).toBe(true);
    });

    it('应该返回false如果缓存服务不健康', () => {
      // 创建一个模拟的缓存服务，使其在setCache方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟setCache方法
      jest.spyOn(mockCacheService, 'setCache').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = mockCacheService.isHealthy();
      
      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith('Health check failed', { error: 'Test error' });
    });
  });

  describe('getStatus', () => {
    it('应该返回critical如果缓存使用率超过90%', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中返回高使用率
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockReturnValue({
        total: 100,
        used: 95,
        percentage: 95,
      });
      
      // 使用jest.spyOn来模拟getCacheStats方法
      jest.spyOn(mockCacheService, 'getCacheStats').mockReturnValue({
        hits: 10,
        misses: 5,
        size: 15,
      });
      
      const result = mockCacheService.getStatus();
      
      expect(result).toBe('critical');
    });

    it('应该返回warning如果缓存使用率超过70%', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中返回中等使用率
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockReturnValue({
        total: 100,
        used: 80,
        percentage: 80,
      });
      
      // 使用jest.spyOn来模拟getCacheStats方法
      jest.spyOn(mockCacheService, 'getCacheStats').mockReturnValue({
        hits: 10,
        misses: 5,
        size: 15,
      });
      
      const result = mockCacheService.getStatus();
      
      expect(result).toBe('warning');
    });

    it('应该返回idle如果尚未使用缓存', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中返回零使用率
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockReturnValue({
        total: 100,
        used: 0,
        percentage: 0,
      });
      
      // 使用jest.spyOn来模拟getCacheStats方法
      jest.spyOn(mockCacheService, 'getCacheStats').mockReturnValue({
        hits: 0,
        misses: 0,
        size: 0,
      });
      
      const result = mockCacheService.getStatus();
      
      expect(result).toBe('idle');
    });

    it('应该返回normal如果缓存状态正常', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中返回正常使用率
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockReturnValue({
        total: 100,
        used: 50,
        percentage: 50,
      });
      
      // 使用jest.spyOn来模拟getCacheStats方法
      jest.spyOn(mockCacheService, 'getCacheStats').mockReturnValue({
        hits: 10,
        misses: 5,
        size: 15,
      });
      
      const result = mockCacheService.getStatus();
      
      expect(result).toBe('normal');
    });

    it('应该返回error如果检查过程中出错', () => {
      // 创建一个模拟的缓存服务，使其在getCacheUsage方法中抛出错误
      const mockCacheService = new GraphCacheService(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      
      // 使用jest.spyOn来模拟getCacheUsage方法
      jest.spyOn(mockCacheService, 'getCacheUsage').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = mockCacheService.getStatus();
      
      expect(result).toBe('error');
      expect(mockLoggerService.error).toHaveBeenCalledWith('Status check failed', { error: 'Test error' });
    });
  });
});