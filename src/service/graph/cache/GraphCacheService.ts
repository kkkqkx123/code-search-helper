import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { CacheEntry, GraphAnalysisResult } from '../core/types';

export interface IGraphCacheService {
  getFromCache<T>(key: string): T | null;
  setCache<T>(key: string, value: T, ttl?: number): void;
  invalidateCache(key: string): void;
  clearAllCache(): void;
  getCacheStats(): { hits: number; misses: number; size: number };
  getGraphStatsCache(): GraphAnalysisResult | null;
  setGraphStatsCache(stats: GraphAnalysisResult): void;
}

@injectable()
export class GraphCacheService implements IGraphCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private hits: number = 0;
  private misses: number = 0;
  private graphStatsCache: CacheEntry<GraphAnalysisResult> | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  getFromCache<T>(key: string): T | null {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.misses++;
        return null;
      }

      // Check if entry has expired
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.misses++;
        this.logger.debug(`Cache entry expired for key: ${key}`);
        return null;
      }

      this.hits++;
      this.logger.debug(`Cache hit for key: ${key}`);
      return entry.data as T;
    } catch (error) {
      this.logger.error(`Error getting from cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache retrieval failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'getFromCache', key }
      );
      return null;
    }
  }

  setCache<T>(key: string, value: T, ttl?: number): void {
    try {
      const defaultTTL = this.configService.get('caching').defaultTTL || 30000; // 5 minutes default
      const cacheTTL = ttl || defaultTTL;
      
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: cacheTTL,
      };

      this.cache.set(key, entry);
      this.logger.debug(`Cache set for key: ${key}, TTL: ${cacheTTL}ms`);
    } catch (error) {
      this.logger.error(`Error setting cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache setting failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'setCache', key }
      );
    }
  }

  invalidateCache(key: string): void {
    try {
      this.cache.delete(key);
      this.logger.debug(`Cache invalidated for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache invalidation failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'invalidateCache', key }
      );
    }
  }

  clearAllCache(): void {
    try {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
      this.graphStatsCache = null;
      this.logger.info('All graph cache cleared');
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache clearing failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'clearAllCache' }
      );
    }
  }

  getCacheStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  getGraphStatsCache(): GraphAnalysisResult | null {
    try {
      if (!this.graphStatsCache) {
        return null;
      }

      // Check if entry has expired
      const now = Date.now();
      if (now - this.graphStatsCache.timestamp > this.graphStatsCache.ttl) {
        this.graphStatsCache = null;
        this.logger.debug('Graph stats cache expired');
        return null;
      }

      this.hits++;
      this.logger.debug('Graph stats cache hit');
      return this.graphStatsCache.data;
    } catch (error) {
      this.logger.error(`Error getting graph stats cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Graph stats cache retrieval failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'getGraphStatsCache' }
      );
      return null;
    }
  }

  setGraphStatsCache(stats: GraphAnalysisResult): void {
    try {
      const defaultTTL = this.configService.get('caching').defaultTTL || 300000; // 5 minutes default
      
      this.graphStatsCache = {
        data: stats,
        timestamp: Date.now(),
        ttl: defaultTTL,
      };

      this.logger.debug('Graph stats cache set');
    } catch (error) {
      this.logger.error(`Error setting graph stats cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Graph stats cache setting failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'setGraphStatsCache' }
      );
    }
  }

  /**
   * 清理过期的缓存项
   */
  cleanupExpired(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up cache: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache cleanup failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'cleanupExpired' }
      );
    }
  }

  /**
   * 获取缓存使用情况
   */
  getCacheUsage(): { total: number; used: number; percentage: number } {
    const total = this.configService.get('caching').maxSize || 10000;
    const used = this.cache.size;
    const percentage = total > 0 ? (used / total) * 10 : 0;

    return {
      total,
      used,
      percentage,
    };
  }

  /**
   * 检查缓存是否接近容量限制
   */
  isNearCapacity(): boolean {
    const usage = this.getCacheUsage();
    // 如果使用率超过80%，则认为接近容量限制
    return usage.percentage > 80;
  }

 /**
   * 当缓存接近容量限制时，删除最旧的条目
   */
  evictOldestEntries(ratio: number = 0.2): void {
    try {
      if (!this.isNearCapacity()) {
        return;
      }

      const entries = Array.from(this.cache.entries());
      // 按时间戳排序（最旧的在前）
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // 计算要删除的条目数量
      const totalEntries = entries.length;
      const entriesToRemove = Math.floor(totalEntries * ratio);

      if (entriesToRemove > 0) {
        for (let i = 0; i < entriesToRemove; i++) {
          const [key] = entries[i];
          this.cache.delete(key);
        }

        this.logger.debug(`Evicted ${entriesToRemove} oldest cache entries`);
      }
    } catch (error) {
      this.logger.error(`Error evicting oldest entries: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache eviction failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphCacheService', operation: 'evictOldestEntries' }
      );
    }
  }
}