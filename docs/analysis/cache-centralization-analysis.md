# 缓存集中管理分析报告

## 📊 当前缓存分布情况

### 1. 多层缓存问题
项目中存在多个层级的私有缓存，造成以下问题：
- **内存浪费**：相同数据在多个缓存中重复存储
- **维护复杂**：缓存同步困难，容易出现数据不一致
- **监控困难**：无法统一监控缓存命中率和性能
- **配置分散**：各层缓存配置不统一

### 2. 现有缓存实例

| 组件 | 缓存位置 | 缓存类型 | 主要问题 |
|------|----------|----------|----------|
| ASTStructureExtractor | 第31-32行 | `Map<string, CacheEntry>` | 私有缓存，无统一监控 |
| LanguageAdapterFactory | 第23行 | `Map<string, ILanguageAdapter>` | 适配器缓存，重复存储 |
| QueryResultNormalizer | 内部实现 | 私有缓存 | 查询结果缓存，无统计 |
| QueryCache | 专用服务 | LRU缓存 | 功能单一，无压缩支持 |
| FileSearchCache | 专用服务 | LRU缓存 | 专用缓存，配置独立 |

## 🎯 缓存基础设施分析

### 1. CacheService（推荐方案）
**位置**：`src\infrastructure\caching\CacheService.ts`

**核心功能**：
- ✅ **TTL管理**：支持自动过期
- ✅ **数据压缩**：自动压缩大数据
- ✅ **内存监控**：防止内存溢出
- ✅ **统一统计**：完整的缓存统计信息
- ✅ **数据库特定缓存**：支持不同类型数据库
- ✅ **自动清理**：定期清理过期数据
- ✅ **依赖注入**：通过DI容器统一管理

**配置选项**：
```typescript
interface CacheConfig {
  defaultTTL: number;        // 默认TTL（毫秒）
  maxEntries: number;        // 最大条目数
  cleanupInterval: number;   // 清理间隔（毫秒）
  enableStats: boolean;      // 启用统计
  enableCompression: boolean; // 启用压缩
  compressionThreshold: number; // 压缩阈值
  maxMemory: number;         // 最大内存使用
  memoryThreshold: number;   // 内存使用阈值
}
```

### 2. LRUCache（基础工具）
**位置**：`src\utils\cache\LRUCache.ts`

**特点**：
- 轻量级LRU缓存实现
- 支持TTL和统计
- 适用于简单场景

## 🚀 缓存集中管理方案

### 推荐方案：统一使用CacheService

**优势**：
1. **功能完善**：包含所有高级缓存功能
2. **统一管理**：通过DI容器集中管理
3. **性能优化**：压缩、内存监控、自动清理
4. **监控友好**：统一的缓存统计和性能监控
5. **扩展性强**：支持数据库特定缓存需求

### 缓存命名空间设计

```typescript
// AST结构缓存
const AST_STRUCTURE_CACHE_PREFIX = 'ast:structure';
// 语言适配器缓存  
const ADAPTER_CACHE_PREFIX = 'adapter';
// 查询结果缓存
const QUERY_RESULT_CACHE_PREFIX = 'query:result';
// 图数据缓存
const GRAPH_CACHE_PREFIX = 'graph:data';
// 向量数据缓存
const VECTOR_CACHE_PREFIX = 'vector:data';
```

### 具体迁移计划

#### 第一阶段：ASTStructureExtractor迁移
```typescript
// 移除私有缓存
// private static cache = new Map<string, CacheEntry>();
// private static readonly CACHE_TTL = 5 * 60 * 1000;

// 注入CacheService
constructor(
  @inject(TYPES.CacheService) private cacheService: ICacheService
) {}

// 缓存键格式
private getCacheKey(language: string, filePath: string): string {
  return `ast:structure:${language}:${filePath}`;
}
```

#### 第二阶段：LanguageAdapterFactory迁移
```typescript
// 移除适配器缓存
// private static adapterCache = new Map<string, ILanguageAdapter>();

// 使用CacheService缓存适配器实例
private async cacheAdapter(language: string, options: AdapterOptions, adapter: ILanguageAdapter): Promise<void> {
  const cacheKey = `adapter:${language}:${JSON.stringify(options)}`;
  await this.cacheService.setCache(cacheKey, adapter, this.ADAPTER_CACHE_TTL);
}
```

#### 第三阶段：QueryResultNormalizer迁移
```typescript
// 使用CacheService缓存查询结果
private async cacheQueryResult(queryKey: string, result: StandardizedQueryResult): Promise<void> {
  const cacheKey = `query:result:${queryKey}`;
  await this.cacheService.setCache(cacheKey, result, this.QUERY_CACHE_TTL);
}
```

## 📈 性能影响评估

### 正面影响
1. **内存使用优化**：消除重复缓存，减少内存占用
2. **缓存命中率提升**：统一缓存管理，提高命中率
3. **监控能力增强**：统一统计，便于性能调优
4. **维护成本降低**：集中配置，简化维护

### 潜在风险
1. **单点故障**：所有缓存依赖单一服务
2. **性能瓶颈**：CacheService可能成为性能瓶颈
3. **迁移成本**：需要修改多个组件的缓存逻辑
