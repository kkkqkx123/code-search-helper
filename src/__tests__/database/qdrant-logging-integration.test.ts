import 'reflect-metadata';
import { DatabaseLoggerService } from '../../database/common/DatabaseLoggerService';
import { PerformanceMonitor } from '../../database/common/PerformanceMonitor';
import { EventToLogBridge } from '../../database/common/EventToLogBridge';
import { DatabaseEvent, DatabaseEventType } from '../../database/common/DatabaseEventTypes';

// Mock 服务
class MockLoggerService {
  logs: { level: string; message: string; meta: any }[] = [];

  async info(message: string, meta?: any): Promise<void> {
    this.logs.push({ level: 'info', message, meta });
  }

  async error(message: string, meta?: any): Promise<void> {
    this.logs.push({ level: 'error', message, meta });
  }

  async warn(message: string, meta?: any): Promise<void> {
    this.logs.push({ level: 'warn', message, meta });
  }

  async debug(message: string, meta?: any): Promise<void> {
    this.logs.push({ level: 'debug', message, meta });
  }
}

class MockConfigService {
  get(path: string) {
    if (path === 'logging') {
      return { level: 'info', format: 'json' };
    }
    return null;
  }
}

describe('Qdrant Logging Integration', () => {
  let mockLoggerService: MockLoggerService;
  let mockConfigService: MockConfigService;
  let databaseLogger: DatabaseLoggerService;
  let performanceMonitor: PerformanceMonitor;
  let eventToLogBridge: EventToLogBridge;

  beforeEach(() => {
    mockLoggerService = new MockLoggerService();
    mockConfigService = new MockConfigService();

    // 创建服务实例
    databaseLogger = new DatabaseLoggerService(mockLoggerService as any, mockConfigService as any);
    performanceMonitor = new PerformanceMonitor(databaseLogger);
    eventToLogBridge = new EventToLogBridge(databaseLogger);
  });

  test('should log Qdrant connection events', async () => {
    await databaseLogger.logConnectionEvent('connect', 'success', { 
      host: 'localhost', 
      port: 6333,
      useHttps: false 
    });

    expect(mockLoggerService.logs).toHaveLength(1);
    expect(mockLoggerService.logs[0].level).toBe('info');
    expect(mockLoggerService.logs[0].message).toBe('Database connect success');
  });

  test('should monitor and log Qdrant query performance', () => {
    // 记录一个正常的查询
    performanceMonitor.recordOperation('search_vectors', 200, { 
      collection: 'test_collection',
      resultCount: 10 
    });

    const stats = performanceMonitor.getOperationStats('search_vectors');
    expect(stats).toBeDefined();
    expect(stats?.averageDuration).toBe(200);
    expect(stats?.count).toBe(1);
  });

  test('should log performance warnings for slow Qdrant operations', () => {
    const initialLogCount = mockLoggerService.logs.length;
    
    // 记录一个超过阈值的操作
    performanceMonitor.recordOperation('upsert_vectors', 1500, { 
      collection: 'test_collection',
      vectorCount: 100 
    });

    // 检查是否生成了性能警告日志
    expect(mockLoggerService.logs.length).toBeGreaterThan(initialLogCount);
  });

  test('should bridge Qdrant events to logs', async () => {
    const mockQdrantEvent: DatabaseEvent = {
      type: DatabaseEventType.CONNECTION_OPENED,
      timestamp: new Date(),
      source: 'qdrant',
      data: { 
        host: 'localhost',
        port: 6333,
        status: 'connected'
      }
    };

    await eventToLogBridge.bridgeEvent(mockQdrantEvent);

    expect(mockLoggerService.logs).toHaveLength(1);
    expect(mockLoggerService.logs[0].message).toBe('Database event: connection_opened');
  });

  test('should handle Qdrant error events properly', async () => {
    const mockErrorEvent: DatabaseEvent = {
      type: DatabaseEventType.DATA_ERROR,
      timestamp: new Date(),
      source: 'qdrant',
      data: { 
        operation: 'search',
        collection: 'test_collection'
      },
      error: new Error('Connection timeout')
    };

    await eventToLogBridge.bridgeEvent(mockErrorEvent);

    expect(mockLoggerService.logs).toHaveLength(1);
    expect(mockLoggerService.logs[0].level).toBe('error');
    expect(mockLoggerService.logs[0].message).toBe('Database event: data_error');
  });
});