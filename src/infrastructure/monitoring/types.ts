export interface PerformanceMetrics {
  queryExecutionTimes: number[];
  averageQueryTime: number;
  cacheHitRate: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    percentage: number;
  };
  connectionPoolStatus: 'healthy' | 'degraded' | 'error';
  batchProcessingStats: {
    totalBatches: number;
    averageBatchSize: number;
    successRate: number;
  };
  timestamp: number;
}

export interface IPerformanceMonitor {
  startPeriodicMonitoring(intervalMs?: number): void;
  stopPeriodicMonitoring(): void;
  recordQueryExecution(executionTimeMs: number): void;
  updateCacheHitRate(isHit: boolean): void;
  updateBatchSize(batchSize: number): void;
  updateConnectionPoolStatus(status: 'healthy' | 'degraded' | 'error'): void;
  getMetrics(): PerformanceMetrics;
  resetMetrics(): void;
}

export interface MetricsCollector {
  collectSystemMetrics(): Promise<PerformanceMetrics>;
  collectQueryMetrics(queryId: string, executionTime: number): void;
  collectCacheMetrics(cacheHit: boolean): void;
  collectBatchMetrics(batchSize: number, success: boolean): void;
}