import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseType } from '../types';
import { ConfigValidationUtil } from './ConfigValidator';
import { BaseConfigTemplate } from './BaseServiceConfig';
import { EnvVarOptimizer } from './EnvVarOptimizer';
import { CommonConfig, TransactionConfig } from './types';
import { InfrastructureConfig } from './InfrastructureConfigTypes';

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
    // 在加载配置时检查是否有使用旧的环境变量命名
    const legacyVars = EnvVarOptimizer.checkForLegacyEnvVars();
    if (legacyVars.length > 0) {
      this.logger.warn('Detected usage of legacy environment variable names. Consider updating to new standardized names.', {
        legacyVars
      });
    }

    return {
      common: {
        enableCache: EnvVarOptimizer.getEnvBooleanValue('INFRA_COMMON_ENABLE_CACHE', true),
        enableMonitoring: EnvVarOptimizer.getEnvBooleanValue('INFRA_COMMON_ENABLE_MONITORING', true),
        enableBatching: EnvVarOptimizer.getEnvBooleanValue('INFRA_COMMON_ENABLE_BATCHING', true),
        logLevel: (EnvVarOptimizer.getEnvValue('INFRA_COMMON_LOG_LEVEL') as any) || 'info',
        enableHealthChecks: EnvVarOptimizer.getEnvBooleanValue('INFRA_COMMON_ENABLE_HEALTH_CHECKS', true),
        healthCheckInterval: EnvVarOptimizer.getEnvNumberValue('INFRA_COMMON_HEALTH_CHECK_INTERVAL', 3000),
        gracefulShutdownTimeout: EnvVarOptimizer.getEnvNumberValue('INFRA_COMMON_GRACEFUL_SHUTDOWN_TIMEOUT', 10000)
      },
      qdrant: {
        cache: {
          defaultTTL: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_CACHE_DEFAULT_TTL', 30000),
          maxEntries: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_CACHE_MAX_ENTRIES', 10000),
          cleanupInterval: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_CACHE_CLEANUP_INTERVAL', 60000),
          enableStats: EnvVarOptimizer.getEnvBooleanValue('INFRA_QDRANT_CACHE_ENABLE_STATS', true),
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_MONITORING_INTERVAL', 1000),  // 设置为最低允许值
          metricsRetentionPeriod: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_METRICS_RETENTION_PERIOD', 8640000),
          enableDetailedLogging: EnvVarOptimizer.getEnvBooleanValue('INFRA_QDRANT_PERFORMANCE_ENABLE_DETAILED_LOGGING', true),
          performanceThresholds: {
            queryExecutionTime: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_QUERY_EXECUTION_TIME', 1000),
            memoryUsage: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_MEMORY_USAGE', 80),
            responseTime: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_RESPONSE_TIME', 50)
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_MAX_CONCURRENT_OPERATIONS', 5),
          defaultBatchSize: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_DEFAULT_BATCH_SIZE', 50),
          maxBatchSize: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_MAX_BATCH_SIZE', 500),
          minBatchSize: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_MIN_BATCH_SIZE', 10),
          memoryThreshold: EnvVarOptimizer.getEnvFloatValue('INFRA_QDRANT_BATCH_MEMORY_THRESHOLD', 0.80),
          processingTimeout: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_PROCESSING_TIMEOUT', 3000),
          retryAttempts: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_RETRY_ATTEMPTS', 3),
          retryDelay: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_RETRY_DELAY', 1000),
          adaptiveBatchingEnabled: EnvVarOptimizer.getEnvBooleanValue('INFRA_QDRANT_BATCH_ADAPTIVE_BATCHING_ENABLED', true),
          performanceThreshold: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_BATCH_PERFORMANCE_THRESHOLD', 1000),
          adjustmentFactor: EnvVarOptimizer.getEnvFloatValue('INFRA_QDRANT_BATCH_ADJUSTMENT_FACTOR', 0.1),
          databaseSpecific: {}
        },
        vector: {
          defaultCollection: EnvVarOptimizer.getEnvValue('INFRA_QDRANT_VECTOR_DEFAULT_COLLECTION') || 'default',
          collectionOptions: {
            vectorSize: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_VECTOR_COLLECTION_VECTOR_SIZE', 1536),
            distance: (EnvVarOptimizer.getEnvValue('INFRA_QDRANT_VECTOR_COLLECTION_DISTANCE') as any) || 'Cosine',
            indexing: {
              type: EnvVarOptimizer.getEnvValue('INFRA_QDRANT_VECTOR_COLLECTION_INDEXING_TYPE') || 'hnsw',
              options: {}
            }
          },
          searchOptions: {
            limit: EnvVarOptimizer.getEnvNumberValue('INFRA_QDRANT_VECTOR_SEARCH_LIMIT', 10),
            threshold: EnvVarOptimizer.getEnvFloatValue('INFRA_QDRANT_VECTOR_SEARCH_THRESHOLD', 0.5),
            exactSearch: EnvVarOptimizer.getEnvBooleanValue('INFRA_QDRANT_VECTOR_SEARCH_EXACT_SEARCH', false)
          }
        }
      },
      nebula: {
        cache: {
          defaultTTL: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_CACHE_DEFAULT_TTL', 30000),
          maxEntries: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_CACHE_MAX_ENTRIES', 10000),
          cleanupInterval: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_CACHE_CLEANUP_INTERVAL', 60000),
          enableStats: EnvVarOptimizer.getEnvBooleanValue('INFRA_NEBULA_CACHE_ENABLE_STATS', true),
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_MONITORING_INTERVAL', 1000),  // 设置为最低允许值
          metricsRetentionPeriod: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_METRICS_RETENTION_PERIOD', 8640000),
          enableDetailedLogging: EnvVarOptimizer.getEnvBooleanValue('INFRA_NEBULA_PERFORMANCE_ENABLE_DETAILED_LOGGING', true),
          performanceThresholds: {
            queryExecutionTime: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_QUERY_EXECUTION_TIME', 1000),
            memoryUsage: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_MEMORY_USAGE', 80),
            responseTime: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_RESPONSE_TIME', 500)
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_MAX_CONCURRENT_OPERATIONS', 5),
          defaultBatchSize: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_DEFAULT_BATCH_SIZE', 50),
          maxBatchSize: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_MAX_BATCH_SIZE', 500),
          minBatchSize: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_MIN_BATCH_SIZE', 10),
          memoryThreshold: EnvVarOptimizer.getEnvFloatValue('INFRA_NEBULA_BATCH_MEMORY_THRESHOLD', 0.80),
          processingTimeout: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_PROCESSING_TIMEOUT', 300000),
          retryAttempts: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_RETRY_ATTEMPTS', 3),
          retryDelay: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_RETRY_DELAY', 100),
          adaptiveBatchingEnabled: EnvVarOptimizer.getEnvBooleanValue('INFRA_NEBULA_BATCH_ADAPTIVE_BATCHING_ENABLED', true),
          performanceThreshold: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_BATCH_PERFORMANCE_THRESHOLD', 1000),
          adjustmentFactor: EnvVarOptimizer.getEnvFloatValue('INFRA_NEBULA_BATCH_ADJUSTMENT_FACTOR', 0.1),
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: EnvVarOptimizer.getEnvValue('INFRA_NEBULA_GRAPH_DEFAULT_SPACE') || 'default',
          spaceOptions: {
            partitionNum: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_GRAPH_SPACE_PARTITION_NUM', 10),
            replicaFactor: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_GRAPH_SPACE_REPLICA_FACTOR', 1),
            vidType: (EnvVarOptimizer.getEnvValue('INFRA_NEBULA_GRAPH_SPACE_VID_TYPE') as any) || 'FIXED_STRING'
          },
          queryOptions: {
            timeout: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_GRAPH_QUERY_TIMEOUT', 30000),
            retryAttempts: EnvVarOptimizer.getEnvNumberValue('INFRA_NEBULA_GRAPH_QUERY_RETRY_ATTEMPTS', 3)
          },
          schemaManagement: {
            autoCreateTags: EnvVarOptimizer.getEnvBooleanValue('INFRA_NEBULA_GRAPH_SCHEMA_AUTO_CREATE_TAGS', false),
            autoCreateEdges: EnvVarOptimizer.getEnvBooleanValue('INFRA_NEBULA_GRAPH_SCHEMA_AUTO_CREATE_EDGES', false)
          }
        }
      },
      transaction: {
        timeout: EnvVarOptimizer.getEnvNumberValue('INFRA_TRANSACTION_TIMEOUT', 30000),
        retryAttempts: EnvVarOptimizer.getEnvNumberValue('INFRA_TRANSACTION_RETRY_ATTEMPTS', 3),
        retryDelay: EnvVarOptimizer.getEnvNumberValue('INFRA_TRANSACTION_RETRY_DELAY', 100),
        enableTwoPhaseCommit: EnvVarOptimizer.getEnvBooleanValue('INFRA_TRANSACTION_ENABLE_TWO_PHASE_COMMIT', true),
        maxConcurrentTransactions: EnvVarOptimizer.getEnvNumberValue('INFRA_TRANSACTION_MAX_CONCURRENT_TRANSACTIONS', 100),
        deadlockDetectionTimeout: EnvVarOptimizer.getEnvNumberValue('INFRA_TRANSACTION_DEADLOCK_DETECTION_TIMEOUT', 1000),  // 设置为最低允许值
        isolationLevel: (EnvVarOptimizer.getEnvValue('INFRA_TRANSACTION_ISOLATION_LEVEL') as any) || undefined
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
      ConfigValidationUtil.validateAndThrow(this.config);  // 使用新的验证工具
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
        ConfigValidationUtil.validateAndThrow(this.config);  // 使用新的验证工具
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
        ConfigValidationUtil.validateAndThrow(this.config);  // 使用新的验证工具
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
    ConfigValidationUtil.validateAndThrow(config);
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
    return ConfigValidationUtil.validateAndLog(this.config, this.logger);
  }
  
}