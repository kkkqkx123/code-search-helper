import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseType } from '../types';
import { ConfigValidationUtil } from './ConfigValidator';
import { InfrastructureConfig } from './InfrastructureConfigTypes';

/**
 * 环境变量工具函数
 */
class EnvUtils {
  static getEnvValue(key: string): string | undefined {
    return process.env[key];
  }

  static getEnvValueWithDefault(key: string, defaultValue: string): string {
    const value = this.getEnvValue(key);
    return value !== undefined ? value : defaultValue;
  }

  static getEnvNumberValue(key: string, defaultValue: number): number {
    const value = this.getEnvValue(key);
    if (value === undefined) {
      return defaultValue;
    }
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }

  static getEnvBooleanValue(key: string, defaultValue: boolean): boolean {
    const value = this.getEnvValue(key);
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() !== 'false';
  }

  static getEnvFloatValue(key: string, defaultValue: number): number {
    const value = this.getEnvValue(key);
    if (value === undefined) {
      return defaultValue;
    }
    const parsedValue = parseFloat(value);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }
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
        enableCache: EnvUtils.getEnvBooleanValue('INFRA_CACHE_ENABLED', true),
        enableMonitoring: EnvUtils.getEnvBooleanValue('INFRA_MONITORING_ENABLED', true),
        enableBatching: EnvUtils.getEnvBooleanValue('INFRA_BATCHING_ENABLED', true),
        logLevel: (EnvUtils.getEnvValue('INFRA_LOG_LEVEL') as any) || 'info',
        enableHealthChecks: EnvUtils.getEnvBooleanValue('INFRA_HEALTH_CHECKS_ENABLED', true),
        healthCheckInterval: EnvUtils.getEnvNumberValue('INFRA_HEALTH_CHECK_INTERVAL', 30000),
        gracefulShutdownTimeout: EnvUtils.getEnvNumberValue('INFRA_SHUTDOWN_TIMEOUT', 10000)
      },
      qdrant: {
        cache: {
          defaultTTL: EnvUtils.getEnvNumberValue('INFRA_QDRANT_CACHE_TTL', 30000),
          maxEntries: EnvUtils.getEnvNumberValue('INFRA_QDRANT_CACHE_MAX_ENTRIES', 10000),
          cleanupInterval: EnvUtils.getEnvNumberValue('INFRA_QDRANT_CACHE_CLEANUP_INTERVAL', 60000),
          enableStats: EnvUtils.getEnvBooleanValue('INFRA_QDRANT_CACHE_STATS_ENABLED', true),
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: EnvUtils.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_INTERVAL', 30000),
          metricsRetentionPeriod: EnvUtils.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_RETENTION', 86400000),
          enableDetailedLogging: EnvUtils.getEnvBooleanValue('INFRA_QDRANT_PERFORMANCE_LOGGING_ENABLED', true),
          performanceThresholds: {
            queryExecutionTime: EnvUtils.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_QUERY_TIMEOUT', 5000),
            memoryUsage: EnvUtils.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_MEMORY_THRESHOLD', 80),
            responseTime: EnvUtils.getEnvNumberValue('INFRA_QDRANT_PERFORMANCE_RESPONSE_THRESHOLD', 500)
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_CONCURRENCY', 5),
          defaultBatchSize: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_SIZE_DEFAULT', 50),
          maxBatchSize: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_SIZE_MAX', 500),
          minBatchSize: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_SIZE_MIN', 10),
          memoryThreshold: EnvUtils.getEnvFloatValue('INFRA_QDRANT_BATCH_MEMORY_THRESHOLD', 0.80),
          processingTimeout: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_PROCESSING_TIMEOUT', 3000),
          retryAttempts: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_RETRY_ATTEMPTS', 3),
          retryDelay: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_RETRY_DELAY', 1000),
          adaptiveBatchingEnabled: EnvUtils.getEnvBooleanValue('INFRA_QDRANT_BATCH_ADAPTIVE_ENABLED', true),
          performanceThreshold: EnvUtils.getEnvNumberValue('INFRA_QDRANT_BATCH_PERFORMANCE_THRESHOLD', 1000),
          adjustmentFactor: EnvUtils.getEnvFloatValue('INFRA_QDRANT_BATCH_ADJUSTMENT_FACTOR', 0.1),
          databaseSpecific: {}
        },
        vector: {
          defaultCollection: EnvUtils.getEnvValue('INFRA_QDRANT_VECTOR_COLLECTION_DEFAULT') || 'default',
          collectionOptions: {
            vectorSize: EnvUtils.getEnvNumberValue('INFRA_QDRANT_VECTOR_SIZE', 1536),
            distance: (EnvUtils.getEnvValue('INFRA_QDRANT_VECTOR_DISTANCE') as any) || 'Cosine',
            indexing: {
              type: EnvUtils.getEnvValue('INFRA_QDRANT_VECTOR_INDEX_TYPE') || 'hnsw',
              options: {}
            }
          },
          searchOptions: {
            limit: EnvUtils.getEnvNumberValue('INFRA_QDRANT_VECTOR_SEARCH_LIMIT', 10),
            threshold: EnvUtils.getEnvFloatValue('INFRA_QDRANT_VECTOR_SEARCH_THRESHOLD', 0.5),
            exactSearch: EnvUtils.getEnvBooleanValue('INFRA_QDRANT_VECTOR_SEARCH_EXACT_ENABLED', false)
          }
        }
      },
      nebula: {
        cache: {
          defaultTTL: EnvUtils.getEnvNumberValue('INFRA_NEBULA_CACHE_TTL', 30000),
          maxEntries: EnvUtils.getEnvNumberValue('INFRA_NEBULA_CACHE_MAX_ENTRIES', 10000),
          cleanupInterval: EnvUtils.getEnvNumberValue('INFRA_NEBULA_CACHE_CLEANUP_INTERVAL', 60000),
          enableStats: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_CACHE_STATS_ENABLED', true),
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_INTERVAL', 1000),
          metricsRetentionPeriod: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_RETENTION', 8640000),
          enableDetailedLogging: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_PERFORMANCE_LOGGING_ENABLED', true),
          performanceThresholds: {
            queryExecutionTime: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_QUERY_TIMEOUT', 1000),
            memoryUsage: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_MEMORY_THRESHOLD', 80),
            responseTime: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_RESPONSE_THRESHOLD', 500)
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_CONCURRENCY', 5),
          defaultBatchSize: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_SIZE_DEFAULT', 50),
          maxBatchSize: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_SIZE_MAX', 500),
          minBatchSize: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_SIZE_MIN', 10),
          memoryThreshold: EnvUtils.getEnvFloatValue('INFRA_NEBULA_BATCH_MEMORY_THRESHOLD', 0.80),
          processingTimeout: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_PROCESSING_TIMEOUT', 300000),
          retryAttempts: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_RETRY_ATTEMPTS', 3),
          retryDelay: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_RETRY_DELAY', 100),
          adaptiveBatchingEnabled: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_BATCH_ADAPTIVE_ENABLED', true),
          performanceThreshold: EnvUtils.getEnvNumberValue('INFRA_NEBULA_BATCH_PERFORMANCE_THRESHOLD', 1000),
          adjustmentFactor: EnvUtils.getEnvFloatValue('INFRA_NEBULA_BATCH_ADJUSTMENT_FACTOR', 0.1),
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: EnvUtils.getEnvValue('INFRA_NEBULA_GRAPH_SPACE_DEFAULT') || 'default',
          spaceOptions: {
            partitionNum: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_PARTITION_COUNT', 10),
            replicaFactor: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_REPLICA_FACTOR', 1),
            vidType: (EnvUtils.getEnvValue('INFRA_NEBULA_GRAPH_VID_TYPE') as any) || 'FIXED_STRING'
          },
          queryOptions: {
            timeout: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_QUERY_TIMEOUT', 30000),
            retryAttempts: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_QUERY_RETRIES', 3)
          },
          schemaManagement: {
            autoCreateTags: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_GRAPH_SCHEMA_TAGS_AUTO', false),
            autoCreateEdges: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_GRAPH_SCHEMA_EDGES_AUTO', false)
          }
        }
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
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 5000,
            memoryUsage: 80,
            responseTime: 2000
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 3,
          defaultBatchSize: 25,
          maxBatchSize: 100,
          minBatchSize: 5,
          memoryThreshold: 0.70,
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
          memoryThreshold: 0.70,
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
          memoryThreshold: 0.50,
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
          memoryThreshold: 0.50,
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

  validateConfig(): boolean {
    return ConfigValidationUtil.validateAndLog(this.config, this.logger);
  }

  /**
   * 验证图配置
   */
  validateGraphConfiguration(): void {
    const nebulaConfig = this.getDatabaseConfig(DatabaseType.NEBULA);

    if (!this.isGraphEnabled()) {
      throw new Error('Graph indexing is disabled via NEBULA_ENABLED environment variable');
    }

    // 验证必要的图配置
    if (!nebulaConfig.graph) {
      throw new Error('Graph configuration is missing');
    }
  }

  /**
   * 检查图是否启用
   */
  isGraphEnabled(): boolean {
    return process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
  }

  /**
   * 获取图配置
   */
  getGraphConfiguration(): any {
    return this.getDatabaseConfig(DatabaseType.NEBULA).graph;
  }

}