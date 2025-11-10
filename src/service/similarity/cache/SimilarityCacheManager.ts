import { inject, injectable } from 'inversify';
import { ISimilarityCacheManager } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { CacheService } from '../../../infrastructure/caching/CacheService';
import { HashUtils } from '../../../utils/cache/HashUtils';

/**
 * 相似度缓存管理器
 * 使用基础设施的CacheService管理相似度计算结果
 */
@injectable()
export class SimilarityCacheManager implements ISimilarityCacheManager {
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0
  };

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.CacheService) private cacheService?: CacheService,
    private defaultTTL: number = 300000 // 5分钟
  ) {
    if (!cacheService) {
      this.logger?.warn('CacheService not provided, SimilarityCacheManager will not function properly');
    }
  }

  async get(key: string): Promise<number | null> {
    try {
      if (!this.cacheService) {
        return null;
      }

      const value = this.cacheService.getFromCache<number>(`similarity:${key}`);

      if (value !== undefined) {
        this.stats.hits++;
        this.logger?.debug(`Cache hit for similarity key: ${key}`);
        return value;
      } else {
        this.stats.misses++;
        this.logger?.debug(`Cache miss for similarity key: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger?.error('Error getting from similarity cache:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: number, ttl?: number): Promise<void> {
    try {
      if (!this.cacheService) {
        return;
      }

      this.cacheService.setCache(`similarity:${key}`, value, ttl || this.defaultTTL);
      this.stats.sets++;
      this.logger?.debug(`Similarity cache set for key: ${key}, value: ${value}`);
    } catch (error) {
      this.logger?.error('Error setting similarity cache:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (!this.cacheService) {
        return;
      }

      this.cacheService.deleteFromCache(`similarity:${key}`);
      this.logger?.debug(`Similarity cache delete for key: ${key}`);
    } catch (error) {
      this.logger?.error('Error deleting from similarity cache:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (!this.cacheService) {
        return;
      }

      // 只清除相似度相关的缓存项
      const deletedCount = this.cacheService.deleteByPattern(/^similarity:/);
      this.stats = { hits: 0, misses: 0, sets: 0 };
      this.logger?.info(`Similarity cache cleared, ${deletedCount} entries removed`);
    } catch (error) {
      this.logger?.error('Error clearing similarity cache:', error);
    }
  }

  async getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
  }> {
    if (!this.cacheService) {
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        size: 0
      };
    }

    const cacheStats = this.cacheService.getCacheStats();
    const similarityKeys = this.cacheService.getKeysByPattern(/^similarity:/);

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: similarityKeys.length
    };
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
    return HashUtils.simpleHash(str);
  }
}