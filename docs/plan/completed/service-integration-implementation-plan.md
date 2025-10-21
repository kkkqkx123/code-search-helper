# 服务模块集成实施计划

## 概述

本文档提供了将 AsyncTaskQueue、ConflictResolver 和 DataConsistencyChecker 正确集成到系统中的详细实施步骤。

## 第一阶段：文件重定位

### 1.1 移动 AsyncTaskQueue
```bash
# 创建目标目录
mkdir -p src/infrastructure/batching

# 移动文件
mv src/service/async/AsyncTaskQueue.ts src/infrastructure/batching/

# 更新导入路径
# 在 src/core/registrars/DatabaseServiceRegistrar.ts 中
# 从: import { AsyncTaskQueue } from '../../service/async/AsyncTaskQueue';
# 到: import { AsyncTaskQueue } from '../../infrastructure/batching/AsyncTaskQueue';
```

### 1.2 移动 ConflictResolver
```bash
# 创建目标目录
mkdir -p src/infrastructure/transaction

# 移动文件
mv src/service/conflict/ConflictResolver.ts src/infrastructure/transaction/

# 更新导入路径
# 在 src/types.ts 中更新引用
```

### 1.3 移动 DataConsistencyChecker
```bash
# 移动文件
mv src/service/consistency/DataConsistencyChecker.ts src/database/common/

# 更新导入路径
# 在 src/types.ts 中更新引用
```

## 第二阶段：服务注册实现

### 2.1 更新 InfrastructureServiceRegistrar.ts

```typescript
// 添加导入
import { AsyncTaskQueue } from '../../infrastructure/batching/AsyncTaskQueue';
import { ConflictResolver } from '../../infrastructure/transaction/ConflictResolver';

// 在 register 方法中添加注册逻辑
export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    // ... 现有代码 ...
    
    // 注册 AsyncTaskQueue
    console.log('Binding AsyncTaskQueue...');
    container.bind<AsyncTaskQueue>(TYPES.AsyncTaskQueue)
      .toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const configService = context.get<ConfigService>(TYPES.ConfigService);
        
        // 从配置获取参数
        const config = configService.getBatchProcessingConfig();
        return new AsyncTaskQueue(
          logger,
          {
            maxConcurrency: config.maxConcurrency || 5,
            maxRetries: config.maxRetries || 3,
            defaultTimeout: config.defaultTimeout || 30000,
            enableAutoRetry: config.enableAutoRetry || true
          }
        );
      }).inSingletonScope();
    
    // 注册 ConflictResolver
    console.log('Binding ConflictResolver...');
    container.bind<ConflictResolver>(TYPES.ConflictResolver)
      .toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const transactionCoordinator = context.get<TransactionCoordinator>(TYPES.TransactionCoordinator);
        
        return new ConflictResolver(
          logger,
          {
            defaultStrategy: 'latest_wins',
            maxRetries: 3,
            timeout: 30000,
            enableAutoRetry: true
          },
          transactionCoordinator
        );
      }).inSingletonScope();
  }
}
```

### 2.2 更新 DatabaseServiceRegistrar.ts

```typescript
// 添加导入
import { DataConsistencyChecker } from '../../database/common/DataConsistencyChecker';

// 在 register 方法中添加注册逻辑
export class DatabaseServiceRegistrar {
  static register(container: Container): void {
    // ... 现有代码 ...
    
    // 注册 DataConsistencyChecker
    console.log('Binding DataConsistencyChecker...');
    container.bind<DataConsistencyChecker>(TYPES.DataConsistencyChecker)
      .toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const databaseHealthChecker = context.get<DatabaseHealthChecker>(TYPES.HealthChecker);
        const sqliteService = context.get<SqliteDatabaseService>(TYPES.SqliteDatabaseService);
        
        return new DataConsistencyChecker(
          logger,
          databaseHealthChecker,
          sqliteService
        );
      }).inSingletonScope();
  }
}
```

## 第三阶段：服务集成实现

### 3.1 在 PerformanceOptimizerService 中集成 AsyncTaskQueue

```typescript
// 更新 src/infrastructure/batching/PerformanceOptimizerService.ts
import { AsyncTaskQueue } from '../batching/AsyncTaskQueue';

export class PerformanceOptimizerService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.MemoryMonitorService) private memoryMonitor: MemoryMonitorService,
    @inject(TYPES.AsyncTaskQueue) private taskQueue: AsyncTaskQueue
  ) {}

  async optimizeBatchProcessing(batchData: BatchData[]): Promise<OptimizationResult> {
    // 使用任务队列异步处理
    const tasks = batchData.map(data => ({
      id: `batch-optimize-${data.id}`,
      priority: 'high',
      timeout: 60000,
      execute: async () => {
        return await this.processBatchOptimization(data);
      }
    }));

    const results = await this.taskQueue.processBatch(tasks);
    return this.aggregateResults(results);
  }

  private async processBatchOptimization(data: BatchData): Promise<BatchResult> {
    try {
      // 实际的批处理优化逻辑
      const optimized = await this.performOptimization(data);
      return { success: true, data: optimized };
    } catch (error) {
      this.logger.error('Batch optimization failed', { error, dataId: data.id });
      return { success: false, error: error.message };
    }
  }
}
```

### 3.2 在 TransactionCoordinator 中集成 ConflictResolver

```typescript
// 更新 src/infrastructure/transaction/TransactionCoordinator.ts
import { ConflictResolver } from './ConflictResolver';

export class TransactionCoordinator {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.DatabaseConnectionPool) private connectionPool: DatabaseConnectionPool,
    @inject(TYPES.ConflictResolver) private conflictResolver: ConflictResolver
  ) {}

  async executeTransaction<T>(
    operation: () => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.isConflictError(error)) {
        // 处理冲突
        const conflict = this.extractConflictInfo(error);
        const resolution = await this.conflictResolver.resolve(conflict, {
          strategy: options?.conflictStrategy || 'latest_wins',
          maxRetries: options?.maxRetries || 3,
          timeout: options?.timeout || 30000
        });

        if (resolution.success) {
          this.logger.info('Conflict resolved successfully', { 
            conflictId: conflict.id,
            strategy: resolution.strategy 
          });
          return resolution.resolvedData as T;
        } else {
          throw new Error(`Conflict resolution failed: ${resolution.errors.join(', ')}`);
        }
      }
      throw error;
    }
  }

  private isConflictError(error: any): boolean {
    return error.code === 'CONFLICT' || 
           error.message.includes('conflict') ||
           error.message.includes('duplicate');
  }

  private extractConflictInfo(error: any): Conflict {
    return {
      id: `conflict-${Date.now()}`,
      type: 'data_conflict',
      entities: this.extractEntities(error),
      timestamp: Date.now(),
      details: error.message
    };
  }
}
```

### 3.3 在 DatabaseHealthChecker 中集成 DataConsistencyChecker

```typescript
// 更新 src/infrastructure/monitoring/DatabaseHealthChecker.ts
import { DataConsistencyChecker } from '../../database/common/DataConsistencyChecker';

export class DatabaseHealthChecker {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.DataConsistencyChecker) private consistencyChecker: DataConsistencyChecker
  ) {}

  async performHealthCheck(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkConnectionHealth(),
      this.checkMemoryUsage(),
      this.checkDataConsistency()
    ]);

    const failedChecks = checks.filter(check => !check.healthy);
    
    return {
      status: failedChecks.length === 0 ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      checks: checks,
      summary: {
        total: checks.length,
        passed: checks.filter(c => c.healthy).length,
        failed: failedChecks.length
      }
    };
  }

  private async checkDataConsistency(): Promise<HealthCheck> {
    try {
      const result = await this.consistencyChecker.checkConsistency(
        this.getCurrentProjectPath(),
        {
          checkMissingReferences: true,
          checkDataIntegrity: true,
          checkReferenceIntegrity: true,
          batchSize: 1000,
          maxResults: 100
        }
      );

      return {
        name: 'data_consistency',
        healthy: result.isConsistent,
        message: result.isConsistent ? 
          'Data consistency check passed' : 
          `Found ${result.inconsistencies.length} inconsistencies`,
        details: result.summary
      };
    } catch (error) {
      this.logger.error('Data consistency check failed', { error });
      return {
        name: 'data_consistency',
        healthy: false,
        message: `Consistency check error: ${error.message}`,
        error: error.message
      };
    }
  }
}
```

## 第四阶段：配置管理

### 4.1 更新配置服务

```typescript
// 在 src/config/ConfigService.ts 中添加
export interface BatchProcessingConfig {
  maxConcurrency: number;
  maxRetries: number;
  defaultTimeout: number;
  enableAutoRetry: boolean;
  queueSizeLimit: number;
}

export interface ConflictResolutionConfig {
  defaultStrategy: 'latest_wins' | 'merge' | 'custom';
  maxRetries: number;
  timeout: number;
  enableAutoRetry: boolean;
}

export interface DataConsistencyConfig {
  checkInterval: number;
  batchSize: number;
  maxResults: number;
  enabled: boolean;
}

// 在 ConfigService 类中添加方法
public getBatchProcessingConfig(): BatchProcessingConfig {
  return {
    maxConcurrency: this.get('batch.maxConcurrency', 5),
    maxRetries: this.get('batch.maxRetries', 3),
    defaultTimeout: this.get('batch.defaultTimeout', 30000),
    enableAutoRetry: this.get('batch.enableAutoRetry', true),
    queueSizeLimit: this.get('batch.queueSizeLimit', 1000)
  };
}

public getConflictResolutionConfig(): ConflictResolutionConfig {
  return {
    defaultStrategy: this.get('conflict.defaultStrategy', 'latest_wins'),
    maxRetries: this.get('conflict.maxRetries', 3),
    timeout: this.get('conflict.timeout', 30000),
    enableAutoRetry: this.get('conflict.enableAutoRetry', true)
  };
}

public getDataConsistencyConfig(): DataConsistencyConfig {
  return {
    checkInterval: this.get('consistency.checkInterval', 300000), // 5 minutes
    batchSize: this.get('consistency.batchSize', 1000),
    maxResults: this.get('consistency.maxResults', 100),
    enabled: this.get('consistency.enabled', true)
  };
}
```

## 第五阶段：测试验证

### 5.1 创建集成测试

```typescript
// 创建 src/__tests__/integration/ServiceIntegration.test.ts
import { Container } from 'inversify';
import { TYPES } from '../../types';
import { AsyncTaskQueue } from '../../infrastructure/batching/AsyncTaskQueue';
import { ConflictResolver } from '../../infrastructure/transaction/ConflictResolver';
import { DataConsistencyChecker } from '../../database/common/DataConsistencyChecker';

describe('Service Integration Tests', () => {
  let container: Container;
  let taskQueue: AsyncTaskQueue;
  let conflictResolver: ConflictResolver;
  let consistencyChecker: DataConsistencyChecker;

  beforeEach(() => {
    container = new Container();
    // 注册所有服务
    InfrastructureServiceRegistrar.register(container);
    DatabaseServiceRegistrar.register(container);
    
    taskQueue = container.get<AsyncTaskQueue>(TYPES.AsyncTaskQueue);
    conflictResolver = container.get<ConflictResolver>(TYPES.ConflictResolver);
    consistencyChecker = container.get<DataConsistencyChecker>(TYPES.DataConsistencyChecker);
  });

  test('AsyncTaskQueue should process tasks concurrently', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `test-task-${i}`,
      priority: 'normal',
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: `task-${i}-completed` };
      }
    }));

    const results = await taskQueue.processBatch(tasks);
    expect(results.length).toBe(10);
    expect(results.every(r => r.success)).toBe(true);
  });

  test('ConflictResolver should resolve data conflicts', async () => {
    const conflict = {
      id: 'test-conflict',
      type: 'data_conflict',
      entities: ['entity1', 'entity2'],
      timestamp: Date.now()
    };

    const resolution = await conflictResolver.resolve(conflict, {
      strategy: 'latest_wins',
      maxRetries: 3
    });

    expect(resolution.success).toBe(true);
    expect(resolution.resolvedData).toBeDefined();
  });

  test('DataConsistencyChecker should detect inconsistencies', async () => {
    const result = await consistencyChecker.checkConsistency('/test/project', {
      checkMissingReferences: true,
      checkDataIntegrity: true
    });

    expect(result).toBeDefined();
    expect(result.isConsistent).toBe(true);
    expect(result.summary).toBeDefined();
  });
});
```

## 部署检查清单

### 代码移动
- [ ] AsyncTaskQueue 移动到 `src/infrastructure/batching/`
- [ ] ConflictResolver 移动到 `src/infrastructure/transaction/`
- [ ] DataConsistencyChecker 移动到 `src/database/common/`

### 服务注册
- [ ] 在 InfrastructureServiceRegistrar 注册 AsyncTaskQueue
- [ ] 在 InfrastructureServiceRegistrar 注册 ConflictResolver
- [ ] 在 DatabaseServiceRegistrar 注册 DataConsistencyChecker

### 集成实现
- [ ] PerformanceOptimizerService 集成 AsyncTaskQueue
- [ ] TransactionCoordinator 集成 ConflictResolver
- [ ] DatabaseHealthChecker 集成 DataConsistencyChecker

### 配置管理
- [ ] 添加批处理配置
- [ ] 添加冲突解决配置
- [ ] 添加数据一致性配置

### 测试验证
- [ ] 创建集成测试
- [ ] 验证服务注册
- [ ] 测试功能集成

### 文档更新
- [ ] 更新架构文档
- [ ] 更新配置文档
- [ ] 更新部署文档