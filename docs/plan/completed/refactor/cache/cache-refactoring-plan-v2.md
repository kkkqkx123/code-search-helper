# 缓存架构重构计划（细化版）

## 改进原则
1. **直接修改LRUCache**：不新建文件，在现有基础上增强
2. **职责分离**：简单逻辑保留在LRUCache，复杂功能分离到utils/cache
3. **向后兼容**：保持现有API不变，新增功能为可选
4. **渐进式重构**：分步骤实施，降低风险

## 第一阶段：增强现有LRUCache

### 1.1 修改 src/service/parser/utils/LRUCache.ts

```typescript
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
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0 };
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

    // LRU：删除并重新插入以更新位置
    this.cache.delete(key);
    this.cache.set(key, { ...entry, accessTime: Date.now() });
    
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
        this.cache.delete(firstKey);
        if (this.enableStats) this.stats.evictions++;
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
      size: this.cache.size
    };
  }

  // 新增：清理过期条目
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
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
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
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
}
```

### 1.2 创建内存监控工具（复杂逻辑分离）

```typescript
// src/utils/cache/MemoryAwareCache.ts
import { LRUCache } from '../../service/parser/utils/LRUCache';

export interface MemoryOptions {
  maxMemory?: number; // 最大内存使用（字节）
  memoryCheckInterval?: number; // 内存检查间隔（毫秒）
}

export class MemoryAwareCache<K, V> extends LRUCache<K, V> {
  private maxMemory: number;
  private memoryUsage: number;
  private sizeMap: Map<K, number>;

  constructor(maxSize: number = 1000, options: MemoryOptions & any = {}) {
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
```

### 1.3 创建统计装饰器

```typescript
// src/utils/cache/StatsDecorator.ts
import { LRUCache } from '../../service/parser/utils/LRUCache';

export class StatsDecorator<K, V> {
  private cache: LRUCache<K, V>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    gets: 0,
    deletes: 0,
    clears: 0
  };

  constructor(cache: LRUCache<K, V>) {
    this.cache = cache;
  }

  get(key: K): V | undefined {
    this.stats.gets++;
    const result = this.cache.get(key);
    if (result === undefined) {
      this.stats.misses++;
    } else {
      this.stats.hits++;
    }
    return result;
  }

  set(key: K, value: V, ttl?: number): void {
    this.stats.sets++;
    const hadKey = this.cache.has(key);
    this.cache.set(key, value, ttl);
    if (!hadKey && this.cache.has(key) && this.cache.size() > 0) {
      // 新插入且缓存未空，说明可能发生了驱逐
      this.stats.evictions++;
    }
  }

  // 包装其他方法...
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.gets > 0 ? this.stats.hits / this.stats.gets : 0,
      size: this.cache.size()
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      gets: 0,
      deletes: 0,
      clears: 0
    };
  }
}
```

## 第二阶段：重构 GraphMappingCache

```typescript
// src/service/caching/GraphMappingCache.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphNode, GraphRelationship } from '../graph/mapping/IGraphDataMappingService';
import { LRUCache } from '../parser/utils/LRUCache';
import { MemoryAwareCache } from '../../utils/cache/MemoryAwareCache';

@injectable()
export class GraphMappingCache {
  private logger: LoggerService;
  private cache: MemoryAwareCache<string, any>;

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
    // 使用内存感知的缓存
    this.cache = new MemoryAwareCache<string, any>(10000, {
      maxMemory: 50 * 1024 * 1024, // 50MB
      defaultTTL: 300000, // 5分钟
      enableStats: true
    });
    
    this.logger.info('GraphMappingCache initialized', {
      maxSize: 10000,
      maxMemory: 50 * 1024 * 1024,
      defaultTTL: 300000
    });
  }

  // 业务方法保持不变，但使用新的缓存实现
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

  // 其他方法类似实现...

  async getStats() {
    const baseStats = this.cache.getStats?.() || { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0 };
    return {
      ...baseStats,
      memoryUsage: this.cache.getMemoryUsage?.() || 0,
      maxMemory: this.cache.getMaxMemory?.() || 0
    };
  }
}
```

## 实施优先级

1. **高优先级**：增强现有LRUCache（TTL、统计）
2. **中优先级**：创建内存监控工具
3. **低优先级**：重构GraphMappingCache
4. **可选**：创建统计装饰器

## 向后兼容性保证

- 所有现有API保持不变
- 新增功能为可选参数
- 逐步迁移，不影响现有功能
- 提供回滚方案

## 测试策略

1. **单元测试**：每个增强功能单独测试
2. **集成测试**：验证与现有系统兼容性
3. **性能测试**：对比新旧实现性能
4. **内存测试**：验证内存监控准确性