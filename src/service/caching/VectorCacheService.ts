import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../../infrastructure/types';
import { ICacheService, CacheEntry, CacheConfig } from '../../infrastructure/caching/types';

export interface SearchResult {
  id: string;
  score: number;
  payload: any;
}

@injectable()
export class VectorCacheService implements ICacheService {
  private logger: LoggerService;
  private embeddingCache: Map<string, CacheEntry<number[]>>;
  private searchCache: Map<string, CacheEntry<SearchResult[]>>;
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
    this.embeddingCache = new Map();
    this.searchCache = new Map();
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

  getFromCache<T>(key: string): T | undefined {
    // 对于向量缓存，我们不使用通用缓存，而是使用专门的缓存
    return undefined;
  }

  setCache<T>(key: string, data: T, ttl: number = this.config.defaultTTL): void {
    // 对于向量缓存，我们不使用通用缓存，而是使用专门的缓存
    this.logger.debug('Vector cache does not use generic cache', { key });
  }

  deleteFromCache(key: string): boolean {
    // 删除嵌入缓存和搜索缓存中的项目
    const embeddingDeleted = this.embeddingCache.delete(key);
    const searchDeleted = this.searchCache.delete(key);
    return embeddingDeleted || searchDeleted;
  }

  clearAllCache(): void {
    const embeddingSize = this.embeddingCache.size;
    const searchSize = this.searchCache.size;
    this.embeddingCache.clear();
    this.searchCache.clear();
    this.logger.info('Vector caches cleared', {
      embeddingEntriesRemoved: embeddingSize,
      searchEntriesRemoved: searchSize
    });
  }

  getCacheStats() {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    const hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;

    return {
      totalEntries: this.embeddingCache.size + this.searchCache.size,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate,
    };
  }

  cleanupExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    // 清理嵌入缓存
    for (const [key, entry] of this.embeddingCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.embeddingCache.delete(key);
        expiredCount++;
      }
    }

    // 清理搜索缓存
    for (const [key, entry] of this.searchCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.searchCache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Cleaned up expired vector cache entries', { expiredCount });
    }
  }

  deleteByPattern(pattern: RegExp): number {
    let deletedCount = 0;

    // 删除匹配模式的嵌入缓存
    for (const [key] of this.embeddingCache.entries()) {
      if (pattern.test(key)) {
        this.embeddingCache.delete(key);
        deletedCount++;
      }
    }

    // 删除匹配模式的搜索缓存
    for (const [key] of this.searchCache.entries()) {
      if (pattern.test(key)) {
        this.searchCache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.debug('Deleted cache entries by pattern', { deletedCount, pattern: pattern.toString() });
    }

    return deletedCount;
  }

  isGraphCacheHealthy(): boolean {
    const cacheStats = this.getCacheStats();
    const maxSize = 10000;
    
    // 缓存健康检查条件：总条目数未超过最大限制
    return cacheStats.totalEntries <= maxSize;
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

  // 向量缓存专用方法
  async cacheEmbedding(vectorId: string, embedding: number[]): Promise<void> {
    const key = `embedding:${vectorId}`;
    const entry = this.createCacheEntry(embedding, this.config.defaultTTL);
    this.embeddingCache.set(key, entry);
    this.logger.debug('Embedding cached', { vectorId, embeddingLength: embedding.length });
  }

  async getEmbedding(vectorId: string): Promise<number[] | null> {
    const key = `embedding:${vectorId}`;
    const entry = this.embeddingCache.get(key);

    if (entry && !this.isExpired(entry)) {
      this.updateCacheStats('hit', 1);
      return entry.data;
    }

    this.updateCacheStats('miss', 1);
    return null;
  }

  async cacheVectorSearch(searchKey: string, results: SearchResult[]): Promise<void> {
    const key = `search:${searchKey}`;
    const entry = this.createCacheEntry(results, this.config.defaultTTL);
    this.searchCache.set(key, entry);
    this.logger.debug('Vector search results cached', { searchKey, resultCount: results.length });
  }

  async getCachedVectorSearch(searchKey: string): Promise<SearchResult[] | null> {
    const key = `search:${searchKey}`;
    const entry = this.searchCache.get(key);

    if (entry && !this.isExpired(entry)) {
      this.updateCacheStats('hit', 1);
      return entry.data;
    }

    this.updateCacheStats('miss', 1);
    return null;
  }

  async invalidateVectorCache(vectorId?: string): Promise<void> {
    if (vectorId) {
      // 使特定向量的缓存失效
      const embeddingKey = `embedding:${vectorId}`;
      const searchKey = `search:${vectorId}`;
      this.embeddingCache.delete(embeddingKey);
      this.searchCache.delete(searchKey);
      this.logger.info('Invalidated vector cache for specific vector', { vectorId });
    } else {
      // 使整个向量缓存失效
      this.clearAllCache();
      this.logger.info('Invalidated all vector cache');
    }
  }

  private createCacheEntry<T>(data: T, ttl: number): CacheEntry<T> {
    return {
      data,
      timestamp: Date.now(),
      ttl,
    };
  }

  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateCacheStats(operation: string, count: number): void {
    if (this.config.enableStats) {
      if (operation === 'hit') {
        this.stats.hitCount += count;
      } else {
        this.stats.missCount += count;
      }
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
}