export enum DatabaseType {
  QDRANT = 'qdrant',
  NEBULA = 'nebula',
  VECTOR = 'vector',
  GRAPH = 'graph',
  SQLITE = 'sqlite'
}

export interface DatabaseConnection {
  // 数据库连接的通用接口
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface PoolStatus {
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  maxConnections: number;
}

export interface TransactionStatus {
 state: 'active' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
  participants: Map<DatabaseType, boolean>;
  timestamp: number;
}

// 缓存配置接口
export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  enableStats: boolean;
  [key: string]: any; // 支持额外的数据库特定配置
}

// 批处理配置接口
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
  [key: string]: any; // 支持额外的数据库特定配置
}

// 性能监控配置接口
export interface PerformanceConfig {
  monitoringInterval: number;
 metricsRetentionPeriod: number;
  enableDetailedLogging: boolean;
 performanceThresholds: {
    queryExecutionTime: number;
    memoryUsage: number;
    responseTime: number;
  };
  [key: string]: any; // 支持额外的数据库特定配置
}

// 连接池配置接口
export interface ConnectionConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  acquireTimeout: number;
  validationInterval: number;
  enableConnectionPooling: boolean;
  [key: string]: any; // 支持额外的数据库特定配置
}