import { LRUCache } from '../../../../utils/LRUCache';

export interface CacheStats {
  hits: number;
  misses: number;
  total: number;
  size: number;
}

export class NormalizationCacheAdapter {
  private cache: LRUCache<string, any>;
  private stats: CacheStats;
 private maxAge: number; // 缓存项最大存活时间（毫秒）
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(cacheSize: number, maxAge: number = 1800000) { // 默认半小时
    this.cache = new LRUCache<string, any>(cacheSize, { defaultTTL: maxAge });
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0,
      size: 0
    };
    this.maxAge = maxAge;
    this.cleanupInterval = null;
    
    // 定期清理过期项
    this.startCleanupTimer();
  }

  get<T>(key: string): T | undefined {
    this.stats.total++;
    const result = this.cache.get(key);
    if (result !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return result as T;
  }

  set(key: string, value: any): void {
    // 使用TTL设置，使缓存项在指定时间后过期
    this.cache.set(key, value, this.maxAge);
    this.stats.size = this.cache.size();
  }

  has(key: string): boolean {
    return this.cache.has(key);
 }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0,
      size: 0
    };
  }

  /**
   * 停止定期清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  calculateHitRate(): number {
    return this.stats.total > 0 ? this.stats.hits / this.stats.total : 0;
  }

  size(): number {
    return this.cache.size();
  }

  private startCleanupTimer(): void {
    // 每5分钟清理一次过期项
    this.cleanupInterval = setInterval(() => {
      this.cache.cleanup();
    }, 300000);
  }
}