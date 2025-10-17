/**
 * 图缓存服务测试
 * 测试新的简化图缓存服务
 */

import { GraphCacheService } from '../../../../infrastructure/caching/GraphCacheService';
import { LoggerService } from '../../../../utils/LoggerService';
import { GraphData, CacheOptions } from '../types';

// Mock 服务
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as any;

const mockConfigService = {
  getConfig: jest.fn(() => ({
    maxSize: 1000,
    defaultTTL: 300,
    maxMemory: 50 * 1024 * 1024,
    enableCompression: true,
    compressionThreshold: 1024,
    enableStats: true,
    compressionLevel: 6
  }))
} as any;

describe('GraphCacheService', () => {
  let service: GraphCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GraphCacheService(mockLogger, mockConfigService);
  });

  afterEach(() => {
    // 清理缓存
    if (service) {
      service.clearGraphCache();
    }
  });

  describe('基本缓存操作', () => {
    it('应该正确缓存图数据', async () => {
      const testData: GraphData = {
        nodes: [
          { id: '1', type: 'function' as any, properties: { name: 'testFunc' } }
        ],
        relationships: []
      };

      const result = await service.setGraphData('test-key', testData);
      expect(result).toBe(true);

      const cached = await service.getGraphData('test-key');
      expect(cached).toEqual(testData);
    });

    it('应该正确处理缓存未命中', async () => {
      const cached = await service.getGraphData('non-existent-key');
      expect(cached).toBeNull();
    });

    it('应该正确删除缓存', async () => {
      const testData: GraphData = {
        nodes: [],
        relationships: []
      };

      await service.set('test-key', testData);
      const deleteResult = await service.delete('test-key');
      expect(deleteResult).toBe(true);

      const cached = await service.getGraphData('test-key');
      expect(cached).toBeNull();
    });
  });

  describe('批量操作', () => {
    it('应该正确处理批量缓存', async () => {
      const items = [
        {
          key: 'key1',
          data: { nodes: [{ id: '1', type: 'function' as any, properties: {} }], relationships: [] }
        },
        {
          key: 'key2',
          data: { nodes: [{ id: '2', type: 'class' as any, properties: {} }], relationships: [] }
        }
      ];

      const count = await service.setGraphBatch(items);
      expect(count).toBe(2);

      const cached1 = await service.getGraphData('key1');
      const cached2 = await service.getGraphData('key2');
      expect(cached1).toBeTruthy();
      expect(cached2).toBeTruthy();
    });

    it('应该正确处理批量获取', async () => {
      const testData1: GraphData = { nodes: [{ id: '1', type: 'function' as any, properties: {} }], relationships: [] };
      const testData2: GraphData = { nodes: [{ id: '2', type: 'class' as any, properties: {} }], relationships: [] };

      await service.set('key1', testData1);
      await service.set('key2', testData2);

      const results = await service.getGraphBatch(['key1', 'key2', 'non-existent']);
      expect(results.get('key1')).toEqual(testData1);
      expect(results.get('key2')).toEqual(testData2);
      expect(results.get('non-existent')).toBeNull();
    });
  });

  describe('缓存管理', () => {
    it('应该正确清空缓存', async () => {
      const testData: GraphData = { nodes: [], relationships: [] };
      await service.set('test-key', testData);
      
      await service.clearGraphCache();
      
      const cached = await service.getGraphData('test-key');
      expect(cached).toBeNull();
      expect(service.getGraphCacheSize()).toBe(0);
    });

    it('应该正确返回缓存大小', async () => {
      const testData: GraphData = { nodes: [], relationships: [] };
      await service.set('key1', testData);
      await service.set('key2', testData);
      
      expect(service.getGraphCacheSize()).toBe(2);
    });

    it('应该正确返回缓存键', async () => {
      const testData: GraphData = { nodes: [], relationships: [] };
      await service.set('key1', testData);
      await service.set('key2', testData);
      
      const keys = service.getGraphCacheKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('统计信息', () => {
    it('应该正确返回统计信息', async () => {
      const testData: GraphData = { nodes: [], relationships: [] };
      await service.set('test-key', testData);
      await service.getGraphData('test-key'); // 命中
      await service.getGraphData('non-existent'); // 未命中

      const stats = service.getGraphCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('应该正确检查健康状态', () => {
      const isHealthy = service.isGraphCacheHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('TTL功能', () => {
    it('应该正确处理TTL过期', async () => {
      const testData: GraphData = { nodes: [], relationships: [] };
      const options: CacheOptions = { ttl: 100 }; // 100ms
      
      await service.setGraphData('test-key', testData, options);
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cached = await service.getGraphData('test-key');
      expect(cached).toBeNull();
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理缓存错误', async () => {
      // 模拟错误情况
      const result = await service.setGraphData('', {} as GraphData);
      expect(result).toBe(false);
    });

    it('应该优雅处理获取错误', async () => {
      const cached = await service.getGraphData('');
      expect(cached).toBeNull();
    });
  });
});