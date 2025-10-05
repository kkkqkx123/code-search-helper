import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { ICacheService, CacheEntry, CacheConfig, GraphAnalysisResult } from './types';

@injectable()
export class CacheService implements ICacheService {
  private logger: LoggerService;
  private cache: Map<string, CacheEntry<any>>;
  private databaseSpecificCache: Map<DatabaseType, Map<string, CacheEntry<any>>>;
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats: {
    hitCount: number;
    missCount: number;
  };

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.cache = new Map();
    this.databaseSpecificCache = new Map();
    // 初始化数据库特定缓存映射
    Object.values(DatabaseType).forEach(dbType => {
      this.databaseSpecificCache.set(dbType, new Map<string, CacheEntry<any>>());
    });
    this.stats = {
      hitCount: 0,
      missCount: 0,
    };

    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxEntries: 10000,
      cleanupInterval: 60000, // 1 minute
      enableStats: true,
      databaseSpecific: {}
    };

    this.startCleanupInterval();
  }

  getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.missCount++;
      }
      this.logger.debug('Cache miss', { key });
      return undefined;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.config.enableStats) {
        this.stats.missCount++;
      }
      this.logger.debug('Cache entry expired', { key });
      return undefined;
    }

    if (this.config.enableStats) {
      this.stats.hitCount++;
    }
    this.logger.debug('Cache hit', { key });
    return entry.data;
  }

  setCache<T>(key: string, data: T, ttl: number = this.config.defaultTTL): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictEntries();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.logger.debug('Cache entry set', { key, ttl });
  }

  deleteFromCache(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry deleted', { key });
    } else {
      this.logger.debug('Cache entry not found for deletion', { key });
    }
    return deleted;
  }

  clearAllCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared', { entriesRemoved: size });
  }

  getCacheStats() {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    const hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;

    return {
      totalEntries: this.cache.size,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate,
    };
  }

  cleanupExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Cleaned up expired cache entries', { expiredCount });
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);

    // Ensure interval doesn't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private evictEntries(): void {
    // Simple LRU eviction: remove the oldest 10% of entries
    const entriesToRemove = Math.ceil(this.cache.size * 0.1);
    const keys = Array.from(this.cache.keys());

    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      this.cache.delete(keys[i]);
    }

    this.logger.info('Evicted cache entries due to size limit', {
      entriesRemoved: entriesToRemove,
      remainingEntries: this.cache.size
    });
  }

  // Graph-specific cache methods
  getGraphStatsCache(): GraphAnalysisResult | undefined {
    return this.getFromCache<GraphAnalysisResult>('graph_stats');
  }

  setGraphStatsCache(data: GraphAnalysisResult, ttl: number = this.config.defaultTTL): void {
    this.setCache('graph_stats', data, ttl);
  }

  // Additional utility methods
  hasKey(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getSize(): number {
    return this.cache.size;
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Cache configuration updated', { config });
  }

  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Stopped cache cleanup interval');
    }
  }

  // Method to manually trigger cleanup
  forceCleanup(): void {
    this.cleanupExpiredEntries();
  }

  // Method to get cache performance metrics
  getPerformanceMetrics() {
    const stats = this.getCacheStats();
    const now = Date.now();

    let totalTTL = 0;
    let averageTTL = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      totalTTL += entry.ttl;
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      }
    }

    averageTTL = this.cache.size > 0 ? totalTTL / this.cache.size : 0;

    return {
      ...stats,
      averageTTL,
      expiredEntries,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  // Method to preload cache with data
  preloadCache<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.setCache(entry.key, entry.data, entry.ttl || this.config.defaultTTL);
    }
    this.logger.info('Preloaded cache with entries', { count: entries.length });
  }

  // Method to get cache entries by pattern
  getKeysByPattern(pattern: RegExp): string[] {
    return this.getKeys().filter(key => pattern.test(key));
  }

  // Method to delete cache entries by pattern
  deleteByPattern(pattern: RegExp): number {
    const keysToDelete = this.getKeysByPattern(pattern);
    let deletedCount = 0;

    for (const key of keysToDelete) {
      if (this.deleteFromCache(key)) {
        deletedCount++;
      }
    }

    this.logger.info('Deleted cache entries by pattern', {
      pattern: pattern.toString(),
      deletedCount
    });

    return deletedCount;
  }

  // 扩展方法：支持多数据库类型的缓存
  async getDatabaseSpecificCache<T>(key: string, databaseType: DatabaseType): Promise<T | null> {
    const dbCache = this.databaseSpecificCache.get(databaseType);
    if (!dbCache) {
      this.logger.warn('Database-specific cache not found', { databaseType });
      return null;
    }

    const entry = dbCache.get(key);
    if (!entry) {
      this.logger.debug('Database-specific cache miss', { key, databaseType });
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      dbCache.delete(key);
      this.logger.debug('Database-specific cache entry expired', { key, databaseType });
      return null;
    }

    this.logger.debug('Database-specific cache hit', { key, databaseType });
    return entry.data as T;
  }

  async setDatabaseSpecificCache<T>(key: string, value: T, databaseType: DatabaseType, ttl?: number): Promise<void> {
    const dbCache = this.databaseSpecificCache.get(databaseType);
    if (!dbCache) {
      this.logger.warn('Database-specific cache not found', { databaseType });
      return;
    }

    // 获取特定数据库类型的配置
    const dbConfig = this.config.databaseSpecific[databaseType] || {
      defaultTTL: this.config.defaultTTL,
      maxEntries: this.config.maxEntries
    };

    // 检查是否需要驱逐条目
    if (dbCache.size >= dbConfig.maxEntries) {
      this.evictDatabaseSpecificEntries(databaseType);
    }

    const effectiveTTL = ttl !== undefined ? ttl : dbConfig.defaultTTL;

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: effectiveTTL,
    };

    dbCache.set(key, entry);
    this.logger.debug('Database-specific cache entry set', { key, databaseType, ttl: effectiveTTL });
  }

  async invalidateDatabaseCache(databaseType: DatabaseType): Promise<void> {
    const dbCache = this.databaseSpecificCache.get(databaseType);
    if (dbCache) {
      const size = dbCache.size;
      dbCache.clear();
      this.logger.info('Database-specific cache invalidated', { databaseType, entriesRemoved: size });
    } else {
      this.logger.warn('Database-specific cache not found for invalidation', { databaseType });
    }
  }

  private evictDatabaseSpecificEntries(databaseType: DatabaseType): void {
    const dbCache = this.databaseSpecificCache.get(databaseType);
    if (!dbCache) return;

    // 获取特定数据库类型的配置
    const dbConfig = this.config.databaseSpecific[databaseType] || {
      defaultTTL: this.config.defaultTTL,
      maxEntries: this.config.maxEntries
    };

    // 简单的LRU驱逐：删除最老的10%条目
    const entriesToRemove = Math.ceil(dbCache.size * 0.1);
    const keys = Array.from(dbCache.keys());

    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      dbCache.delete(keys[i]);
    }

    this.logger.info('Evicted database-specific cache entries due to size limit', {
      databaseType,
      entriesRemoved: entriesToRemove,
      remainingEntries: dbCache.size
    });
  }

  // 专门用于Nebula图数据的缓存方法
  async cacheNebulaGraphData(spaceName: string, data: any): Promise<void> {
    const key = `nebula:graph:${spaceName}`;
    await this.setDatabaseSpecificCache(key, data, DatabaseType.NEBULA);
  }

  async getNebulaGraphData(spaceName: string): Promise<any | null> {
    const key = `nebula:graph:${spaceName}`;
    return await this.getDatabaseSpecificCache(key, DatabaseType.NEBULA);
  }

  // 专门用于Qdrant向量数据的缓存方法
  async cacheVectorData(collectionName: string, data: any): Promise<void> {
    const key = `qdrant:vector:${collectionName}`;
    await this.setDatabaseSpecificCache(key, data, DatabaseType.QDRANT);
  }

  async getVectorData(collectionName: string): Promise<any | null> {
    const key = `qdrant:vector:${collectionName}`;
    return await this.getDatabaseSpecificCache(key, DatabaseType.QDRANT);
  }
}