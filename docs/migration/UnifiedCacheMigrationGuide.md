# 统一缓存服务迁移指南

## 概述

本文档提供了将现有服务从旧缓存实现迁移到新的统一缓存服务的指南。统一缓存服务整合了 `GraphMappingCache`、`GraphCacheService` 和 `MappingCacheManager` 的功能。

## 新的缓存架构

### 统一缓存服务组件

1. **UnifiedGraphCacheService** - 主缓存服务，实现了 `IGraphCacheService` 接口
2. **IGraphCacheService** - 统一缓存服务接口
3. **types.ts** - 缓存相关类型定义
4. **MappingCacheManager** - 多级缓存管理器（可选使用）

## 迁移步骤

### 1. 更新依赖注入配置

在 `InfrastructureServiceRegistrar.ts` 中已经添加了新的服务注册：

```typescript
// 添加新的服务注册
container.bind<UnifiedGraphCacheService>(TYPES.UnifiedGraphCacheService).to(UnifiedGraphCacheService).inSingletonScope();
container.bind<MappingCacheManager>(TYPES.MappingCacheManager).to(MappingCacheManager).inSingletonScope();
```

### 2. 更新服务实现

#### 2.1 更新 GraphDataMappingService

```typescript
// 旧实现
import { GraphMappingCache } from '../caching/GraphMappingCache';

// 新实现
import { UnifiedGraphCacheService } from '../caching/UnifiedGraphCacheService';
import { IGraphCacheService } from '../caching/IGraphCacheService';

// 在构造函数中
constructor(
  @inject(TYPES.DataMappingValidator) validator: DataMappingValidator,
  // 旧方式
  // @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
  // 新方式 - 可以选择保留旧的或直接使用新的
  @inject(TYPES.UnifiedGraphCacheService) cache: IGraphCacheService,
  @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer
)
```

#### 2.2 更新 SemanticRelationshipExtractor

```typescript
// 旧实现
import { GraphMappingCache } from '../caching/GraphMappingCache';

// 新实现
import { UnifiedGraphCacheService } from '../caching/UnifiedGraphCacheService';
import { IGraphCacheService } from '../caching/IGraphCacheService';

// 在构造函数中
constructor(
  @inject(TYPES.DataMappingValidator) validator: DataMappingValidator,
  // 旧方式
  // @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
  // 新方式
  @inject(TYPES.UnifiedGraphCacheService) cache: IGraphCacheService,
  @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
)
```

### 3. 更新监控服务

#### 3.1 更新 CachePerformanceMonitor

`CachePerformanceMonitor` 已经更新为可以同时使用旧缓存服务和新统一缓存服务，并优先使用新服务。

#### 3.2 更新 PerformanceMetricsCollector

```typescript
// 旧实现
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

// 新实现
import { UnifiedGraphCacheService } from '../graph/caching/UnifiedGraphCacheService';
import { IGraphCacheService } from '../graph/caching/IGraphCacheService';

// 在构造函数中
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.TransactionLogger) transactionLogger: TransactionLogger,
  // 旧方式
  // @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
  // 新方式
  @inject(TYPES.UnifiedGraphCacheService) cache: IGraphCacheService,
  options?: Partial<MetricsCollectionOptions>
)
```

#### 3.3 更新 PerformanceDashboard

```typescript
// 旧实现
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

// 新实现
import { UnifiedGraphCacheService } from '../graph/caching/UnifiedGraphCacheService';
import { IGraphCacheService } from '../graph/caching/IGraphCacheService';

// 在构造函数中
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.TransactionLogger) transactionLogger: TransactionLogger,
  // 旧方式
  // @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
  // 新方式
  @inject(TYPES.UnifiedGraphCacheService) cache: IGraphCacheService
)
```

### 4. 更新优化服务

#### 4.1 更新 AutoOptimizationAdvisor

```typescript
// 旧实现
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

// 新实现
import { UnifiedGraphCacheService } from '../graph/caching/UnifiedGraphCacheService';
import { IGraphCacheService } from '../graph/caching/IGraphCacheService';

// 在构造函数中
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.PerformanceDashboard) dashboard: PerformanceDashboard,
  @inject(TYPES.PerformanceMetricsCollector) metricsCollector: PerformanceMetricsCollector,
  @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
  // 旧方式
  // @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
  // 新方式
  @inject(TYPES.UnifiedGraphCacheService) cache: IGraphCacheService,
  options?: Partial<AdvisorOptions>
)
```

### 5. 更新容错服务

#### 5.1 更新 FaultToleranceHandler

```typescript
// 旧实现
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

// 新实现
import { UnifiedGraphCacheService } from '../graph/caching/UnifiedGraphCacheService';
import { IGraphCacheService } from '../graph/caching/IGraphCacheService';

// 在构造函数中
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.TransactionLogger) transactionLogger: TransactionLogger,
  // 旧方式
  // @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
  // 新方式
  @inject(TYPES.UnifiedGraphCacheService) cache: IGraphCacheService,
  options?: Partial<FaultToleranceOptions>
)
```

## 迁移策略

### 阶段1：并行运行（推荐）

1. 保留旧的缓存服务注册
2. 添加新的统一缓存服务注册
3. 逐个更新服务实现，从非关键服务开始
4. 在监控服务中同时监控新旧缓存的性能

### 阶段2：逐步替换

1. 逐个替换服务中的缓存依赖
2. 运行测试确保功能正常
3. 监控性能指标确保没有性能下降

### 阶段3：清理

1. 移除旧的缓存服务注册
2. 删除不再使用的旧缓存实现文件（可选）
3. 更新文档

## 性能对比

新的统一缓存服务提供了以下改进：

1. **统一接口** - 所有缓存功能通过一个接口访问
2. **更好的性能监控** - 集成的统计和监控功能
3. **多级缓存支持** - 可选的多级缓存实现
4. **更丰富的功能** - 批量操作、健康检查等
5. **更好的错误处理** - 统一的错误处理机制

## 注意事项

1. **兼容性** - 新的统一缓存服务保持了与旧接口的兼容性
2. **配置** - 可以通过配置启用/禁用多级缓存
3. **回退机制** - 在新服务出现问题时可以回退到旧实现
4. **测试** - 确保在迁移后运行完整的测试套件

## 常见问题

### Q: 是否需要立即替换所有服务？
A: 不需要。可以采用渐进式迁移策略，先在非关键服务中试用新缓存服务。

### Q: 新缓存服务是否与旧服务兼容？
A: 是的。新的统一缓存服务实现了旧服务的所有功能，并保持了接口兼容性。

### Q: 如何监控迁移过程中的性能变化？
A: 使用 `CachePerformanceMonitor` 可以同时监控新旧缓存服务的性能。