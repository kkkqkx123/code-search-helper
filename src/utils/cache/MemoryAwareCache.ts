import { LRUCache, CacheOptions } from '../LRUCache';

export interface MemoryOptions {
  maxMemory?: number; // 最大内存使用（字节）
  memoryCheckInterval?: number; // 内存检查间隔（毫秒）
}

export class MemoryAwareCache<K, V> extends LRUCache<K, V> {
  private maxMemory: number;
  private memoryUsage: number;
  private sizeMap: Map<K, number>;

  constructor(maxSize: number = 1000, options: MemoryOptions & CacheOptions = {}) {
    super(maxSize, options);
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB 默认
    this.memoryUsage = 0;
    this.sizeMap = new Map();
  }

  set(key: K, value: V, ttl?: number): void {
    const entrySize = this.estimateSize(value);
    
    // 如果key已存在，减去旧大小
    if (this.sizeMap.has(key)) {
      this.memoryUsage -= this.sizeMap.get(key)!;
    }

    // 检查内存限制，必要时驱逐条目
    while (this.memoryUsage + entrySize > this.maxMemory && this.size() > 0) {
      this.evictForMemory();
    }

    this.sizeMap.set(key, entrySize);
    this.memoryUsage += entrySize;
    super.set(key, value, ttl);
  }

  delete(key: K): boolean {
    const result = super.delete(key);
    if (result && this.sizeMap.has(key)) {
      this.memoryUsage -= this.sizeMap.get(key)!;
      this.sizeMap.delete(key);
    }
    return result;
  }

  clear(): void {
    super.clear();
    this.memoryUsage = 0;
    this.sizeMap.clear();
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  getMaxMemory(): number {
    return this.maxMemory;
  }

  private estimateSize(value: V): number {
    try {
      // 简单估算：JSON字符串长度 + 对象开销
      const jsonSize = JSON.stringify(value).length * 2;
      return jsonSize + 64; // 添加对象开销
    } catch {
      return 128; // 默认值
    }
  }

  private evictForMemory(): void {
    // 使用LRU顺序驱逐（复用父类逻辑）
    const keys = this.keys();
    if (keys.length > 0) {
      this.delete(keys[0]);
    }
  }
}