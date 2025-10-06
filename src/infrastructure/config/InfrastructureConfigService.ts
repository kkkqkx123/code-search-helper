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
    
    // 从环境变量加载基础设施配置
    this.config = this.loadInfrastructureConfigFromEnv();
    
    // 验证配置
    this.validateEnvironmentConfig(this.config);
    
    // 尝试从主配置服务加载基础设施特定配置
    this.loadConfigFromMainConfig();
  }

  private loadInfrastructureConfigFromEnv(): InfrastructureConfig {
    return {
      common: {
        enableCache: process.env.INFRA_COMMON_ENABLE_CACHE !== 'false',
        enableMonitoring: process.env.INFRA_COMMON_ENABLE_MONITORING !== 'false',
        enableBatching: process.env.INFRA_COMMON_ENABLE_BATCHING !== 'false',
        logLevel: (process.env.INFRA_COMMON_LOG_LEVEL as any) || 'info',
        enableHealthChecks: process.env.INFRA_COMMON_ENABLE_HEALTH_CHECKS !== 'false',
        healthCheckInterval: parseInt(process.env.INFRA_COMMON_HEALTH_CHECK_INTERVAL || '3000'),
        gracefulShutdownTimeout: parseInt(process.env.INFRA_COMMON_GRACEFUL_SHUTDOWN_TIMEOUT || '10000')
      },
      qdrant: {
        cache: {
          defaultTTL: parseInt(process.env.INFRA_QDRANT_CACHE_DEFAULT_TTL || '30000'),
          maxEntries: parseInt(process.env.INFRA_QDRANT_CACHE_MAX_ENTRIES || '10000'),
          cleanupInterval: parseInt(process.env.INFRA_QDRANT_CACHE_CLEANUP_INTERVAL || '60000'),
          enableStats: process.env.INFRA_QDRANT_CACHE_ENABLE_STATS !== 'false',
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: parseInt(process.env.INFRA_QDRANT_PERFORMANCE_MONITORING_INTERVAL || '30000'),
          metricsRetentionPeriod: parseInt(process.env.INFRA_QDRANT_PERFORMANCE_METRICS_RETENTION_PERIOD || '8640000'),
          enableDetailedLogging: process.env.INFRA_QDRANT_PERFORMANCE_ENABLE_DETAILED_LOGGING !== 'false',
          performanceThresholds: {
            queryExecutionTime: parseInt(process.env.INFRA_QDRANT_PERFORMANCE_QUERY_EXECUTION_TIME || '1000'),
            memoryUsage: parseInt(process.env.INFRA_QDRANT_PERFORMANCE_MEMORY_USAGE || '80'),
            responseTime: parseInt(process.env.INFRA_QDRANT_PERFORMANCE_RESPONSE_TIME || '50')
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: parseInt(process.env.INFRA_QDRANT_BATCH_MAX_CONCURRENT_OPERATIONS || '5'),
          defaultBatchSize: parseInt(process.env.INFRA_QDRANT_BATCH_DEFAULT_BATCH_SIZE || '50'),
          maxBatchSize: parseInt(process.env.INFRA_QDRANT_BATCH_MAX_BATCH_SIZE || '500'),
          minBatchSize: parseInt(process.env.INFRA_QDRANT_BATCH_MIN_BATCH_SIZE || '10'),
          memoryThreshold: parseInt(process.env.INFRA_QDRANT_BATCH_MEMORY_THRESHOLD || '80'),
          processingTimeout: parseInt(process.env.INFRA_QDRANT_BATCH_PROCESSING_TIMEOUT || '3000'),
          retryAttempts: parseInt(process.env.INFRA_QDRANT_BATCH_RETRY_ATTEMPTS || '3'),
          retryDelay: parseInt(process.env.INFRA_QDRANT_BATCH_RETRY_DELAY || '1000'),
          adaptiveBatchingEnabled: process.env.INFRA_QDRANT_BATCH_ADAPTIVE_BATCHING_ENABLED !== 'false',
          performanceThreshold: parseInt(process.env.INFRA_QDRANT_BATCH_PERFORMANCE_THRESHOLD || '1000'),
          adjustmentFactor: parseFloat(process.env.INFRA_QDRANT_BATCH_ADJUSTMENT_FACTOR || '0.1'),
          databaseSpecific: {}
        },
        connection: {
          maxConnections: parseInt(process.env.INFRA_QDRANT_CONNECTION_MAX_CONNECTIONS || '10'),
          minConnections: parseInt(process.env.INFRA_QDRANT_CONNECTION_MIN_CONNECTIONS || '2'),
          connectionTimeout: parseInt(process.env.INFRA_QDRANT_CONNECTION_CONNECTION_TIMEOUT || '3000'),
          idleTimeout: parseInt(process.env.INFRA_QDRANT_CONNECTION_IDLE_TIMEOUT || '300000'),
          acquireTimeout: parseInt(process.env.INFRA_QDRANT_CONNECTION_ACQUIRE_TIMEOUT || '10000'),
          validationInterval: parseInt(process.env.INFRA_QDRANT_CONNECTION_VALIDATION_INTERVAL || '6000'),
          enableConnectionPooling: process.env.INFRA_QDRANT_CONNECTION_ENABLE_CONNECTION_POOLING !== 'false',
          databaseSpecific: {}
        },
        vector: {
          defaultCollection: process.env.INFRA_QDRANT_VECTOR_DEFAULT_COLLECTION || 'default',
          collectionOptions: {
            vectorSize: parseInt(process.env.INFRA_QDRANT_VECTOR_COLLECTION_VECTOR_SIZE || '1536'),
            distance: (process.env.INFRA_QDRANT_VECTOR_COLLECTION_DISTANCE as any) || 'Cosine',
            indexing: {
              type: process.env.INFRA_QDRANT_VECTOR_COLLECTION_INDEXING_TYPE || 'hnsw',
              options: {}
            }
          },
          searchOptions: {
            limit: parseInt(process.env.INFRA_QDRANT_VECTOR_SEARCH_LIMIT || '10'),
            threshold: parseFloat(process.env.INFRA_QDRANT_VECTOR_SEARCH_THRESHOLD || '0.5'),
            exactSearch: process.env.INFRA_QDRANT_VECTOR_SEARCH_EXACT_SEARCH === 'true'
          }
        }
      },
      nebula: {
        cache: {
          defaultTTL: parseInt(process.env.INFRA_NEBULA_CACHE_DEFAULT_TTL || '30000'),
          maxEntries: parseInt(process.env.INFRA_NEBULA_CACHE_MAX_ENTRIES || '10000'),
          cleanupInterval: parseInt(process.env.INFRA_NEBULA_CACHE_CLEANUP_INTERVAL || '60000'),
          enableStats: process.env.INFRA_NEBULA_CACHE_ENABLE_STATS !== 'false',
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: parseInt(process.env.INFRA_NEBULA_PERFORMANCE_MONITORING_INTERVAL || '30000'),
          metricsRetentionPeriod: parseInt(process.env.INFRA_NEBULA_PERFORMANCE_METRICS_RETENTION_PERIOD || '8640000'),
          enableDetailedLogging: process.env.INFRA_NEBULA_PERFORMANCE_ENABLE_DETAILED_LOGGING !== 'false',
          performanceThresholds: {
            queryExecutionTime: parseInt(process.env.INFRA_NEBULA_PERFORMANCE_QUERY_EXECUTION_TIME || '1000'),
            memoryUsage: parseInt(process.env.INFRA_NEBULA_PERFORMANCE_MEMORY_USAGE || '80'),
            responseTime: parseInt(process.env.INFRA_NEBULA_PERFORMANCE_RESPONSE_TIME || '500')
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: parseInt(process.env.INFRA_NEBULA_BATCH_MAX_CONCURRENT_OPERATIONS || '5'),
          defaultBatchSize: parseInt(process.env.INFRA_NEBULA_BATCH_DEFAULT_BATCH_SIZE || '50'),
          maxBatchSize: parseInt(process.env.INFRA_NEBULA_BATCH_MAX_BATCH_SIZE || '500'),
          minBatchSize: parseInt(process.env.INFRA_NEBULA_BATCH_MIN_BATCH_SIZE || '10'),
          memoryThreshold: parseInt(process.env.INFRA_NEBULA_BATCH_MEMORY_THRESHOLD || '80'),
          processingTimeout: parseInt(process.env.INFRA_NEBULA_BATCH_PROCESSING_TIMEOUT || '300000'),
          retryAttempts: parseInt(process.env.INFRA_NEBULA_BATCH_RETRY_ATTEMPTS || '3'),
          retryDelay: parseInt(process.env.INFRA_NEBULA_BATCH_RETRY_DELAY || '100'),
          adaptiveBatchingEnabled: process.env.INFRA_NEBULA_BATCH_ADAPTIVE_BATCHING_ENABLED !== 'false',
          performanceThreshold: parseInt(process.env.INFRA_NEBULA_BATCH_PERFORMANCE_THRESHOLD || '1000'),
          adjustmentFactor: parseFloat(process.env.INFRA_NEBULA_BATCH_ADJUSTMENT_FACTOR || '0.1'),
          databaseSpecific: {}
        },
        connection: {
          maxConnections: parseInt(process.env.INFRA_NEBULA_CONNECTION_MAX_CONNECTIONS || '10'),
          minConnections: parseInt(process.env.INFRA_NEBULA_CONNECTION_MIN_CONNECTIONS || '2'),
          connectionTimeout: parseInt(process.env.INFRA_NEBULA_CONNECTION_CONNECTION_TIMEOUT || '30000'),
          idleTimeout: parseInt(process.env.INFRA_NEBULA_CONNECTION_IDLE_TIMEOUT || '30000'),
          acquireTimeout: parseInt(process.env.INFRA_NEBULA_CONNECTION_ACQUIRE_TIMEOUT || '10000'),
          validationInterval: parseInt(process.env.INFRA_NEBULA_CONNECTION_VALIDATION_INTERVAL || '60000'),
          enableConnectionPooling: process.env.INFRA_NEBULA_CONNECTION_ENABLE_CONNECTION_POOLING !== 'false',
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: process.env.INFRA_NEBULA_GRAPH_DEFAULT_SPACE || 'default',
          spaceOptions: {
            partitionNum: parseInt(process.env.INFRA_NEBULA_GRAPH_SPACE_PARTITION_NUM || '10'),
            replicaFactor: parseInt(process.env.INFRA_NEBULA_GRAPH_SPACE_REPLICA_FACTOR || '1'),
            vidType: (process.env.INFRA_NEBULA_GRAPH_SPACE_VID_TYPE as any) || 'FIXED_STRING'
          },
          queryOptions: {
            timeout: parseInt(process.env.INFRA_NEBULA_GRAPH_QUERY_TIMEOUT || '30000'),
            retryAttempts: parseInt(process.env.INFRA_NEBULA_GRAPH_QUERY_RETRY_ATTEMPTS || '3')
          },
          schemaManagement: {
            autoCreateTags: process.env.INFRA_NEBULA_GRAPH_SCHEMA_AUTO_CREATE_TAGS === 'true',
            autoCreateEdges: process.env.INFRA_NEBULA_GRAPH_SCHEMA_AUTO_CREATE_EDGES === 'true'
          }
        }
      },
      transaction: {
        timeout: parseInt(process.env.INFRA_TRANSACTION_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.INFRA_TRANSACTION_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.INFRA_TRANSACTION_RETRY_DELAY || '100'),
        enableTwoPhaseCommit: process.env.INFRA_TRANSACTION_ENABLE_TWO_PHASE_COMMIT !== 'false',
        maxConcurrentTransactions: parseInt(process.env.INFRA_TRANSACTION_MAX_CONCURRENT_TRANSACTIONS || '100'),
        deadlockDetectionTimeout: parseInt(process.env.INFRA_TRANSACTION_DEADLOCK_DETECTION_TIMEOUT || '5000'),
        isolationLevel: (process.env.INFRA_TRANSACTION_ISOLATION_LEVEL as any) || undefined
      }
    };
  }

  private getDefaultConfig(): InfrastructureConfig {
    return this.loadInfrastructureConfigFromEnv();
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

  private validateEnvironmentConfig(config: InfrastructureConfig): void {
    const errors: string[] = [];

    // 验证环境变量配置的有效性
    if (config.common.healthCheckInterval < 1000) {
      errors.push('Common health check interval must be at least 1000ms');
    }

    if (config.qdrant.connection.maxConnections <= 0) {
      errors.push('Qdrant max connections must be greater than 0');
    }

    if (config.nebula.connection.maxConnections <= 0) {
      errors.push('Nebula max connections must be greater than 0');
    }

    if (config.transaction.timeout <= 0) {
      errors.push('Transaction timeout must be greater than 0');
    }

    if (errors.length > 0) {
      throw new Error(`Infrastructure configuration validation failed: ${errors.join(', ')}`);
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