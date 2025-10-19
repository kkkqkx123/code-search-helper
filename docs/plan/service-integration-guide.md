# 服务模块集成指南

## 概述

本文档详细说明了剩余服务模块的正确集成方案，包括架构层次定位、注册策略和使用建议。

## 当前状态分析

### 已处理模块
- ✅ **DataMappingValidator**: 已移动到 `src/service/graph/mapping/` 并注册在 DatabaseServiceRegistrar
- ✅ **PerformanceBenchmark**: 已删除

### 待处理模块
- **AsyncTaskQueue**: 已注册但未使用
- **ConflictResolver**: 未注册，未使用
- **DataConsistencyChecker**: 未注册，未使用

## 架构层次定位

### 1. AsyncTaskQueue - 基础设施层 (`src/infrastructure/batching/`)
**定位理由**:
- 提供通用的异步任务处理能力
- 与批处理优化器、性能监控等基础设施服务协同工作
- 支持系统级的并发控制和任务调度

**移动路径**: `src/service/async/AsyncTaskQueue.ts` → `src/infrastructure/batching/AsyncTaskQueue.ts`

### 2. ConflictResolver - 基础设施层 (`src/infrastructure/transaction/`)
**定位理由**:
- 处理数据冲突解决，属于事务管理范畴
- 与事务协调器、数据库连接池等基础设施服务配合
- 提供系统级的数据一致性保障

**移动路径**: `src/service/conflict/ConflictResolver.ts` → `src/infrastructure/transaction/ConflictResolver.ts`

### 3. DataConsistencyChecker - 数据库服务层 (`src/database/common/`)
**定位理由**:
- 专注于数据库数据一致性检查
- 与数据库迁移、健康检查等数据库服务协同
- 提供数据完整性验证功能

**移动路径**: `src/service/consistency/DataConsistencyChecker.ts` → `src/database/common/DataConsistencyChecker.ts`

## 注册策略

### 1. AsyncTaskQueue 注册
```typescript
// 在 InfrastructureServiceRegistrar.ts 中注册
container.bind<AsyncTaskQueue>(TYPES.AsyncTaskQueue)
  .toDynamicValue(context => {
    const logger = context.get<LoggerService>(TYPES.LoggerService);
    const configService = context.get<ConfigService>(TYPES.ConfigService);
    return new AsyncTaskQueue(logger, configService);
  }).inSingletonScope();
```

### 2. ConflictResolver 注册
```typescript
// 在 InfrastructureServiceRegistrar.ts 中注册
container.bind<ConflictResolver>(TYPES.ConflictResolver)
  .toDynamicValue(context => {
    const logger = context.get<LoggerService>(TYPES.LoggerService);
    const transactionCoordinator = context.get<TransactionCoordinator>(TYPES.TransactionCoordinator);
    return new ConflictResolver(logger, transactionCoordinator);
  }).inSingletonScope();
```

### 3. DataConsistencyChecker 注册
```typescript
// 在 DatabaseServiceRegistrar.ts 中注册
container.bind<DataConsistencyChecker>(TYPES.DataConsistencyChecker)
  .toDynamicValue(context => {
    const logger = context.get<LoggerService>(TYPES.LoggerService);
    const databaseHealthChecker = context.get<DatabaseHealthChecker>(TYPES.HealthChecker);
    return new DataConsistencyChecker(logger, databaseHealthChecker);
  }).inSingletonScope();
```

## 使用场景和集成点

### AsyncTaskQueue 使用场景

#### 1. 批处理优化器集成
```typescript
// 在 PerformanceOptimizerService 中使用
@inject(TYPES.AsyncTaskQueue) private taskQueue: AsyncTaskQueue

// 用于异步处理批量索引任务
await this.taskQueue.addTask({
  id: `batch-index-${projectId}`,
  priority: 'high',
  execute: async () => {
    return await this.processBatchIndexing(batchData);
  }
});
```

#### 2. 文件处理集成
```typescript
// 在 FileProcessingCoordinator 中使用
@inject(TYPES.AsyncTaskQueue) private taskQueue: AsyncTaskQueue

// 用于异步处理大文件
await this.taskQueue.addTask({
  id: `file-process-${fileId}`,
  priority: 'normal',
  timeout: 30000,
  execute: async () => {
    return await this.processLargeFile(filePath);
  }
});
```

### ConflictResolver 使用场景

#### 1. 事务管理集成
```typescript
// 在 TransactionCoordinator 中使用
@inject(TYPES.ConflictResolver) private conflictResolver: ConflictResolver

// 处理事务冲突
const resolution = await this.conflictResolver.resolve({
  type: 'data_conflict',
  entities: conflictingEntities,
  timestamp: Date.now()
}, {
  strategy: 'latest_wins',
  maxRetries: 3
});
```

#### 2. 数据库操作集成
```typescript
// 在 NebulaTransactionService 中使用
@inject(TYPES.ConflictResolver) private conflictResolver: ConflictResolver

// 处理并发写入冲突
if (error.code === 'CONFLICT') {
  const resolution = await this.conflictResolver.resolve(conflict);
  if (resolution.success) {
    return resolution.resolvedData;
  }
}
```

### DataConsistencyChecker 使用场景

#### 1. 健康检查集成
```typescript
// 在 DatabaseHealthChecker 中使用
@inject(TYPES.DataConsistencyChecker) private consistencyChecker: DataConsistencyChecker

// 定期检查数据一致性
public async performHealthCheck(): Promise<HealthStatus> {
  const consistencyResult = await this.consistencyChecker.checkConsistency(
    this.projectPath,
    {
      checkMissingReferences: true,
      checkDataIntegrity: true,
      checkReferenceIntegrity: true
    }
  );
  
  return {
    status: consistencyResult.isConsistent ? 'healthy' : 'unhealthy',
    details: consistencyResult.summary
  };
}
```

#### 2. 迁移过程集成
```typescript
// 在 MigrationOrchestrator 中使用
@inject(TYPES.DataConsistencyChecker) private consistencyChecker: DataConsistencyChecker

// 迁移后执行一致性检查
private async postMigrationValidation(): Promise<void> {
  const result = await this.consistencyChecker.checkConsistency(
    this.targetProjectPath
  );
  
  if (!result.isConsistent) {
    throw new Error(`Migration validation failed: ${result.inconsistencies.length} inconsistencies found`);
  }
}
```

## 依赖关系图

```
Infrastructure Layer:
├── AsyncTaskQueue (批处理任务调度)
├── ConflictResolver (事务冲突解决)
└── TransactionCoordinator (事务协调)

Database Layer:
├── DataConsistencyChecker (数据一致性检查)
├── DatabaseHealthChecker (数据库健康检查)
└── MigrationOrchestrator (迁移编排)

Service Layer:
├── PerformanceOptimizerService (性能优化)
├── FileProcessingCoordinator (文件处理协调)
└── NebulaTransactionService (图数据库事务)
```

## 实施步骤

### 第一阶段：文件重定位 (优先级：高)
1. 移动 AsyncTaskQueue 到 `src/infrastructure/batching/`
2. 移动 ConflictResolver 到 `src/infrastructure/transaction/`
3. 移动 DataConsistencyChecker 到 `src/database/common/`

### 第二阶段：服务注册 (优先级：高)
1. 在 InfrastructureServiceRegistrar 注册 AsyncTaskQueue 和 ConflictResolver
2. 在 DatabaseServiceRegistrar 注册 DataConsistencyChecker
3. 更新相应的导入路径

### 第三阶段：集成使用 (优先级：中)
1. 在 PerformanceOptimizerService 中集成 AsyncTaskQueue
2. 在 TransactionCoordinator 中集成 ConflictResolver
3. 在 DatabaseHealthChecker 中集成 DataConsistencyChecker

### 第四阶段：测试验证 (优先级：高)
1. 编写集成测试验证服务间协作
2. 测试错误处理和回退机制
3. 验证性能改进效果

## 注意事项

1. **循环依赖**: 确保服务间依赖关系清晰，避免循环依赖
2. **错误处理**: 每个服务都需要完善的错误处理机制
3. **性能监控**: 集成后需要监控服务性能影响
4. **配置管理**: 确保服务配置参数可配置化
5. **日志记录**: 完善的服务操作日志记录

## 预期收益

1. **系统稳定性**: 通过冲突解决和一致性检查提升数据可靠性
2. **性能优化**: 异步任务队列提升系统并发处理能力
3. **可维护性**: 清晰的服务分层和职责划分
4. **可扩展性**: 模块化设计便于后续功能扩展