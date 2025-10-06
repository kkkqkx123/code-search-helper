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
import { QdrantInfrastructure } from './implementations/QdrantInfrastructure';
import { NebulaInfrastructure } from './implementations/NebulaInfrastructure';
import { InfrastructureConfig as TypedInfrastructureConfig } from './config/types';
import { ConfigValidator } from './config/ConfigValidator';

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

// 为了向后兼容，保留旧的接口但使用新的类型
export interface InfrastructureConfig extends TypedInfrastructureConfig {}

@injectable()
export class InfrastructureManager {
  private logger: LoggerService;
  private databaseInfrastructures: Map<DatabaseType, IDatabaseInfrastructure>;
  private transactionCoordinator: TransactionCoordinator;
  private config: InfrastructureConfig;
  private configValidator: ConfigValidator;
  
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheService) cacheService: any,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: any,
    @inject(TYPES.BatchOptimizer) batchOptimizer: any,
    @inject(TYPES.HealthChecker) healthChecker: any,
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
        logLevel: 'info',
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        gracefulShutdownTimeout: 10000
      },
      qdrant: {
        cache: {
          defaultTTL: 300000,
          maxEntries: 10000,
          cleanupInterval: 60000,
          enableStats: true,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 30000,
          metricsRetentionPeriod: 86400000,
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 1000,
            memoryUsage: 80,
            responseTime: 500
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 5,
          defaultBatchSize: 50,
          maxBatchSize: 500,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 300000,
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000,
          adjustmentFactor: 0.1,
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          acquireTimeout: 10000,
          validationInterval: 60000,
          enableConnectionPooling: true,
          databaseSpecific: {}
        }
      },
      nebula: {
        cache: {
          defaultTTL: 300000,
          maxEntries: 10000,
          cleanupInterval: 60000,
          enableStats: true,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 30000,
          metricsRetentionPeriod: 86400000,
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 1000,
            memoryUsage: 80,
            responseTime: 500
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 5,
          defaultBatchSize: 50,
          maxBatchSize: 500,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 300000,
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000,
          adjustmentFactor: 0.1,
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          acquireTimeout: 10000,
          validationInterval: 60000,
          enableConnectionPooling: true,
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: 'default',
          spaceOptions: {
            partitionNum: 10,
            replicaFactor: 1,
            vidType: 'FIXED_STRING'
          },
          queryOptions: {
            timeout: 30000,
            retryAttempts: 3
          },
          schemaManagement: {
            autoCreateTags: false,
            autoCreateEdges: false
          }
        }
      },
      transaction: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableTwoPhaseCommit: true,
        maxConcurrentTransactions: 100,
        deadlockDetectionTimeout: 5000
      }
    };

    // 创建配置验证器
    this.configValidator = new ConfigValidator(this.logger);
    
    // 验证默认配置
    this.validateConfiguration(this.config, 'default configuration');

    // 创建数据库基础设施实例
    this.createDatabaseInfrastructures(
      cacheService,
      performanceMonitor,
      batchOptimizer,
      healthChecker,
      databaseConnectionPool
    );
    
    this.logger.info('Infrastructure manager initialized');
  }

  private createDatabaseInfrastructures(
    cacheService: any,
    performanceMonitor: any,
    batchOptimizer: any,
    healthChecker: any,
    databaseConnectionPool: DatabaseConnectionPool
  ): void {
    // 创建 Qdrant 基础设施
    const qdrantInfrastructure = new QdrantInfrastructure(
      this.logger,
      cacheService,
      performanceMonitor,
      batchOptimizer,
      healthChecker,
      databaseConnectionPool
    );
    this.databaseInfrastructures.set(DatabaseType.QDRANT, qdrantInfrastructure);

    // 创建 Nebula 基础设施
    const nebulaInfrastructure = new NebulaInfrastructure(
      this.logger,
      cacheService,
      performanceMonitor,
      batchOptimizer,
      healthChecker,
      databaseConnectionPool
    );
    this.databaseInfrastructures.set(DatabaseType.NEBULA, nebulaInfrastructure);

    this.logger.info('Database infrastructure instances created', {
      qdrant: !!qdrantInfrastructure,
      nebula: !!nebulaInfrastructure
    });
  }
  
  async initialize(): Promise<void> {
    this.logger.info('Initializing database infrastructures');
    
    try {
      // 初始化所有数据库基础设施
      const initializationPromises: Promise<void>[] = [];
      
      for (const [databaseType, infrastructure] of this.databaseInfrastructures) {
        this.logger.info(`Initializing ${databaseType} infrastructure`);
        
        // 检查配置中是否启用了该数据库类型
        if (this.isDatabaseTypeEnabled(databaseType)) {
          initializationPromises.push(this.initializeInfrastructure(databaseType, infrastructure));
        } else {
          this.logger.warn(`Database type ${databaseType} is disabled in configuration`);
        }
      }
      
      // 等待所有基础设施初始化完成
      await Promise.all(initializationPromises);
      
      // 验证所有基础设施是否成功初始化
      await this.validateInfrastructures();
      
      // 执行全局健康检查
      await this.performGlobalHealthCheck();
      
      this.logger.info('All database infrastructures initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database infrastructures', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      
      // 清理已初始化的基础设施
      await this.cleanupOnInitializationFailure();
      
      throw error;
    }
  }

  private isDatabaseTypeEnabled(databaseType: DatabaseType): boolean {
    // 根据配置检查数据库类型是否启用
    // 目前默认启用所有类型，实际实现中可以根据配置决定
    return true;
  }

  private async initializeInfrastructure(
    databaseType: DatabaseType,
    infrastructure: IDatabaseInfrastructure
  ): Promise<void> {
    try {
      this.logger.debug(`Starting initialization for ${databaseType}`);
      
      // 调用基础设施的初始化方法
      await (infrastructure as any).initialize();
      
      this.logger.info(`Successfully initialized ${databaseType} infrastructure`);
    } catch (error) {
      this.logger.error(`Failed to initialize ${databaseType} infrastructure`, {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async validateInfrastructures(): Promise<void> {
    this.logger.debug('Validating initialized infrastructures');
    
    for (const [databaseType, infrastructure] of this.databaseInfrastructures) {
      try {
        // 检查基础设施是否已初始化
        if (!(infrastructure as any).isInitialized()) {
          throw new Error(`${databaseType} infrastructure is not properly initialized`);
        }
        
        // 验证健康检查器
        const healthChecker = infrastructure.getHealthChecker();
        const healthStatus = await healthChecker.getHealthStatus();
        
        if (healthStatus.status === 'error') {
          this.logger.warn(`${databaseType} infrastructure has error health status`, {
            status: healthStatus
          });
        }
        
        this.logger.debug(`${databaseType} infrastructure validation passed`);
      } catch (error) {
        this.logger.error(`Validation failed for ${databaseType} infrastructure`, {
          error: (error as Error).message
        });
        throw error;
      }
    }
  }

  private async performGlobalHealthCheck(): Promise<void> {
    this.logger.debug('Performing global health check');
    
    try {
      const healthStatuses = await this.getAllHealthStatus();
      
      let healthyCount = 0;
      let degradedCount = 0;
      let errorCount = 0;
      
      for (const [databaseType, status] of healthStatuses) {
        switch (status.status) {
          case 'healthy':
            healthyCount++;
            break;
          case 'degraded':
            degradedCount++;
            this.logger.warn(`${databaseType} infrastructure is in degraded state`);
            break;
          case 'error':
            errorCount++;
            this.logger.error(`${databaseType} infrastructure has error status`);
            break;
        }
      }
      
      this.logger.info('Global health check completed', {
        total: healthStatuses.size,
        healthy: healthyCount,
        degraded: degradedCount,
        error: errorCount
      });
      
      // 如果所有基础设施都有错误，则抛出异常
      if (errorCount === healthStatuses.size && healthStatuses.size > 0) {
        throw new Error('All database infrastructures have error status');
      }
    } catch (error) {
      this.logger.error('Global health check failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async cleanupOnInitializationFailure(): Promise<void> {
    this.logger.warn('Cleaning up due to initialization failure');
    
    try {
      await this.shutdown();
    } catch (cleanupError) {
      this.logger.error('Error during cleanup after initialization failure', {
        error: (cleanupError as Error).message
      });
    }
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
    
    try {
      // 记录关闭开始时间
      const shutdownStartTime = Date.now();
      
      // 关闭所有数据库基础设施
      await this.shutdownAllInfrastructures();
      
      // 关闭事务协调器（如果需要）
      await this.shutdownTransactionCoordinator();
      
      // 关闭连接池（如果需要）
      await this.shutdownConnectionPool();
      
      // 清理资源
      this.cleanupResources();
      
      const shutdownDuration = Date.now() - shutdownStartTime;
      this.logger.info('Infrastructure manager shutdown completed', {
        duration: shutdownDuration,
        infrastructuresShutdown: this.databaseInfrastructures.size
      });
    } catch (error) {
      this.logger.error('Error during infrastructure manager shutdown', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  private async shutdownAllInfrastructures(): Promise<void> {
    this.logger.info('Shutting down all database infrastructures');
    
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [databaseType, infrastructure] of this.databaseInfrastructures) {
      this.logger.debug(`Shutting down ${databaseType} infrastructure`);
      
      shutdownPromises.push(
        this.shutdownInfrastructure(databaseType, infrastructure)
          .catch(error => {
            this.logger.error(`Failed to shutdown ${databaseType} infrastructure`, {
              error: (error as Error).message
            });
            // 不抛出错误，继续关闭其他基础设施
          })
      );
    }
    
    // 等待所有基础设施关闭完成
    await Promise.all(shutdownPromises);
    
    this.logger.info('All database infrastructures shutdown completed');
  }

  private async shutdownInfrastructure(
    databaseType: DatabaseType,
    infrastructure: IDatabaseInfrastructure
  ): Promise<void> {
    try {
      this.logger.debug(`Starting shutdown for ${databaseType}`);
      
      // 检查基础设施是否已初始化并有shutdown方法
      if ((infrastructure as any).isInitialized && (infrastructure as any).isInitialized()) {
        await (infrastructure as any).shutdown();
        this.logger.info(`Successfully shutdown ${databaseType} infrastructure`);
      } else {
        this.logger.debug(`${databaseType} infrastructure is not initialized, skipping shutdown`);
      }
    } catch (error) {
      this.logger.error(`Error during ${databaseType} infrastructure shutdown`, {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async shutdownTransactionCoordinator(): Promise<void> {
    this.logger.debug('Shutting down transaction coordinator');
    
    try {
      // 检查是否有活跃的事务
      // 这里可以添加事务协调器的关闭逻辑
      // 目前TransactionCoordinator没有shutdown方法，所以只记录日志
      
      this.logger.debug('Transaction coordinator shutdown completed');
    } catch (error) {
      this.logger.error('Error during transaction coordinator shutdown', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async shutdownConnectionPool(): Promise<void> {
    this.logger.debug('Shutting down connection pools');
    
    try {
      // 遍历所有数据库类型，关闭连接池
      for (const databaseType of Object.values(DatabaseType)) {
        try {
          // 获取连接池状态
          const infrastructure = this.databaseInfrastructures.get(databaseType);
          if (infrastructure) {
            const connectionManager = infrastructure.getConnectionManager();
            const poolStatus = connectionManager.getPoolStatus(databaseType);
            
            this.logger.debug(`Connection pool status for ${databaseType}`, poolStatus);
            
            // 这里可以添加连接池的关闭逻辑
            // 目前DatabaseConnectionPool没有shutdown方法，所以只记录状态
          }
        } catch (error) {
          this.logger.warn(`Error getting connection pool status for ${databaseType}`, {
            error: (error as Error).message
          });
        }
      }
      
      this.logger.debug('Connection pools shutdown completed');
    } catch (error) {
      this.logger.error('Error during connection pool shutdown', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private cleanupResources(): void {
    this.logger.debug('Cleaning up resources');
    
    try {
      // 清理基础设施映射
      this.databaseInfrastructures.clear();
      
      // 重置配置（可选）
      // this.config = { ...this.defaultConfig };
      
      this.logger.debug('Resource cleanup completed');
    } catch (error) {
      this.logger.error('Error during resource cleanup', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  // 添加检查基础设施管理器是否已初始化的方法
  isInitialized(): boolean {
    if (this.databaseInfrastructures.size === 0) {
      return false;
    }
    
    // 检查所有基础设施是否已初始化
    for (const [, infrastructure] of this.databaseInfrastructures) {
      if (!(infrastructure as any).isInitialized()) {
        return false;
      }
    }
    
    return true;
  }

  // 添加获取基础设施状态的方法
  getInfrastructureStatus(): Map<DatabaseType, { initialized: boolean; healthy: boolean }> {
    const status = new Map<DatabaseType, { initialized: boolean; healthy: boolean }>();
    
    for (const [databaseType, infrastructure] of this.databaseInfrastructures) {
      const initialized = (infrastructure as any).isInitialized ? (infrastructure as any).isInitialized() : false;
      let healthy = false;
      
      if (initialized) {
        try {
          const healthChecker = infrastructure.getHealthChecker();
          const healthStatus = healthChecker.getHealthStatus();
          healthy = healthStatus.status === 'healthy';
        } catch (error) {
          healthy = false;
        }
      }
      
      status.set(databaseType, { initialized, healthy });
    }
    
    return status;
  }
  
  updateConfig(config: Partial<InfrastructureConfig>): void {
    // 创建新配置对象
    const newConfig = { ...this.config, ...config };
    
    // 验证新配置
    this.validateConfiguration(newConfig, 'configuration update');
    
    // 如果验证通过，更新配置
    this.config = newConfig;
    this.logger.info('Infrastructure configuration updated', {
      updatedKeys: Object.keys(config)
    });
  }
  
  getConfig(): InfrastructureConfig {
    return { ...this.config };
  }

  private validateConfiguration(config: InfrastructureConfig, context: string): void {
    this.logger.debug(`Validating configuration: ${context}`);
    
    const validationResult = this.configValidator.validateConfig(config);
    
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors.map(error =>
        `${error.field}: ${error.message}`
      ).join('; ');
      
      this.logger.error(`Configuration validation failed for ${context}`, {
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }
    
    if (validationResult.warnings.length > 0) {
      this.logger.warn(`Configuration validation warnings for ${context}`, {
        warnings: validationResult.warnings
      });
    }
    
    this.logger.debug(`Configuration validation passed for ${context}`);
  }

  // 获取配置摘要信息
  getConfigSummary(): {
    databaseTypes: string[];
    enabledFeatures: string[];
    configurationHealth: 'valid' | 'invalid' | 'warnings';
  } {
    const databaseTypes = Object.keys(this.config).filter(key =>
      ['qdrant', 'nebula', 'vector', 'graph'].includes(key)
    );
    
    const enabledFeatures = [];
    if (this.config.common.enableCache) enabledFeatures.push('cache');
    if (this.config.common.enableMonitoring) enabledFeatures.push('monitoring');
    if (this.config.common.enableBatching) enabledFeatures.push('batching');
    if (this.config.common.enableHealthChecks) enabledFeatures.push('healthChecks');
    
    const validationResult = this.configValidator.validateConfig(this.config);
    let configurationHealth: 'valid' | 'invalid' | 'warnings' = 'valid';
    if (!validationResult.isValid) {
      configurationHealth = 'invalid';
    } else if (validationResult.warnings.length > 0) {
      configurationHealth = 'warnings';
    }
    
    return {
      databaseTypes,
      enabledFeatures,
      configurationHealth
    };
  }

  // 验证特定数据库类型的配置
  validateDatabaseConfig(databaseType: DatabaseType): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const configKey = databaseType.toLowerCase();
    const dbConfig = (this.config as any)[configKey];
    
    if (!dbConfig) {
      return {
        isValid: false,
        errors: [`Configuration for ${databaseType} not found`],
        warnings: []
      };
    }
    
    // 创建部分配置进行验证
    const partialConfig = {
      [configKey]: dbConfig,
      common: this.config.common,
      transaction: this.config.transaction
    } as any;
    
    const validationResult = this.configValidator.validateConfig(partialConfig);
    
    return {
      isValid: validationResult.isValid,
      errors: validationResult.errors.map(error => error.message),
      warnings: validationResult.warnings.map(warning => warning.message)
    };
  }
}