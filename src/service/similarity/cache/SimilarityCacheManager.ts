import { inject, injectable } from 'inversify';
import { ISimilarityCacheManager } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { LRUCache } from '../../../utils/LRUCache';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 相似度缓存管理器
 * 使用LRU缓存策略管理相似度计算结果
 */
@injectable()
export class SimilarityCacheManager implements ISimilarityCacheManager {
  private cache: LRUCache<string, number>;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0
  };

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    private maxSize: number = 1000,
    private defaultTTL: number = 300000 // 5分钟
  ) {
    this.cache = new LRUCache<string, number>(maxSize);
  }

  async get(key: string): Promise<number | null> {
    try {
      const value = this.cache.get(key);
      
      if (value !== undefined) {
        this.stats.hits++;
        this.logger?.debug(`Cache hit for key: ${key}`);
        return value;
      } else {
        this.stats.misses++;
        this.logger?.debug(`Cache miss for key: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger?.error('Error getting from cache:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: number, ttl?: number): Promise<void> {
    try {
      this.cache.set(key, value);
      this.stats.sets++;
      this.logger?.debug(`Cache set for key: ${key}, value: ${value}`);
      
      // 如果需要TTL，可以在这里实现定时清理
      if (ttl && ttl > 0) {
        setTimeout(() => {
          this.delete(key).catch(error => {
            this.logger?.warn(`Failed to delete expired cache key ${key}:`, error);
          });
        }, ttl);
      }
    } catch (error) {
      this.logger?.error('Error setting cache:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.cache.delete(key);
      this.logger?.debug(`Cache delete for key: ${key}`);
    } catch (error) {
      this.logger?.error('Error deleting from cache:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.stats = { hits: 0, misses: 0, sets: 0 };
      this.logger?.info('Cache cleared');
    } catch (error) {
      this.logger?.error('Error clearing cache:', error);
    }
  }

  async getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
  }> {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size
    };
  }

  /**
   * 获取缓存命中率
   */
  async getHitRate(): Promise<number> {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(
    content1: string,
    content2: string,
    strategy: string,
    options?: any
  ): string {
    // 简单的哈希实现
    const hash1 = this.simpleHash(content1);
    const hash2 = this.simpleHash(content2);
    const optionsHash = options ? this.simpleHash(JSON.stringify(options)) : '';
    
    return `${strategy}:${hash1}:${hash2}:${optionsHash}`;
  }

  /**
   * 简单的字符串哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 批量获取缓存值
   */
  async mget(keys: string[]): Promise<Map<string, number | null>> {
    const results = new Map<string, number | null>();
    
    await Promise.all(
      keys.map(async key => {
        const value = await this.get(key);
        results.set(key, value);
      })
    );
    
    return results;
  }

  /**
   * 批量设置缓存值
   */
  async mset(entries: Map<string, number>, ttl?: number): Promise<void> {
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.set(key, value, ttl)
    );
    
    await Promise.all(promises);
  }

  /**
   * 清理过期条目（如果实现了TTL）
   */
  async cleanup(): Promise<void> {
    // 由于LRUCache本身不支持TTL，这里只是一个占位符
    // 实际实现中可以使用定时器或其他机制来清理过期条目
    this.logger?.debug('Cache cleanup completed');
  }

  /**
   * 获取缓存大小限制
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * 设置缓存大小限制
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    // 重新创建缓存实例
    const oldCache = this.cache;
    this.cache = new LRUCache<string, number>(size);
    
    // 迁移现有数据（如果新大小足够）
    if (size >= oldCache.size) {
      oldCache.forEach((value, key) => {
        this.cache.set(key, value);
      });
    }
    
    this.logger?.info(`Cache max size updated to ${size}`);
  }

  /**
   * 预热缓存
   */
  async warmup(entries: Map<string, number>): Promise<void> {
    this.logger?.info(`Warming up cache with ${entries.size} entries`);
    await this.mset(entries);
    this.logger?.info('Cache warmup completed');
  }

  /**
   * 导出缓存数据
   */
  async export(): Promise<Map<string, number>> {
    const data = new Map<string, number>();
    this.cache.forEach((value, key) => {
      data.set(key, value);
    });
    return data;
  }

  /**
   * 导入缓存数据
   */
  async import(data: Map<string, number>): Promise<void> {
    this.logger?.info(`Importing ${data.size} cache entries`);
    await this.clear();
    await this.mset(data);
    this.logger?.info('Cache import completed');
  }

  /**
   * 获取详细的性能统计
   */
  async getDetailedStats(): Promise<{
    hits: number;
    misses: number;
    sets: number;
    hitRate: number;
    size: number;
    maxSize: number;
    utilization: number;
  }> {
    const hitRate = await this.getHitRate();
    const utilization = this.cache.size / this.maxSize;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate,
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization
    };
  }
}