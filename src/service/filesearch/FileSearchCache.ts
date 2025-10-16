import { FileSearchResult, CachedSearchResult, CacheConfig } from './types';
import { LoggerService } from '../../utils/LoggerService';
import { LRUCache } from '../../utils/LRUCache';

/**
 * 文件搜索缓存服务
 * 缓存搜索结果以提高性能
 */
export class FileSearchCache {
  private cache: LRUCache<string, CachedSearchResult>;
  private config: CacheConfig;
  private logger: LoggerService;
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(config: CacheConfig = {}, logger: LoggerService) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 5 * 60 * 1000, // 5分钟
      cleanupInterval: config.cleanupInterval || 60 * 1000, // 1分钟
      ...config
    };
    this.logger = logger;
    this.cache = new LRUCache(this.config.maxSize);

    // 启动定期清理
    this.startCleanupInterval();
  }

  /**
   * 获取缓存的搜索结果
   */
  async get(key: string): Promise<FileSearchResult[] | null> {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      this.delete(key);
      return null;
    }

    this.logger.debug(`缓存命中: ${key}`);
    return cached.results;
  }

  /**
   * 设置缓存的搜索结果
   */
  async set(key: string, results: FileSearchResult[], ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.config.defaultTTL || 5 * 60 * 1000);

    const cachedResult: CachedSearchResult = {
      results,
      expiresAt,
      createdAt: Date.now()
    };

    this.cache.set(key, cachedResult);

    this.logger.debug(`缓存设置: ${key}, 结果数量: ${results.length}`);
  }

  /**
   * 删除缓存项
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`缓存删除: ${key}`);
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.info('缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    missRate: number;
    totalRequests: number;
    totalHits: number;
    totalMisses: number;
  } {
    return {
      size: this.cache.size(),
      maxSize: this.config.maxSize || 1000,
      hitRate: this.getHitRate(),
      missRate: this.getMissRate(),
      totalRequests: this.totalRequests,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses
    };
  }

  /**
   * 生成缓存键
   */
  generateKey(query: string, options?: any): string {
    const normalizedQuery = query.toLowerCase().trim();
    const optionsKey = options ? JSON.stringify(this.sortObject(options)) : '';
    return `filesearch:${normalizedQuery}:${optionsKey}`;
  }

  /**
   * 检查缓存是否包含指定键
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);

    if (!cached) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  // 私有方法
  private totalRequests = 0;
  private totalHits = 0;
  private totalMisses = 0;

  /**
   * 记录请求统计
   */
  private recordRequest(hit: boolean): void {
    this.totalRequests++;
    if (hit) {
      this.totalHits++;
    } else {
      this.totalMisses++;
    }
  }

  /**
   * 获取命中率
   */
  private getHitRate(): number {
    return this.totalRequests > 0 ? this.totalHits / this.totalRequests : 0;
  }

  /**
   * 获取未命中率
   */
  private getMissRate(): number {
    return this.totalRequests > 0 ? this.totalMisses / this.totalRequests : 0;
  }


  /**
   * 启动定期清理间隔
   */
  private startCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);

    this.logger.debug(`定期清理已启动，间隔: ${this.config.cleanupInterval}ms`);
  }

  /**
   * 清理过期的缓存项
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // 获取所有键并检查过期
    const keys = this.cache.keys();
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached && now > cached.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`清理过期缓存项: ${cleanedCount}个`);
    }
  }

  /**
   * 深度排序对象属性（用于生成一致的JSON字符串）
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = this.sortObject(obj[key]);
    }

    return sortedObj;
  }

  /**
   * 销毁缓存（清理资源）
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.clear();
    this.logger.info('文件搜索缓存已销毁');
  }
}