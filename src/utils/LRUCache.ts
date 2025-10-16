export interface CacheOptions {
  maxSize?: number;
  enableStats?: boolean;
  defaultTTL?: number;
  enableFastAccess?: boolean; // 启用快速访问模式
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  size: number;
}

interface CacheEntry<V> {
  value: V;
  timestamp: number;
  accessTime: number;  // 用于LRU，每次访问更新
  ttl?: number;
}

// 对象池，用于重用CacheEntry对象
class EntryPool<V> {
  private pool: CacheEntry<V>[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  acquire(): CacheEntry<V> | null {
    return this.pool.pop() || null;
  }

  release(entry: CacheEntry<V>): void {
    if (this.pool.length < this.maxSize) {
      // 重置对象
      entry.value = undefined as any;
      entry.timestamp = 0;
      entry.accessTime = 0;
      entry.ttl = undefined;
      this.pool.push(entry);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private enableStats: boolean;
  private defaultTTL: number;
  private stats: CacheStats;
  private entryPool: EntryPool<V>;
  private enableFastAccess: boolean;
  private fastAccessCache = new Map<K, V>(); // 快速访问缓存

  constructor(maxSize: number = 1000, options: CacheOptions = {}) {
    this.maxSize = maxSize;
    this.enableStats = options.enableStats || false;
    this.defaultTTL = options.defaultTTL || 0; // 0表示无TTL
    this.enableFastAccess = options.enableFastAccess || false;
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0 };
    this.entryPool = new EntryPool<V>(Math.min(maxSize / 10, 100)); // 池大小为maxSize的10%
  }

  get(key: K): V | undefined {
    // 快速访问模式：直接从快速缓存获取
    if (this.enableFastAccess && this.fastAccessCache.has(key)) {
      if (this.enableStats) this.stats.hits++;
      return this.fastAccessCache.get(key);
    }

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

    // 优化：直接更新访问时间，避免删除和重新插入的开销
    entry.accessTime = Date.now();
    
    if (this.enableStats) this.stats.hits++;
    
    // 更新快速访问缓存
    if (this.enableFastAccess) {
      this.fastAccessCache.set(key, entry.value);
      // 限制快速缓存大小
      if (this.fastAccessCache.size > this.maxSize / 2) {
        const firstKey = this.fastAccessCache.keys().next().value;
        if (firstKey !== undefined) {
          this.fastAccessCache.delete(firstKey);
        }
      }
    }
    
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.maxSize <= 0) return;

    // 如果key已存在，删除旧条目
    if (this.cache.has(key)) {
      this.cache.delete(key);
      // 从快速缓存中删除
      if (this.enableFastAccess) {
        this.fastAccessCache.delete(key);
      }
    }

    // 如果缓存已满，删除最久未使用的条目
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.evictEntry(firstKey);
      }
    }

    const now = Date.now();
    const pooledEntry = this.entryPool.acquire();
    
    if (pooledEntry) {
      // 重用对象池中的对象
      pooledEntry.value = value;
      pooledEntry.timestamp = now;
      pooledEntry.accessTime = now;
      pooledEntry.ttl = ttl || this.defaultTTL;
      this.cache.set(key, pooledEntry);
    } else {
      // 创建新对象
      const entry: CacheEntry<V> = {
        value,
        timestamp: now,
        accessTime: now,
        ttl: ttl || this.defaultTTL
      };
      this.cache.set(key, entry);
    }

    if (this.enableStats) this.stats.sets++;
  }

  private evictEntry(key: K): void {
    const entry = this.cache.get(key);
    if (entry) {
      // 将对象归还到对象池
      this.entryPool.release(entry);
      this.cache.delete(key);
      if (this.enableStats) this.stats.evictions++;
      
      // 从快速缓存中删除
      if (this.enableFastAccess) {
        this.fastAccessCache.delete(key);
      }
    }
  }

  // 新增：获取统计信息
  getStats(): CacheStats | undefined {
    if (!this.enableStats) return undefined;
    return {
      ...this.stats,
      size: this.cache.size
    };
  }

  // 新增：清理过期条目
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.evictEntry(key);
        removed++;
      }
    }
    
    return removed;
  }

  // 原有方法保持不变以保持兼容性
  has(key: K): boolean {
    // 快速访问模式检查
    if (this.enableFastAccess && this.fastAccessCache.has(key)) {
      return true;
    }

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
      this.evictEntry(key);
      return true;
    }
    return false;
  }

  clear(): void {
    // 将所有对象归还到对象池
    for (const entry of this.cache.values()) {
      this.entryPool.release(entry);
    }
    
    this.cache.clear();
    this.fastAccessCache.clear();
    
    if (this.enableStats) {
      this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0 };
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

  // 获取对象池统计信息
  getPoolStats() {
    return {
      poolSize: this.entryPool['pool'].length,
      maxPoolSize: this.entryPool['maxSize'],
      fastCacheSize: this.fastAccessCache.size
    };
  }

  // 手动清理对象池
  clearPool(): void {
    this.entryPool.clear();
  }
}