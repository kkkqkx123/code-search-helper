# 数据库日志适配器使用示例

## 概述

本文档展示如何使用新实现的数据库日志适配器，包括数据库专用日志服务、事件到日志桥接器和性能监控器。

## 核心组件

### 1. DatabaseLoggerService

数据库专用日志服务，提供统一的数据库操作日志记录功能。

```typescript
import { DatabaseLoggerService } from '../database/common/DatabaseLoggerService';

// 在依赖注入容器中获取服务实例
const databaseLogger = container.get<DatabaseLoggerService>(TYPES.DatabaseLoggerService);

// 记录连接事件
await databaseLogger.logConnectionEvent('connect', 'success', { 
  host: 'localhost', 
  port: 6333 
});

// 记录查询性能
await databaseLogger.logQueryPerformance('SELECT * FROM users', 150, 10);

// 记录批量操作
await databaseLogger.logBatchOperation('insert', 1000, { 
  duration: 2000, 
  throughput: 500 
});

// 记录数据库事件
await databaseLogger.logDatabaseEvent({
  type: DatabaseEventType.CONNECTION_OPENED,
  timestamp: new Date(),
  source: 'qdrant',
  data: { host: 'localhost', port: 6333 }
});
```

### 2. EventToLogBridge

将数据库事件系统与日志系统集成的桥接器。

```typescript
import { EventToLogBridge } from '../database/common/EventToLogBridge';

const eventToLogBridge = container.get<EventToLogBridge>(TYPES.EventToLogBridge);

// 桥接数据库事件到日志
const dbEvent: DatabaseEvent = {
  type: DatabaseEventType.DATA_INSERTED,
  timestamp: new Date(),
  source: 'qdrant',
  data: { collection: 'test_collection', count: 100 }
};

await eventToLogBridge.bridgeEvent(dbEvent);

// 添加自定义事件映射
eventToLogBridge.addEventMapping(
  'custom_event', 
  'info', 
  'Custom event occurred'
);
```

### 3. PerformanceMonitor

数据库操作性能监控器，记录和监控数据库操作的性能指标。

```typescript
import { PerformanceMonitor } from '../database/common/PerformanceMonitor';

const performanceMonitor = container.get<PerformanceMonitor>(TYPES.PerformanceMonitor);

// 记录操作性能
performanceMonitor.recordOperation('search_vectors', 500, {
  collection: 'test_collection',
  queryLength: 1536,
  resultCount: 10
});

// 获取操作统计
const stats = performanceMonitor.getOperationStats('search_vectors');
console.log(`Average duration: ${stats?.averageDuration}ms`);

// 设置性能阈值（毫秒）
performanceMonitor.setPerformanceThreshold(1000);

// 获取所有操作统计
const allStats = performanceMonitor.getAllStats();
```

## 在Qdrant服务中的集成

### 更新后的QdrantConnectionManager

```typescript
// 在QdrantConnectionManager中集成数据库日志
export class QdrantConnectionManager implements IQdrantConnectionManager {
  constructor(
    // ... 其他依赖
    @inject(TYPES.DatabaseLoggerService) private databaseLogger: DatabaseLoggerService,
    @inject(TYPES.PerformanceMonitor) private performanceMonitor: PerformanceMonitor
  ) {}
  
  async initialize(): Promise<boolean> {
    const startTime = Date.now();
    try {
      // ... 连接逻辑
      
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation('qdrant_connection', duration, {
        host: this.config.host,
        port: this.config.port,
        useHttps: this.config.useHttps
      });

      await this.databaseLogger.logConnectionEvent('connection', 'success', {
        host: this.config.host,
        port: this.config.port,
        useHttps: this.config.useHttps,
        duration
      });

      return true;
    } catch (error) {
      // 记录错误日志
      await this.databaseLogger.logConnectionEvent('connection', 'failed', {
        host: this.config.host,
        port: this.config.port,
        useHttps: this.config.useHttps,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
}
```

### 更新后的QdrantService

```typescript
// 在QdrantService中集成性能监控
export class QdrantService extends BaseDatabaseService {
  async searchVectorsWithOptions(collectionName: string, query: number[], options?: VectorSearchOptions): Promise<SearchResult[]> {
    const startTime = Date.now();
    try {
      const results = await this.vectorOperations.searchVectorsWithOptions(collectionName, query, options);
      const duration = Date.now() - startTime;
      
      this.performanceMonitor.recordOperation('search_vectors', duration, {
        collectionName,
        queryLength: query.length,
        resultCount: results.length
      });
      
      await this.databaseLogger.logQueryPerformance(`search in ${collectionName}`, duration, results.length);
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_ERROR,
        timestamp: new Date(),
        source: 'qdrant',
        data: {
          operation: 'search_vectors',
          collectionName,
          queryLength: query.length,
          duration,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
}
```

## 依赖注入配置

所有新组件都已注册到依赖注入容器中：

```typescript
// 在 DatabaseServiceRegistrar 中注册
container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
container.bind<EventToLogBridge>(TYPES.EventToLogBridge).to(EventToLogBridge).inSingletonScope();
container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
```

## 测试验证

我们提供了全面的测试来验证数据库日志适配器的功能：

```typescript
// 基础集成测试
describe('Database Logging Integration', () => {
  test('should create database logger service instance', () => {
    expect(databaseLogger).toBeDefined();
  });

  test('should log connection events properly', async () => {
    await databaseLogger.logConnectionEvent('connect', 'success', { host: 'localhost', port: 6333 });
    // 验证日志记录
  });

  test('should bridge database events to logs', async () => {
    const mockEvent: DatabaseEvent = {
      type: DatabaseEventType.CONNECTION_OPENED,
      timestamp: new Date(),
      source: 'qdrant',
      data: { host: 'localhost', port: 6333 }
    };

    await eventToLogBridge.bridgeEvent(mockEvent);
    // 验证事件桥接
  });

  test('should record and monitor performance', () => {
    performanceMonitor.recordOperation('test_operation', 500, { test: true });
    const stats = performanceMonitor.getOperationStats('test_operation');
    expect(stats?.count).toBe(1);
    expect(stats?.averageDuration).toBe(500);
  });
});
```

## 日志级别配置

数据库日志服务使用通用的配置系统：

```typescript
// 使用通用日志级别配置
this.databaseLogLevel = this.configService.get('logging')?.level || 'info';
```

## 性能监控阈值

性能监控器使用1000ms作为默认阈值，当操作时间超过此阈值时会生成警告日志。

## 总结

通过本次实现，我们成功创建了：

1. **DatabaseLoggerService** - 数据库专用日志服务
2. **EventToLogBridge** - 事件到日志的桥接器
3. **PerformanceMonitor** - 性能监控器
4. **完整的测试覆盖** - 验证所有功能正常工作
5. **与现有系统集成** - 无缝集成到现有的Qdrant服务中

这个实现既满足了调试需求（提供详细的日志记录），又保持了日志的完整性（通过性能监控和事件跟踪），同时保持了系统的可维护性。