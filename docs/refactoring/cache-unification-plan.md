# 缓存统一管理计划

## 当前缓存实现分析

### 1. QueryCache (database/nebula/query/QueryCache.ts)
**用途**: Nebula查询结果缓存
**实现**: 基于LRUCache
**特点**:
- 查询结果缓存
- 支持TTL
- 统计信息追踪
- 可配置启用/禁用

### 2. SessionManager缓存 (database/nebula/session/SessionManager.ts)
**用途**: Session对象缓存
**实现**: 基于LRUCache (spaceSessionCache)
**特点**:
- 按space缓存session
- 缓存命中率统计

### 3. SpaceValidator缓存 (database/nebula/validation/SpaceValidator.ts)
**用途**: Space验证结果缓存
**实现**: 基于LRUCache
**特点**:
- 验证结果缓存
- TTL支持
- 缓存统计

### 4. MemoryOptimizer缓存 (database/nebula/memory/MemoryOptimizer.ts)
**用途**: 结果集缓存
**实现**: Map<string, CachedData>
**特点**:
- 智能缓存驱逐
- 内存阈值管理

### 5. GraphService缓存 (service/graph/core/GraphService.ts)
**用途**: 图查询结果缓存
**实现**: 通过ICacheService
**特点**:
- 读查询缓存
- 写操作缓存失效

### 6. GraphMappingCache (service/graph/caching/)
**用途**: 图映射数据缓存
**实现**: 专用缓存服务
**特点**:
- 映射关系缓存
- 关系提取缓存

## 问题分析

### 1. 缓存分散
- 多个独立的缓存实现
- 没有统一的缓存策略
- 难以全局管理和监控

### 2. 重复实现
- 多处使用LRUCache但配置不一致
- 统计信息收集方式不统一
- 缓存失效策略各异

### 3. 配置混乱
- 缓存配置分散在各个模块
- 没有统一的配置管理
- 难以调优

## 解决方案

### 方案1: 保持现状 + Repository层统一访问 (推荐)

**原理**: 
- 各模块保持现有缓存实现
- Repository层提供统一的缓存访问接口
- 通过infrastructure/caching提供缓存服务

**优势**:
- ✅ 最小改动
- ✅ 保持各模块独立性
- ✅ 通过Repository层隔离缓存细节
- ✅ 风险低

**实施**:
```typescript
// Repository层统一使用ICacheService
class GraphRepository {
  constructor(
    private cacheService: ICacheService  // 统一缓存接口
  ) {}
  
  async findNodeById(id: string) {
    const cacheKey = `node:${id}`;
    const cached = this.cacheService.getFromCache(cacheKey);
    if (cached) return cached;
    
    const result = await this.dataOps.getNode(id);
    this.cacheService.setCache(cacheKey, result);
    return result;
  }
}
```

### 方案2: 完全统一到infrastructure/caching (激进)

**原理**:
- 移除所有分散的缓存实现
- 统一使用infrastructure/caching/CacheService
- 所有缓存通过统一接口访问

**优势**:
- 统一管理
- 配置集中
- 易于监控

**劣势**:
- ❌ 改动巨大
- ❌ 风险高
- ❌ 需要大量测试

## 推荐实施方案

### 阶段1: 当前状态 (已完成)
```
各模块独立缓存 → Repository层 → 服务层
```

### 阶段2: 统一缓存接口 (建议实施)

**步骤**:

1. **确保infrastructure/caching完善**
   - CacheService支持所有缓存场景
   - 提供统一的配置管理
   - 支持多种缓存策略

2. **Repository层统一使用ICacheService**
   ```typescript
   // 所有Repository通过ICacheService访问缓存
   class GraphRepository {
     constructor(
       @inject(TYPES.CacheService) private cache: ICacheService
     ) {}
   }
   ```

3. **保留数据库层特定缓存**
   - QueryCache: 查询级别缓存，保留
   - SessionManager缓存: 连接管理，保留
   - SpaceValidator缓存: 验证结果，保留

4. **服务层缓存统一**
   - GraphService通过Repository访问
   - 移除直接的缓存操作
   - 统一缓存失效策略

### 阶段3: 渐进式优化 (长期)

1. 监控各缓存使用情况
2. 识别可合并的缓存
3. 逐步迁移到统一实现

## 具体实施

### 1. 确认infrastructure/caching已满足需求

检查 `src/infrastructure/caching/CacheService.ts`:
- ✅ 支持TTL
- ✅ 支持统计
- ✅ 支持多种存储后端
- ✅ 支持缓存失效

### 2. Repository层统一缓存访问

```typescript
// src/service/graph/repository/GraphRepository.ts
@injectable()
export class GraphRepository implements IGraphRepository {
  constructor(
    @inject(TYPES.CacheService) private cache: ICacheService,
    @inject(TYPES.INebulaDataOperations) private dataOps: INebulaDataOperations
  ) {}

  async getNodeById(nodeId: string): Promise<GraphNodeData | null> {
    const cacheKey = `graph:node:${nodeId}`;
    
    // 尝试从缓存获取
    const cached = this.cache.getFromCache<GraphNodeData>(cacheKey);
    if (cached) return cached;
    
    // 从数据库获取
    const result = await this.dataOps.getNode(nodeId);
    
    // 缓存结果
    if (result) {
      this.cache.setCache(cacheKey, result, 300000); // 5分钟
    }
    
    return result;
  }
}
```

### 3. 数据库层缓存保持独立

```typescript
// QueryCache, SessionManager缓存等保持不变
// 这些是数据库层内部优化，不需要暴露给上层
```

## 缓存策略建议

### 1. 缓存分层

```
L1: 数据库层缓存 (QueryCache, SessionCache)
    - 查询结果
    - 连接会话
    - 验证结果
    
L2: Repository层缓存 (通过ICacheService)
    - 节点数据
    - 关系数据
    - 遍历结果
    
L3: 服务层缓存 (通过Repository)
    - 业务对象
    - 聚合数据
    - 分析结果
```

### 2. 缓存失效策略

```typescript
// 写操作自动失效相关缓存
async createNode(node: GraphNodeData) {
  const result = await this.dataOps.insertNode(node);
  
  // 失效相关缓存
  this.cache.invalidatePattern(`graph:node:*`);
  this.cache.invalidatePattern(`graph:traversal:*`);
  
  return result;
}
```

### 3. 缓存配置统一

```typescript
// config/CacheConfig.ts
export const CACHE_CONFIG = {
  graph: {
    node: { ttl: 300000, maxSize: 10000 },
    relationship: { ttl: 300000, maxSize: 10000 },
    traversal: { ttl: 60000, maxSize: 1000 }
  },
  query: {
    result: { ttl: 300000, maxSize: 5000 }
  }
};
```

## 监控和调优

### 1. 统一监控接口

```typescript
interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  itemCount: number;
}

// 各层缓存提供统一的监控接口
```

### 2. 性能追踪

```typescript
// 记录缓存性能
this.performanceMonitor.recordCacheOperation({
  layer: 'repository',
  operation: 'get',
  hit: !!cached,
  duration: Date.now() - startTime
});
```

## 总结

### 当前方案 (推荐)
- ✅ Repository层已经提供了缓存抽象
- ✅ 数据库层缓存保持独立
- ✅ 服务层通过Repository访问
- ✅ 风险低，改动小

### 不需要大规模重构
- QueryCache等数据库层缓存是内部优化，保持不变
- Repository层已经统一了服务层的缓存访问
- 通过ICacheService提供了统一接口

### 后续优化方向
- 监控各层缓存使用情况
- 优化缓存配置
- 必要时合并重复缓存

## 结论

**当前架构已经通过Repository层实现了缓存的合理分层和统一访问，不需要进行大规模的缓存统一重构。**

数据库层的QueryCache、SessionCache等是内部优化，应该保持独立。服务层通过Repository和ICacheService访问缓存，已经实现了统一管理的目标。