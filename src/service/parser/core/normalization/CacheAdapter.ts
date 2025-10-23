import { LRUCache } from '../../../utils/cache/LRUCache';

export interface CacheStats {
  hits: number;
  misses: number;
 total: number;
  size: number;
}

export class NormalizationCacheAdapter {
  private cache: LRUCache<string, any>;
  private stats: CacheStats;
  
  constructor(cacheSize: number) {
    this.cache = new LRUCache<string, any>(cacheSize);
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0,
      size: 0
    };
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
    this.cache.set(key, value);
    this.stats.size = this.cache.size();
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0,
      size: 0
    };
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
}