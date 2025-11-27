# 批处理模块 (Batching Module)

## 模块概述

批处理模块负责处理大规模数据的批量操作，包括数据库操作、向量嵌入、相似度计算等。该模块采用模块化架构，分离了关注点，提高了可维护性和可扩展性。

## 文件结构

```
batching/
├── BatchProcessingService.ts          # 统一入口和核心服务
├── BatchConfigManager.ts              # 配置管理
├── BatchExecutionEngine.ts            # 执行引擎
├── PerformanceMetricsManager.ts       # 性能监控
├── HotReloadBatchProcessor.ts         # 热重载处理
├── ChangeGroupingService.ts           # 变更分组
├── VectorIndexBatchProcessor.ts       # 向量索引处理
├── GraphIndexBatchProcessor.ts        # 图索引处理
├── types.ts                           # 类型定义
├── strategies/                        # 批处理策略
│   ├── BatchStrategyFactory.ts
│   ├── SemanticBatchStrategy.ts
│   ├── QdrantBatchStrategy.ts
│   ├── NebulaBatchStrategy.ts
│   ├── GraphBatchStrategy.ts
│   └── EmbeddingBatchStrategy.ts
└── README.md                          # 本文件
```

## 核心模块说明

### 1. BatchProcessingService
**主要职责**:
- 提供统一的批处理接口
- 委托给各个专职模块处理
- 实现 `IBatchProcessingService` 接口

**使用示例**:
```typescript
// 通用批处理
const results = await batchProcessingService.processBatches(items, processor);

// 数据库批处理
const dbResults = await batchProcessingService.processDatabaseBatches(items, processor);

// 热重载变更处理
const hotReloadResult = await batchProcessingService.processHotReloadChanges(projectId, changes);
```

### 2. BatchConfigManager
**主要职责**:
- 管理批处理配置
- 提供配置的获取、更新、重置功能

**配置项包括**:
- 批处理大小 (defaultBatchSize, maxBatchSize)
- 并发级别 (maxConcurrentOperations)
- 重试策略 (retryAttempts, retryDelay)
- 内存阈值 (memoryThreshold)
- 监控配置

### 3. BatchExecutionEngine
**主要职责**:
- 执行带监控的操作
- 实现指数退避重试机制
- 创建和管理数据批次
- 并发处理批次

**关键特性**:
- 自动性能指标收集
- 指数退避重试策略
- 并发控制

### 4. PerformanceMetricsManager
**主要职责**:
- 收集和管理性能指标
- 计算统计信息（平均值、p95、p99等）
- 基于内存使用优化批处理大小
- 执行内存优化操作

**性能指标包括**:
- 操作持续时间
- 成功率
- 百分位数（p95, p99）

### 5. HotReloadBatchProcessor
**主要职责**:
- 协调热重载批处理
- 分组和分发变更给相应处理器
- 统计处理结果

**处理流程**:
1. 接收文件变更事件
2. 按索引类型分组（向量/图索引）
3. 并发处理不同类型的变更
4. 返回统计结果

### 6. ChangeGroupingService
**主要职责**:
- 分组文件变更
- 按变更类型分类
- 按文件扩展名过滤
- 按优先级排序

**支持的扩展名**:
- 向量索引: .ts, .js, .tsx, .jsx, .py, .java, .cpp, .c, .h, .hpp, .md, .txt
- 图索引: .ts, .js, .tsx, .jsx, .py, .java, .cpp, .c, .h, .hpp

### 7. VectorIndexBatchProcessor
**主要职责**:
- 处理向量索引相关的文件变更
- 批量更新向量索引

**配置**:
- 默认批处理大小: 20
- 默认并发级别: 3

### 8. GraphIndexBatchProcessor
**主要职责**:
- 处理图索引相关的文件变更
- 批量更新图索引

**配置**:
- 默认批处理大小: 15
- 默认并发级别: 2

## 类型定义

### 关键接口

```typescript
// 统一批处理服务接口
interface IBatchProcessingService {
  // 通用方法
  processBatches<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, options?: BatchProcessingOptions): Promise<R[]>;
  
  // 特殊领域方法
  processSimilarityBatch(...): Promise<BatchSimilarityResult>;
  processEmbeddingBatch(...): Promise<EmbeddingResult[]>;
  processDatabaseBatch(...): Promise<BatchResult>;
  
  // 执行和监控
  executeWithRetry<T>(...): Promise<T>;
  executeWithMonitoring<T>(...): Promise<T>;
  
  // 配置和统计
  updateConfig(...): void;
  getPerformanceStats(...): PerformanceStats;
  getCurrentBatchSize(...): number;
  optimizeMemory(): void;
}
```

### BatchContext
```typescript
interface BatchContext {
  domain: 'database' | 'similarity' | 'embedding';
  subType?: string;
  metadata?: Record<string, any>;
}
```

## 使用指南

### 基本用法

```typescript
import { BatchProcessingService } from './infrastructure/batching/BatchProcessingService';

// 注入服务
constructor(
  @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService
) {}

// 通用批处理
async processLargeDataset(items: any[]) {
  const results = await this.batchProcessor.processBatches(
    items,
    async (batch) => {
      // 处理批次
      return batch.map(item => processItem(item));
    },
    {
      batchSize: 100,
      maxConcurrency: 5,
      enableRetry: true,
      maxRetries: 3
    }
  );
  return results;
}
```

### 数据库批处理

```typescript
async processDatabaseOperations(operations: any[]) {
  const results = await this.batchProcessor.processDatabaseBatches(
    operations,
    async (batch) => {
      // 执行数据库操作
      return await database.batchInsert(batch);
    },
    {
      databaseType: DatabaseType.QDRANT,
      batchSize: 50,
      maxConcurrency: 3
    }
  );
  return results;
}
```

### 热重载处理

```typescript
async handleFileChanges(projectId: string, changes: FileChangeEvent[]) {
  const result = await this.batchProcessor.processHotReloadChanges(
    projectId,
    changes,
    {
      batchSize: 20,
      maxConcurrency: 5,
      priority: 'high'
    }
  );
  console.log(`处理完成: ${result.processedChanges} 成功, ${result.failedChanges} 失败`);
}
```

### 性能监控

```typescript
// 获取性能统计
const stats = this.batchProcessor.getPerformanceStats('database-batch-1');
console.log(`平均耗时: ${stats.averageDuration}ms`);
console.log(`成功率: ${stats.successRate * 100}%`);
console.log(`P95: ${stats.p95Duration}ms`);

// 获取当前批处理大小
const currentSize = this.batchProcessor.getCurrentBatchSize(context);

// 优化批处理大小
const optimizedSize = await this.batchProcessor.optimizeBatchSize(context);

// 优化内存
await this.batchProcessor.optimizeMemory();
```

## 依赖注入

模块使用 Inversify 进行依赖注入。在 `src/core/registrars/InfrastructureServiceRegistrar.ts` 中注册：

```typescript
// 基础服务
container.bind<BatchConfigManager>(TYPES.BatchConfigManager).to(BatchConfigManager).inSingletonScope();
container.bind<ChangeGroupingService>(TYPES.ChangeGroupingService).to(ChangeGroupingService).inSingletonScope();

// 高级服务
container.bind<BatchExecutionEngine>(TYPES.BatchExecutionEngine).to(BatchExecutionEngine).inSingletonScope();
container.bind<PerformanceMetricsManager>(TYPES.PerformanceMetricsManager).to(PerformanceMetricsManager).inSingletonScope();
container.bind<VectorIndexBatchProcessor>(TYPES.VectorIndexBatchProcessor).to(VectorIndexBatchProcessor).inSingletonScope();
container.bind<GraphIndexBatchProcessor>(TYPES.GraphIndexBatchProcessor).to(GraphIndexBatchProcessor).inSingletonScope();
container.bind<HotReloadBatchProcessor>(TYPES.HotReloadBatchProcessor).to(HotReloadBatchProcessor).inSingletonScope();
container.bind<BatchProcessingService>(TYPES.BatchProcessingService).toDynamicValue(...).inSingletonScope();
```

## 配置说明

### 默认配置

```typescript
{
  enabled: true,
  maxConcurrentOperations: 5,
  defaultBatchSize: 50,
  maxBatchSize: 500,
  maxConcurrency: 5,
  timeout: 30000,
  memoryThreshold: 0.80,
  processingTimeout: 300000,
  retryAttempts: 3,
  retryDelay: 1000,
  continueOnError: true,
  monitoring: {
    enabled: true,
    metricsInterval: 60000,
    alertThresholds: {
      highLatency: 5000,
      highMemoryUsage: 0.80,
      highErrorRate: 0.1,
    },
  },
}
```

### 更新配置

```typescript
batchProcessor.updateConfig({
  defaultBatchSize: 100,
  maxConcurrentOperations: 10,
  memoryThreshold: 0.90
});
```

## 性能考虑

### 批处理大小优化

- 系统会根据内存使用情况自动调整批处理大小
- 当内存使用超过阈值时，批处理大小会减少50%
- 最小批处理大小为10

### 并发控制

- 每个模块配置不同的并发级别
- 向量索引: 最多3个并发操作
- 图索引: 最多2个并发操作
- 一般操作: 最多5个并发操作

### 内存管理

- 自动清理过期的性能指标（保留最新5000条）
- 支持垃圾回收触发（如果可用）
- 监控内存使用，当超过阈值时触发优化

## 常见问题

### Q: 如何自定义批处理大小？
A: 在 `BatchProcessingOptions` 中指定 `batchSize` 参数，或通过 `updateConfig()` 方法全局配置。

### Q: 如何处理批处理失败？
A: 启用 `enableRetry` 选项进行自动重试，或处理返回的异常。

### Q: 如何监控性能？
A: 使用 `getPerformanceStats()` 方法获取性能统计信息。

### Q: 如何优化内存使用？
A: 调用 `optimizeMemory()` 方法，系统会自动清理过期数据和触发垃圾回收。

## 扩展指南

### 添加新的批处理器

1. 创建新的处理器类（继承或实现相关接口）
2. 在模块中注册处理器
3. 在 `BatchProcessingService` 中添加相应的处理方法
4. 在 DI 容器中注册新的处理器

### 添加新的批处理策略

1. 创建新的策略类（实现 `IBatchStrategy` 接口）
2. 在 `BatchStrategyFactory` 中注册策略
3. 在 `BatchContext` 中添加对应的 `subType`

## 相关文件

- 配置服务: `src/config/ConfigService.ts`
- 内存监控: `src/service/memory/`
- 文件系统: `src/service/filesystem/`
- 数据库服务: `src/database/`
- 嵌入器服务: `src/embedders/`

## 更新日期

- 创建时间: 2025-11-27
- 最后更新: 2025-11-27
