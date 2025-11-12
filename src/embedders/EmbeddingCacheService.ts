import { injectable, inject } from 'inversify';
import { LoggerService } from '../utils/LoggerService';
import { Logger } from '../utils/logger';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { EmbeddingResult } from './BaseEmbedder';
import { ConfigService } from '../config/ConfigService';
import { TYPES } from '../types';

/**
 * 简化的嵌入极缓存服务
 * 使用内存缓存，避免复杂的缓存管理器依赖
 */
@injectable()
export class EmbeddingCacheService {
  private cache: Map<string, { data: EmbeddingResult; timestamp: number; ttl: number }> = new Map();
  private logger: LoggerService | Logger;
  private errorHandler: ErrorHandlerService;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private configService: ConfigService;
  private maxCacheSize: number;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService | Logger,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    // 延迟初始化 configService 以避免循环依赖
    this.configService = null as any;

    // 简化配置获取
    this.defaultTTL = parseInt(process.env.EMBEDDING_CACHE_TTL || '86400'); // 默认24小时（秒）
    this.maxCacheSize = parseInt(process.env.EMBEDDING_CACHE_MAX_SIZE || '10000'); // 最大缓存条目数

    // 定期清理过期缓存（测试环境中不启动）
    if (process.env.NODE_ENV !== 'test') {
      // 延迟启动清理定时器，等到配置服务初始化完成后再启动
      setTimeout(() => {
        this.startCleanupInterval();
      }, 1000);
    }
  }

  /**
   * 生成缓存键
   */
  private generateKey(text: string, model: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `${model}:${hash}`;
  }

  /**
   * 检查缓存项是否过期
   */
  private isExpired(entry: { timestamp: number; ttl: number }): boolean {
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000; // 转换为秒
    return age > entry.ttl;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // 清理过期缓存
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // 如果缓存仍然过大，清理最旧的条目（LRU策略）
    if (this.cache.size > this.maxCacheSize) {
      const entriesToRemove = this.cache.size - this.maxCacheSize;
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(sortedEntries[i][0]);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} cache entries (expired + size limit)`);
    }

    // 强制垃圾回收
    if (cleanedCount > 100 && global.gc) {
      global.gc();
    }
  }

  /**
   * 设置配置服务（延迟注入）
   */
  setConfigService(configService: ConfigService): void {
    this.configService = configService;
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    try {
      // 从配置中获取清理间隔，默认为10分钟
      let cleanupInterval = 600000; // 默认10分钟
      if (this.configService) {
        try {
          cleanupInterval = this.configService.get('caching')?.cleanupInterval || 600000;
        } catch (error) {
          this.logger.warn('Failed to get cache cleanup interval from config, using default value', { error });
        }
      }
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupInterval);
    } catch (error) {
      // 如果配置服务未初始化，使用默认的清理间隔
      this.logger.warn('Failed to start cleanup interval, using default value', { error });
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 600000); // 默认10分钟
    }
  }

  /**
   * 获取缓存的嵌入结果
   */
  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    try {
      const key = this.generateKey(text, model);
      const entry = this.cache.get(key);

      if (!entry) {
        this.cacheMisses++;
        this.logger.debug('Cache miss', { key, model });
        return null;
      }

      // 检查是否过期
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.cacheMisses++;
        this.logger.debug('Cache entry expired', { key, model });
        return null;
      }

      this.cacheHits++;
      this.logger.debug('Cache hit', { key, model });
      return entry.data;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error getting embedding from cache: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbeddingCacheService', operation: 'get' }
      );
      return null;
    }
  }

  /**
   * 设置嵌入结果到缓存
   */
  async set(text: string, model: string, result: EmbeddingResult): Promise<void> {
    try {
      // 检查缓存大小限制
      if (this.cache.size >= this.maxCacheSize) {
        // 清理最旧的条目
        this.cleanup();

        // 如果仍然太大，直接删除最旧的条目
        if (this.cache.size >= this.maxCacheSize) {
          const oldestKey = Array.from(this.cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
          this.cache.delete(oldestKey);
        }
      }

      const key = this.generateKey(text, model);
      const ttl = parseInt(process.env.EMBEDDING_CACHE_TTL || String(this.defaultTTL));

      this.cache.set(key, {
        data: result,
        timestamp: Date.now(),
        ttl
      });

      this.logger.debug('Cache set', { key, model, ttl, cacheSize: this.cache.size });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error setting embedding to cache: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbeddingCacheService', operation: 'set' }
      );
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.logger.debug(`Embedding cache cleared, removed ${size} entries`);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error clearing embedding cache: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbeddingCacheService', operation: 'clear' }
      );
    }
  }

  /**
   * 停止清理定时器
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 强制清理缓存（内存保护）
   */
  forceCleanup(): void {
    const beforeSize = this.cache.size;
    this.cleanup();
    this.logger.info(`Force cleanup completed: ${beforeSize} -> ${this.cache.size} entries`);

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{ size: number; hits?: number; misses?: number }> {
    try {
      // 清理过期项
      this.cleanup();

      return {
        size: this.cache.size,
        hits: this.cacheHits,
        misses: this.cacheMisses
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error getting embedding cache stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbeddingCacheService', operation: 'getStats' }
      );
      return { size: 0, hits: this.cacheHits, misses: this.cacheMisses };
    }
  }

  /**
   * 获取缓存中的所有键
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 根据模型删除缓存项
   */
  async deleteByModel(model: string): Promise<number> {
    try {
      let deletedCount = 0;
      const modelPrefix = `${model}:`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(modelPrefix)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      this.logger.debug(`Deleted ${deletedCount} cache entries for model ${model}`);
      return deletedCount;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error deleting cache entries by model: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbeddingCacheService', operation: 'deleteByModel' }
      );
      return 0;
    }
  }
}