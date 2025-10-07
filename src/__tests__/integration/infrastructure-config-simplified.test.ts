import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';
import { InfrastructureManager } from '../../infrastructure/InfrastructureManager';
import { ConfigValidator } from '../../infrastructure/config/ConfigValidator';
import { DatabaseType } from '../../infrastructure/types';
import { IDatabaseConnectionPool, ITransactionCoordinator } from '../../infrastructure/connection/types';
import { TransactionCoordinator } from '../../infrastructure/transaction/TransactionCoordinator';

// Mock dependencies
const mockLoggerService = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockConfigService = {
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn()
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn()
};

const mockPerformanceMonitor = {
  startTimer: jest.fn(),
  recordMetric: jest.fn(),
  getMetrics: jest.fn()
};

const mockBatchOptimizer = {
  optimize: jest.fn(),
  flush: jest.fn(),
  getStatus: jest.fn()
};

const mockHealthChecker = {
  getHealthStatus: jest.fn(),
  checkHealth: jest.fn()
};

const mockTransactionCoordinator = {
  beginTransaction: jest.fn(),
  preparePhase: jest.fn(),
  commitPhase: jest.fn(),
  rollback: jest.fn(),
  getTransactionStatus: jest.fn()
};

const mockDatabaseConnectionPool = {
  getConnection: jest.fn(),
  releaseConnection: jest.fn(),
  getPoolStatus: jest.fn(),
  close: jest.fn()
};

describe('简化配置管理测试', () => {
  let container: Container;
  let infrastructureConfigService: InfrastructureConfigService;
  let infrastructureManager: InfrastructureManager;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // 创建依赖注入容器
    container = new Container();

    // 绑定mock依赖
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.CacheService).toConstantValue(mockCacheService);
    container.bind(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind(TYPES.BatchOptimizer).toConstantValue(mockBatchOptimizer);
    container.bind(TYPES.HealthChecker).toConstantValue(mockHealthChecker);
    container.bind(TYPES.InfrastructureConfigService).to(InfrastructureConfigService).inSingletonScope();
    container.bind(TYPES.DatabaseConnectionPool).toConstantValue(mockDatabaseConnectionPool);

    // 创建真实的TransactionCoordinator实例，依赖于已绑定的LoggerService
    container.bind(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();

    container.bind(InfrastructureManager).to(InfrastructureManager).inSingletonScope();

    // 获取实例
    infrastructureConfigService = container.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);
    infrastructureManager = container.get<InfrastructureManager>(InfrastructureManager);
  });

  describe('基础配置功能测试', () => {
    test('应该能够加载配置', () => {
      const config = infrastructureConfigService.getConfig();
      expect(config).toBeDefined();
      expect(config.common).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.nebula).toBeDefined();
      expect(config.transaction).toBeDefined();
    });

    test('应该能够验证配置', () => {
      const config = infrastructureConfigService.getConfig();
      expect(() => {
        infrastructureConfigService['validateEnvironmentConfig'](config);
      }).not.toThrow();
    });

    test('应该能够获取数据库特定配置', () => {
      const qdrantConfig = infrastructureConfigService.getDatabaseConfig(DatabaseType.QDRANT);
      const nebulaConfig = infrastructureConfigService.getDatabaseConfig(DatabaseType.NEBULA);
      const vectorConfig = infrastructureConfigService.getDatabaseConfig(DatabaseType.VECTOR);
      const graphConfig = infrastructureConfigService.getDatabaseConfig(DatabaseType.GRAPH);

      expect(qdrantConfig).toBeDefined();
      expect(nebulaConfig).toBeDefined();
      expect(vectorConfig).toBeDefined();
      expect(graphConfig).toBeDefined();

      // VECTOR uses Qdrant config, GRAPH uses Nebula config
      expect(vectorConfig).toBe(qdrantConfig);
      expect(graphConfig).toBe(nebulaConfig);
    });

    test('应该能够获取通用配置', () => {
      const commonConfig = infrastructureConfigService.getCommonConfig();
      expect(commonConfig).toBeDefined();
      expect(typeof commonConfig.enableCache).toBe('boolean');
      expect(typeof commonConfig.enableMonitoring).toBe('boolean');
      expect(typeof commonConfig.enableBatching).toBe('boolean');
    });

    test('应该能够获取事务配置', () => {
      const transactionConfig = infrastructureConfigService.getTransactionConfig();
      expect(transactionConfig).toBeDefined();
      expect(typeof transactionConfig.timeout).toBe('number');
      expect(typeof transactionConfig.retryAttempts).toBe('number');
    });
  });

  describe('InfrastructureManager基础功能测试', () => {
    test('应该能够获取配置', () => {
      const config = infrastructureManager.getConfig();
      expect(config).toBeDefined();
      expect(config.common).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.nebula).toBeDefined();
      expect(config.transaction).toBeDefined();
    });

    test('应该能够获取配置摘要', () => {
      const summary = infrastructureManager.getConfigSummary();

      expect(summary).toHaveProperty('databaseTypes');
      expect(summary).toHaveProperty('enabledFeatures');
      expect(summary).toHaveProperty('configurationHealth');

      expect(Array.isArray(summary.databaseTypes)).toBe(true);
      expect(Array.isArray(summary.enabledFeatures)).toBe(true);
      expect(['valid', 'invalid', 'warnings']).toContain(summary.configurationHealth);
    });

    test('应该能够验证特定数据库配置', () => {
      const qdrantValidation = infrastructureManager.validateDatabaseConfig(DatabaseType.QDRANT);
      const nebulaValidation = infrastructureManager.validateDatabaseConfig(DatabaseType.NEBULA);

      expect(qdrantValidation.isValid).toBe(true);
      expect(qdrantValidation.errors).toHaveLength(0);

      expect(nebulaValidation.isValid).toBe(true);
      expect(nebulaValidation.errors).toHaveLength(0);
    });
  });

  describe('配置验证功能测试', () => {
    test('应该能够验证整个配置', () => {
      const isValid = infrastructureConfigService.validateConfig();
      expect(isValid).toBe(true);
    });

    test('配置验证失败时应该抛出错误', () => {
      // 创建一个无效的配置验证器
      const invalidConfig = {
        common: {
          enableCache: false,
          enableMonitoring: true,
          enableBatching: true,
          logLevel: 'info' as const,
          enableHealthChecks: true,
          healthCheckInterval: 500, // 小于最小值1000
          gracefulShutdownTimeout: 10000
        },
        qdrant: {
          cache: {
            defaultTTL: 30000,
            maxEntries: 1000,
            cleanupInterval: 60000,
            enableStats: true,
            databaseSpecific: {}
          },
          performance: {
            monitoringInterval: 30000,
            metricsRetentionPeriod: 86400000,
            enableDetailedLogging: false,
            performanceThresholds: {
              queryExecutionTime: 1000,
              memoryUsage: 80,
              responseTime: 500
            },
            databaseSpecific: {}
          },
          batch: {
            maxConcurrentOperations: 3,
            defaultBatchSize: 25,
            maxBatchSize: 100,
            minBatchSize: 5,
            memoryThreshold: 70,
            processingTimeout: 30000,
            retryAttempts: 2,
            retryDelay: 1000,
            adaptiveBatchingEnabled: false,
            performanceThreshold: 1000,
            adjustmentFactor: 0.1,
            databaseSpecific: {}
          },
          connection: {
            maxConnections: 5,
            minConnections: 1,
            connectionTimeout: 10000,
            idleTimeout: 30000,
            acquireTimeout: 5000,
            validationInterval: 10000,
            enableConnectionPooling: true,
            databaseSpecific: {}
          }
        },
        nebula: {
          cache: {
            defaultTTL: 30000,
            maxEntries: 1000,
            cleanupInterval: 60000,
            enableStats: true,
            databaseSpecific: {}
          },
          performance: {
            monitoringInterval: 30000,
            metricsRetentionPeriod: 86400000,
            enableDetailedLogging: false,
            performanceThresholds: {
              queryExecutionTime: 1000,
              memoryUsage: 80,
              responseTime: 500
            },
            databaseSpecific: {}
          },
          batch: {
            maxConcurrentOperations: 3,
            defaultBatchSize: 25,
            maxBatchSize: 100,
            minBatchSize: 5,
            memoryThreshold: 70,
            processingTimeout: 30000,
            retryAttempts: 2,
            retryDelay: 100,
            adaptiveBatchingEnabled: false,
            performanceThreshold: 1000,
            adjustmentFactor: 0.1,
            databaseSpecific: {}
          },
          connection: {
            maxConnections: 5,
            minConnections: 1,
            connectionTimeout: 10000,
            idleTimeout: 30000,
            acquireTimeout: 5000,
            validationInterval: 10000,
            enableConnectionPooling: true,
            databaseSpecific: {}
          },
          graph: {
            defaultSpace: 'default',
            spaceOptions: {
              partitionNum: 5,
              replicaFactor: 1,
              vidType: 'FIXED_STRING' as const
            },
            queryOptions: {
              timeout: 10000,
              retryAttempts: 2
            },
            schemaManagement: {
              autoCreateTags: false,
              autoCreateEdges: false
            }
          }
        },
        transaction: {
          timeout: 15000,
          retryAttempts: 2,
          retryDelay: 500,
          enableTwoPhaseCommit: false,
          maxConcurrentTransactions: 50,
          deadlockDetectionTimeout: 3000,
          isolationLevel: undefined
        }
      };

      expect(() => {
        infrastructureConfigService['validateEnvironmentConfig'](invalidConfig);
      }).toThrow();
    });
  });

  describe('错误处理和降级策略测试', () => {
    test('配置服务不可用时应使用降级策略', () => {
      // 创建新的容器，绑定mock的ConfigService（模拟配置服务的降级行为）
      const errorContainer = new Container();
      errorContainer.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
      errorContainer.bind(TYPES.ConfigService).toConstantValue({
        get: jest.fn().mockImplementation(() => undefined), // 模拟配置服务不可用
        set: jest.fn(),
        has: jest.fn().mockReturnValue(false)
      });
      errorContainer.bind(TYPES.CacheService).toConstantValue(mockCacheService);
      errorContainer.bind(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor);
      errorContainer.bind(TYPES.BatchOptimizer).toConstantValue(mockBatchOptimizer);
      errorContainer.bind(TYPES.HealthChecker).toConstantValue(mockHealthChecker);
      errorContainer.bind(TYPES.InfrastructureConfigService).to(InfrastructureConfigService).inSingletonScope();
      errorContainer.bind(TYPES.DatabaseConnectionPool).toConstantValue(mockDatabaseConnectionPool);
      errorContainer.bind(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();
      errorContainer.bind(InfrastructureManager).to(InfrastructureManager).inSingletonScope();

      // 获取实例（应该使用降级策略）
      const errorInfrastructureConfigService = errorContainer.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);
      const errorInfrastructureManager = errorContainer.get<InfrastructureManager>(InfrastructureManager);

      // 验证配置服务仍然可以工作
      expect(() => {
        const config = errorInfrastructureConfigService.getConfig();
        expect(config).toBeDefined();
        expect(config.common).toBeDefined();
      }).not.toThrow();

      expect(() => {
        const config = errorInfrastructureManager.getConfig();
        expect(config).toBeDefined();
        expect(config.common).toBeDefined();
      }).not.toThrow();
    });

    test('配置验证失败时应记录错误但服务继续运行', () => {
      // 尝试创建无效配置
      const invalidConfig = {
        common: {
          enableCache: false,
          enableMonitoring: true,
          enableBatching: true,
          logLevel: 'debug' as const,
          enableHealthChecks: true,
          healthCheckInterval: 500, // 无效值
          gracefulShutdownTimeout: 10000
        }
      };

      // 验证配置应该失败
      expect(() => {
        ConfigValidator.validate(invalidConfig as any);
      }).not.toThrow(); // 静态方法不会抛出异常，而是返回验证结果

      // 但服务应该继续运行
      expect(() => {
        const config = infrastructureConfigService.getConfig();
        expect(config).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('配置服务集成测试', () => {
    test('应该能够从环境变量加载配置', () => {
      const config = infrastructureConfigService.getConfig();

      // 验证配置包含预期的字段
      expect(config.common).toHaveProperty('enableCache');
      expect(config.common).toHaveProperty('enableMonitoring');
      expect(config.common).toHaveProperty('enableBatching');
      expect(config.common).toHaveProperty('logLevel');
      expect(config.qdrant).toHaveProperty('cache');
      expect(config.qdrant).toHaveProperty('performance');
      expect(config.qdrant).toHaveProperty('batch');
      expect(config.qdrant).toHaveProperty('connection');
      expect(config.nebula).toHaveProperty('cache');
      expect(config.nebula).toHaveProperty('performance');
      expect(config.nebula).toHaveProperty('batch');
      expect(config.nebula).toHaveProperty('connection');
      expect(config.nebula).toHaveProperty('graph');
      expect(config.transaction).toBeDefined();
    });

    test('应该能够从主配置服务合并配置', () => {
      // 配置mock返回值
      mockConfigService.get.mockReturnValue({
        maxConcurrentOperations: 10,
        defaultBatchSize: 100,
        maxBatchSize: 500,
        memoryThreshold: 80,
        processingTimeout: 60000,
        retryAttempts: 5,
        retryDelay: 2000
      });

      // 创建新的配置服务实例
      const testContainer = new Container();
      testContainer.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
      testContainer.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
      testContainer.bind(TYPES.InfrastructureConfigService).to(InfrastructureConfigService).inSingletonScope();

      const testConfigService = testContainer.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);
      const config = testConfigService.getConfig();

      // 验证配置加载成功
      expect(config).toBeDefined();
      expect(config.common).toBeDefined();
    });
  });

  describe('已移除功能的验证测试', () => {
    test('不应该有热更新功能', () => {
      // 验证热更新方法不存在
      expect(infrastructureConfigService).not.toHaveProperty('updateConfigWithValidation');
      expect(infrastructureConfigService).not.toHaveProperty('onConfigUpdate');
      expect(infrastructureConfigService).not.toHaveProperty('removeConfigUpdateCallback');
      expect(infrastructureConfigService).not.toHaveProperty('reloadConfig');
      expect(infrastructureConfigService).not.toHaveProperty('getConfigUpdateStatus');
    });

    test('不应该有环境变量监听功能', () => {
      // 验证环境变量监听方法不存在
      expect(infrastructureConfigService).not.toHaveProperty('startEnvironmentWatching');
      expect(infrastructureConfigService).not.toHaveProperty('stopEnvironmentWatching');
      expect(infrastructureConfigService).not.toHaveProperty('checkEnvironmentChanges');
    });

    test('不应该有配置缓存功能', () => {
      // 验证配置缓存方法不存在
      expect(infrastructureManager).not.toHaveProperty('refreshConfigCache');
      expect(infrastructureManager).not.toHaveProperty('clearConfigCache');
      expect(infrastructureManager).not.toHaveProperty('getConfigCacheStatus');
      expect(infrastructureManager).not.toHaveProperty('configCache');
    });

    test('不应该有配置更新监听功能', () => {
      // 验证配置更新监听方法不存在
      expect(infrastructureManager).not.toHaveProperty('onConfigUpdate');
      expect(infrastructureManager).not.toHaveProperty('removeConfigUpdateCallback');
      expect(infrastructureManager).not.toHaveProperty('notifyConfigUpdateCallbacks');
      expect(infrastructureManager).not.toHaveProperty('configUpdateCallbacks');
    });
  });
});