import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { LoggerService } from '../utils/LoggerService';
import { DatabaseType } from './types';
import { ICacheService } from './caching/types';
import { IPerformanceMonitor } from './monitoring/types';
import { IBatchOptimizer } from './batching/types';
import { IHealthChecker } from './monitoring/types';
import { TransactionCoordinator } from './transaction/TransactionCoordinator';
import { DatabaseConnectionPool } from './connection/DatabaseConnectionPool';

export interface IDatabaseInfrastructure {
  readonly databaseType: DatabaseType;
  
  // 缓存支持
  getCacheService(): ICacheService;
  
  // 性能监控
  getPerformanceMonitor(): IPerformanceMonitor;
  
  // 批处理优化
  getBatchOptimizer(): IBatchOptimizer;
  
  // 健康检查
  getHealthChecker(): IHealthChecker;
  
  // 连接管理
  getConnectionManager(): DatabaseConnectionPool;
}

export interface InfrastructureConfig {
  // 通用配置
  common: {
    enableCache: boolean;
    enableMonitoring: boolean;
    enableBatching: boolean;
    logLevel: string; // 例如 'info', 'debug', 'warn', 'error'
  };
  
  // Qdrant特定配置
  qdrant: {
    cache: any; // CacheConfig的简化版
    performance: any; // PerformanceConfig的简化版
    batch: any; // BatchConfig的简化版
    connection: any; // ConnectionConfig的简化版
  };
  
  // Nebula特定配置
  nebula: {
    cache: any; // CacheConfig的简化版
    performance: any; // PerformanceConfig的简化版
    batch: any; // BatchConfig的简化版
    connection: any; // ConnectionConfig的简化版
    graph: any; // GraphSpecificConfig的简化版
  };
  
  // 事务配置
  transaction: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    enableTwoPhaseCommit: boolean;
  };
}

@injectable()
export class InfrastructureManager {
  private logger: LoggerService;
  private databaseInfrastructures: Map<DatabaseType, IDatabaseInfrastructure>;
  private transactionCoordinator: TransactionCoordinator;
  private config: InfrastructureConfig;
  
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    transactionCoordinator: TransactionCoordinator,
    databaseConnectionPool: DatabaseConnectionPool
  ) {
    this.logger = logger;
    this.databaseInfrastructures = new Map();
    this.transactionCoordinator = transactionCoordinator;
    
    // 初始化默认配置
    this.config = {
      common: {
        enableCache: true,
        enableMonitoring: true,
        enableBatching: true,
        logLevel: 'info'
      },
      qdrant: {
        cache: {},
        performance: {},
        batch: {},
        connection: {}
      },
      nebula: {
        cache: {},
        performance: {},
        batch: {},
        connection: {},
        graph: {}
      },
      transaction: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableTwoPhaseCommit: true
      }
    };
    
    this.logger.info('Infrastructure manager initialized');
  }
  
  async initialize(): Promise<void> {
    this.logger.info('Initializing database infrastructures');
    
    // 可以在这里初始化具体的数据库基础设施实现
    // 例如：创建QdrantInfrastructure、NebulaInfrastructure等实例
    // 并将它们添加到databaseInfrastructures映射中
    
    this.logger.info('Database infrastructures initialized');
  }
  
  getInfrastructure(databaseType: DatabaseType): IDatabaseInfrastructure {
    const infrastructure = this.databaseInfrastructures.get(databaseType);
    if (!infrastructure) {
      throw new Error(`Infrastructure not found for database type: ${databaseType}`);
    }
    return infrastructure;
  }
  
  getTransactionCoordinator(): TransactionCoordinator {
    return this.transactionCoordinator;
  }
  
  async getAllHealthStatus(): Promise<Map<DatabaseType, any>> {
    const healthStatus = new Map<DatabaseType, any>();
    
    for (const [type, infrastructure] of this.databaseInfrastructures) {
      try {
        const healthChecker = infrastructure.getHealthChecker();
        const status = await healthChecker.getHealthStatus();
        healthStatus.set(type, status);
      } catch (error) {
        this.logger.error(`Failed to get health status for ${type}`, { error: (error as Error).message });
        healthStatus.set(type, { 
          status: 'error', 
          error: (error as Error).message,
          timestamp: Date.now()
        });
      }
    }
    
    return healthStatus;
  }
  
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down infrastructure manager');
    
    // 关闭所有基础设施组件
    for (const [, infrastructure] of this.databaseInfrastructures) {
      // 如果基础设施实现了关闭方法，可以在这里调用
    }
    
    // 关闭事务协调器
    // 关闭连接池
    this.logger.info('Infrastructure manager shutdown completed');
  }
  
  updateConfig(config: Partial<InfrastructureConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Infrastructure configuration updated');
  }
  
  getConfig(): InfrastructureConfig {
    return { ...this.config };
  }
}