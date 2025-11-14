import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { CompressionUtils } from '../../utils/cache/CompressionUtils';
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
  private compressedKeys: Set<string> = new Set();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.cache = new Map();
    this.databaseSpecificCache = new Map();
    Object.values(DatabaseType).forEach(dbType => {
      this.databaseSpecificCache.set(dbType, new Map<string, CacheEntry<any>>());
    });
    this.stats = {
      hitCount: 0,
      missCount: 0,
    };

    this.config = {
      defaultTTL: 300000,
      maxEntries: 10000,
      cleanupInterval: 60000,
      enableStats: true,
      databaseSpecific: {}
    };

    this.startCleanupInterval();
  }

  getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) this.stats.missCount++;
      this.logger.debug('Cache miss', { key });
      return undefined;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.compressedKeys.delete(key);
      if (this.config.enableStats) this.stats.missCount++;
      this.logger.debug('Cache entry expired', { key });
      return undefined;
    }

    if (this.config.enableStats) this.stats.hitCount++;
    this.logger.debug('Cache hit', { key });
    
    // 解压缩
    if (this.compressedKeys.has(key)) {
      const decompressed = CompressionUtils.decompress(entry.data as Buffer);
      return JSON.parse(decompressed) as T;
    }
    
    return entry.data;
  }

  setCache<T>(key: string, data: T, ttl: number = this.config.defaultTTL): void {
    // 内存检查
    this.checkMemoryUsage();
    
    if (this.cache.size >= this.config.maxEntries) {
      this.evictEntries();
    }

    let finalData: any = data;
    
    // 压缩逻辑
    if (this.config.enableCompression) {
      const dataStr = JSON.stringify(data);
      const dataSize = Buffer.byteLength(dataStr);
      
      if (dataSize > (this.config.compressionThreshold || 1024)) {
        finalData = CompressionUtils.compress(dataStr);
        this.compressedKeys.add(key);
        this.logger.debug('Data compressed', { key, originalSize: dataSize, compressedSize: finalData.length });
      }
    }

    const entry: CacheEntry<T> = {
      data: finalData,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.logger.debug('Cache entry set', { key, ttl });
  }

  deleteFromCache(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.compressedKeys.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry deleted', { key });
    }
    return deleted;
  }

  clearAllCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.compressedKeys.clear();
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
        this.compressedKeys.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Cleaned up expired cache entries', { expiredCount });
    }
  }

  private checkMemoryUsage(): void {
    if (!this.config.maxMemory) return;
    
    const usage = process.memoryUsage();
    const heapRatio = usage.heapUsed / usage.heapTotal;
    const threshold = this.config.memoryThreshold || 0.8;
    
    if (heapRatio > threshold) {
      this.logger.warn('High memory usage detected', { heapRatio, threshold });
      this.aggressiveCleanup();
    }
  }
  
  private aggressiveCleanup(): void {
    const entriesToRemove = Math.ceil(this.cache.size * 0.3);
    const keys = Array.from(this.cache.keys());
    
    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      this.cache.delete(keys[i]);
      this.compressedKeys.delete(keys[i]);
    }
    
    this.logger.info('Aggressive cleanup completed', {
      entriesRemoved: entriesToRemove,
      remainingEntries: this.cache.size
    });
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private evictEntries(): void {
    const entriesToRemove = Math.ceil(this.cache.size * 0.1);
    const keys = Array.from(this.cache.keys());

    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      this.cache.delete(keys[i]);
      this.compressedKeys.delete(keys[i]);
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

  async cacheGraphData(key: string, data: any, ttl?: number): Promise<void> {
    this.setCache(`graph:${key}`, data, ttl || this.config.defaultTTL);
  }
  
  async getGraphData(key: string): Promise<any | null> {
    return this.getFromCache(`graph:${key}`) || null;
  }

  // Additional utility methods
  hasKey(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.compressedKeys.delete(key);
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

  forceCleanup(): void {
    this.cleanupExpiredEntries();
  }

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

  preloadCache<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.setCache(entry.key, entry.data, entry.ttl || this.config.defaultTTL);
    }
    this.logger.info('Preloaded cache with entries', { count: entries.length });
  }

  getKeysByPattern(pattern: RegExp): string[] {
    return this.getKeys().filter(key => pattern.test(key));
  }

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

    const dbConfig = this.config.databaseSpecific[databaseType] || {
      defaultTTL: this.config.defaultTTL,
      maxEntries: this.config.maxEntries
    };

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

    const dbConfig = this.config.databaseSpecific[databaseType] || {
      defaultTTL: this.config.defaultTTL,
      maxEntries: this.config.maxEntries
    };

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

  async cacheNebulaGraphData(spaceName: string, data: any): Promise<void> {
    const key = `nebula:graph:${spaceName}`;
    await this.setDatabaseSpecificCache(key, data, DatabaseType.NEBULA);
  }

  async getNebulaGraphData(spaceName: string): Promise<any | null> {
    const key = `nebula:graph:${spaceName}`;
    return await this.getDatabaseSpecificCache(key, DatabaseType.NEBULA);
  }

  async cacheVectorData(collectionName: string, data: any): Promise<void> {
    const key = `qdrant:vector:${collectionName}`;
    await this.setDatabaseSpecificCache(key, data, DatabaseType.QDRANT);
  }

  async getVectorData(collectionName: string): Promise<any | null> {
    const key = `qdrant:vector:${collectionName}`;
    return await this.getDatabaseSpecificCache(key, DatabaseType.QDRANT);
  }
}