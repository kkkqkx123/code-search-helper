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
        // 仅保留基础设施特有的配置（graph），数据库配置由 NebulaConfigService 管理
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

      // 注意: 批处理配置现在由 QdrantConfigService 和 NebulaConfigService 管理
      // 这里不再处理批处理相关的配置


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