export interface CacheOptions {
  maxSize?: number;
  enableStats?: boolean;
  defaultTTL?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  size: number;
  memoryUsage: number;
}

interface CacheEntry<V> {
  value: V;
  timestamp: number;
  accessTime: number;  // 用于LRU，每次访问更新
  ttl?: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private enableStats: boolean;
  private defaultTTL: number;
  private stats: CacheStats;

  constructor(maxSize: number = 1000, options: CacheOptions = {}) {
    this.maxSize = maxSize;
    this.enableStats = options.enableStats || false;
    this.defaultTTL = options.defaultTTL || 0; // 0表示无TTL
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0, memoryUsage: 0 };
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // 检查TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // 更新访问时间
    entry.accessTime = Date.now();
    
    if (this.enableStats) this.stats.hits++;
    
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.maxSize <= 0) return;

    // 如果key已存在，删除旧条目
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果缓存已满，删除最久未使用的条目
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.delete(firstKey);
      }
    }

    const now = Date.now();
    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      accessTime: now,
      ttl: ttl || this.defaultTTL
    };
    this.cache.set(key, entry);

    if (this.enableStats) this.stats.sets++;
  }

  // 新增：获取统计信息
  getStats(): CacheStats | undefined {
    if (!this.enableStats) return undefined;
    return {
      ...this.stats,
      size: this.cache.size,
      memoryUsage: 0 // LRUCache currently doesn't track actual memory usage
    };
  }

  // 新增：清理过期条目
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.delete(key);
        removed++;
      }
    }
    
    return removed;
  }

  // 原有方法保持不变以保持兼容性
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // 检查是否过期
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      if (this.enableStats) this.stats.evictions++;
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    
    if (this.enableStats) {
      this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0, memoryUsage: 0 };
    }
  }

  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values())
      .filter(entry => !entry.ttl || Date.now() - entry.timestamp <= entry.ttl)
      .map(entry => entry.value);
  }
}