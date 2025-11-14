import { VectorCacheManager } from '../caching/VectorCacheManager';
import { LoggerService } from '../../../utils/LoggerService';
import { Vector, SearchResult, CacheStats, CacheClearOptions, CacheClearResult } from '../types/VectorTypes';
import { ICacheService } from '../../../infrastructure/caching/types';

describe('VectorCacheManager', () => {
  let vectorCacheManager: VectorCacheManager;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockCacheService: jest.Mocked<ICacheService>;

  beforeEach(() => {
    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockCacheService = {
      getFromCache: jest.fn(),
      setCache: jest.fn(),
      deleteFromCache: jest.fn(),
      clearAllCache: jest.fn(),
      getCacheStats: jest.fn(),
      cleanupExpiredEntries: jest.fn(),
      isGraphCacheHealthy: jest.fn(),
      deleteByPattern: jest.fn(),
      getKeysByPattern: jest.fn(),
      getDatabaseSpecificCache: jest.fn(),
      setDatabaseSpecificCache: jest.fn(),
      invalidateDatabaseCache: jest.fn(),
    } as any;

    vectorCacheManager = new VectorCacheManager(mockCacheService, mockLoggerService);
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

      (mockCacheService.getFromCache as jest.Mock).mockReturnValue(vector);
      await vectorCacheManager.setVector(key, vector);

      // Act
      const result = await vectorCacheManager.getVector(key);

      // Assert
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(`vector:${key}`);
      expect(result).toEqual(vector);
    });

    it('should return null when vector not found', async () => {
      // Arrange
      const key = 'non-existent-key';
      (mockCacheService.getFromCache as jest.Mock).mockReturnValue(undefined);

      // Act
      const result = await vectorCacheManager.getVector(key);

      // Assert
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(`vector:${key}`);
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
      expect(mockCacheService.setCache).toHaveBeenCalledWith(`vector:${key}`, vector, 300000);
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
      expect(mockCacheService.setCache).toHaveBeenCalledWith(`vector:${key}`, vector, 5000);
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

      (mockCacheService.getFromCache as jest.Mock).mockReturnValue(searchResults);
      await vectorCacheManager.setSearchResult(key, searchResults);

      // Act
      const result = await vectorCacheManager.getSearchResult(key);

      // Assert
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(`search:${key}`);
      expect(result).toEqual(searchResults);
    });

    it('should return null when search results not found', async () => {
      // Arrange
      const key = 'non-existent-key';
      (mockCacheService.getFromCache as jest.Mock).mockReturnValue(undefined);

      // Act
      const result = await vectorCacheManager.getSearchResult(key);

      // Assert
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(`search:${key}`);
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
      expect(mockCacheService.setCache).toHaveBeenCalledWith(`search:${key}`, searchResults, 300000);
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
      expect(mockCacheService.setCache).toHaveBeenCalledWith(`search:${key}`, searchResults, 5000);
    });
  });

  describe('delete', () => {
    it('should delete vector and search results by key', async () => {
      // Arrange
      const key = 'test-key';

      // Act
      await vectorCacheManager.delete(key);

      // Assert
      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(`vector:${key}`);
      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(`search:${key}`);
    });
  });

  describe('deleteByPattern', () => {
    it('should delete items matching pattern', async () => {
      // Arrange
      const pattern = 'test-.*';
      const vectorPattern = /^vector:test-.*/;
      const searchPattern = /^search:test-.*/;

      // Act
      await vectorCacheManager.deleteByPattern(pattern);

      // Assert
      expect(mockCacheService.deleteByPattern).toHaveBeenCalledWith(vectorPattern);
      expect(mockCacheService.deleteByPattern).toHaveBeenCalledWith(searchPattern);
    });
 });

  describe('clear', () => {
    it('should clear all cached items and return statistics', async () => {
      // Arrange
      const mockKeys = ['vector:test1', 'vector:test2', 'search:test1'];
      (mockCacheService.getKeysByPattern as jest.Mock).mockReturnValue(mockKeys);
      (mockCacheService.deleteFromCache as jest.Mock).mockReturnValue(true);

      // Act
      const result = await vectorCacheManager.clear();

      // Assert
      expect(mockCacheService.getKeysByPattern).toHaveBeenCalled();
      expect(mockCacheService.deleteFromCache).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        vectorsCleared: 2,
        searchResultsCleared: 1,
        totalCleared: 3,
        success: true,
        executionTime: expect.any(Number)
      });
    });

    it('should clear only vectors when specified', async () => {
      // Arrange
      const mockKeys = ['vector:test1', 'vector:test2'];
      (mockCacheService.getKeysByPattern as jest.Mock).mockReturnValue(mockKeys);
      (mockCacheService.deleteFromCache as jest.Mock).mockReturnValue(true);
      const options: CacheClearOptions = { clearVectors: true, clearSearchResults: false };

      // Act
      const result = await vectorCacheManager.clear(options);

      // Assert
      expect(result).toEqual({
        vectorsCleared: 2,
        searchResultsCleared: 0,
        totalCleared: 2,
        success: true,
        executionTime: expect.any(Number)
      });
    });

    it('should clear only search results when specified', async () => {
      // Arrange
      const mockKeys = ['search:test1', 'search:test2'];
      (mockCacheService.getKeysByPattern as jest.Mock).mockReturnValue(mockKeys);
      (mockCacheService.deleteFromCache as jest.Mock).mockReturnValue(true);
      const options: CacheClearOptions = { clearVectors: false, clearSearchResults: true };

      // Act
      const result = await vectorCacheManager.clear(options);

      // Assert
      expect(result).toEqual({
        vectorsCleared: 0,
        searchResultsCleared: 2,
        totalCleared: 2,
        success: true,
        executionTime: expect.any(Number)
      });
    });

    it('should filter by timestamp when olderThan is specified', async () => {
      // Arrange
      const mockKeys = ['vector:test1', 'search:test1'];
      const oldTimestamp = Date.now() - 1000000; // 1 second ago
      const mockEntry = { timestamp: oldTimestamp - 1000 }; // older than olderThan
      (mockCacheService.getKeysByPattern as jest.Mock).mockReturnValue(mockKeys);
      (mockCacheService.getFromCache as jest.Mock).mockReturnValue(mockEntry);
      (mockCacheService.deleteFromCache as jest.Mock).mockReturnValue(true);
      const options: CacheClearOptions = { olderThan: oldTimestamp };

      // Act
      const result = await vectorCacheManager.clear(options);

      // Assert
      expect(mockCacheService.getFromCache).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        vectorsCleared: 1,
        searchResultsCleared: 1,
        totalCleared: 2,
        success: true,
        executionTime: expect.any(Number)
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const errorMessage = 'Cache service error';
      (mockCacheService.getKeysByPattern as jest.Mock).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      // Act
      const result = await vectorCacheManager.clear();

      // Assert
      expect(result).toEqual({
        vectorsCleared: 0,
        searchResultsCleared: 0,
        totalCleared: 0,
        success: false,
        error: errorMessage,
        executionTime: expect.any(Number)
      });
    });

    it('should return empty result when no clearing options are selected', async () => {
      // Arrange
      const options: CacheClearOptions = { clearVectors: false, clearSearchResults: false };

      // Act
      const result = await vectorCacheManager.clear(options);

      // Assert
      expect(mockCacheService.getKeysByPattern).not.toHaveBeenCalled();
      expect(result).toEqual({
        vectorsCleared: 0,
        searchResultsCleared: 0,
        totalCleared: 0,
        success: true,
        executionTime: expect.any(Number)
      });
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Arrange
      const mockStats = {
        totalEntries: 5,
        hitCount: 3,
        missCount: 2,
        hitRate: 0.6
      };
      (mockCacheService.getCacheStats as jest.Mock).mockReturnValue(mockStats);

      // Act
      const stats = await vectorCacheManager.getStats();

      // Assert
      expect(mockCacheService.getCacheStats).toHaveBeenCalled();
      expect(stats).toEqual({
        hitCount: 3,
        missCount: 2,
        hitRate: 0.6,
        totalEntries: 5,
        memoryUsage: 0
      });
    });

    it('should handle zero operations correctly', async () => {
      // Arrange
      const mockStats = {
        totalEntries: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      };
      (mockCacheService.getCacheStats as jest.Mock).mockReturnValue(mockStats);

      // Act
      const stats = await vectorCacheManager.getStats();

      // Assert
      expect(mockCacheService.getCacheStats).toHaveBeenCalled();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalEntries).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });
  });

  // 移除cleanup mechanism测试，因为现在依赖CacheService的清理机制
});