import { DatabaseType } from '../types';

/**
 * 基础缓存配置接口
 */
export interface BaseCacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  enableStats: boolean;
}

/**
 * 基础性能配置接口
 */
export interface BasePerformanceConfig {
  monitoringInterval: number;
  metricsRetentionPeriod: number;
  enableDetailedLogging: boolean;
  performanceThresholds: {
    queryExecutionTime: number;
    memoryUsage: number;
    responseTime: number;
  };
}

/**
 * 基础批处理配置接口
 */
export interface BaseBatchConfig {
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveBatchingEnabled: boolean;
  performanceThreshold: number;
  adjustmentFactor: number;
}


/**
 * 基础服务配置接口
 * 包含所有服务的通用配置部分
 */
export interface BaseServiceConfig {
  cache: BaseCacheConfig;
  performance: BasePerformanceConfig;
  batch: BaseBatchConfig;
}

/**
 * Qdrant特定配置接口
 * 继承基础配置并添加Qdrant特有配置
 */
export interface QdrantConfig extends BaseServiceConfig {
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
}

/**
 * Nebula特定配置接口
 * 继承基础配置并添加Nebula特有配置
 */
export interface NebulaConfig extends BaseServiceConfig {
  graph: {
    defaultSpace?: string;
    spaceOptions?: {
      partitionNum?: number;
      replicaFactor?: number;
      vidType?: 'FIXED_STRING' | 'INT64';
    };
    queryOptions?: {
      timeout?: number;
      retryAttempts?: number;
    };
    schemaManagement?: {
      autoCreateTags?: boolean;
      autoCreateEdges?: boolean;
    };
  };
}

/**
 * 配置工厂接口
 * 用于创建标准化的配置对象
 */
export interface ConfigFactory<T> {
  createDefaults(): T;
  createFromEnv(prefix: string): T;
  validate(config: T): boolean;
}

/**
 * 基础配置模板
 * 提供标准化的默认配置值
 */
export class BaseConfigTemplate {
  /**
   * 获取基础缓存配置默认值
   */
  static getCacheDefaults(): BaseCacheConfig {
    return {
      defaultTTL: 30000,
      maxEntries: 10000,
      cleanupInterval: 60000,
      enableStats: true
    };
  }

  /**
   * 获取基础性能配置默认值
   */
  static getPerformanceDefaults(): BasePerformanceConfig {
    return {
      monitoringInterval: 30000,
      metricsRetentionPeriod: 86400000,
      enableDetailedLogging: false,
      performanceThresholds: {
        queryExecutionTime: 1000,
        memoryUsage: 80,
        responseTime: 500
      }
    };
  }

  /**
   * 获取基础批处理配置默认值
   */
  static getBatchDefaults(): BaseBatchConfig {
    return {
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      minBatchSize: 10,
      memoryThreshold: 80,
      processingTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      adaptiveBatchingEnabled: true,
      performanceThreshold: 1000,
      adjustmentFactor: 0.1
    };
  }

  /**
   * 获取完整的基础服务配置默认值
   */
  static getServiceDefaults(): BaseServiceConfig {
    return {
      cache: this.getCacheDefaults(),
      performance: this.getPerformanceDefaults(),
      batch: this.getBatchDefaults()
    };
  }
}