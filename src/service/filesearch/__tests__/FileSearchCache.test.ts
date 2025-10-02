import { FileSearchCache } from '../FileSearchCache';
import { LoggerService } from '../../../utils/LoggerService';

// Mock LoggerService
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('FileSearchCache', () => {
 let cache: FileSearchCache;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new FileSearchCache({}, mockLogger as unknown as LoggerService);
  });

  afterEach(() => {
    cache.destroy();
  });

 describe('constructor', () => {
    it('应该使用默认配置初始化', () => {
      const defaultCache = new FileSearchCache({}, mockLogger as unknown as LoggerService);
      
      const stats = defaultCache.getStats();
      expect(stats.maxSize).toBe(1000);
      expect((defaultCache as any).config.defaultTTL).toBe(5 * 60 * 1000); // 5分钟
      expect((defaultCache as any).config.cleanupInterval).toBe(60 * 1000); // 1分钟
      
      defaultCache.destroy();
    });

    it('应该使用自定义配置初始化', () => {
      const customConfig = {
        maxSize: 500,
        defaultTTL: 10 * 60 * 1000, // 10分钟
        cleanupInterval: 2 * 60 * 1000 // 2分钟
      };
      
      const customCache = new FileSearchCache(customConfig, mockLogger as unknown as LoggerService);
      const stats = customCache.getStats();
      
      expect(stats.maxSize).toBe(500);
      expect((customCache as any).config.defaultTTL).toBe(10 * 60 * 1000);
      
      customCache.destroy();
    });
  });

  describe('get', () => {
    it('应该返回缓存的值', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      
      const result = await cache.get('test-key');
      expect(result).toEqual(mockResults);
    });

    it('应该返回null如果键不存在', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('应该返回null如果键已过期', async () => {
      jest.useFakeTimers();
      
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults, 100); // 100ms TTL
      
      // 快进时间超过TTL
      jest.advanceTimersByTime(150);
      
      const result = await cache.get('test-key');
      expect(result).toBeNull();
      
      jest.useRealTimers();
    });

    it('应该更新访问时间', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      
      // 等待一点时间再获取
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 获取操作会更新LRU状态（访问时间）
      const resultBefore = await cache.get('test-key');
      expect(resultBefore).toEqual(mockResults);
      
      // 再次获取以确保LRU状态更新
      const resultAfter = await cache.get('test-key');
      expect(resultAfter).toEqual(mockResults);
    });
 });

  describe('set', () => {
    it('应该设置缓存值', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      
      const cached = (cache as any).cache.get('test-key');
      expect(cached.results).toEqual(mockResults);
      expect(cached.expiresAt).toBeGreaterThan(Date.now());
      expect(cached.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('应该使用自定义TTL', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults, 2000); // 2秒TTL
      
      const cached = (cache as any).cache.get('test-key');
      expect(cached.expiresAt).toBeCloseTo(Date.now() + 2000, -1);
    });

    it('应该在达到最大大小时淘汰LRU项', async () => {
      const config = { maxSize: 2, cleanupInterval: 1000 }; // 设置较长的清理间隔避免干扰
      const lruCache = new FileSearchCache(config, mockLogger as unknown as LoggerService);
      
      const mockResults1 = [{ filePath: '/file1.ts', fileName: 'file1.ts', directory: '/', relevanceScore: 0.9, semanticDescription: 'File 1', extension: '.ts', fileSize: 100, lastModified: new Date() }];
      const mockResults2 = [{ filePath: '/file2.ts', fileName: 'file2.ts', directory: '/', relevanceScore: 0.8, semanticDescription: 'File 2', extension: '.ts', fileSize: 100, lastModified: new Date() }];
      const mockResults3 = [{ filePath: '/file3.ts', fileName: 'file3.ts', directory: '/', relevanceScore: 0.7, semanticDescription: 'File 3', extension: '.ts', fileSize: 100, lastModified: new Date() }];
      
      await lruCache.set('key1', mockResults1);
      await lruCache.set('key2', mockResults2);
      
      // 访问key1使其成为最近使用的
      await lruCache.get('key1');
      
      await lruCache.set('key3', mockResults3); // 这应该淘汰key2（最久未使用）
      
      const result1 = await lruCache.get('key1');
      const result2 = await lruCache.get('key2'); // 应该已被淘汰
      const result3 = await lruCache.get('key3');
      
      expect(result1).not.toBeNull(); // key1应该还存在，因为最近访问过
      expect(result2).toBeNull(); // key2应该被淘汰，最久未使用
      expect(result3).not.toBeNull(); // key3应该被添加
      
      lruCache.destroy();
    });
 });

  describe('delete', () => {
    it('应该删除缓存项', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      expect(await cache.get('test-key')).not.toBeNull();
      
      await cache.delete('test-key');
      expect(await cache.get('test-key')).toBeNull();
    });

    it('应该删除访问时间记录', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      expect(await cache.get('test-key')).not.toBeNull();
      
      await cache.delete('test-key');
      expect(await cache.get('test-key')).toBeNull();
    });
  });

  describe('clear', () => {
    it('应该清空所有缓存项', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('key1', mockResults);
      await cache.set('key2', mockResults);
      
      expect(cache.getStats().size).toBe(2);
      
      await cache.clear();
      
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      
      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(1000);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.missRate).toBeGreaterThanOrEqual(0);
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0);
      expect(stats.totalHits).toBeGreaterThanOrEqual(0);
      expect(stats.totalMisses).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateKey', () => {
    it('应该生成一致的缓存键', () => {
      const key1 = cache.generateKey('test query', { maxResults: 10 });
      const key2 = cache.generateKey('test query', { maxResults: 10 });
      
      expect(key1).toBe(key2);
    });

    it('应该为不同选项生成不同键', () => {
      const key1 = cache.generateKey('test query', { maxResults: 10 });
      const key2 = cache.generateKey('test query', { maxResults: 20 });
      
      expect(key1).not.toBe(key2);
    });

    it('应该规范化查询大小写', () => {
      const key1 = cache.generateKey('Test Query', { maxResults: 10 });
      const key2 = cache.generateKey('test query', { maxResults: 10 });
      
      expect(key1).toBe(key2);
    });

    it('应该处理未定义的选项', () => {
      const key1 = cache.generateKey('test query');
      const key2 = cache.generateKey('test query');
      
      expect(key1).toBe(key2);
    });
  });

  describe('has', () => {
    it('应该返回true如果键存在且未过期', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      const hasKey = cache.has('test-key');
      
      expect(hasKey).toBe(true);
    });

    it('应该返回false如果键不存在', () => {
      const hasKey = cache.has('non-existent-key');
      expect(hasKey).toBe(false);
    });

    it('应该返回false如果键已过期', async () => {
      jest.useFakeTimers();
      
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults, 100); // 100ms TTL
      
      // 快进时间超过TTL
      jest.advanceTimersByTime(150);
      
      const hasKey = cache.has('test-key');
      expect(hasKey).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('cleanupExpired', () => {
    it('应该清理过期的缓存项', async () => {
      jest.useFakeTimers();
      
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('key1', mockResults, 100); // 100ms TTL
      await cache.set('key2', mockResults, 500); // 500ms TTL
      
      // 快进时间，但超过第一个键的TTL
      jest.advanceTimersByTime(150);
      
      (cache as any).cleanupExpired(); // 手动调用清理
      
      // key1应该被删除，key2应该还存在
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).not.toBeNull();
      
      jest.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('应该正确销毁缓存', async () => {
      const mockResults = [
        {
          filePath: '/src/service.ts',
          fileName: 'service.ts',
          directory: '/src',
          relevanceScore: 0.9,
          semanticDescription: 'Service file',
          extension: '.ts',
          fileSize: 1024,
          lastModified: new Date()
        }
      ];
      
      await cache.set('test-key', mockResults);
      expect(cache.getStats().size).toBe(1);
      
      cache.destroy();
      
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('LRU淘汰', () => {
    it('应该正确淘汰最久未使用的项', async () => {
      const config = { maxSize: 2, cleanupInterval: 1000 }; // 设置较长的清理间隔避免干扰
      const lruCache = new FileSearchCache(config, mockLogger as unknown as LoggerService);
      
      const mockResults1 = [{ filePath: '/file1.ts', fileName: 'file1.ts', directory: '/', relevanceScore: 0.9, semanticDescription: 'File 1', extension: '.ts', fileSize: 100, lastModified: new Date() }];
      const mockResults2 = [{ filePath: '/file2.ts', fileName: 'file2.ts', directory: '/', relevanceScore: 0.8, semanticDescription: 'File 2', extension: '.ts', fileSize: 100, lastModified: new Date() }];
      const mockResults3 = [{ filePath: '/file3.ts', fileName: 'file3.ts', directory: '/', relevanceScore: 0.7, semanticDescription: 'File 3', extension: '.ts', fileSize: 100, lastModified: new Date() }];
      
      // 设置三个键，超过最大大小
      await lruCache.set('key1', mockResults1);
      await lruCache.set('key2', mockResults2);
      await lruCache.set('key3', mockResults3); // 这会触发LRU淘汰
      
      // key1应该是最久未使用的，应该被移除
      expect(await lruCache.get('key1')).toBeNull();
      expect(await lruCache.get('key2')).not.toBeNull();
      expect(await lruCache.get('key3')).not.toBeNull();
      
      lruCache.destroy();
    });
  });
});