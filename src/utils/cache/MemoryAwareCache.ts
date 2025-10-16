import { LRUCache, CacheOptions } from '../LRUCache';

export interface MemoryOptions {
  maxMemory?: number; // 最大内存使用（字节）
  memoryCheckInterval?: number; // 内存检查间隔（毫秒）
  enableCompression?: boolean; // 启用数据压缩
  compressionThreshold?: number; // 压缩阈值（字节）
}

interface CompressedEntry {
  compressed: boolean;
  data: any; // 原始数据或压缩数据
  originalSize: number; // 原始大小
  compressedSize?: number; // 压缩后大小
}

export class MemoryAwareCache<K, V> extends LRUCache<K, V> {
  private maxMemory: number;
  private memoryUsage: number;
  private sizeMap: Map<K, number>;
  private enableCompression: boolean;
  private compressionThreshold: number;
  private compressionStats = {
    compressedEntries: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0
  };

  constructor(maxSize: number = 1000, options: MemoryOptions & CacheOptions = {}) {
    super(maxSize, options);
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB 默认
    this.memoryUsage = 0;
    this.sizeMap = new Map();
    this.enableCompression = options.enableCompression || false;
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB以上才压缩
  }

  set(key: K, value: V, ttl?: number): void {
    const entryInfo = this.processValue(value);
    const entrySize = entryInfo.size;
    
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
    super.set(key, entryInfo.data, ttl);
  }

  get(key: K): V | undefined {
    const result = super.get(key);
    if (result === undefined) {
      return undefined;
    }

    // 如果是压缩数据，需要解压
    if (this.enableCompression && this.isCompressedEntry(result)) {
      return this.decompressData(result);
    }

    return result;
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
    this.compressionStats = {
      compressedEntries: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0
    };
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  getMaxMemory(): number {
    return this.maxMemory;
  }

  getCompressionStats() {
    if (!this.enableCompression) {
      return {
        enabled: false,
        message: 'Compression is disabled'
      };
    }

    const compressionRatio = this.compressionStats.totalOriginalSize > 0 
      ? this.compressionStats.totalCompressedSize / this.compressionStats.totalOriginalSize 
      : 1;

    return {
      enabled: true,
      compressedEntries: this.compressionStats.compressedEntries,
      totalOriginalSize: this.compressionStats.totalOriginalSize,
      totalCompressedSize: this.compressionStats.totalCompressedSize,
      compressionRatio: compressionRatio,
      savingsPercent: ((1 - compressionRatio) * 100).toFixed(2) + '%'
    };
  }

  private processValue(value: V): { data: any; size: number } {
    if (!this.enableCompression) {
      return {
        data: value,
        size: this.estimateSize(value)
      };
    }

    const originalSize = this.estimateSize(value);
    
    // 只对大于阈值的数据进行压缩
    if (originalSize < this.compressionThreshold) {
      return {
        data: value,
        size: originalSize
      };
    }

    try {
      const compressedData = this.compressData(value);
      const compressedSize = this.estimateSize(compressedData);

      // 只有压缩有效时才使用压缩数据
      if (compressedSize < originalSize * 0.8) { // 至少20%的压缩率
        this.compressionStats.compressedEntries++;
        this.compressionStats.totalOriginalSize += originalSize;
        this.compressionStats.totalCompressedSize += compressedSize;

        return {
          data: {
            compressed: true,
            data: compressedData,
            originalSize,
            compressedSize
          } as CompressedEntry,
          size: compressedSize + 64 // 加上压缩标记的开销
        };
      }
    } catch (error) {
      // 压缩失败，使用原始数据
    }

    return {
      data: value,
      size: originalSize
    };
  }

  private isCompressedEntry(data: any): data is CompressedEntry {
    return typeof data === 'object' && data !== null && 'compressed' in data && data.compressed === true;
  }

  private compressData(value: V): any {
    try {
      // 简单的JSON压缩 - 移除空格
      const jsonString = JSON.stringify(value);
      return JSON.parse(jsonString);
    } catch {
      throw new Error('Compression failed');
    }
  }

  private decompressData(entry: CompressedEntry): V {
    return entry.data as V;
  }

  private estimateSize(value: V): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }

    if (typeof value === 'number') {
      return 8; // 64位数字
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.reduce((total, item) => total + this.estimateSize(item), 24) + 24; // 数组开销
      }

      // 对象大小估算
      let size = 24; // 基础对象开销
      for (const [key, val] of Object.entries(value)) {
        size += key.length * 2; // 键的大小
        size += this.estimateSize(val); // 值的大小
        size += 8; // 属性开销
      }
      return size;
    }

    return 64; // 默认值
  }

  private evictForMemory(): void {
    // 使用LRU顺序驱逐（复用父类逻辑）
    const keys = this.keys();
    if (keys.length > 0) {
      this.delete(keys[0]);
    }
  }
}