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