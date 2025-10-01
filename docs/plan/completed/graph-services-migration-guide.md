# 图服务迁移指南

## 📖 概述

本文档提供了从单体 `GraphPersistenceService` 迁移到新的分层架构的详细指南。包括迁移步骤、API 变更、配置调整和最佳实践。

## 🔄 迁移路线图

### 阶段一：架构准备 (已完成)
- ✅ 分析现有模块结构和依赖关系
- ✅ 设计新的分层架构
- ✅ 创建基础设施层组件
- ✅ 重构数据库层组件
- ✅ 创建新的服务层组件

### 阶段二：代码迁移
- ✅ 更新依赖注入配置
- ✅ 编写单元测试和集成测试
- ✅ 创建架构文档

### 阶段三：部署验证
- [ ] 逐步替换现有调用
- [ ] 性能基准测试
- [ ] 生产环境部署

## 🗂️ 目录结构变化

### 迁移前结构
```
src/
├── service/
│   └── graph/
│       ├── core/
│       │   └── GraphPersistenceService.ts (1285行)
│       ├── cache/
│       │   └── GraphCacheService.ts
│       ├── performance/
│       │   ├── GraphPerformanceMonitor.ts
│       │   └── GraphBatchOptimizer.ts
│       ├── query/
│       │   └── GraphQueryBuilder.ts
│       └── utils/
│           └── GraphPersistenceUtils.ts
```

### 迁移后结构
```
src/
├── infrastructure/          # 新增基础设施层
│   ├── batching/
│   │   ├── BatchOptimizer.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   ├── caching/
│   │   ├── CacheService.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   └── monitoring/
│       ├── PerformanceMonitor.ts
│       ├── types.ts
│       └── __tests__/
│
├── database/               # 重构数据库层
│   ├── core/
│   │   ├── DatabaseService.ts
│   │   ├── TransactionManager.ts
│   │   └── types.ts
│   ├── query/              # 查询构建器迁移至此
│   │   ├── GraphQueryBuilder.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   └── graph/
│       ├── GraphDatabaseService.ts
│       ├── types.ts
│       └── __tests__/
│
└── service/
    └── graph/
        ├── core/           # 保留原有服务（向后兼容）
        │   └── GraphPersistenceService.ts
        ├── core-new/       # 新增服务层
        │   ├── GraphDataService.ts
        │   ├── GraphAnalysisService.ts
        │   ├── GraphTransactionService.ts
        │   ├── types.ts
        │   └── __tests__/
        └── ...            # 其他原有目录保持不变
```

## 🔌 API 变更说明

### 1. 原有 API (保持兼容)

**GraphPersistenceService** 的所有公共方法保持不变，确保现有代码无需修改：

```typescript
// 迁移前代码继续有效
const result = await graphPersistenceService.storeParsedFiles(files, options);
const relatedNodes = await graphPersistenceService.findRelatedNodes(nodeId);
const stats = await graphPersistenceService.getGraphStats();
```

### 2. 新 API (推荐使用)

#### 数据操作 - GraphDataService
```typescript
// 存储解析文件
const result = await graphDataService.storeParsedFiles(files, {
  projectId: 'my-project',
  batchSize: 100,
  useCache: true
});

// 存储代码片段
const chunkResult = await graphDataService.storeChunks(chunks, options);

// 增量更新
const updateResult = await graphDataService.updateChunks(updatedChunks, options);
```

#### 分析查询 - GraphAnalysisService
```typescript
// 查找相关节点
const relatedNodes = await graphAnalysisService.findRelatedNodes(
  'func-123', 
  ['CONTAINS', 'CALLS'], 
  2
);

// 分析代码结构
const analysis = await graphAnalysisService.analyzeCodeStructure('project-1');

// 查找代码依赖
const dependencies = await graphAnalysisService.findCodeDependencies('func-123');
```

#### 事务管理 - GraphTransactionService
```typescript
// 执行事务
const transactionResult = await graphTransactionService.executeTransaction(queries);

// 批量操作
const batchResult = await graphTransactionService.executeBatchTransaction(operations, {
  batchSize: 50,
  timeoutMs: 30000
});
```

## ⚙️ 配置调整

### 1. 依赖注入配置

**迁移前**:
```typescript
@inject(TYPES.GraphPersistenceService)
private graphPersistenceService: GraphPersistenceService;
```

**迁移后** (推荐):
```typescript
@inject(TYPES.GraphDataService)
private graphDataService: GraphDataService;

@inject(TYPES.GraphAnalysisService) 
private graphAnalysisService: GraphAnalysisService;

@inject(TYPES.GraphTransactionService)
private graphTransactionService: GraphTransactionService;
```

### 2. 批处理配置

**新增配置选项**:
```yaml
batchProcessing:
  maxConcurrentOperations: 10
  defaultBatchSize: 100
  maxBatchSize: 1000
  memoryThreshold: 85
  processingTimeout: 600000
  retryAttempts: 5
  retryDelay: 2000
  adaptiveBatching:
    enabled: true
    learningRate: 0.1
```

### 3. 缓存配置

**新增配置选项**:
```yaml
caching:
  defaultTTL: 300000
  cleanupInterval: 60000
  maxEntries: 10000
  memoryLimit: 512
```

## 🧪 测试策略

### 单元测试覆盖
- ✅ BatchOptimizer 测试
- ✅ PerformanceMonitor 测试  
- ✅ CacheService 测试
- ✅ GraphQueryBuilder 测试
- ✅ GraphDatabaseService 测试
- ✅ GraphDataService 测试
- ✅ GraphAnalysisService 测试
- ✅ GraphTransactionService 测试

### 集成测试
```typescript
// 验证新服务与原有服务的兼容性
describe('Backward Compatibility', () => {
  it('should maintain same API behavior', async () => {
    const oldResult = await oldService.method(params);
    const newResult = await newService.method(params);
    expect(newResult).toEqual(oldResult);
  });
});
```

## 🚀 部署策略

### 渐进式迁移方案

#### 阶段 1: 并行运行
```typescript
// 同时注入新旧服务
constructor(
  @inject(TYPES.GraphPersistenceService) private oldService: GraphPersistenceService,
  @inject(TYPES.GraphDataService) private newDataService: GraphDataService,
  @inject(TYPES.GraphAnalysisService) private newAnalysisService: GraphAnalysisService
) {}
```

#### 阶段 2: 逐步替换
```typescript
// 逐步将调用从旧服务迁移到新服务
async migrateOperation() {
  // 原有调用（暂时保留）
  const oldResult = await this.oldService.someOperation(params);
  
  // 新服务调用（逐步启用）
  try {
    const newResult = await this.newDataService.someOperation(params);
    // 验证结果一致性
    if (this.validateResults(oldResult, newResult)) {
      // 切换到新服务
      return newResult;
    }
  } catch (error) {
    // 回退到旧服务
    logger.warn('New service failed, falling back to old service', error);
    return oldResult;
  }
}
```

#### 阶段 3: 完全切换
```typescript
// 移除旧服务依赖，完全使用新服务
constructor(
  @inject(TYPES.GraphDataService) private dataService: GraphDataService,
  @inject(TYPES.GraphAnalysisService) private analysisService: GraphAnalysisService,
  @inject(TYPES.GraphTransactionService) private transactionService: GraphTransactionService
) {}
```

## 📊 性能监控

### 关键监控指标
```typescript
// 获取性能指标
const metrics = {
  // 批处理性能
  batchSize: batchOptimizer.getConfig().defaultBatchSize,
  batchSuccessRate: performanceMonitor.getMetrics().batchSuccessRate,
  
  // 缓存性能
  cacheHitRate: performanceMonitor.getMetrics().cacheHitRate,
  cacheSize: cacheService.getCacheStats().totalEntries,
  
  // 查询性能
  avgQueryTime: performanceMonitor.getMetrics().averageQueryTime,
  maxQueryTime: performanceMonitor.getMetrics().maxQueryTime,
  
  // 错误率
  errorRate: performanceMonitor.getMetrics().errorRate
};
```

### 监控仪表板建议
1. **批处理性能**: 成功率、平均处理时间、批处理大小分布
2. **缓存效率**: 命中率、缓存大小、清理频率
3. **查询性能**: 响应时间分布、慢查询分析
4. **资源使用**: 内存使用率、连接池状态

## 🔧 故障排除

### 常见问题及解决方案

#### 问题 1: 批处理性能下降
**解决方案**:
```typescript
// 调整批处理配置
batchOptimizer.updateConfig({
  maxConcurrentOperations: 5,      // 减少并发
  defaultBatchSize: 50,            // 减小批处理大小
  memoryThreshold: 70              // 降低内存阈值
});
```

#### 问题 2: 缓存命中率低
**解决方案**:
```typescript
// 调整缓存策略
// 1. 增加热门数据的TTL
// 2. 优化缓存键生成策略
// 3. 监控缓存模式，调整缓存大小
```

#### 问题 3: 事务超时
**解决方案**:
```typescript
// 使用带超时的事务执行
const result = await graphTransactionService.executeWithTimeout(
  () => transactionService.executeTransaction(queries),
  30000 // 30秒超时
);
```

## 📈 性能优化建议

### 1. 批处理优化
```typescript
// 根据数据量动态调整批处理大小
const optimalBatchSize = batchOptimizer.calculateOptimalBatchSize(totalItems);

// 使用自适应批处理
if (batchOptimizer.getConfig().adaptiveBatchingEnabled) {
  // 根据历史性能数据调整批处理策略
}
```

### 2. 缓存策略优化
```typescript
// 分层缓存策略
const layeredCache = {
  L1: new MemoryCache({ maxSize: 1000 }),     // 内存缓存
  L2: new RedisCache({ ttl: 300000 }),        // Redis缓存
  L3: new DiskCache({ path: './cache' })      // 磁盘缓存
};
```

### 3. 查询优化
```typescript
// 使用预处理语句
const preparedQuery = graphQueryBuilder.buildOptimizedQuery(params);

// 批量查询优化
const batchQueries = graphQueryBuilder.batchOptimize(queries);
```

## 🎯 迁移检查清单

### 代码迁移
- [ ] 更新依赖注入配置
- [ ] 替换服务调用（逐步进行）
- [ ] 验证API兼容性
- [ ] 更新单元测试

### 配置调整
- [ ] 批处理配置优化
- [ ] 缓存策略配置
- [ ] 性能监控配置

### 部署验证
- [ ] 性能基准测试
- [ ] 回归测试
- [ ] 生产环境监控

## 📝 总结

本次迁移实现了从单体架构到分层架构的转变，带来了以下好处：

1. **更好的可维护性**: 职责分离，代码更清晰
2. **更高的性能**: 专门的优化组件
3. **更强的扩展性**: 可以独立扩展各个组件
4. **更好的可测试性**: 每个组件都可以单独测试
5. **渐进式迁移**: 保持向后兼容，降低风险

建议采用渐进式迁移策略，逐步验证新架构的稳定性和性能，确保平滑过渡。