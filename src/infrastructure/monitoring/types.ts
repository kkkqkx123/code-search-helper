import { DatabaseType, PoolStatus } from '../types';

export interface PerformanceMetrics {
  queryExecutionTimes: number[];
  averageQueryTime: number;
  cacheHitRate: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    percentage: number;
  };
  systemHealthStatus: 'healthy' | 'degraded' | 'error';
  batchProcessingStats: {
    totalBatches: number;
    averageBatchSize: number;
    successRate: number;
  };
  timestamp: number;
}

export interface GraphDatabaseMetric {
  databaseType: DatabaseType;
  operation: string;
  spaceName: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata: {
    vertexCount: number;
    edgeCount: number;
  };
}

export interface VectorOperationMetric {
  operation: 'insert' | 'search' | 'update' | 'delete';
  collectionName: string;
  vectorCount: number;
  dimension: number;
  duration: number;
  success: boolean;
  timestamp: number;
  throughput: number; // vectors per second
}

/**
 * 解析操作指标
 */
export interface ParsingOperationMetric {
  operation: 'parse' | 'query' | 'normalize' | 'chunk';
  language: string;
  filePath?: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata: {
    nodeCount?: number;
    resultCount?: number;
    chunkCount?: number;
    errorType?: string;
    errorMessage?: string;
  };
}

/**
 * 标准化操作指标
 */
export interface NormalizationOperationMetric {
  operation: 'normalize' | 'adapt' | 'map';
  language: string;
  queryType: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata: {
    resultCount?: number;
    adapterType?: string;
    cacheHit?: boolean;
    fallbackUsed?: boolean;
    errorType?: string;
    errorMessage?: string;
  };
}

/**
 * 分段操作指标
 */
export interface ChunkingOperationMetric {
  operation: 'semantic' | 'bracket' | 'line' | 'standardization';
  language: string;
  filePath?: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata: {
    chunkCount?: number;
    averageChunkSize?: number;
    totalSize?: number;
    strategy?: string;
    standardized?: boolean;
    errorType?: string;
    errorMessage?: string;
  };
}

/**
 * 操作上下文
 */
export interface OperationContext {
  operationId: string;
  operationType: string;
  startTime: number;
  metadata?: Record<string, any>;
}

/**
 * 操作结果
 */
export interface OperationResult {
  operationId: string;
  duration: number;
  success: boolean;
  resultCount?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IPerformanceMonitor {
  startPeriodicMonitoring(intervalMs?: number): void;
  stopPeriodicMonitoring(): void;
  recordQueryExecution(executionTimeMs: number): void;
  updateCacheHitRate(isHit: boolean): void;
  updateBatchSize(batchSize: number): void;
  updateSystemHealthStatus(status: 'healthy' | 'degraded' | 'error'): void;
  getMetrics(): PerformanceMetrics;
  resetMetrics(): void;

  // 扩展接口以支持多数据库类型
  recordNebulaOperation(
    operation: string,
    spaceName: string,
    duration: number,
    success: boolean
  ): Promise<void>;

  recordVectorOperation(
    operation: 'insert' | 'search' | 'update' | 'delete',
    collectionName: string,
    vectorCount: number,
    dimension: number,
    duration: number,
    success: boolean
  ): Promise<void>;

  // 新增解析和标准化操作监控
  startOperation(operationType: string, metadata?: Record<string, any>): string;
  endOperation(operationId: string, result?: Partial<OperationResult>): void;
  recordParsingOperation(metric: ParsingOperationMetric): Promise<void>;
  recordNormalizationOperation(metric: NormalizationOperationMetric): Promise<void>;
  recordChunkingOperation(metric: ChunkingOperationMetric): Promise<void>;
  getOperationMetrics(): {
    parsing: ParsingOperationMetric[];
    normalization: NormalizationOperationMetric[];
    chunking: ChunkingOperationMetric[];
  };
  getOperationStats(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    operationsByType: Record<string, number>;
    operationsByLanguage: Record<string, number>;
  };
}

export interface MetricsCollector {
  collectSystemMetrics(): Promise<PerformanceMetrics>;
  collectQueryMetrics(queryId: string, executionTime: number): void;
  collectCacheMetrics(cacheHit: boolean): void;
  collectBatchMetrics(batchSize: number, success: boolean): void;
}

export interface DatabaseHealthStatus {
  databaseType: DatabaseType;
  status: 'healthy' | 'degraded' | 'error';
  responseTime: number;
  connectionPoolStatus: PoolStatus;
  timestamp: number;
}

export interface IHealthChecker {
  checkHealth(): Promise<DatabaseHealthStatus>;
  getHealthStatus(): DatabaseHealthStatus;
  subscribeToHealthUpdates(callback: (status: DatabaseHealthStatus) => void): void;
}