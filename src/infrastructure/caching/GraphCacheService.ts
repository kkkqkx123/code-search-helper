import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ICacheService } from './types';
import { CacheConfig } from './types';

@injectable()
export class GraphCacheService implements ICacheService {
  private logger: LoggerService;
  private cache: Map<string, any> = new Map();
  private timestamps: Map<string, number> = new Map();
  private ttlMap: Map<string, number> = new Map(); // 每个键的TTL
  private config: CacheConfig;
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
    this.config = {
      defaultTTL: 300000, // 5分钟默认TTL
      maxEntries: 10000,
      cleanupInterval: 6000, // 1分钟清理间隔
      enableStats: true,
      ...config
    };

    this.startCleanup();
    this.logger.info('GraphCacheService initialized', { config: this.config });
  }

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

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // 检查是否达到最大条目数
    if (this.cache.size >= this.config.maxEntries) {
      // 简单地删除最早添加的条目
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.timestamps.delete(firstKey);
        this.ttlMap.delete(firstKey);
        if (this.config.enableStats) {
          this.stats.evictions++;
        }
      }
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    this.ttlMap.set(key, ttl || this.config.defaultTTL);
    
    if (this.config.enableStats) {
      this.stats.sets++;
    }
    
    this.logger.debug('Cache set', { key, ttl: ttl || this.config.defaultTTL });
  }

  async has(key: string): Promise<boolean> {
    const value = this.cache.get(key);
    const timestamp = this.timestamps.get(key);
    const ttl = this.ttlMap.get(key) || this.config.defaultTTL;

    if (value !== undefined && timestamp !== undefined) {
      return Date.now() - timestamp < ttl;
    }
    return false;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);
    this.timestamps.delete(key);
    this.ttlMap.delete(key);
    
    if (existed && this.config.enableStats) {
      this.logger.debug('Cache delete', { key });
    }
    
    return existed;
 }

  async clearAllCache(): Promise<void> {
    this.cache.clear();
    this.timestamps.clear();
    this.ttlMap.clear();
    this.logger.info('All cache cleared');
  }

 async getStats(): Promise<{
    hits: number;
    misses: number;
    sets: number;
    evictions: number;
    hitRate: number;
    size: number;
  }> {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    return {
      ...this.stats,
      hitRate,
      size: this.cache.size
    };
  }

  async getCacheKeys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

 private cleanupExpiredEntries(): void {
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

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.logger.info('GraphCacheService disposed');
  }
}