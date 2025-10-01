# 图服务架构与职能划分文档

## 📋 概述

本文档详细描述了重构后的图服务模块架构，展示了从单体 `GraphPersistenceService` 到分层架构的演变过程。新的架构遵循 SOLID 原则，实现了清晰的职责分离和模块化设计。

## 🏗️ 架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ GraphData   │  │ GraphAnalysis │  │ GraphTransaction     │ │
│  │ Service     │  │ Service      │  │ Service               │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ GraphDatabase  │  │ Transaction     │  │ GraphQuery      │ │
│  │ Service        │  │ Manager         │  │ Builder         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Batch       │  │ Performance  │  │ Cache                    │ │
│  │ Optimizer   │  │ Monitor      │  │ Service                 │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 服务层详细职能划分

### 1. GraphDataService - 数据持久化服务

**核心职责**: 负责代码数据的存储、更新和删除操作

**主要方法**:
- `storeParsedFiles(files: any[], options: GraphPersistenceOptions)`: 存储解析后的文件数据
- `storeChunks(chunks: any[], options: GraphPersistenceOptions)`: 存储代码片段数据
- `updateChunks(chunks: any[], options: GraphPersistenceOptions)`: 增量更新代码片段
- `deleteNodesByFiles(filePaths: string[])`: 按文件路径删除节点
- `clearGraph(projectId: string)`: 清空项目图数据
- `getGraphStats()`: 获取图统计信息

**依赖关系**:
- `GraphDatabaseService`: 数据库操作
- `CacheService`: 缓存管理
- `BatchOptimizer`: 批处理优化
- `PerformanceMonitor`: 性能监控

### 2. GraphAnalysisService - 代码分析服务

**核心职责**: 负责代码结构分析和图遍历查询

**主要方法**:
- `findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number)`: 查找相关节点
- `findPath(sourceId: string, targetId: string, maxDepth?: number)`: 查找节点间路径
- `analyzeCodeStructure(projectId: string)`: 分析代码结构
- `findCodeDependencies(nodeId: string)`: 查找代码依赖关系
- `findCodeUsage(nodeId: string)`: 查找代码使用情况
- `calculateComplexityMetrics(projectId: string)`: 计算复杂度指标

**依赖关系**:
- `GraphDatabaseService`: 数据库查询
- `CacheService`: 分析结果缓存
- `PerformanceMonitor`: 查询性能监控

### 3. GraphTransactionService - 事务管理服务

**核心职责**: 负责事务管理和批量操作

**主要方法**:
- `executeTransaction(queries: GraphQuery[])`: 执行事务
- `executeBatchTransaction(operations: BatchOperation[], options?: BatchOptions)`: 执行批量事务
- `executeWithRetry(operation: () => Promise<any>)`: 带重试的执行操作
- `executeWithTimeout(operation: () => Promise<any>, timeoutMs: number)`: 带超时的执行操作
- `begin()`: 开始事务
- `commit(transactionId: string)`: 提交事务
- `rollback(transactionId: string)`: 回滚事务

**依赖关系**:
- `TransactionManager`: 事务管理
- `BatchOptimizer`: 批处理优化
- `GraphDatabaseService`: 数据库操作

## 🗄️ 数据库层详细职能划分

### 1. GraphDatabaseService - 图数据库服务

**核心职责**: 提供统一的图数据库操作接口

**主要方法**:
- `createNode(nodeData: NodeData)`: 创建节点
- `createRelationship(relationshipData: RelationshipData)`: 创建关系
- `updateNode(updateData: UpdateData)`: 更新节点
- `deleteNode(nodeId: string)`: 删除节点
- `findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number)`: 查找相关节点
- `findPath(sourceId: string, targetId: string, maxDepth?: number)`: 查找路径
- `batchInsertNodes(nodes: NodeData[])`: 批量插入节点
- `batchInsertRelationships(relationships: RelationshipData[])`: 批量插入关系
- `getGraphStatistics()`: 获取图统计信息

### 2. TransactionManager - 事务管理器

**核心职责**: 管理数据库事务

**主要方法**:
- `executeTransaction(queries: GraphQuery[])`: 执行事务
- `beginTransaction()`: 开始事务
- `commitTransaction(transactionId: string)`: 提交事务
- `rollbackTransaction(transactionId: string)`: 回滚事务

### 3. GraphQueryBuilder - 查询构建器

**核心职责**: 构建 NebulaGraph 查询语句

**主要方法**:
- `buildInsertNodeQuery(nodeData: NodeData)`: 构建插入节点查询
- `buildInsertRelationshipQuery(relationshipData: RelationshipData)`: 构建插入关系查询
- `buildUpdateNodeQuery(updateData: UpdateData)`: 构建更新节点查询
- `buildDeleteNodeQuery(nodeId: string)`: 构建删除节点查询
- `buildFindRelatedNodesQuery(nodeId: string, relationshipTypes?: string[], maxDepth?: number)`: 构建查找相关节点查询
- `buildFindPathQuery(sourceId: string, targetId: string, maxDepth?: number)`: 构建查找路径查询
- `batchInsertVertices(vertices: any[])`: 批量插入顶点
- `batchInsertEdges(edges: any[])`: 批量插入边

## 🛠️ 基础设施层详细职能划分

### 1. BatchOptimizer - 批处理优化器

**核心职责**: 优化批处理操作的性能和资源使用

**主要方法**:
- `calculateOptimalBatchSize(totalItems: number)`: 计算最优批处理大小
- `shouldRetry(error: Error, attempt: number)`: 判断是否应该重试
- `updateConfig(config: BatchConfig)`: 更新配置
- `getConfig()`: 获取当前配置

### 2. PerformanceMonitor - 性能监控器

**核心职责**: 监控系统性能指标

**主要方法**:
- `recordQueryExecution(timeMs: number)`: 记录查询执行时间
- `updateCacheHitRate(isHit: boolean)`: 更新缓存命中率
- `updateBatchSize(size: number)`: 记录批处理大小
- `recordMemoryUsage(percentage: number)`: 记录内存使用率
- `recordError(error: string)`: 记录错误
- `startPeriodicMonitoring(intervalMs: number, callback?: () => void)`: 启动周期性监控
- `getMetrics()`: 获取性能指标

### 3. CacheService - 缓存服务

**核心职责**: 提供数据缓存功能

**主要方法**:
- `setCache(key: string, value: any, ttlMs?: number)`: 设置缓存
- `getFromCache<T>(key: string)`: 获取缓存
- `hasKey(key: string)`: 检查键是否存在
- `deleteFromCache(key: string)`: 删除缓存
- `clearAllCache()`: 清空所有缓存
- `cleanupExpiredEntries()`: 清理过期条目
- `getCacheStats()`: 获取缓存统计信息

## 🔄 服务间调用关系

### 正向调用流程

```
用户请求 → GraphDataService → GraphDatabaseService → NebulaGraph
                             ↓
                     TransactionManager
                             ↓
                     GraphQueryBuilder
```

### 分析查询流程

```
用户请求 → GraphAnalysisService → GraphDatabaseService → NebulaGraph
                                 ↓
                         CacheService (缓存分析结果)
```

### 事务处理流程

```
用户请求 → GraphTransactionService → TransactionManager → NebulaGraph
                                   ↓
                           BatchOptimizer (优化批处理)
```

## 📊 性能优化策略

### 1. 批处理优化
- 自适应批处理大小计算
- 内存使用率监控和限制
- 并发操作控制

### 2. 缓存策略
- 查询结果缓存
- 分析结果缓存
- 自动过期清理

### 3. 错误处理
- 智能重试机制
- 超时控制
- 错误分类和处理

## 🚀 部署建议

### 开发环境
```typescript
// 使用默认配置
const graphDataService = new GraphDataService(
  graphDatabaseService,
  cacheService,
  batchOptimizer,
  performanceMonitor,
  loggerService,
  errorHandlerService,
  configService
);
```

### 生产环境
```typescript
// 使用优化配置
const optimizedBatchOptimizer = new BatchOptimizer({
  maxConcurrentOperations: 10,
  defaultBatchSize: 100,
  maxBatchSize: 1000,
  memoryThreshold: 85,
  processingTimeout: 600000,
  retryAttempts: 5,
  retryDelay: 2000
});
```

## 🔍 监控指标

### 关键性能指标
- 查询平均响应时间
- 缓存命中率
- 批处理成功率
- 内存使用率
- 错误率

### 业务指标
- 节点创建数量
- 关系创建数量
- 分析查询次数
- 事务提交成功率

## 📝 总结

新的图服务架构通过清晰的职责分离和模块化设计，实现了以下优势：

1. **可维护性**: 每个服务职责单一，易于理解和维护
2. **可扩展性**: 可以独立扩展各个服务组件
3. **可测试性**: 每个组件都可以进行单元测试和集成测试
4. **性能优化**: 专门的优化组件处理批处理、缓存和性能监控
5. **容错性**: 完善的错误处理和重试机制

这种架构为未来的功能扩展和性能优化提供了坚实的基础。