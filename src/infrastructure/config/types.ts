import { DatabaseType } from '../types';

// 缓存配置
export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  enableStats: boolean;
  databaseSpecific: {
    [key in DatabaseType]?: {
      defaultTTL: number;
      maxEntries: number;
    };
  };
}

// 性能监控配置
export interface PerformanceConfig {
  monitoringInterval: number;
  metricsRetentionPeriod: number;
  enableDetailedLogging: boolean;
  performanceThresholds: {
    queryExecutionTime: number;
    memoryUsage: number;
    responseTime: number;
  };
  databaseSpecific: {
    [key in DatabaseType]?: {
      monitoringInterval: number;
      performanceThresholds: {
        [operation: string]: number;
      };
    };
  };
}

// 批处理配置
export interface BatchConfig {
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
    [key in DatabaseType]?: {
      defaultBatchSize: number;
      maxBatchSize: number;
      minBatchSize: number;
    };
  };
}

// 连接配置
export interface ConnectionConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  acquireTimeout: number;
  validationInterval: number;
  enableConnectionPooling: boolean;
  databaseSpecific: {
    [key in DatabaseType]?: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      ssl?: boolean;
      additionalOptions?: Record<string, any>;
    };
  };
}

// 图数据库特定配置
export interface GraphSpecificConfig {
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
}

// 向量数据库特定配置
export interface VectorSpecificConfig {
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
}

// SQLite特定配置
export interface SqliteSpecificConfig {
  databasePath: string;
  backupPath?: string;
  backupInterval?: number;
  maxConnections?: number;
  queryTimeout?: number;
  journalMode?: 'WAL' | 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'OFF';
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  cacheSize?: number;
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY';
  autoVacuum?: 'NONE' | 'FULL' | 'INCREMENTAL';
  busyTimeout?: number;
}

// 数据库特定配置
export interface DatabaseSpecificConfig {
  qdrant: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    vector?: VectorSpecificConfig;
  };
  nebula: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    graph: GraphSpecificConfig;
  };
  vector?: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    vector?: VectorSpecificConfig;
  };
  graph?: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    graph: GraphSpecificConfig;
  };
  sqlite?: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    database: SqliteSpecificConfig;
  };
}

// 事务配置
export interface TransactionConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableTwoPhaseCommit: boolean;
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  maxConcurrentTransactions: number;
  deadlockDetectionTimeout: number;
}

// 通用配置
export interface CommonConfig {
  enableCache: boolean;
  enableMonitoring: boolean;
  enableBatching: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  gracefulShutdownTimeout: number;
}

// 完整的基础设施配置
export interface InfrastructureConfig {
  common: CommonConfig;
  qdrant: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    vector?: VectorSpecificConfig;
  };
  nebula: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    graph: GraphSpecificConfig;
  };
  vector?: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    vector?: VectorSpecificConfig;
  };
  graph?: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    graph: GraphSpecificConfig;
  };
  sqlite?: {
    cache: CacheConfig;
    performance: PerformanceConfig;
    batch: BatchConfig;
    connection: ConnectionConfig;
    database: SqliteSpecificConfig;
  };
  transaction: TransactionConfig;
}

// 配置验证规则
export interface ConfigValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  validator?: (value: any) => boolean;
  message?: string;
}

// 配置验证结果
export interface ConfigValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value: any;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value: any;
  }>;
}