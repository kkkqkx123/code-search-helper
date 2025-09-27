import { LoggerService } from '../utils/LoggerService';
import { Logger } from '../utils/logger';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { EmbeddingResult } from './BaseEmbedder';

/**
 * 简化的嵌入缓存服务
 * 使用内存缓存，避免复杂的缓存管理器依赖
 */
export class EmbeddingCacheService {
  private cache: Map<string, { data: EmbeddingResult; timestamp: number; ttl: number }> = new Map();
  private logger: LoggerService | Logger;
  private errorHandler: ErrorHandlerService;
  private defaultTTL: number;

  constructor(
    logger: LoggerService | Logger,
    errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;

    // 简化配置获取
    this.defaultTTL = parseInt(process.env.EMBEDDING_CACHE_TTL || '86400'); // 默认24小时（秒）

    // 定期清理过期缓存（测试环境中不启动）
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
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

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    // 每小时清理一次
    setInterval(() => {
      this.cleanup();
    }, 3600000); // 1小时
  }

  /**
   * 获取缓存的嵌入结果
   */
  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    try {
      const key = this.generateKey(text, model);
      const entry = this.cache.get(key);

      if (!entry) {
        this.logger.debug('Cache miss', { key, model });
        return null;
      }

      // 检查是否过期
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.logger.debug('Cache entry expired', { key, model });
        return null;
      }

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
      const key = this.generateKey(text, model);
      const ttl = parseInt(process.env.EMBEDDING_CACHE_TTL || String(this.defaultTTL));

      this.cache.set(key, {
        data: result,
        timestamp: Date.now(),
        ttl
      });

      this.logger.debug('Cache set', { key, model, ttl });
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
   * 获取缓存统计信息
   */
  async getStats(): Promise<{ size: number; hits?: number; misses?: number }> {
    try {
      // 清理过期项
      this.cleanup();

      return {
        size: this.cache.size,
        // 简化版本不跟踪命中/未命中次数
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error getting embedding cache stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbeddingCacheService', operation: 'getStats' }
      );
      return { size: 0 };
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