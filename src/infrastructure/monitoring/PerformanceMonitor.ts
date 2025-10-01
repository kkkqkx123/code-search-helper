import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { IPerformanceMonitor, PerformanceMetrics } from './types';

@injectable()
export class PerformanceMonitor implements IPerformanceMonitor {
  private logger: LoggerService;
  private metrics: PerformanceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queryExecutionTimes: number[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private batchSizes: number[] = [];
  private batchSuccesses: number = 0;
  private batchFailures: number = 0;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      queryExecutionTimes: [],
      averageQueryTime: 0,
      cacheHitRate: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        percentage: 0,
      },
      connectionPoolStatus: 'healthy',
      batchProcessingStats: {
        totalBatches: 0,
        averageBatchSize: 0,
        successRate: 0,
      },
      timestamp: Date.now(),
    };
  }

  startPeriodicMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.logger.warn('Performance monitoring is already running');
      return;
    }

    this.logger.info('Starting periodic performance monitoring', { intervalMs });

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.logMetricsSummary();
    }, intervalMs);

    // Ensure interval doesn't prevent Node.js from exiting
    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }
  }

  stopPeriodicMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped periodic performance monitoring');
    } else {
      this.logger.warn('Performance monitoring is not running');
    }
  }

  recordQueryExecution(executionTimeMs: number): void {
    this.queryExecutionTimes.push(executionTimeMs);

    // Keep only the last 1000 query execution times
    if (this.queryExecutionTimes.length > 1000) {
      this.queryExecutionTimes = this.queryExecutionTimes.slice(-1000);
    }

    this.updateAverageQueryTime();
    this.logger.debug('Recorded query execution time', { executionTimeMs });
  }

  updateCacheHitRate(isHit: boolean): void {
    if (isHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    this.logger.debug('Updated cache hit rate', {
      isHit,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.metrics.cacheHitRate,
    });
  }

  updateBatchSize(batchSize: number): void {
    this.batchSizes.push(batchSize);

    // Keep only the last 100 batch sizes
    if (this.batchSizes.length > 100) {
      this.batchSizes = this.batchSizes.slice(-100);
    }

    this.updateBatchProcessingStats();
    this.logger.debug('Updated batch size', { batchSize });
  }

  updateConnectionPoolStatus(status: 'healthy' | 'degraded' | 'error'): void {
    this.metrics.connectionPoolStatus = status;
    this.logger.debug('Updated connection pool status', { status });
  }

  getMetrics(): PerformanceMetrics {
    // Update timestamp to current time
    this.metrics.timestamp = Date.now();

    // Calculate current memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    };

    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.logger.info('Resetting performance metrics');
    this.queryExecutionTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.batchSizes = [];
    this.batchSuccesses = 0;
    this.batchFailures = 0;
    this.metrics = this.initializeMetrics();
  }

  private updateAverageQueryTime(): void {
    if (this.queryExecutionTimes.length > 0) {
      const sum = this.queryExecutionTimes.reduce((acc, time) => acc + time, 0);
      this.metrics.averageQueryTime = sum / this.queryExecutionTimes.length;
    } else {
      this.metrics.averageQueryTime = 0;
    }
  }

  private updateBatchProcessingStats(): void {
    const totalBatches = this.batchSuccesses + this.batchFailures;
    this.metrics.batchProcessingStats = {
      totalBatches,
      averageBatchSize: this.batchSizes.length > 0
        ? this.batchSizes.reduce((sum, size) => sum + size, 0) / this.batchSizes.length
        : 0,
      successRate: totalBatches > 0 ? this.batchSuccesses / totalBatches : 0,
    };
  }

  private collectSystemMetrics(): void {
    // Update memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    };

    // Update query execution times
    this.metrics.queryExecutionTimes = [...this.queryExecutionTimes];
    this.updateAverageQueryTime();

    // Update batch processing stats
    this.updateBatchProcessingStats();

    // Update timestamp
    this.metrics.timestamp = Date.now();
  }

  private logMetricsSummary(): void {
    const metrics = this.getMetrics();

    this.logger.info('Performance metrics summary', {
      averageQueryTime: `${metrics.averageQueryTime.toFixed(2)}ms`,
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(2)}%`,
      memoryUsage: `${metrics.memoryUsage.percentage.toFixed(2)}%`,
      connectionPoolStatus: metrics.connectionPoolStatus,
      batchProcessing: {
        totalBatches: metrics.batchProcessingStats.totalBatches,
        averageBatchSize: Math.round(metrics.batchProcessingStats.averageBatchSize),
        successRate: `${(metrics.batchProcessingStats.successRate * 100).toFixed(2)}%`,
      },
    });

    // Log warnings for potential issues
    if (metrics.memoryUsage.percentage > 80) {
      this.logger.warn('High memory usage detected', {
        percentage: metrics.memoryUsage.percentage,
      });
    }

    if (metrics.averageQueryTime > 1000) {
      this.logger.warn('High average query time detected', {
        averageQueryTime: metrics.averageQueryTime,
      });
    }

    if (metrics.connectionPoolStatus === 'error') {
      this.logger.error('Connection pool status is error');
    }
  }

  // Additional utility methods for batch processing
  recordBatchResult(success: boolean): void {
    if (success) {
      this.batchSuccesses++;
    } else {
      this.batchFailures++;
    }
    this.updateBatchProcessingStats();
  }

  getDetailedMetrics(): PerformanceMetrics & {
    queryExecutionTimes: number[];
    cacheHits: number;
    cacheMisses: number;
    batchSizes: number[];
    batchSuccesses: number;
    batchFailures: number;
  } {
    return {
      ...this.getMetrics(),
      queryExecutionTimes: [...this.queryExecutionTimes],
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      batchSizes: [...this.batchSizes],
      batchSuccesses: this.batchSuccesses,
      batchFailures: this.batchFailures,
    };
  }
}