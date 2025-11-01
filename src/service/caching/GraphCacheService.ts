import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ICacheService, CacheConfig } from '../../infrastructure/caching/types';
import { DatabaseType } from '../../infrastructure/types';
import { GraphCacheConfigService } from '../../config/service/GraphCacheConfigService';
import { MemoryAwareCache } from '../../utils/cache/MemoryAwareCache';
import { GraphData, CacheOptions, CacheItem, CacheStats } from '../graph/caching/types';

@injectable()
export class GraphCacheService implements ICacheService {
  private logger: LoggerService;
  private cache: MemoryAwareCache<string, any>;
  private config: any;
  private hits: number = 0;
  private misses: number = 0;
  private timestamps: Map<string, number> = new Map();
  private ttlMap: Map<string, number> = new Map(); // 每个键的TTL
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheConfig) config?: CacheConfig
  ) {
    this.logger = logger;
    // 使用graph缓存配置服务来获取配置
    this.config = {
      maxSize: 1000,
      defaultTTL: 300000, // 5分钟默认TTL
      maxMemory: 50 * 1024 * 1024, // 50MB
      enableCompression: true,
      compressionThreshold: 1024,
      enableStats: true,
      maxEntries: 10000,
      cleanupInterval: 60000, // 1分钟清理间隔
      databaseSpecific: {}, // 添加缺失的 databaseSpecific 字段
      ...config
    };

    // 初始化MemoryAwareCache用于图数据
    this.cache = new MemoryAwareCache<string, any>(this.config.maxSize, {
      maxMemory: this.config.maxMemory,
      enableCompression: this.config.enableCompression,
      compressionThreshold: this.config.compressionThreshold,
      enableDetailedStats: this.config.enableStats
    });

    this.startCleanup();
    this.logger.info('GraphCacheService initialized', { config: this.config });
  }

  // ICacheService接口实现 - 通用缓存方法
  async get<T>(key: string): Promise<T | null> {
    const value = this.cache.get(key);
    const timestamp = this.timestamps.get(key);
    const ttl = this.ttlMap.get(key) || this.config.defaultTTL;

    if (value !== undefined && timestamp !== undefined) {
      // 检查是否过期
      if (Date.now() - timestamp < ttl) {
        if (this.config.enableStats) {
          this.stats.hits++;
        }
        this.logger.debug('Cache hit', { key });
        return value as T;
      } else {
        // 过期，删除它
        this.cache.delete(key);
        this.timestamps.delete(key);
        this.ttlMap.delete(key);
        if (this.config.enableStats) {
          this.stats.evictions++;
        }
        this.logger.debug('Cache entry expired', { key });
      }
    }

    if (this.config.enableStats) {
      this.stats.misses++;
    }
    this.logger.debug('Cache miss', { key });
    return null;
  }

  // ICacheService接口实现
  getFromCache<T>(key: string): T | undefined {
    const value = this.cache.get(key);
    const timestamp = this.timestamps.get(key);
    const ttl = this.ttlMap.get(key) || this.config.defaultTTL;

    if (value !== undefined && timestamp !== undefined) {
      // 检查是否过期
      if (Date.now() - timestamp < ttl) {
        if (this.config.enableStats) {
          this.stats.hits++;
        }
        this.logger.debug('Cache hit', { key });
        return value as T;
      } else {
        // 过期，删除它
        this.cache.delete(key);
        this.timestamps.delete(key);
        this.ttlMap.delete(key);
        if (this.config.enableStats) {
          this.stats.evictions++;
        }
        this.logger.debug('Cache entry expired', { key });
      }
    }

    if (this.config.enableStats) {
      this.stats.misses++;
    }
    this.logger.debug('Cache miss', { key });
    return undefined;
  }

  // ICacheService接口实现
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // 检查是否达到最大条目数
    if (this.cache.size() >= this.config.maxSize) {
      // 简单地删除最早添加的条目
      const keys = this.cache.keys();
      if (keys.length > 0) {
        const firstKey = keys[0];
        this.cache.delete(firstKey);
        this.timestamps.delete(firstKey);
        this.ttlMap.delete(firstKey);
        if (this.config.enableStats) {
          this.stats.evictions++;
        }
      }
    }

    this.cache.set(key, value, ttl || this.config.defaultTTL);
    this.timestamps.set(key, Date.now());
    this.ttlMap.set(key, ttl || this.config.defaultTTL);

    if (this.config.enableStats) {
      this.stats.sets++;
    }

    this.logger.debug('Cache set', { key, ttl: ttl || this.config.defaultTTL });
  }

  // ICacheService接口实现
  async setCache<T>(key: string, data: T, ttl: number): Promise<void> {
    await this.set(key, data, ttl);
  }

  // ICacheService接口实现
  async has(key: string): Promise<boolean> {
    const value = this.cache.get(key);
    const timestamp = this.timestamps.get(key);
    const ttl = this.ttlMap.get(key) || this.config.defaultTTL;

    if (value !== undefined && timestamp !== undefined) {
      return Date.now() - timestamp < ttl;
    }
    return false;
  }

  // ICacheService接口实现
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);
    this.timestamps.delete(key);
    this.ttlMap.delete(key);

    if (existed && this.config.enableStats) {
      this.logger.debug('Cache delete', { key });
    }

    return existed;
  }

  // ICacheService接口实现
  deleteFromCache(key: string): boolean {
    const existed = this.cache.delete(key);
    this.timestamps.delete(key);
    this.ttlMap.delete(key);

    if (existed && this.config.enableStats) {
      this.logger.debug('Cache delete', { key });
    }

    return existed;
  }

  // ICacheService接口实现
  async clearAllCache(): Promise<void> {
    this.cache.clear();
    this.timestamps.clear();
    this.ttlMap.clear();
    this.hits = 0;
    this.misses = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
    this.logger.info('All cache cleared');
  }

  // ICacheService接口实现
  getCacheStats(): {
    totalEntries: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      totalEntries: this.cache.size(),
      hitCount: this.stats.hits,
      missCount: this.stats.misses,
      hitRate
    };
  }

  // ICacheService接口实现
  async getDatabaseSpecificCache<T>(key: string, databaseType: DatabaseType): Promise<T | null> {
    const dbSpecificKey = `${databaseType}:${key}`;
    return await this.get<T>(dbSpecificKey);
  }

  // ICacheService接口实现
  async setDatabaseSpecificCache<T>(key: string, value: T, databaseType: DatabaseType, ttl?: number): Promise<void> {
    const dbSpecificKey = `${databaseType}:${key}`;
    await this.set(dbSpecificKey, value, ttl);
  }

  // ICacheService接口实现
  async invalidateDatabaseCache(databaseType: DatabaseType): Promise<void> {
    const keysToDelete: string[] = [];

    // 收集所有属于指定数据库类型的键
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${databaseType}:`)) {
        keysToDelete.push(key);
      }
    }

    // 删除这些键
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    this.logger.info(`Invalidated cache for database type: ${databaseType}`, {
      deletedEntries: keysToDelete.length
    });
  }

  // 图缓存专用方法 - 直接定义在类中
  async setGraphData(key: string, data: GraphData, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl ?? this.config.defaultTTL;
      this.cache.set(key, data, ttl);

      this.logger.debug('Graph data cached', {
        key,
        nodes: data.nodes.length,
        relationships: data.relationships.length,
        ttl
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache graph data', { key, error });
      return false;
    }
  }

  // 图缓存专用方法
  async getGraphData(key: string): Promise<GraphData | null> {
    try {
      const data = this.cache.get(key);

      if (data) {
        this.hits++;
        this.logger.debug('Graph data cache hit', { key });
      } else {
        this.misses++;
        this.logger.debug('Graph data cache miss', { key });
      }

      return data || null;
    } catch (error) {
      this.logger.error('Failed to get graph data', { key, error });
      return null;
    }
  }

  // 图缓存专用方法
  async setGraphBatch(items: CacheItem[]): Promise<number> {
    let successCount = 0;

    for (const item of items) {
      if (await this.setGraphData(item.key, item.data, item.options)) {
        successCount++;
      }
    }

    this.logger.debug('Batch graph cache completed', {
      total: items.length,
      success: successCount,
      failed: items.length - successCount
    });

    return successCount;
  }

  // 图缓存专用方法
  async getGraphBatch(keys: string[]): Promise<Map<string, GraphData | null>> {
    const results = new Map<string, GraphData | null>();

    for (const key of keys) {
      results.set(key, await this.getGraphData(key));
    }

    return results;
  }

  // 图缓存专用方法
  async clearGraphCache(): Promise<void> {
    try {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
      this.timestamps.clear();
      this.ttlMap.clear();
      this.logger.info('Graph cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear graph cache', { error });
      throw error;
    }
  }

  // 图缓存专用方法
  getGraphCacheSize(): number {
    return this.cache.size();
  }

  // 图缓存专用方法
  getGraphCacheKeys(): string[] {
    return this.cache.keys();
  }

  // 图缓存专用方法
  getGraphCacheStats(): CacheStats {
    try {
      const memoryStats = this.cache.getDetailedMemoryStats();
      const totalGets = this.hits + this.misses;

      return {
        hits: this.hits,
        misses: this.misses,
        evictions: memoryStats.totalEntries, // 简化统计
        sets: memoryStats.totalEntries,
        size: memoryStats.totalEntries,
        memoryUsage: memoryStats.totalMemoryUsage,
        hitRate: totalGets > 0 ? this.hits / totalGets : 0
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      return {
        hits: this.hits,
        misses: this.misses,
        evictions: 0,
        sets: 0,
        size: this.getGraphCacheSize(),
        memoryUsage: 0,
        hitRate: 0
      };
    }
  }

  // 图缓存专用方法
  isGraphCacheHealthy(): boolean {
    try {
      const stats = this.getGraphCacheStats();
      const memoryUtilization = this.cache.getMemoryUtilization();

      // 健康检查逻辑
      if (memoryUtilization > 95) {
        this.logger.warn('Cache memory utilization too high', { utilization: memoryUtilization });
        return false;
      }

      if (stats.hitRate < 0.1 && stats.size > 100) {
        this.logger.warn('Cache hit rate too low', { hitRate: stats.hitRate });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  // 图缓存特定方法
  getMemoryStats(): any {
    return this.cache.getDetailedMemoryStats();
  }

  // 图缓存特定方法
  getCompressionStats(): any {
    return this.cache.getCompressionStats();
  }

  // 图缓存特定方法
  getMemoryUtilization(): number {
    return this.cache.getMemoryUtilization();
  }

  // 特定缓存方法
  async cacheNebulaGraphData(spaceName: string, data: any): Promise<void> {
    const key = `nebula:graph:${spaceName}`;
    await this.set(key, data);
  }

  async getNebulaGraphData(spaceName: string): Promise<any | null> {
    const key = `nebula:graph:${spaceName}`;
    return await this.get(key);
  }

  async cacheVectorData(collectionName: string, data: any): Promise<void> {
    const key = `qdrant:vector:${collectionName}`;
    await this.set(key, data);
  }

  async getVectorData(collectionName: string): Promise<any | null> {
    const key = `qdrant:vector:${collectionName}`;
    return await this.get(key);
  }

  async cacheQueryResult(queryHash: string, result: any, ttl?: number): Promise<void> {
    const key = `query:${queryHash}`;
    await this.set(key, result, ttl);
  }

  async getQueryResult(queryHash: string): Promise<any | null> {
    const key = `query:${queryHash}`;
    return await this.get(key);
  }

  async cacheRelationships(sourceId: string, targetId: string, relationships: any): Promise<void> {
    const key = `relationships:${sourceId}:${targetId}`;
    await this.set(key, relationships);
  }

  async getRelationships(sourceId: string, targetId: string): Promise<any | null> {
    const key = `relationships:${sourceId}:${targetId}`;
    return await this.get(key);
  }

  async cacheParsedAST(filePath: string, ast: any): Promise<void> {
    const key = `ast:${filePath}`;
    await this.set(key, ast);
  }

  async getParsedAST(filePath: string): Promise<any | null> {
    const key = `ast:${filePath}`;
    return await this.get(key);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  public cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, timestamp] of this.timestamps) {
      const ttl = this.ttlMap.get(key) || this.config.defaultTTL;
      if (now - timestamp >= ttl) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        this.ttlMap.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      if (this.config.enableStats) {
        this.stats.evictions += cleanedCount;
      }
      this.logger.debug('Cache cleanup completed', { cleanedCount });
    }
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.logger.info('GraphCacheService disposed');
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.logger.info('GraphCacheService cleanup stopped');
  }
}