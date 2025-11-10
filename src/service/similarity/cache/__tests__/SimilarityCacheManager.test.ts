import { SimilarityCacheManager } from '../SimilarityCacheManager';
import { LoggerService } from '../../../../utils/LoggerService';
import { CacheService } from '../../../../infrastructure/caching/CacheService';
import { HashUtils } from '../../../../utils/HashUtils';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock CacheService
class MockCacheService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private stats = { hitCount: 0, missCount: 0 };

  getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.missCount++;
      return undefined;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.missCount++;
      return undefined;
    }

    this.stats.hitCount++;
    return entry.data;
  }

  setCache<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  deleteFromCache(key: string): boolean {
    return this.cache.delete(key);
  }

  deleteByPattern(pattern: RegExp): number {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => pattern.test(key));
    let deletedCount = 0;

    for (const key of keysToDelete) {
      if (this.cache.delete(key)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  getCacheStats() {
    return {
      totalEntries: this.cache.size,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate: this.stats.hitCount / (this.stats.hitCount + this.stats.missCount) || 0
    };
  }

  getKeysByPattern(pattern: RegExp): string[] {
    return Array.from(this.cache.keys()).filter(key => pattern.test(key));
  }
}

// Mock HashUtils
jest.mock('../../../../utils/HashUtils');
const MockHashUtils = HashUtils as jest.Mocked<typeof HashUtils>;

describe('SimilarityCacheManager', () => {
  let cacheManager: SimilarityCacheManager;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      getLogFilePath: jest.fn().mockReturnValue('/test/log/path'),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockCacheService = new MockCacheService();
    
    MockHashUtils.simpleHash.mockImplementation((str: string) => {
      // Simple deterministic hash for testing
      return str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(36);
    });

    cacheManager = new SimilarityCacheManager(
      mockLogger,
      mockCacheService as any,
      300000 // 5 minutes default TTL
    );
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(cacheManager).toBeInstanceOf(SimilarityCacheManager);
    });

    it('should warn when CacheService is not provided', () => {
      const managerWithoutCache = new SimilarityCacheManager(mockLogger, undefined, 300000);
      expect(mockLogger.warn).toHaveBeenCalledWith('CacheService not provided, SimilarityCacheManager will not function properly');
    });
  });

  describe('get', () => {
    it('should return cached value when key exists', async () => {
      const key = 'test-key';
      const expectedValue = 0.85;
      
      // Pre-populate cache
      mockCacheService.setCache(`similarity:${key}`, expectedValue);
      
      const result = await cacheManager.get(key);
      
      expect(result).toBe(expectedValue);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Cache hit for similarity key: ${key}`);
    });

    it('should return null when key does not exist', async () => {
      const key = 'non-existent-key';
      
      const result = await cacheManager.get(key);
      
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(`Cache miss for similarity key: ${key}`);
    });

    it('should return null when CacheService is not available', async () => {
      const managerWithoutCache = new SimilarityCacheManager(mockLogger, undefined, 300000);
      
      const result = await managerWithoutCache.get('test-key');
      
      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      const key = 'test-key';
      const errorCacheService = {
        getFromCache: jest.fn().mockImplementation(() => {
          throw new Error('Cache error');
        })
      } as any;
      
      const errorManager = new SimilarityCacheManager(mockLogger, errorCacheService, 300000);
      
      const result = await errorManager.get(key);
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting from similarity cache:', expect.any(Error));
    });
  });

  describe('set', () => {
    it('should set value in cache with default TTL', async () => {
      const key = 'test-key';
      const value = 0.75;
      
      await cacheManager.set(key, value);
      
      const retrievedValue = mockCacheService.getFromCache(`similarity:${key}`);
      expect(retrievedValue).toBe(value);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Similarity cache set for key: ${key}, value: ${value}`);
    });

    it('should set value in cache with custom TTL', async () => {
      const key = 'test-key';
      const value = 0.75;
      const customTTL = 600000; // 10 minutes
      
      await cacheManager.set(key, value, customTTL);
      
      const retrievedValue = mockCacheService.getFromCache(`similarity:${key}`);
      expect(retrievedValue).toBe(value);
    });

    it('should not set value when CacheService is not available', async () => {
      const managerWithoutCache = new SimilarityCacheManager(mockLogger, undefined, 300000);
      
      // Should not throw
      await expect(managerWithoutCache.set('test-key', 0.75)).resolves.toBeUndefined();
    });

    it('should handle cache errors gracefully', async () => {
      const errorCacheService = {
        setCache: jest.fn().mockImplementation(() => {
          throw new Error('Cache error');
        })
      } as any;
      
      const errorManager = new SimilarityCacheManager(mockLogger, errorCacheService, 300000);
      
      // Should not throw
      await expect(errorManager.set('test-key', 0.75)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Error setting similarity cache:', expect.any(Error));
    });
  });

  describe('delete', () => {
    it('should delete value from cache', async () => {
      const key = 'test-key';
      const value = 0.75;
      
      // Pre-populate cache
      await cacheManager.set(key, value);
      
      await cacheManager.delete(key);
      
      const retrievedValue = mockCacheService.getFromCache(`similarity:${key}`);
      expect(retrievedValue).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(`Similarity cache delete for key: ${key}`);
    });

    it('should not delete when CacheService is not available', async () => {
      const managerWithoutCache = new SimilarityCacheManager(mockLogger, undefined, 300000);
      
      // Should not throw
      await expect(managerWithoutCache.delete('test-key')).resolves.toBeUndefined();
    });

    it('should handle cache errors gracefully', async () => {
      const errorCacheService = {
        deleteFromCache: jest.fn().mockImplementation(() => {
          throw new Error('Cache error');
        })
      } as any;
      
      const errorManager = new SimilarityCacheManager(mockLogger, errorCacheService, 300000);
      
      // Should not throw
      await expect(errorManager.delete('test-key')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting from similarity cache:', expect.any(Error));
    });
  });

  describe('clear', () => {
    it('should clear all similarity cache entries', async () => {
      // Add some similarity cache entries
      await cacheManager.set('key1', 0.75);
      await cacheManager.set('key2', 0.85);
      
      // Add a non-similarity cache entry
      mockCacheService.setCache('other-key', 'value');
      
      await cacheManager.clear();
      
      // Similarity entries should be deleted
      expect(mockCacheService.getFromCache('similarity:key1')).toBeUndefined();
      expect(mockCacheService.getFromCache('similarity:key2')).toBeUndefined();
      
      // Non-similarity entry should remain
      expect(mockCacheService.getFromCache('other-key')).toBe('value');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Similarity cache cleared, 2 entries removed');
    });

    it('should not clear when CacheService is not available', async () => {
      const managerWithoutCache = new SimilarityCacheManager(mockLogger, undefined, 300000);
      
      // Should not throw
      await expect(managerWithoutCache.clear()).resolves.toBeUndefined();
    });

    it('should handle cache errors gracefully', async () => {
      const errorCacheService = {
        deleteByPattern: jest.fn().mockImplementation(() => {
          throw new Error('Cache error');
        })
      } as any;
      
      const errorManager = new SimilarityCacheManager(mockLogger, errorCacheService, 300000);
      
      // Should not throw
      await expect(errorManager.clear()).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Error clearing similarity cache:', expect.any(Error));
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Add some entries
      await cacheManager.set('key1', 0.75);
      await cacheManager.set('key2', 0.85);
      
      // Perform some operations to affect stats
      await cacheManager.get('key1'); // hit
      await cacheManager.get('non-existent'); // miss
      
      const stats = await cacheManager.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(2);
    });

    it('should return stats with size 0 when CacheService is not available', async () => {
      const managerWithoutCache = new SimilarityCacheManager(mockLogger, undefined, 300000);
      
      const stats = await managerWithoutCache.getStats();
      
      expect(stats.size).toBe(0);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys for same inputs', () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function test() { return false; }';
      const strategy = 'levenshtein';
      const options = { threshold: 0.8 };
      
      const key1 = cacheManager.generateCacheKey(content1, content2, strategy, options);
      const key2 = cacheManager.generateCacheKey(content1, content2, strategy, options);
      
      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different inputs', () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function test() { return false; }';
      const strategy = 'levenshtein';
      const options = { threshold: 0.8 };
      
      const key1 = cacheManager.generateCacheKey(content1, content2, strategy, options);
      const key2 = cacheManager.generateCacheKey(content2, content1, strategy, options);
      
      expect(key1).not.toBe(key2);
    });

    it('should handle options parameter correctly', () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function test() { return false; }';
      const strategy = 'levenshtein';
      
      const key1 = cacheManager.generateCacheKey(content1, content2, strategy);
      const key2 = cacheManager.generateCacheKey(content1, content2, strategy, { threshold: 0.8 });
      
      expect(key1).not.toBe(key2);
    });

    it('should include all components in the key', () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function test() { return false; }';
      const strategy = 'levenshtein';
      const options = { threshold: 0.8 };
      
      const key = cacheManager.generateCacheKey(content1, content2, strategy, options);
      
      expect(key).toContain(strategy);
      expect(key.split(':')).toHaveLength(4); // strategy:hash1:hash2:optionsHash
    });
  });

  describe('integration tests', () => {
    it('should handle complete cache lifecycle', async () => {
      const key = 'integration-test';
      const value = 0.92;
      
      // Set value
      await cacheManager.set(key, value);
      
      // Get value
      const retrievedValue = await cacheManager.get(key);
      expect(retrievedValue).toBe(value);
      
      // Update value
      const newValue = 0.95;
      await cacheManager.set(key, newValue);
      
      // Get updated value
      const updatedValue = await cacheManager.get(key);
      expect(updatedValue).toBe(newValue);
      
      // Delete value
      await cacheManager.delete(key);
      
      // Verify deletion
      const deletedValue = await cacheManager.get(key);
      expect(deletedValue).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      const key = 'ttl-test';
      const value = 0.88;
      const shortTTL = 100; // 100ms
      
      // Set value with short TTL
      await cacheManager.set(key, value, shortTTL);
      
      // Get value immediately
      const immediateValue = await cacheManager.get(key);
      expect(immediateValue).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Get value after expiration
      const expiredValue = await cacheManager.get(key);
      expect(expiredValue).toBeNull();
    });
  });
});