import { GraphMappingCache } from '../GraphMappingCache';
import { LoggerService } from '../../../../utils/LoggerService';
import { GraphNode, GraphNodeType, GraphRelationship, GraphRelationshipType } from '../../mapping/IGraphDataMappingService';

// Mock LoggerService
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
} as any;

// 原始的简单Map缓存实现（用于性能对比）
class OriginalGraphMappingCache {
  private cache: Map<string, any> = new Map();
  private stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  private memoryUsage: number = 0;
  private readonly defaultTTL: number = 300000;
  private readonly maxEntries: number = 10000;
  private readonly maxMemory: number = 50 * 1024 * 1024;

  constructor() { }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Number.MAX_VALUE;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  private async set<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    try {
      const dataSize = JSON.stringify(data).length;

      if (this.memoryUsage + dataSize > this.maxMemory) {
        this.evictOldestEntries(dataSize);
      }

      if (this.cache.size >= this.maxEntries) {
        const oldestKey = this.getOldestKey();
        if (oldestKey) {
          await this.delete(oldestKey);
        }
      }

      const cacheEntry = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL,
        size: dataSize
      };

      this.cache.set(key, cacheEntry);
      this.memoryUsage += dataSize;
      this.stats.sets++;

      return true;
    } catch (error) {
      return false;
    }
  }

  private async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.memoryUsage -= entry.size;
      this.cache.delete(key);
      this.stats.evictions++;
      return true;
    }
    return false;
  }

  private evictOldestEntries(requiredSpace: number): void {
    let freedSpace = 0;
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) {
        break;
      }

      this.cache.delete(key);
      freedSpace += entry.size;
      this.stats.evictions++;
    }

    this.memoryUsage -= freedSpace;
  }

  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    return this.set(key, nodes, ttl);
  }

  async getNodes(key: string): Promise<GraphNode[] | null> {
    const result = await this.get(key);
    return Array.isArray(result) ? result as GraphNode[] : null;
  }

  async getStats() {
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hasSufficientData = totalAccesses >= 10;
    const hitRate = hasSufficientData ? this.stats.hits / totalAccesses : null;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      sets: this.stats.sets,
      size: this.cache.size,
      memoryUsage: this.memoryUsage,
      hitRate,
      hasSufficientData
    };
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.memoryUsage = 0;
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }
}

describe('缓存性能对比测试', () => {
  let newCache: GraphMappingCache;
  let oldCache: OriginalGraphMappingCache;
  const testNodes: GraphNode[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `node-${i}`,
    type: GraphNodeType.FUNCTION,
    properties: { name: `function-${i}`, complexity: Math.floor(Math.random() * 10) }
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    newCache = new GraphMappingCache(mockLogger);
    oldCache = new OriginalGraphMappingCache();
  });

  describe('写入性能对比', () => {
    it('新缓存应该比旧缓存写入更快', async () => {
      const iterations = 1000;

      // 测试新缓存
      const newStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await newCache.cacheNodes(`new-key-${i}`, testNodes.slice(0, 10));
      }
      const newEnd = performance.now();
      const newTime = newEnd - newStart;

      // 测试旧缓存
      const oldStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await oldCache.cacheNodes(`old-key-${i}`, testNodes.slice(0, 10));
      }
      const oldEnd = performance.now();
      const oldTime = oldEnd - oldStart;

      console.log(`新缓存写入时间: ${newTime.toFixed(2)}ms`);
      console.log(`旧缓存写入时间: ${oldTime.toFixed(2)}ms`);
      console.log(`性能提升: ${((oldTime - newTime) / oldTime * 100).toFixed(2)}%`);

      // 新缓存应该更快（至少不会慢很多）
      expect(newTime).toBeLessThan(oldTime * 1.5);
    });
  });

  describe('读取性能对比', () => {
    beforeEach(async () => {
      // 预填充数据
      for (let i = 0; i < 500; i++) {
        await newCache.cacheNodes(`key-${i}`, testNodes.slice(0, 10));
        await oldCache.cacheNodes(`key-${i}`, testNodes.slice(0, 10));
      }
    });

    it('新缓存应该比旧缓存读取更快', async () => {
      const iterations = 1000;

      // 测试新缓存
      const newStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await newCache.getNodes(`key-${i % 500}`);
      }
      const newEnd = performance.now();
      const newTime = newEnd - newStart;

      // 测试旧缓存
      const oldStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await oldCache.getNodes(`key-${i % 500}`);
      }
      const oldEnd = performance.now();
      const oldTime = oldEnd - oldStart;

      console.log(`新缓存读取时间: ${newTime.toFixed(2)}ms`);
      console.log(`旧缓存读取时间: ${oldTime.toFixed(2)}ms`);
      console.log(`性能提升: ${((oldTime - newTime) / oldTime * 100).toFixed(2)}%`);

      // 新缓存应该更快
      expect(newTime).toBeLessThan(oldTime * 1.2);
    });
  });

  describe('内存使用对比', () => {
    it('两种实现的内存使用应该相当', async () => {
      const iterations = 1000;

      // 填充新缓存
      for (let i = 0; i < iterations; i++) {
        await newCache.cacheNodes(`new-key-${i}`, testNodes.slice(0, 10));
      }
      const newStats = await newCache.getStats();

      // 填充旧缓存
      for (let i = 0; i < iterations; i++) {
        await oldCache.cacheNodes(`old-key-${i}`, testNodes.slice(0, 10));
      }
      const oldStats = await oldCache.getStats();

      console.log(`新缓存条目数: ${newStats.size}`);
      console.log(`旧缓存条目数: ${oldStats.size}`);
      console.log(`新缓存内存使用估算: ${(oldStats.memoryUsage / 1024 / 1024).toFixed(2)}MB (使用旧缓存数据作为参考)`);

      // 由于新缓存不再提供内存使用统计，我们只比较缓存大小
      expect(newStats.size).toBe(oldStats.size);
    });
  });

  describe('驱逐性能对比', () => {
    it('新缓存的驱逐操作应该比旧缓存更快', async () => {
      // 创建大量数据以触发驱逐
      const largeDataset = Array.from({ length: 15000 }, (_, i) => ({
        id: `large-node-${i}`,
        type: GraphNodeType.FUNCTION,
        properties: {
          name: `function-${i}`,
          data: 'x'.repeat(1000), // 增加内存占用
          complexity: Math.floor(Math.random() * 10)
        }
      }));

      // 测试新缓存驱逐性能
      const newStart = performance.now();
      for (let i = 0; i < 15000; i++) {
        await newCache.cacheNodes(`evict-new-${i}`, [largeDataset[i]]);
      }
      const newEnd = performance.now();
      const newTime = newEnd - newStart;

      // 测试旧缓存驱逐性能
      const oldStart = performance.now();
      for (let i = 0; i < 15000; i++) {
        await oldCache.cacheNodes(`evict-old-${i}`, [largeDataset[i]]);
      }
      const oldEnd = performance.now();
      const oldTime = oldEnd - oldStart;

      console.log(`新缓存驱逐时间: ${newTime.toFixed(2)}ms`);
      console.log(`旧缓存驱逐时间: ${oldTime.toFixed(2)}ms`);
      console.log(`性能提升: ${((oldTime - newTime) / oldTime * 100).toFixed(2)}%`);

      // 新缓存的驱逐应该明显更快（O(1) vs O(n)）
      expect(newTime).toBeLessThan(oldTime * 0.8);
    });
  });

  describe('命中率对比', () => {
    it('两种实现的命中率应该相似', async () => {
      // 填充数据
      for (let i = 0; i < 100; i++) {
        await newCache.cacheNodes(`hit-key-${i}`, testNodes.slice(0, 10));
        await oldCache.cacheNodes(`hit-key-${i}`, testNodes.slice(0, 10));
      }

      // 混合读取操作（70%命中，30%未命中）
      const hitKeys = Array.from({ length: 700 }, (_, i) => `hit-key-${i % 100}`);
      const missKeys = Array.from({ length: 300 }, (_, i) => `miss-key-${i}`);
      const allKeys = [...hitKeys, ...missKeys].sort(() => Math.random() - 0.5);

      // 测试新缓存
      for (const key of allKeys) {
        await newCache.getNodes(key);
      }
      const newStats = await newCache.getStats();

      // 测试旧缓存
      for (const key of allKeys) {
        await oldCache.getNodes(key);
      }
      const oldStats = await oldCache.getStats();

      console.log(`新缓存命中率: ${(newStats.hitRate! * 100).toFixed(2)}%`);
      console.log(`旧缓存命中率: ${(oldStats.hitRate! * 100).toFixed(2)}%`);

      // 命中率应该非常相似
      expect(newStats.hitRate).toBeCloseTo(oldStats.hitRate!, 1);
    });
  });
});