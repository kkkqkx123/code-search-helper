import { NormalizationCacheAdapter } from '../CacheAdapter';

describe('NormalizationCacheAdapter', () => {
  let cache: NormalizationCacheAdapter;

  beforeEach(() => {
    // 使用较小的TL值进行测试，100ms
    cache = new NormalizationCacheAdapter(10, 100);
  });

  afterEach(() => {
    if (cache) {
      cache.stopCleanupTimer(); // 停止定时器以避免Jest无法退出
      cache.clear();
    }
  });

 describe('Basic Operations', () => {
    test('should set and get values correctly', () => {
      cache.set('key1', 'value1');
      const result = cache.get<string>('key1');
      
      expect(result).toBe('value1');
    });

    test('should return undefined for non-existent keys', () => {
      const result = cache.get<string>('nonexistent');
      
      expect(result).toBeUndefined();
    });

    test('should check if key exists', () => {
      cache.set('key1', 'value1');
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('should delete existing keys', () => {
      cache.set('key1', 'value1');
      const deleted = cache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    test('should return false when deleting non-existent keys', () => {
      const deleted = cache.delete('nonexistent');
      
      expect(deleted).toBe(false);
    });

    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('TL and Expiration', () => {
    test('should expire entries after TTL', async () => {
      cache = new NormalizationCacheAdapter(10, 50); // 50ms TTL
      cache.set('expiringKey', 'expiringValue');
      
      expect(cache.get('expiringKey')).toBe('expiringValue');
      
      // 等待超过TTL时间
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('expiringKey')).toBeUndefined();
      expect(cache.has('expiringKey')).toBe(false);
    });

    test('should not expire entries before TTL', async () => {
      cache = new NormalizationCacheAdapter(10, 200); // 200ms TTL
      cache.set('nonExpiringKey', 'nonExpiringValue');
      
      expect(cache.get('nonExpiringKey')).toBe('nonExpiringValue');
      
      // 等待少于TTL时间
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(cache.get('nonExpiringKey')).toBe('nonExpiringValue');
    });

    test('should handle multiple entries with different expiration times', async () => {
      cache = new NormalizationCacheAdapter(10, 100); // 100ms TTL
      cache.set('fastExpiring', 'fastValue');
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 60));
      
      cache.set('slowExpiring', 'slowValue');
      
      // At this point, both items should be valid
      expect(cache.get('fastExpiring')).toBe('fastValue');
      expect(cache.get('slowExpiring')).toBe('slowValue');
      
      // Wait for the first item to expire (60 + 60 = 120ms > 100ms TTL)
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // fastExpiring should be expired, slowExpiring should still be valid
      expect(cache.get('fastExpiring')).toBeUndefined();
      expect(cache.get('slowExpiring')).toBe('slowValue');
    });

    test('should clean up expired items via cleanup method', async () => {
      cache = new NormalizationCacheAdapter(10, 50); // 50ms TTL
      cache.set('toBeExpired', 'expiredValue');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The item should still be in the cache but marked as expired
      expect(cache.has('toBeExpired')).toBe(false);
      
      // Try to get the item, which should trigger cleanup internally
      expect(cache.get('toBeExpired')).toBeUndefined();
    });
  });

  describe('Cache Statistics', () => {
    test('should track cache statistics correctly', () => {
      // Initial stats
      const initialStats = cache.getStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);
      expect(initialStats.total).toBe(0);
      expect(initialStats.size).toBe(0);
      
      // Cache miss
      cache.get('nonexistent');
      let stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.total).toBe(1);
      
      // Cache hit
      cache.set('key1', 'value1');
      cache.get('key1');
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.total).toBe(2);
      
      // Calculate hit rate
      const hitRate = cache.calculateHitRate();
      expect(hitRate).toBe(1 / 2); // 0.5
    });

    test('should update size correctly', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

 describe('LRU Behavior with TTL', () => {
    test('should respect cache size limit', () => {
      cache = new NormalizationCacheAdapter(3, 10000); // Large TTL to avoid expiration
      
      // Add more items than the size limit
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // This should trigger LRU eviction
      
      // Check that we still have 3 items
      expect(cache.size()).toBe(3);
      
      // The oldest item (key1) should be evicted
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('Complex Objects', () => {
    test('should handle complex objects', () => {
      const complexObject = {
        name: 'test',
        data: [1, 2, 3],
        nested: { value: 'nested' },
        func: () => 'function'
      };
      
      cache.set('complexKey', complexObject);
      const retrieved = cache.get<any>('complexKey');
      
      expect(retrieved).toEqual(complexObject);
      expect(retrieved.name).toBe('test');
      expect(retrieved.data).toEqual([1, 2, 3]);
      expect(retrieved.nested.value).toBe('nested');
    });

    test('should handle arrays', () => {
      const testArray = [1, 'two', { three: 3 }, [4, 5]];
      
      cache.set('arrayKey', testArray);
      const retrieved = cache.get<any[]>('arrayKey');
      
      expect(retrieved).toEqual(testArray);
      if (retrieved) {
        expect(retrieved[0]).toBe(1);
        expect(retrieved[1]).toBe('two');
        expect(retrieved[2]).toEqual({ three: 3 });
        expect(retrieved[3]).toEqual([4, 5]);
      }
    });
  });
});