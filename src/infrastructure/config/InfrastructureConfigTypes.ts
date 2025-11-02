import { CommonConfig, TransactionConfig } from './types';

/**
 * 基础设施配置接口
 * 使用提取的公共配置接口来减少重复
 */
export interface InfrastructureConfig {
  // 通用配置
  common: CommonConfig;
  
  // Qdrant特定配置，使用新的接口
  qdrant: {
    cache: {
      defaultTTL: number;
      maxEntries: number;
      cleanupInterval: number;
      enableStats: boolean;
      databaseSpecific: {
        [key: string]: any;
      };
    };
    performance: {
      monitoringInterval: number;
      metricsRetentionPeriod: number;
      enableDetailedLogging: boolean;
      performanceThresholds: {
        queryExecutionTime: number;
        memoryUsage: number;
        responseTime: number;
      };
      databaseSpecific: {
        [key: string]: any;
      };
    };
    batch: {
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
      databaseSpecific: {
        [key: string]: any;
      };
    };
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
  
  // Nebula特定配置，使用新的接口
  nebula: {
    cache: {
      defaultTTL: number;
      maxEntries: number;
      cleanupInterval: number;
      enableStats: boolean;
      databaseSpecific: {
        [key: string]: any;
      };
    };
    performance: {
      monitoringInterval: number;
      metricsRetentionPeriod: number;
      enableDetailedLogging: boolean;
      performanceThresholds: {
        queryExecutionTime: number;
        memoryUsage: number;
        responseTime: number;
      };
      databaseSpecific: {
        [key: string]: any;
      };
    };
    batch: {
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
      databaseSpecific: {
        [key: string]: any;
      };
    };
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
  };
  
  // 事务配置
  transaction: TransactionConfig;
}