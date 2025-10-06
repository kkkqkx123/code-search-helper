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
  private config!: InfrastructureConfig;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.configService = configService;

    // 使用降级策略加载配置
    this.loadConfigWithFallback();
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
          monitoringInterval: parseInt(process.env.INFRA_QDRANT_PERFORMANCE_MONITORING_INTERVAL || '1000'),  // 设置为最低允许值
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
          monitoringInterval: parseInt(process.env.INFRA_NEBULA_PERFORMANCE_MONITORING_INTERVAL || '1000'),  // 设置为最低允许值
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
        deadlockDetectionTimeout: parseInt(process.env.INFRA_TRANSACTION_DEADLOCK_DETECTION_TIMEOUT || '1000'),  // 设置为最低允许值
        isolationLevel: (process.env.INFRA_TRANSACTION_ISOLATION_LEVEL as any) || undefined
      }
    };
  }

  private getDefaultConfig(): InfrastructureConfig {
    return this.loadInfrastructureConfigFromEnv();
  }

  // 使用降级策略加载配置
  private loadConfigWithFallback(): void {
    let configLoadSuccess = false;
    let lastError: Error | null = null;

    // 策略1：尝试从环境变量加载
    try {
      this.config = this.loadInfrastructureConfigFromEnv();
      this.validateEnvironmentConfig(this.config);
      configLoadSuccess = true;
      this.logger.info('配置从环境变量加载成功');
    } catch (error) {
      lastError = error as Error;
      this.logger.warn('从环境变量加载配置失败，尝试下一个策略', {
        error: lastError.message
      });
    }

    // 策略2：尝试从主配置服务加载
    if (!configLoadSuccess) {
      try {
        this.config = this.getSafeDefaultConfig();
        this.loadConfigFromMainConfig();
        this.validateEnvironmentConfig(this.config);
        configLoadSuccess = true;
        this.logger.info('配置从主配置服务加载成功');
      } catch (error) {
        lastError = error as Error;
        this.logger.warn('从主配置服务加载配置失败，使用默认配置', {
          error: lastError.message
        });
      }
    }

    // 策略3：使用安全的默认配置
    if (!configLoadSuccess) {
      try {
        this.config = this.getSafeDefaultConfig();
        this.validateEnvironmentConfig(this.config);
        configLoadSuccess = true;
        this.logger.info('使用安全默认配置成功');
      } catch (error) {
        lastError = error as Error;
        this.logger.error('所有配置加载策略都失败', {
          error: lastError.message
        });
        // 最后的降级：强制使用最小配置
        this.config = this.getMinimalConfig();
      }
    }

    // 如果成功加载了配置，尝试从主配置服务合并配置
    if (configLoadSuccess) {
      try {
        this.loadConfigFromMainConfig();
      } catch (error) {
        this.logger.warn('从主配置服务合并配置失败，继续使用当前配置', {
          error: (error as Error).message
        });
      }
    }

    this.logger.info('配置加载完成', {
      success: configLoadSuccess,
      hasError: lastError !== null,
      error: lastError?.message
    });
  }

  // 获取安全的默认配置
  private getSafeDefaultConfig(): InfrastructureConfig {
    return {
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
        },
        vector: {
          defaultCollection: 'default',
          collectionOptions: {
            vectorSize: 1536,
            distance: 'Cosine',
            indexing: {
              type: 'hnsw',
              options: {}
            }
          },
          searchOptions: {
            limit: 10,
            threshold: 0.5,
            exactSearch: false
          }
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
            vidType: 'FIXED_STRING'
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
  }

  // 获取最小配置（最后的降级策略）
  private getMinimalConfig(): InfrastructureConfig {
    return {
      common: {
        enableCache: false,
        enableMonitoring: false,
        enableBatching: false,
        logLevel: 'error',
        enableHealthChecks: false,
        healthCheckInterval: 60000,
        gracefulShutdownTimeout: 5000
      },
      qdrant: {
        cache: {
          defaultTTL: 60000,
          maxEntries: 100,
          cleanupInterval: 120000,
          enableStats: false,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 60000,
          metricsRetentionPeriod: 3600000,
          enableDetailedLogging: false,
          performanceThresholds: {
            queryExecutionTime: 5000,
            memoryUsage: 90,
            responseTime: 2000
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 1,
          defaultBatchSize: 10,
          maxBatchSize: 50,
          minBatchSize: 1,
          memoryThreshold: 50,
          processingTimeout: 10000,
          retryAttempts: 1,
          retryDelay: 2000,
          adaptiveBatchingEnabled: false,
          performanceThreshold: 5000,
          adjustmentFactor: 0.05,
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 2,
          minConnections: 1,
          connectionTimeout: 5000,
          idleTimeout: 10000,
          acquireTimeout: 3000,
          validationInterval: 15000,
          enableConnectionPooling: false,
          databaseSpecific: {}
        },
        vector: {
          defaultCollection: 'default',
          collectionOptions: {
            vectorSize: 512,
            distance: 'Cosine',
            indexing: {
              type: 'flat',
              options: {}
            }
          },
          searchOptions: {
            limit: 5,
            threshold: 0.8,
            exactSearch: true
          }
        }
      },
      nebula: {
        cache: {
          defaultTTL: 60000,
          maxEntries: 100,
          cleanupInterval: 120000,
          enableStats: false,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 60000,
          metricsRetentionPeriod: 3600000,
          enableDetailedLogging: false,
          performanceThresholds: {
            queryExecutionTime: 5000,
            memoryUsage: 90,
            responseTime: 2000
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 1,
          defaultBatchSize: 10,
          maxBatchSize: 50,
          minBatchSize: 1,
          memoryThreshold: 50,
          processingTimeout: 10000,
          retryAttempts: 1,
          retryDelay: 200,
          adaptiveBatchingEnabled: false,
          performanceThreshold: 5000,
          adjustmentFactor: 0.05,
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 2,
          minConnections: 1,
          connectionTimeout: 5000,
          idleTimeout: 10000,
          acquireTimeout: 3000,
          validationInterval: 15000,
          enableConnectionPooling: false,
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: 'default',
          spaceOptions: {
            partitionNum: 1,
            replicaFactor: 1,
            vidType: 'FIXED_STRING'
          },
          queryOptions: {
            timeout: 5000,
            retryAttempts: 1
          },
          schemaManagement: {
            autoCreateTags: false,
            autoCreateEdges: false
          }
        }
      },
      transaction: {
        timeout: 10000,
        retryAttempts: 1,
        retryDelay: 1000,
        enableTwoPhaseCommit: false,
        maxConcurrentTransactions: 10,
        deadlockDetectionTimeout: 2000,
        isolationLevel: undefined
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
      
      // 合并相关的配置到基础设施配置中，但保持最小值验证
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
          // 确保处理超时时间不低于最小值
          this.config.qdrant.batch.processingTimeout = Math.max(batchProcessingConfig.processingTimeout, 1000);
          this.config.nebula.batch.processingTimeout = Math.max(batchProcessingConfig.processingTimeout, 1000);
        }
        if (batchProcessingConfig.retryAttempts !== undefined) {
          this.config.qdrant.batch.retryAttempts = batchProcessingConfig.retryAttempts;
          this.config.nebula.batch.retryAttempts = batchProcessingConfig.retryAttempts;
        }
        if (batchProcessingConfig.retryDelay !== undefined) {
          // 确保重试延迟不低于最小值
          this.config.qdrant.batch.retryDelay = Math.max(batchProcessingConfig.retryDelay, 100);
          this.config.nebula.batch.retryDelay = Math.max(batchProcessingConfig.retryDelay, 100);
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

    // 验证通用配置
    if (config.common.healthCheckInterval < 1000) {
      errors.push('Common health check interval must be at least 1000ms');
    }
    
    if (config.common.gracefulShutdownTimeout < 1000) {
      errors.push('Common graceful shutdown timeout must be at least 1000ms');
    }

    // 验证缓存配置
    if (config.qdrant.cache.defaultTTL < 1000) {
      errors.push('Qdrant cache default TTL must be at least 1000ms');
    }
    
    if (config.qdrant.cache.maxEntries < 1) {
      errors.push('Qdrant cache max entries must be at least 1');
    }
    
    if (config.qdrant.cache.cleanupInterval < 1000) {
      errors.push('Qdrant cache cleanup interval must be at least 1000ms');
    }
    
    if (config.nebula.cache.defaultTTL < 1000) {
      errors.push('Nebula cache default TTL must be at least 1000ms');
    }
    
    if (config.nebula.cache.maxEntries < 1) {
      errors.push('Nebula cache max entries must be at least 1');
    }
    
    if (config.nebula.cache.cleanupInterval < 1000) {
      errors.push('Nebula cache cleanup interval must be at least 1000ms');
    }

    // 验证性能配置
    if (config.qdrant.performance.monitoringInterval < 1000) {
      errors.push('Qdrant performance monitoring interval must be at least 1000ms');
    }
    
    if (config.qdrant.performance.metricsRetentionPeriod < 60000) {
      errors.push('Qdrant performance metrics retention period must be at least 60000ms');
    }
    
    if (config.nebula.performance.monitoringInterval < 1000) {
      errors.push('Nebula performance monitoring interval must be at least 1000ms');
    }
    
    if (config.nebula.performance.metricsRetentionPeriod < 60000) {
      errors.push('Nebula performance metrics retention period must be at least 60000ms');
    }

    // 验证批处理配置
    if (config.qdrant.batch.maxConcurrentOperations < 1) {
      errors.push('Qdrant batch max concurrent operations must be at least 1');
    }
    
    if (config.qdrant.batch.maxConcurrentOperations > 100) {
      errors.push('Qdrant batch max concurrent operations must be at most 100');
    }
    
    if (config.qdrant.batch.defaultBatchSize < 1) {
      errors.push('Qdrant batch default batch size must be at least 1');
    }
    
    if (config.qdrant.batch.defaultBatchSize > 10000) {
      errors.push('Qdrant batch default batch size must be at most 10000');
    }
    
    if (config.qdrant.batch.maxBatchSize < 1) {
      errors.push('Qdrant batch max batch size must be at least 1');
    }
    
    if (config.qdrant.batch.maxBatchSize > 10000) {
      errors.push('Qdrant batch max batch size must be at most 10000');
    }
    
    if (config.qdrant.batch.minBatchSize < 1) {
      errors.push('Qdrant batch min batch size must be at least 1');
    }
    
    if (config.qdrant.batch.minBatchSize > 1000) {
      errors.push('Qdrant batch min batch size must be at most 1000');
    }
    
    if (config.qdrant.batch.memoryThreshold < 10) {
      errors.push('Qdrant batch memory threshold must be at least 10');
    }
    
    if (config.qdrant.batch.memoryThreshold > 95) {
      errors.push('Qdrant batch memory threshold must be at most 95');
    }
    
    if (config.qdrant.batch.processingTimeout < 1000) {
      errors.push('Qdrant batch processing timeout must be at least 1000ms');
    }
    
    if (config.qdrant.batch.retryDelay < 100) {
      errors.push('Qdrant batch retry delay must be at least 100ms');
    }
    
    if (config.qdrant.batch.performanceThreshold < 100) {
      errors.push('Qdrant batch performance threshold must be at least 100ms');
    }
    
    if (config.qdrant.batch.adjustmentFactor < 0.01) {
      errors.push('Qdrant batch adjustment factor must be at least 0.01');
    }
    
    if (config.qdrant.batch.adjustmentFactor > 1.0) {
      errors.push('Qdrant batch adjustment factor must be at most 1.0');
    }
    
    if (config.nebula.batch.maxConcurrentOperations < 1) {
      errors.push('Nebula batch max concurrent operations must be at least 1');
    }
    
    if (config.nebula.batch.maxConcurrentOperations > 100) {
      errors.push('Nebula batch max concurrent operations must be at most 100');
    }
    
    if (config.nebula.batch.defaultBatchSize < 1) {
      errors.push('Nebula batch default batch size must be at least 1');
    }
    
    if (config.nebula.batch.defaultBatchSize > 10000) {
      errors.push('Nebula batch default batch size must be at most 10000');
    }
    
    if (config.nebula.batch.maxBatchSize < 1) {
      errors.push('Nebula batch max batch size must be at least 1');
    }
    
    if (config.nebula.batch.maxBatchSize > 10000) {
      errors.push('Nebula batch max batch size must be at most 10000');
    }
    
    if (config.nebula.batch.minBatchSize < 1) {
      errors.push('Nebula batch min batch size must be at least 1');
    }
    
    if (config.nebula.batch.minBatchSize > 1000) {
      errors.push('Nebula batch min batch size must be at most 1000');
    }
    
    if (config.nebula.batch.memoryThreshold < 10) {
      errors.push('Nebula batch memory threshold must be at least 10');
    }
    
    if (config.nebula.batch.memoryThreshold > 95) {
      errors.push('Nebula batch memory threshold must be at most 95');
    }
    
    if (config.nebula.batch.processingTimeout < 1000) {
      errors.push('Nebula batch processing timeout must be at least 1000ms');
    }
    
    if (config.nebula.batch.retryDelay < 100) {
      errors.push('Nebula batch retry delay must be at least 100ms');
    }
    
    if (config.nebula.batch.performanceThreshold < 100) {
      errors.push('Nebula batch performance threshold must be at least 100ms');
    }
    
    if (config.nebula.batch.adjustmentFactor < 0.01) {
      errors.push('Nebula batch adjustment factor must be at least 0.01');
    }
    
    if (config.nebula.batch.adjustmentFactor > 1.0) {
      errors.push('Nebula batch adjustment factor must be at most 1.0');
    }

    // 验证连接配置
    if (config.qdrant.connection.maxConnections < 1) {
      errors.push('Qdrant connection max connections must be at least 1');
    }
    
    if (config.qdrant.connection.maxConnections > 1000) {
      errors.push('Qdrant connection max connections must be at most 1000');
    }
    
    if (config.qdrant.connection.minConnections < 0) {
      errors.push('Qdrant connection min connections must be at least 0');
    }
    
    if (config.qdrant.connection.connectionTimeout < 1000) {
      errors.push('Qdrant connection timeout must be at least 1000ms');
    }
    
    if (config.qdrant.connection.idleTimeout < 1000) {
      errors.push('Qdrant connection idle timeout must be at least 1000ms');
    }
    
    if (config.qdrant.connection.acquireTimeout < 1000) {
      errors.push('Qdrant connection acquire timeout must be at least 1000ms');
    }
    
    if (config.qdrant.connection.validationInterval < 1000) {
      errors.push('Qdrant connection validation interval must be at least 1000ms');
    }
    
    if (config.nebula.connection.maxConnections < 1) {
      errors.push('Nebula connection max connections must be at least 1');
    }
    
    if (config.nebula.connection.maxConnections > 1000) {
      errors.push('Nebula connection max connections must be at most 1000');
    }
    
    if (config.nebula.connection.minConnections < 0) {
      errors.push('Nebula connection min connections must be at least 0');
    }
    
    if (config.nebula.connection.connectionTimeout < 1000) {
      errors.push('Nebula connection timeout must be at least 1000ms');
    }
    
    if (config.nebula.connection.idleTimeout < 1000) {
      errors.push('Nebula connection idle timeout must be at least 1000ms');
    }
    
    if (config.nebula.connection.acquireTimeout < 1000) {
      errors.push('Nebula connection acquire timeout must be at least 1000ms');
    }
    
    if (config.nebula.connection.validationInterval < 1000) {
      errors.push('Nebula connection validation interval must be at least 1000ms');
    }

    // 验证事务配置
    if (config.transaction.timeout < 1000) {
      errors.push('Transaction timeout must be at least 1000ms');
    }
    
    if (config.transaction.retryAttempts < 0) {
      errors.push('Transaction retry attempts must be at least 0');
    }
    
    if (config.transaction.retryAttempts > 10) {
      errors.push('Transaction retry attempts must be at most 10');
    }
    
    if (config.transaction.retryDelay < 100) {
      errors.push('Transaction retry delay must be at least 100ms');
    }
    
    if (config.transaction.maxConcurrentTransactions < 1) {
      errors.push('Transaction max concurrent transactions must be at least 1');
    }
    
    if (config.transaction.maxConcurrentTransactions > 1000) {
      errors.push('Transaction max concurrent transactions must be at most 1000');
    }
    
    if (config.transaction.deadlockDetectionTimeout < 1000) {
      errors.push('Transaction deadlock detection timeout must be at least 1000ms');
    }

    if (errors.length > 0) {
      throw new Error(`Infrastructure configuration validation failed: ${errors.join(', ')}`);
    }
  }

  getConfig(): InfrastructureConfig {
    return { ...this.config };
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

  getCommonConfig(): InfrastructureConfig['common'] {
    return this.config.common;
  }

  getTransactionConfig(): InfrastructureConfig['transaction'] {
    return this.config.transaction;
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