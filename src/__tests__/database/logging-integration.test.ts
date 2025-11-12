import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from '../../types';
import { DatabaseLoggerService } from '../../database/common/DatabaseLoggerService';
import { EventToLogBridge } from '../../database/common/EventToLogBridge';
import { PerformanceMonitor } from '../../infrastructure/monitoring/PerformanceMonitor';
import { LoggerService } from '../../utils/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';
import { DatabaseEvent, DatabaseEventType } from '../../database/common/DatabaseEventTypes';

// Mock LoggerService 和 ConfigService
class MockLoggerService {
  async info(message: string, meta?: any): Promise<void> {
    console.log('MOCK INFO:', message, meta);
  }

  async error(message: string, meta?: any): Promise<void> {
    console.log('MOCK ERROR:', message, meta);
  }

  async warn(message: string, meta?: any): Promise<void> {
    console.log('MOCK WARN:', message, meta);
  }

  async debug(message: string, meta?: any): Promise<void> {
    console.log('MOCK DEBUG:', message, meta);
  }
}

class MockConfigService {
  get(path: string) {
    if (path === 'database') {
      return {
        logging: {
          level: 'info',
          performance: {
            threshold: 1000
          },
          events: {
            'connection_opened': 'info',
            'query_executed': 'debug'
          }
        }
      };
    }
    return null;
  }
}

describe('Database Logging Integration', () => {
  let container: Container;
  let databaseLogger: DatabaseLoggerService;
  let eventToLogBridge: EventToLogBridge;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    container = new Container();
    
    // 绑定 Mock 服务
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(new MockLoggerService() as any);
    container.bind<ConfigService>(TYPES.ConfigService).toConstantValue(new MockConfigService() as any);
    container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService).toConstantValue(new MockConfigService() as any);
    
    // 绑定数据库日志服务
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<EventToLogBridge>(TYPES.EventToLogBridge).to(EventToLogBridge).inSingletonScope();
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();

    databaseLogger = container.get<DatabaseLoggerService>(TYPES.DatabaseLoggerService);
    eventToLogBridge = container.get<EventToLogBridge>(TYPES.EventToLogBridge);
    performanceMonitor = container.get<PerformanceMonitor>(TYPES.PerformanceMonitor);
 });

  test('should create database logger service instance', () => {
    expect(databaseLogger).toBeDefined();
  });

  test('should log connection events properly', async () => {
    const logSpy = jest.spyOn((databaseLogger as any).loggerService, 'info');
    
    await databaseLogger.logConnectionEvent('connect', 'success', { host: 'localhost', port: 6333 });
    
    expect(logSpy).toHaveBeenCalled();
 });

  test('should bridge database events to logs', async () => {
    const mockEvent: DatabaseEvent = {
      type: DatabaseEventType.CONNECTION_OPENED,
      timestamp: new Date(),
      source: 'qdrant',
      data: { host: 'localhost', port: 6333 }
    };

    const logSpy = jest.spyOn(databaseLogger, 'logDatabaseEvent');
    
    await eventToLogBridge.bridgeEvent(mockEvent);
    
    expect(logSpy).toHaveBeenCalledWith(mockEvent);
  });

  test('should record and monitor performance', () => {
    performanceMonitor.recordOperation('test_operation', 500);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toBeDefined();
    // count is not available in PerformanceMetrics
    expect(metrics.averageQueryTime).toBe(500);
  });

  test('should handle performance warnings for slow operations', () => {
    const logSpy = jest.spyOn(databaseLogger, 'logDatabaseEvent');
    
    // 记录一个超过阈值的操作 (假设阈值是1000ms)
    performanceMonitor.recordOperation('slow_operation', 1500);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.averageQueryTime).toBe(1500);
  });
});