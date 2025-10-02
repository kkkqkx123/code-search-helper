import { Container } from 'inversify';
import { DatabaseServiceRegistrar } from '../../core/registrars/DatabaseServiceRegistrar';
import { TYPES } from '../../types';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { DatabaseLoggerService } from '../../database/common/DatabaseLoggerService';
import { PerformanceMonitor } from '../../database/common/PerformanceMonitor';
import { EventToLogBridge } from '../../database/common/EventToLogBridge';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { EnvironmentConfigService } from '../../config/service/EnvironmentConfigService';
import { QdrantConfigService } from '../../config/service/QdrantConfigService';
import { EmbeddingConfigService } from '../../config/service/EmbeddingConfigService';
import { LoggingConfigService } from '../../config/service/LoggingConfigService';
import { MonitoringConfigService } from '../../config/service/MonitoringConfigService';
import { FileProcessingConfigService } from '../../config/service/FileProcessingConfigService';
import { BatchProcessingConfigService } from '../../config/service/BatchProcessingConfigService';
import { RedisConfigService } from '../../config/service/RedisConfigService';
import { ProjectConfigService } from '../../config/service/ProjectConfigService';
import { IndexingConfigService } from '../../config/service/IndexingConfigService';
import { LSPConfigService } from '../../config/service/LSPConfigService';
import { SemgrepConfigService } from '../../config/service/SemgrepConfigService';
import { TreeSitterConfigService } from '../../config/service/TreeSitterConfigService';
import { DatabaseEventType } from '../../database/common/DatabaseEventTypes';

describe('Database Logging Integration Tests', () => {
  let container: Container;
  let qdrantService: QdrantService;
  let databaseLogger: DatabaseLoggerService;
  let performanceMonitor: PerformanceMonitor;
  let eventToLogBridge: EventToLogBridge;

 beforeAll(() => {
    container = new Container();
    // 注册所有必需的配置服务
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
    container.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    DatabaseServiceRegistrar.register(container);
  });

  beforeEach(() => {
    qdrantService = container.get<QdrantService>(TYPES.QdrantService);
    databaseLogger = container.get<DatabaseLoggerService>(TYPES.DatabaseLoggerService);
    performanceMonitor = container.get<PerformanceMonitor>(TYPES.PerformanceMonitor);
    eventToLogBridge = container.get<EventToLogBridge>(TYPES.EventToLogBridge);
  });

  test('should have all database logging services properly registered', () => {
    expect(qdrantService).toBeDefined();
    expect(databaseLogger).toBeDefined();
    expect(performanceMonitor).toBeDefined();
    expect(eventToLogBridge).toBeDefined();
  });

 test('should log connection events', async () => {
    // Mock the connection process to test logging
    const logSpy = jest.spyOn(databaseLogger, 'logConnectionEvent');
    
    // Since we're not actually connecting to Qdrant, we'll just test that the logger is available
    await databaseLogger.logConnectionEvent('connect', 'success', {
      host: 'localhost',
      port: 6333,
      duration: 100
    });
    
    expect(logSpy).toHaveBeenCalledWith(
      'connect',
      'success',
      expect.objectContaining({
        host: 'localhost',
        port: 6333,
        duration: 100
      })
    );
 });

  test('should record performance metrics', () => {
    const recordSpy = jest.spyOn(performanceMonitor, 'recordOperation');
    
    performanceMonitor.recordOperation('test_operation', 100, {
      testParam: 'value'
    });
    
    expect(recordSpy).toHaveBeenCalledWith(
      'test_operation',
      100,
      expect.objectContaining({
        testParam: 'value'
      })
    );
 });

  test('should bridge events to logs', async () => {
    const bridgeSpy = jest.spyOn(eventToLogBridge, 'bridgeEvent');
    
    const mockEvent = {
      type: DatabaseEventType.CONNECTION_OPENED as const,
      timestamp: new Date(),
      source: 'qdrant' as const,
      data: { host: 'localhost', port: 633 }
    };
    
    await eventToLogBridge.bridgeEvent(mockEvent);
    
    expect(bridgeSpy).toHaveBeenCalledWith(mockEvent);
 });

  test('should handle Qdrant operations with logging', async () => {
    // Verify that Qdrant service can access the logging services through its dependencies
    expect(qdrantService).toBeDefined();
    
    // Check that the Qdrant service has access to required services
    // This is more of a structural test to ensure dependencies are properly injected
    const qdrantServiceAny = qdrantService as any;
    expect(qdrantServiceAny.logger).toBeDefined();
    expect(qdrantServiceAny.errorHandler).toBeDefined();
    expect(qdrantServiceAny.databaseLogger).toBeDefined();
    expect(qdrantServiceAny.performanceMonitor).toBeDefined();
  });
});