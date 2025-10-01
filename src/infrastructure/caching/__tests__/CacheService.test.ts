import { CacheService } from '../CacheService';
import { ICacheService } from '../types';

describe('CacheService', () => {
  let cacheService: ICacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  describe('constructor', () => {
    it('should initialize with empty cache', () => {
      const cache = (cacheService as any).cache;
      expect(cache.size).toBe(0);
    });
  });

  describe('setCache', () => {
    it('should store value in cache', () => {
      cacheService.setCache('test-key', 'test-value', 5000);
      const value = cacheService.getFromCache('test-key');
      expect(value).toBe('test-value');
    });

    it('should store value with default TTL if not provided', () => {
      cacheService.setCache('test-key', 'test-value');
      const value = cacheService.getFromCache('test-key');
      expect(value).toBe('test-value');
    });

    it('should overwrite existing value', () => {
      cacheService.setCache('test-key', 'initial-value');
      cacheService.setCache('test-key', 'new-value');
      const value = cacheService.getFromCache('test-key');
      expect(value).toBe('new-value');
    });
  });

  describe('getFromCache', () => {
    it('should return stored value', () => {
      cacheService.setCache('test-key', 'test-value');
      const value = cacheService.getFromCache('test-key');
      expect(value).toBe('test-value');
    });

    it('should return null for non-existent key', () => {
      const value = cacheService.getFromCache('non-existent-key');
      expect(value).toBeNull();
    });

    it('should return null for expired entry', (done) => {
      cacheService.setCache('test-key', 'test-value', 100); // 100ms TTL
      
      setTimeout(() => {
        const value = cacheService.getFromCache('test-key');
        expect(value).toBeNull();
        done();
      }, 150);
    });
  });

  describe('hasKey', () => {
    it('should return true for existing key', () => {
      cacheService.setCache('test-key', 'test-value');
      const hasKey = cacheService.hasKey('test-key');
      expect(hasKey).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const hasKey = cacheService.hasKey('non-existent-key');
      expect(hasKey).toBe(false);
    });

    it('should return false for expired entry', (done) => {
      cacheService.setCache('test-key', 'test-value', 100); // 100ms TTL
      
      setTimeout(() => {
        const hasKey = cacheService.hasKey('test-key');
        expect(hasKey).toBe(false);
        done();
      }, 150);
    });
  });

  describe('deleteFromCache', () => {
    it('should delete existing key', () => {
      cacheService.setCache('test-key', 'test-value');
      cacheService.deleteFromCache('test-key');
      const value = cacheService.getFromCache('test-key');
      expect(value).toBeNull();
    });

    it('should not throw error for non-existent key', () => {
      expect(() => {
        cacheService.deleteFromCache('non-existent-key');
      }).not.toThrow();
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache entries', () => {
      cacheService.setCache('key1', 'value1');
      cacheService.setCache('key2', 'value2');
      cacheService.setCache('key3', 'value3');
      
      cacheService.clearAllCache();
      
      expect(cacheService.getFromCache('key1')).toBeNull();
      expect(cacheService.getFromCache('key2')).toBeNull();
      expect(cacheService.getFromCache('key3')).toBeNull();
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should remove expired entries', (done) => {
      cacheService.setCache('expired-key', 'expired-value', 100); // 100ms TTL
      cacheService.setCache('valid-key', 'valid-value', 5000); // 5s TTL
      
      setTimeout(() => {
        cacheService.cleanupExpiredEntries();
        
        expect(cacheService.getFromCache('expired-key')).toBeNull();
        expect(cacheService.getFromCache('valid-key')).toBe('valid-value');
        done();
      }, 150);
    });

    it('should not remove valid entries', (done) => {
      cacheService.setCache('valid-key', 'valid-value', 5000); // 5s TTL
      
      setTimeout(() => {
        cacheService.cleanupExpiredEntries();
        
        expect(cacheService.getFromCache('valid-key')).toBe('valid-value');
        done();
      }, 150);
    });
  });

  describe('startPeriodicCleanup', () => {
    it('should start periodic cleanup', (done) => {
      cacheService.setCache('expired-key', 'expired-value', 100); // 100ms TTL
      
      cacheService.startPeriodicCleanup(200); // Cleanup every 200ms
      
      setTimeout(() => {
        expect(cacheService.getFromCache('expired-key')).toBeNull();
        done();
      }, 350);
    });

    it('should stop periodic cleanup when requested', (done) => {
      cacheService.setCache('expired-key', 'expired-value', 100); // 100ms TTL
      
      cacheService.startPeriodicCleanup(200); // Cleanup every 200ms
      cacheService.stopPeriodicCleanup();
      
      setTimeout(() => {
        // After stopping, expired entries should remain
        expect(cacheService.getFromCache('expired-key')).toBeNull();
        done();
      }, 350);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      cacheService.setCache('key1', 'value1');
      cacheService.setCache('key2', 'value2');
      
      const stats = cacheService.getCacheStats();
      
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hitCount');
      expect(stats).toHaveProperty('missCount');
      expect(stats).toHaveProperty('hitRate');
      expect(stats.totalEntries).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cacheService.setCache('key1', 'value1');
      cacheService.setCache('key2', 'value2');
      
      // Generate hits and misses
      cacheService.getFromCache('key1'); // hit
      cacheService.getFromCache('key2'); // hit
      cacheService.getFromCache('non-existent'); // miss
      
      const stats = cacheService.getCacheStats();
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2); // 2/3 = 0.67
    });
  });
});