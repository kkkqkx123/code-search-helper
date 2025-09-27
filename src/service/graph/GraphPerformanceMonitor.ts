import { LoggerService } from '../../../core/LoggerService';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';

export interface PerformanceMetrics {
  queryExecutionTimes: number[];
  cacheHitRate: number;
  averageBatchSize: number;
  connectionPoolStatus: string;
  totalQueriesExecuted: number;
  averageQueryTime: number;
}

export interface BatchMetrics {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  averageBatchSize: number;
  totalProcessingTime: number;
}

@injectable()
export class GraphPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    queryExecutionTimes: [],
    cacheHitRate: 0,
    averageBatchSize: 0,
    connectionPoolStatus: 'unknown',
    totalQueriesExecuted: 0,
    averageQueryTime: 0,
  };

  private batchMetrics: BatchMetrics = {
    totalBatches: 0,
    successfulBatches: 0,
    failedBatches: 0,
    averageBatchSize: 0,
    totalProcessingTime: 0,
  };

  private logger: LoggerService;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
  }

  recordQueryExecution(queryTime: number): void {
    this.metrics.queryExecutionTimes.push(queryTime);
    this.metrics.totalQueriesExecuted++;

    // Keep only last 1000 query times to prevent memory issues
    if (this.metrics.queryExecutionTimes.length > 1000) {
      this.metrics.queryExecutionTimes = this.metrics.queryExecutionTimes.slice(-1000);
    }

    this.updateAverageQueryTime();
  }

  updateCacheHitRate(hit: boolean): void {
    // Exponential moving average for cache hit rate
    const alpha = 0.1;
    this.metrics.cacheHitRate = this.metrics.cacheHitRate * (1 - alpha) + (hit ? 1 : 0) * alpha;
  }

  updateBatchSize(batchSize: number): void {
    // Exponential moving average for batch size
    const alpha = 0.1;
    this.metrics.averageBatchSize = this.metrics.averageBatchSize * (1 - alpha) + batchSize * alpha;
  }

  updateConnectionPoolStatus(status: string): void {
    this.metrics.connectionPoolStatus = status;
  }

  recordBatchOperation(success: boolean, batchSize: number, processingTime: number): void {
    this.batchMetrics.totalBatches++;

    if (success) {
      this.batchMetrics.successfulBatches++;
    } else {
      this.batchMetrics.failedBatches++;
    }

    this.batchMetrics.totalProcessingTime += processingTime;

    // Update average batch size
    const alpha = 0.1;
    this.batchMetrics.averageBatchSize =
      this.batchMetrics.averageBatchSize * (1 - alpha) + batchSize * alpha;
  }

  private updateAverageQueryTime(): void {
    if (this.metrics.queryExecutionTimes.length === 0) {
      this.metrics.averageQueryTime = 0;
      return;
    }

    this.metrics.averageQueryTime =
      this.metrics.queryExecutionTimes.reduce((a, b) => a + b, 0) /
      this.metrics.queryExecutionTimes.length;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getBatchMetrics(): BatchMetrics {
    return { ...this.batchMetrics };
  }

  getSummaryReport(): string {
    const successRate =
      this.batchMetrics.totalBatches > 0
        ? ((this.batchMetrics.successfulBatches / this.batchMetrics.totalBatches) * 100).toFixed(2)
        : '0.00';

    return `
Graph Performance Summary:
- Total Queries: ${this.metrics.totalQueriesExecuted}
- Average Query Time: ${this.metrics.averageQueryTime.toFixed(2)}ms
- Cache Hit Rate: ${(this.metrics.cacheHitRate * 100).toFixed(2)}%
- Connection Pool: ${this.metrics.connectionPoolStatus}
- Total Batches: ${this.batchMetrics.totalBatches}
- Success Rate: ${successRate}%
- Average Batch Size: ${this.batchMetrics.averageBatchSize.toFixed(0)}
- Total Processing Time: ${(this.batchMetrics.totalProcessingTime / 1000).toFixed(2)}s
    `.trim();
  }

  startPeriodicMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      const report = this.getSummaryReport();
      this.logger.info(report);
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  resetMetrics(): void {
    this.metrics = {
      queryExecutionTimes: [],
      cacheHitRate: 0,
      averageBatchSize: 0,
      connectionPoolStatus: 'unknown',
      totalQueriesExecuted: 0,
      averageQueryTime: 0,
    };

    this.batchMetrics = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      averageBatchSize: 0,
      totalProcessingTime: 0,
    };
  }

  getQueryTimePercentile(percentile: number): number {
    if (this.metrics.queryExecutionTimes.length === 0) return 0;

    const sortedTimes = [...this.metrics.queryExecutionTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sortedTimes.length) - 1;

    return sortedTimes[Math.max(0, index)];
  }

  getPerformanceWarnings(): string[] {
    const warnings: string[] = [];

    if (this.metrics.averageQueryTime > 1000) {
      warnings.push('Average query time exceeds 1 second');
    }

    if (this.metrics.cacheHitRate < 0.5) {
      warnings.push('Cache hit rate below 50%');
    }

    if (
      this.batchMetrics.failedBatches > 0 &&
      this.batchMetrics.failedBatches / this.batchMetrics.totalBatches > 0.1
    ) {
      warnings.push('Batch failure rate exceeds 10%');
    }

    if (this.metrics.connectionPoolStatus !== 'healthy') {
      warnings.push(`Connection pool status: ${this.metrics.connectionPoolStatus}`);
    }

    return warnings;
  }
}
