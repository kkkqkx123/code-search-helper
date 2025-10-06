import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseType } from '../types';

import { CommonConfig, CacheConfig, PerformanceConfig, BatchConfig, ConnectionConfig, GraphSpecificConfig, TransactionConfig } from './types';

export interface InfrastructureConfig {
  // 通用配置
 common: CommonConfig;
  
  // Qdrant特定配置
  qdrant: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    vector?: {
      defaultCollection?: string;
      collectionOptions?: {
        vectorSize?: number;
        distance?: 'Cosine' | 'Euclidean' | 'DotProduct';
        indexing?: {
          type?: string;
          options?: Record<string, any>;
        };
      };
      searchOptions?: {
        limit?: number;
        threshold?: number;
        exactSearch?: boolean;
      };
    };
 };
  
  // Nebula特定配置
 nebula: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    graph: GraphSpecificConfig;
  };
  
  // 事务配置
 transaction: TransactionConfig;
}

@injectable()
export class InfrastructureConfigService {
  private logger: LoggerService;
  private configService: ConfigService;
  private config: InfrastructureConfig;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.configService = configService;
    
    // 初始化默认配置
    this.config = this.getDefaultConfig();
    
    // 尝试从主配置服务加载基础设施特定配置
    this.loadConfigFromMainConfig();
  }

  private getDefaultConfig(): InfrastructureConfig {
    return {
      common: {
        enableCache: true,
        enableMonitoring: true,
        enableBatching: true,
        logLevel: 'info' as const,
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        gracefulShutdownTimeout: 100
      },
      qdrant: {
        cache: {
          defaultTTL: 300000, // 5 minutes
          maxEntries: 10000,
          cleanupInterval: 60000, // 1 minute
          enableStats: true,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 30000, // 30 seconds
          metricsRetentionPeriod: 86400000, // 24 hours
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 1000, // 1 second
            memoryUsage: 80, // 80%
            responseTime: 500 // 500ms
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 5,
          defaultBatchSize: 50,
          maxBatchSize: 500,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 30000, // 5 minutes
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000, // 1 second
          adjustmentFactor: 0.1, // 10% adjustment
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000, // 30 seconds
          idleTimeout: 300000, // 5 minutes
          acquireTimeout: 10000, // 10 seconds
          validationInterval: 6000, // 1 minute
          enableConnectionPooling: true,
          databaseSpecific: {}
        }
      },
      nebula: {
        cache: {
          defaultTTL: 300000, // 5 minutes
          maxEntries: 10000,
          cleanupInterval: 600, // 1 minute
          enableStats: true,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 30000, // 30 seconds
          metricsRetentionPeriod: 86400000, // 24 hours
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 1000, // 1 second
            memoryUsage: 80, // 80%
            responseTime: 500 // 500ms
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 5,
          defaultBatchSize: 50,
          maxBatchSize: 500,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 300000, // 5 minutes
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000, // 1 second
          adjustmentFactor: 0.1, // 10% adjustment
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000, // 30 seconds
          idleTimeout: 300000, // 5 minutes
          acquireTimeout: 1000, // 10 seconds
          validationInterval: 6000, // 1 minute
          enableConnectionPooling: true,
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: 'default',
          spaceOptions: {
            partitionNum: 10,
            replicaFactor: 1,
            vidType: 'FIXED_STRING' as const
          },
          queryOptions: {
            timeout: 30000, // 30 seconds
            retryAttempts: 3
          },
          schemaManagement: {
            autoCreateTags: false,
            autoCreateEdges: false
          }
        }
      },
      transaction: {
        timeout: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 1000,
        enableTwoPhaseCommit: true,
        maxConcurrentTransactions: 100,
        deadlockDetectionTimeout: 5000
      }
    };
  }

  private loadConfigFromMainConfig(): void {
    try {
      // 从主配置服务获取可能影响基础设施的配置
      // 由于AppConfig中没有infrastructure字段，我们检查是否有相关的配置项
      const batchProcessingConfig = this.configService.get('batchProcessing');
      const redisConfig = this.configService.get('redis');
      const loggingConfig = this.configService.get('logging');
      
      // 合并相关的配置到基础设施配置中
      if (batchProcessingConfig) {
        // 更新批处理相关的基础设施配置
        if (batchProcessingConfig.maxConcurrentOperations !== undefined) {
          this.config.qdrant.batch.maxConcurrentOperations = batchProcessingConfig.maxConcurrentOperations;
          this.config.nebula.batch.maxConcurrentOperations = batchProcessingConfig.maxConcurrentOperations;
        }
        if (batchProcessingConfig.defaultBatchSize !== undefined) {
          this.config.qdrant.batch.defaultBatchSize = batchProcessingConfig.defaultBatchSize;
          this.config.nebula.batch.defaultBatchSize = batchProcessingConfig.defaultBatchSize;
        }
        if (batchProcessingConfig.maxBatchSize !== undefined) {
          this.config.qdrant.batch.maxBatchSize = batchProcessingConfig.maxBatchSize;
          this.config.nebula.batch.maxBatchSize = batchProcessingConfig.maxBatchSize;
        }
        if (batchProcessingConfig.memoryThreshold !== undefined) {
          this.config.qdrant.batch.memoryThreshold = batchProcessingConfig.memoryThreshold;
          this.config.nebula.batch.memoryThreshold = batchProcessingConfig.memoryThreshold;
        }
        if (batchProcessingConfig.processingTimeout !== undefined) {
          this.config.qdrant.batch.processingTimeout = batchProcessingConfig.processingTimeout;
          this.config.nebula.batch.processingTimeout = batchProcessingConfig.processingTimeout;
        }
        if (batchProcessingConfig.retryAttempts !== undefined) {
          this.config.qdrant.batch.retryAttempts = batchProcessingConfig.retryAttempts;
          this.config.nebula.batch.retryAttempts = batchProcessingConfig.retryAttempts;
        }
        if (batchProcessingConfig.retryDelay !== undefined) {
          this.config.qdrant.batch.retryDelay = batchProcessingConfig.retryDelay;
          this.config.nebula.batch.retryDelay = batchProcessingConfig.retryDelay;
        }
      }
      
      if (redisConfig && redisConfig.enabled !== undefined) {
        // 更新缓存相关的基础设施配置
        this.config.qdrant.cache.enableStats = redisConfig.enabled;
        this.config.nebula.cache.enableStats = redisConfig.enabled;
      }
      
      if (loggingConfig && loggingConfig.level !== undefined) {
        // 更新日志相关的基础设施配置
        // 验证日志级别是否有效
        const validLogLevels = ['debug', 'info', 'warn', 'error'] as const;
        type LogLevel = typeof validLogLevels[number];
        if ((validLogLevels as readonly string[]).includes(loggingConfig.level)) {
          this.config.common.logLevel = loggingConfig.level as LogLevel;
        } else {
          this.logger.warn(`Invalid log level: ${loggingConfig.level}, using default 'info'`);
        }
      }
      
      this.logger.info('Infrastructure configuration updated with values from main config service');
    } catch (error) {
      this.logger.warn('Failed to load config from main config service, using defaults', {
        error: (error as Error).message
      });
    }
  }

  getConfig(): InfrastructureConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<InfrastructureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Infrastructure configuration updated');
  }

  getDatabaseConfig(databaseType: DatabaseType): any {
    switch (databaseType) {
      case DatabaseType.QDRANT:
        return this.config.qdrant;
      case DatabaseType.NEBULA:
        return this.config.nebula;
      case DatabaseType.VECTOR:
        return this.config.qdrant; // VECTOR uses Qdrant config
      case DatabaseType.GRAPH:
        return this.config.nebula; // GRAPH uses Nebula config
      default:
        throw new Error(`Unknown database type: ${databaseType}`);
    }
  }

  updateDatabaseConfig(databaseType: DatabaseType, newConfig: Partial<any>): void {
    switch (databaseType) {
      case DatabaseType.QDRANT:
        this.config.qdrant = { ...this.config.qdrant, ...newConfig };
        break;
      case DatabaseType.NEBULA:
        this.config.nebula = { ...this.config.nebula, ...newConfig };
        break;
      case DatabaseType.VECTOR:
        this.config.qdrant = { ...this.config.qdrant, ...newConfig };
        break;
      case DatabaseType.GRAPH:
        this.config.nebula = { ...this.config.nebula, ...newConfig };
        break;
      default:
        throw new Error(`Unknown database type: ${databaseType}`);
    }
    
    this.logger.info('Database-specific configuration updated', { databaseType });
  }

  getCommonConfig(): InfrastructureConfig['common'] {
    return this.config.common;
  }

  updateCommonConfig(newConfig: Partial<InfrastructureConfig['common']>): void {
    this.config.common = { ...this.config.common, ...newConfig };
    this.logger.info('Common infrastructure configuration updated');
  }

  getTransactionConfig(): InfrastructureConfig['transaction'] {
    return this.config.transaction;
  }

  updateTransactionConfig(newConfig: Partial<InfrastructureConfig['transaction']>): void {
    this.config.transaction = { ...this.config.transaction, ...newConfig };
    this.logger.info('Transaction configuration updated');
  }

  validateConfig(): boolean {
    // 验证配置的有效性
    const errors: string[] = [];

    // 验证Qdrant配置
    if (this.config.qdrant.connection.maxConnections <= 0) {
      errors.push('Qdrant maxConnections must be greater than 0');
    }

    if (this.config.qdrant.connection.minConnections < 0 || this.config.qdrant.connection.minConnections > this.config.qdrant.connection.maxConnections) {
      errors.push('Qdrant minConnections must be between 0 and maxConnections');
    }

    // 验证Nebula配置
    if (this.config.nebula.connection.maxConnections <= 0) {
      errors.push('Nebula maxConnections must be greater than 0');
    }

    if (this.config.nebula.connection.minConnections < 0 || this.config.nebula.connection.minConnections > this.config.nebula.connection.maxConnections) {
      errors.push('Nebula minConnections must be between 0 and maxConnections');
    }

    // 验证批处理配置
    if (this.config.qdrant.batch.minBatchSize > this.config.qdrant.batch.maxBatchSize) {
      errors.push('Qdrant batch minBatchSize cannot be greater than maxBatchSize');
    }

    if (this.config.nebula.batch.minBatchSize > this.config.nebula.batch.maxBatchSize) {
      errors.push('Nebula batch minBatchSize cannot be greater than maxBatchSize');
    }

    // 验证事务配置
    if (this.config.transaction.timeout <= 0) {
      errors.push('Transaction timeout must be greater than 0');
    }

    if (errors.length > 0) {
      this.logger.error('Configuration validation failed', { errors });
      return false;
    }

    this.logger.info('Configuration validation passed');
    return true;
  }

  async saveConfig(): Promise<void> {
    // 将配置保存到持久化存储
    // 这里可以实现将配置保存到文件、数据库或其他存储位置
    try {
      // 在实际实现中，这里会将配置保存到持久化存储
      this.logger.info('Infrastructure configuration saved');
    } catch (error) {
      this.logger.error('Failed to save infrastructure configuration', {
        error: (error as Error).message
      });
      throw error;
    }
  }
}