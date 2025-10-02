# 数据库日志服务集成使用示例

本文档展示了如何在项目中使用新的数据库日志服务，包括事件系统、性能监控和日志记录功能。

## 1. 基本概念

数据库日志服务集成包括以下几个核心组件：
- **DatabaseLoggerService**: 专门的数据库日志服务
- **EventToLogBridge**: 事件到日志的桥接器
- **PerformanceMonitor**: 性能监控器
- **DatabaseEventType**: 统一的事件类型定义

## 2. 依赖注入配置

在使用数据库日志服务之前，需要通过依赖注入容器获取服务实例：

```typescript
import { Container } from 'inversify';
import { TYPES } from '../types';
import { DatabaseLoggerService } from '../database/common/DatabaseLoggerService';
import { PerformanceMonitor } from '../database/common/PerformanceMonitor';
import { EventToLogBridge } from '../database/common/EventToLogBridge';

// 从容器获取服务
const databaseLogger = container.get<DatabaseLoggerService>(TYPES.DatabaseLoggerService);
const performanceMonitor = container.get<PerformanceMonitor>(TYPES.PerformanceMonitor);
const eventToLogBridge = container.get<EventToLogBridge>(TYPES.EventToLogBridge);
```

## 3. 记录数据库连接事件

```typescript
// 记录连接事件
await databaseLogger.logConnectionEvent('connect', 'success', {
  host: 'localhost',
  port: 6333,
 duration: 10
});

// 记录失败的连接事件
await databaseLogger.logConnectionEvent('connect', 'failed', {
  host: 'localhost',
  port: 633,
  error: 'Connection timeout'
});
```

## 4. 记录集合操作事件

```typescript
// 记录集合创建事件
await databaseLogger.logCollectionOperation('create', 'project-123', 'success', {
  collectionName: 'project-123',
  vectorSize: 1536,
  distance: 'Cosine',
  duration: 50
});

// 记录集合删除事件
await databaseLogger.logCollectionOperation('delete', 'project-123', 'success', {
  collectionName: 'project-123',
  duration: 25
});
```

## 5. 记录向量操作事件

```typescript
// 记录向量插入事件
await databaseLogger.logVectorOperation('upsert', 'project-123', 'success', {
  vectorCount: 100,
  duration: 200
});

// 记录向量删除事件
await databaseLogger.logVectorOperation('delete', 'project-123', 'success', {
  vectorCount: 10,
  duration: 50
});
```

## 6. 记录查询操作事件

```typescript
// 记录搜索查询事件
await databaseLogger.logQueryOperation('search', 'project-123', 'success', {
  queryLength: 1536,
  resultsCount: 10,
  duration: 150
});

// 记录按ID查询事件
await databaseLogger.logQueryOperation('getById', 'project-123', 'success', {
  id: 'vector-123',
  duration: 10,
  found: true
});
```

## 7. 记录项目操作事件

```typescript
// 记录项目信息查询事件
await databaseLogger.logProjectOperation('info', 'project-123', 'success', {
  duration: 5
});

// 记录项目列表查询事件
await databaseLogger.logProjectOperation('list', 'all', 'success', {
 projectCount: 5,
  duration: 20
});
```

## 8. 性能监控

```typescript
// 记录操作性能
performanceMonitor.recordOperation('search_vectors', 150, {
  projectPath: 'project-123',
  queryLength: 1536,
  resultsCount: 10
});

// 记录批量操作性能
performanceMonitor.recordOperation('upsert_vectors', 200, {
  projectPath: 'project-123',
  vectorCount: 100
});
```

## 9. 事件桥接

```typescript
// 将数据库事件桥接到日志系统
const mockEvent = {
  type: DatabaseEventType.CONNECTION_OPENED,
  timestamp: new Date(),
  source: 'qdrant',
  data: { 
    host: 'localhost', 
    port: 6333 
  }
};

await eventToLogBridge.bridgeEvent(mockEvent);
```

## 10. 在Qdrant服务中使用

在Qdrant相关服务中，现在可以使用注入的数据库日志服务：

```typescript
@injectable()
export class QdrantProjectManager {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.DatabaseLoggerService) private databaseLogger: DatabaseLoggerService,
    @inject(TYPES.PerformanceMonitor) private performanceMonitor: PerformanceMonitor,
    // ... 其他依赖
  ) {}

  async createCollectionForProject(projectPath: string, vectorSize: number) {
    const startTime = Date.now();
    
    try {
      // 执行业务逻辑
      const success = await this.collectionManager.createCollection(
        this.projectIdManager.getCollectionName(projectPath), 
        vectorSize
      );

      const duration = Date.now() - startTime;
      
      if (success) {
        // 记录性能指标
        this.performanceMonitor.recordOperation('createCollectionForProject', duration, {
          projectPath,
          vectorSize
        });
        
        // 记录操作日志
        await this.databaseLogger.logCollectionOperation('create', projectPath, 'success', {
          vectorSize,
          duration
        });
      } else {
        await this.databaseLogger.logCollectionOperation('create', projectPath, 'failed', {
          vectorSize,
          duration,
          error: 'Failed to create collection'
        });
      }
      
      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.databaseLogger.logCollectionOperation('create', projectPath, 'failed', {
        vectorSize,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
}
```

## 11. 事件类型映射

以下是常用的数据库事件类型及其对应的日志级别：

- `DatabaseEventType.CONNECTION_OPENED`: 信息级别日志
- `DatabaseEventType.CONNECTION_CLOSED`: 信息级别日志
- `DatabaseEventType.CONNECTION_FAILED`: 错误级别日志
- `DatabaseEventType.ERROR_OCCURRED`: 错误级别日志
- `DatabaseEventType.SERVICE_INITIALIZED`: 信息级别日志
- `DatabaseEventType.PERFORMANCE_METRIC`: 信息级别日志
- `DatabaseEventType.QUERY_EXECUTED`: 调试级别日志

## 12. 最佳实践

1. **始终记录操作性能**：在所有数据库操作完成后记录性能指标
2. **区分成功和失败操作**：使用不同的状态参数记录操作结果
3. **提供详细的操作信息**：在详细信息中包含所有相关的操作参数
4. **使用正确的事件类型**：确保使用正确的DatabaseEventType枚举值
5. **处理异常情况**：在catch块中记录失败操作的详细信息

通过这种方式，数据库日志服务提供了统一、结构化的日志记录机制，有助于调试和监控数据库操作。