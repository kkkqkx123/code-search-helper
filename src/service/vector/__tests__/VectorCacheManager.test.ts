import { VectorCacheManager } from '../caching/VectorCacheManager';
import { LoggerService } from '../../../utils/LoggerService';
import { Vector, SearchResult, CacheStats } from '../types/VectorTypes';

describe('VectorCacheManager', () => {
  let vectorCacheManager: VectorCacheManager;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    vectorCacheManager = new VectorCacheManager(mockLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('getVector', () => {
    it('should return cached vector when found and not expired', async () => {
      // Arrange
      const key = 'test-vector-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      await vectorCacheManager.setVector(key, vector);

      // Act
      const result = await vectorCacheManager.getVector(key);

      // Assert
      expect(result).toEqual(vector);
    });

    it('should return null when vector not found', async () => {
      // Arrange
      const key = 'non-existent-key';

      // Act
      const result = await vectorCacheManager.getVector(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when vector is expired', async () => {
      // Arrange
      const key = 'test-vector-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      // Set with very short TTL
      await vectorCacheManager.setVector(key, vector, 1);

      // Fast-forward time to ensure expiration
      jest.advanceTimersByTime(10);

      // Act
      const result = await vectorCacheManager.getVector(key);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setVector', () => {
    it('should store vector in cache', async () => {
      // Arrange
      const key = 'test-vector-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      // Act
      await vectorCacheManager.setVector(key, vector);

      // Assert
      const result = await vectorCacheManager.getVector(key);
      expect(result).toEqual(vector);
    });

    it('should use custom TTL when provided', async () => {
      // Arrange
      const key = 'test-vector-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      // Act
      await vectorCacheManager.setVector(key, vector, 5000); // 5 seconds

      // Assert
      const result = await vectorCacheManager.getVector(key);
      expect(result).toEqual(vector);
    });
  });

  describe('getSearchResult', () => {
    it('should return cached search results when found and not expired', async () => {
      // Arrange
      const key = 'test-search-key';
      const searchResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      await vectorCacheManager.setSearchResult(key, searchResults);

      // Act
      const result = await vectorCacheManager.getSearchResult(key);

      // Assert
      expect(result).toEqual(searchResults);
    });

    it('should return null when search results not found', async () => {
      // Arrange
      const key = 'non-existent-key';

      // Act
      const result = await vectorCacheManager.getSearchResult(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when search results are expired', async () => {
      // Arrange
      const key = 'test-search-key';
      const searchResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      // Set with very short TTL
      await vectorCacheManager.setSearchResult(key, searchResults, 1);

      // Fast-forward time to ensure expiration
      jest.advanceTimersByTime(10);

      // Act
      const result = await vectorCacheManager.getSearchResult(key);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setSearchResult', () => {
    it('should store search results in cache', async () => {
      // Arrange
      const key = 'test-search-key';
      const searchResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      // Act
      await vectorCacheManager.setSearchResult(key, searchResults);

      // Assert
      const result = await vectorCacheManager.getSearchResult(key);
      expect(result).toEqual(searchResults);
    });

    it('should use custom TTL when provided', async () => {
      // Arrange
      const key = 'test-search-key';
      const searchResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      // Act
      await vectorCacheManager.setSearchResult(key, searchResults, 5000); // 5 seconds

      // Assert
      const result = await vectorCacheManager.getSearchResult(key);
      expect(result).toEqual(searchResults);
    });
  });

  describe('delete', () => {
    it('should delete vector and search results by key', async () => {
      // Arrange
      const key = 'test-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };
      const searchResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      await vectorCacheManager.setVector(key, vector);
      await vectorCacheManager.setSearchResult(key, searchResults);

      // Verify items are cached
      expect(await vectorCacheManager.getVector(key)).toEqual(vector);
      expect(await vectorCacheManager.getSearchResult(key)).toEqual(searchResults);

      // Act
      await vectorCacheManager.delete(key);

      // Assert
      expect(await vectorCacheManager.getVector(key)).toBeNull();
      expect(await vectorCacheManager.getSearchResult(key)).toBeNull();
    });
  });

  describe('deleteByPattern', () => {
    it('should delete items matching pattern', async () => {
      // Arrange
      const key1 = 'test-key-1';
      const key2 = 'test-key-2';
      const key3 = 'other-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      await vectorCacheManager.setVector(key1, vector);
      await vectorCacheManager.setVector(key2, vector);
      await vectorCacheManager.setVector(key3, vector);

      // Act
      await vectorCacheManager.deleteByPattern('test-.*');

      // Assert
      expect(await vectorCacheManager.getVector(key1)).toBeNull();
      expect(await vectorCacheManager.getVector(key2)).toBeNull();
      expect(await vectorCacheManager.getVector(key3)).toEqual(vector);
    });
  });

  describe('clear', () => {
    it('should clear all cached items', async () => {
      // Arrange
      const key1 = 'test-key-1';
      const key2 = 'test-key-2';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };
      const searchResults: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          metadata: { projectId: 'test-project' }
        }
      ];

      await vectorCacheManager.setVector(key1, vector);
      await vectorCacheManager.setVector(key2, vector);
      await vectorCacheManager.setSearchResult(key1, searchResults);

      // Act
      await vectorCacheManager.clear();

      // Assert
      expect(await vectorCacheManager.getVector(key1)).toBeNull();
      expect(await vectorCacheManager.getVector(key2)).toBeNull();
      expect(await vectorCacheManager.getSearchResult(key1)).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Arrange
      const key1 = 'test-key-1';
      const key2 = 'test-key-2';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      await vectorCacheManager.setVector(key1, vector);
      await vectorCacheManager.setVector(key2, vector);

      // Generate some hits and misses
      await vectorCacheManager.getVector(key1); // hit
      await vectorCacheManager.getVector('non-existent'); // miss

      // Act
      const stats = await vectorCacheManager.getStats();

      // Assert
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.totalEntries).toBe(2);
      expect(stats.memoryUsage).toBe(0);
    });

    it('should handle zero operations correctly', async () => {
      // Act
      const stats = await vectorCacheManager.getStats();

      // Assert
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalEntries).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });
  });

  describe('cleanup mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clean up expired entries periodically', async () => {
      // Arrange
      const key = 'test-key';
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'test content',
        metadata: { projectId: 'test-project' },
        timestamp: new Date()
      };

      // Set with very short TTL
      await vectorCacheManager.setVector(key, vector, 1);

      // Verify item is cached
      expect(await vectorCacheManager.getVector(key)).toEqual(vector);

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(61000); // 61 seconds (cleanup interval is 60 seconds)

      // Manually trigger the cleanup by running pending timers
      jest.runOnlyPendingTimers();

      // Assert
      expect(await vectorCacheManager.getVector(key)).toBeNull();
    });
  });
});