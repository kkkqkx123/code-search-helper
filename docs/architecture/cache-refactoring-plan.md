# 缓存架构重构计划

## 当前问题分析

### GraphMappingCache 逻辑缺陷
1. **性能问题**：`getOldestKey()` 方法每次遍历整个 Map，O(n) 复杂度
2. **内存计算不准确**：使用 `JSON.stringify(data).length` 估算大小，忽略 JavaScript 对象开销
3. **驱逐策略冲突**：同时存在 TTL、内存限制、条目数量限制，可能导致频繁驱逐
4. **异步操作不合理**：方法标记为 async 但没有真正的异步操作

### 架构设计问题
1. **代码重复**：两个缓存实现相似功能但方式不同
2. **职责不分离**：GraphMappingCache 既管缓存逻辑又管业务逻辑
3. **缺乏抽象层**：没有统一的缓存接口
4. **测试困难**：紧密耦合导致单元测试复杂

## 重构方案

### 第一阶段：增强 LRUCache

将 `src/utils/LRUCache.ts` 重构为通用缓存工具：

```typescript
// src/utils/cache/EnhancedLRUCache.ts
export interface CacheOptions {
  maxSize?: number;
  maxMemory?: number;
  defaultTTL?: number;
  enableStats?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  size: number;
}

export interface CacheEntry<V> {
  value: V;
  timestamp: number;
  ttl?: number;
  size: number;
}

export class EnhancedLRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private maxMemory: number;
  private defaultTTL: number;
  private enableStats: boolean;
  private stats: CacheStats;
  private memoryUsage: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxMemory = options.maxMemory || 50 * 1024 * 1024; // 50MB
    this.defaultTTL = options.defaultTTL || 0; // 0 表示无 TTL
    this.enableStats = options.enableStats || false;
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0 };
    this.memoryUsage = 0;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // 检查 TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // 更新访问时间（LRU 机制）
    this.cache.delete(key);
    this.cache.set(key, { ...entry, timestamp: Date.now() });
    
    if (this.enableStats) this.stats.hits++;
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.maxSize <= 0) return;

    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      size: this.estimateSize(value)
    };

    // 如果 key 已存在，先删除旧条目
    if (this.cache.has(key)) {
      this.memoryUsage -= this.cache.get(key)!.size;
    }

    // 检查内存限制
    while (this.memoryUsage + entry.size > this.maxMemory && this.cache.size > 0) {
      this.evictLRU();
    }

    // 检查大小限制
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.memoryUsage += entry.size;
    
    if (this.enableStats) this.stats.sets++;
  }

  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      const entry = this.cache.get(firstKey)!;
      this.memoryUsage -= entry.size;
      this.cache.delete(firstKey);
      if (this.enableStats) this.stats.evictions++;
    }
  }

  private estimateSize(value: V): number {
    // 更精确的大小估算
    try {
      return JSON.stringify(value).length * 2; // UTF-16 字符占 2 字节
    } catch {
      return 64; // 默认值
    }
  }

  // 其他方法：has, delete, clear, getStats 等
}
```

### 第二阶段：重构 GraphMappingCache

```typescript
// src/service/caching/GraphMappingCache.ts
import { EnhancedLRUCache } from '../../utils/cache/EnhancedLRUCache';
import { GraphNode, GraphRelationship } from '../graph/mapping/IGraphDataMappingService';

export class GraphMappingCache {
  private cache: EnhancedLRUCache<string, any>;
  
  constructor(options: CacheOptions = {}) {
    this.cache = new EnhancedLRUCache<string, any>({
      maxSize: 10000,
      maxMemory: 50 * 1024 * 1024, // 50MB
      defaultTTL: 300000, // 5分钟
      enableStats: true,
      ...options
    });
  }

  // 业务特定方法保持不变，但使用 EnhancedLRUCache
  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    try {
      this.cache.set(key, nodes, ttl);
      return true;
    } catch (error) {
      this.logger.error('Failed to cache nodes', { key, error });
      return false;
    }
  }

  async getNodes(key: string): Promise<GraphNode[] | null> {
    const result = this.cache.get(key);
    return Array.isArray(result) ? result as GraphNode[] : null;
  }

  // 其他方法类似...
  
  async getStats() {
    return this.cache.getStats();
  }
}
```

### 第三阶段：创建缓存抽象层

```typescript
// src/utils/cache/ICache.ts
export interface ICache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, ttl?: number): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  getStats?(): CacheStats;
}

// src/utils/cache/CacheFactory.ts
export class CacheFactory {
  static createCache<K, V>(type: 'lru' | 'fifo' | 'lfu', options: CacheOptions): ICache<K, V> {
    switch (type) {
      case 'lru':
        return new EnhancedLRUCache<K, V>(options);
      // 可以扩展其他缓存类型
      default:
        throw new Error(`Unsupported cache type: ${type}`);
    }
  }
}
```

## 实施步骤

1. **步骤 1**：创建 `src/utils/cache/` 目录结构
2. **步骤 2**：实现 `EnhancedLRUCache` 类
3. **步骤 3**：编写单元测试验证新实现
4. **步骤 4**：重构 `GraphMappingCache` 使用新缓存
5. **步骤 5**：创建缓存抽象接口和工厂
6. **步骤 6**：更新依赖注入配置
7. **步骤 7**：性能测试和验证
8. **步骤 8**：废弃旧的缓存实现

## 预期收益

1. **性能提升**：LRU 算法比简单时间戳更高效
2. **代码复用**：统一的缓存实现减少重复代码
3. **可维护性**：清晰的架构分层，易于测试和扩展
4. **灵活性**：支持多种缓存策略和配置选项
5. **监控能力**：统一的统计和监控接口

## 风险评估

1. **兼容性风险**：需要确保 API 兼容性
2. **性能风险**：新实现需要充分测试
3. **迁移成本**：需要修改现有代码和测试

建议分阶段实施，先在测试环境验证新实现的性能和稳定性。