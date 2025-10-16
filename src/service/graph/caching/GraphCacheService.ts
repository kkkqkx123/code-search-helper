import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { CacheEntry, GraphAnalysisResult } from '../core/types';
import { LRUCache } from '../../../utils/LRUCache';

export interface IGraphCacheService {
  getFromCache<T>(key: string): T | null;
  setCache<T>(key: string, value: T, ttl?: number): void;
  invalidateCache(key: string): void;
  clearAllCache(): void;
  getCacheStats(): { hits: number; misses: number; size: number };
  getGraphStatsCache(): GraphAnalysisResult | null;
  setGraphStatsCache(stats: GraphAnalysisResult): void;
  isHealthy(): boolean;
  getStatus(): string;
  cleanupExpired(): void;
  getCacheUsage(): { total: number; used: number; percentage: number };
  isNearCapacity(): boolean;
  evictOldestEntries(ratio?: number): void;
}

// 扩展 LRUCache 以支持 TTL
class TTLCache<K, V> extends LRUCache<K, CacheEntry<V>> {
  get(key: K): CacheEntry<V> | undefined {
    const item = super.get(key);
    return item;
  }

  set(key: K, value: CacheEntry<V>): void {
    super.set(key, value);
  }

  size(): number {
    return super.size();
  }

  entries(): IterableIterator<[K, CacheEntry<V>]> {
    // 创建一个 Map 来存储键值对
    const entriesMap = new Map<K, CacheEntry<V>>();

    // 获取所有键
    const keys = super.keys();

    // 为每个键获取值
    for (const key of keys) {
      const value = super.get(key);
      if (value !== undefined) {
        entriesMap.set(key, value);
      }
    }

    return entriesMap.entries();
  }
}

@injectable()
export class GraphCacheService implements IGraphCacheService {
  private cache: TTLCache<string, any>;
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

    // 延迟初始化缓存，避免在构造函数中访问未初始化的配置服务
    // 缓存将在第一次使用时通过 getCacheConfig() 方法初始化
    this.cache = new TTLCache<string, any>(10000); // 使用默认值
  }

  /**
   * 获取缓存配置，确保在配置服务初始化后使用
   */
  private getCacheConfig() {
    try {
      // 确保配置服务已初始化
      if (!this.configService) {
        throw new Error('ConfigService not available');
      }

      // 尝试获取配置，如果失败则使用默认值
      try {
        return this.configService.get('caching');
      } catch (error) {
        this.logger.warn('Failed to get cache configuration, using defaults', { error: (error as Error).message });
        return { maxSize: 10000, defaultTTL: 30000 };
      }
    } catch (error) {
      this.logger.error('Error getting cache configuration', { error: (error as Error).message });
      return { maxSize: 10000, defaultTTL: 30000 };
    }
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
      const cacheConfig = this.getCacheConfig();
      const defaultTTL = cacheConfig.defaultTTL || 30000; // 5 minutes default
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
      size: this.cache.size(),
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
      const cacheConfig = this.getCacheConfig();
      const defaultTTL = cacheConfig.defaultTTL || 300000; // 5 minutes default

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

      // 使用 entries() 方法获取所有缓存项
      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
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
    const cacheConfig = this.getCacheConfig();
    const total = cacheConfig.maxSize || 10000;
    const used = this.cache.size();
    const percentage = total > 0 ? (used / total) * 100 : 0; // 修复百分比计算

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

      // 使用 entries() 方法获取所有缓存项
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

  /**
   * 检查缓存服务是否健康
   */
  isHealthy(): boolean {
    try {
      // 检查缓存是否可用
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };

      // 设置测试值
      this.setCache(testKey, testValue, 1000);

      // 获取测试值
      const retrieved = this.getFromCache<{ timestamp: number }>(testKey);

      // 清除测试值
      this.invalidateCache(testKey);

      // 检查获取的值是否正确
      return retrieved !== null && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      this.logger.error('Health check failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 获取缓存服务状态
   */
  getStatus(): string {
    try {
      const usage = this.getCacheUsage();
      const stats = this.getCacheStats();

      if (usage.percentage > 90) {
        return 'critical'; // 缓存使用率超过90%
      } else if (usage.percentage > 70) {
        return 'warning'; // 缓存使用率超过70%
      } else if (stats.hits + stats.misses === 0) {
        return 'idle'; // 尚未使用缓存
      } else {
        return 'normal'; // 正常状态
      }
    } catch (error) {
      this.logger.error('Status check failed', { error: (error as Error).message });
      return 'error'; // 检查过程中出错
    }
  }
}