import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { CacheManager } from '../services/cache/CacheManager';
import { CacheInterface } from '../services/cache/CacheInterface';
import { EmbeddingResult } from './BaseEmbedder';

@injectable()
export class EmbeddingCacheService {
  private cache!: CacheInterface;
  private logger: LoggerService;

  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheManager) private cacheManager: CacheManager
  ) {
    this.logger = logger;
  }

  private async getCache(): Promise<CacheInterface> {
    if (!this.cache) {
      this.cache = await this.cacheManager.getEmbeddingCache();
    }
    return this.cache;
  }

  /**
   * Generate a cache key for the given text and model
   */
  private generateKey(text: string, model: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `${model}:${hash}`;
  }

  /**
   * Get cached embedding result
   */
  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    try {
      const cache = await this.getCache();
      const key = this.generateKey(text, model);
      const result = await cache.get<EmbeddingResult>(key);

      if (result) {
        this.logger.debug('Cache hit', { key, model });
      } else {
        this.logger.debug('Cache miss', { key, model });
      }

      return result;
    } catch (error) {
      this.logger.error('Error getting embedding from cache', {
        error,
        text: text.substring(0, 50),
        model,
      });
      return null;
    }
  }

  /**
   * Set embedding result in cache
   */
  async set(text: string, model: string, result: EmbeddingResult): Promise<void> {
    try {
      const cache = await this.getCache();
      const key = this.generateKey(text, model);
      const redisConfig = this.configService.get('redis') || { ttl: { embedding: 86400 } };
      const ttl = redisConfig.ttl?.embedding || 86400; // 默认24小时

      await cache.set(key, result, { ttl });
      this.logger.debug('Cache set', { key, model, ttl });
    } catch (error) {
      this.logger.error('Error setting embedding to cache', {
        error,
        text: text.substring(0, 50),
        model,
      });
    }
  }

  /**
   * Clear all entries from cache
   */
  async clear(): Promise<void> {
    try {
      const cache = await this.getCache();
      await cache.clear();
      this.logger.debug('Embedding cache cleared');
    } catch (error) {
      this.logger.error('Error clearing embedding cache', { error });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; hits?: number; misses?: number }> {
    try {
      const cache = await this.getCache();
      const stats = await cache.getStats();
      return {
        size: stats.size,
        hits: stats.hitCount,
        misses: stats.missCount,
      };
    } catch (error) {
      this.logger.error('Error getting embedding cache stats', { error });
      return { size: 0 };
    }
  }
}
