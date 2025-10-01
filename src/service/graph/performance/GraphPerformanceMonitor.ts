import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';

export interface GraphPerformanceMetrics {
  totalQueries: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  cacheHits: number;
  cacheMisses: number;
  currentBatchSize: number;
  memoryUsage: number;
  activeConnections: number;
  errorRate: number;
 lastUpdated: Date;
}

export interface IGraphPerformanceMonitor {
  getMetrics(): GraphPerformanceMetrics;
  recordQueryExecution(executionTime: number): void;
  updateCacheHitRate(isHit: boolean): void;
  updateBatchSize(size: number): void;
  startPeriodicMonitoring(intervalMs: number): void;
  stopPeriodicMonitoring(): void;
  resetMetrics(): void;
  isHealthy(): boolean;
  getStatus(): string;
}

@injectable()
export class GraphPerformanceMonitor implements IGraphPerformanceMonitor {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private metrics: GraphPerformanceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    
    this.metrics = {
      totalQueries: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      cacheHitRate: 0,
      cacheHits: 0,
      cacheMisses: 0,
      currentBatchSize: 0,
      memoryUsage: 0,
      activeConnections: 0,
      errorRate: 0,
      lastUpdated: new Date(),
    };
  }

  getMetrics(): GraphPerformanceMetrics {
    // Update memory usage before returning metrics
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  recordQueryExecution(executionTime: number): void {
    try {
      this.metrics.totalQueries++;
      this.metrics.totalExecutionTime += executionTime;
      this.metrics.avgExecutionTime = this.metrics.totalExecutionTime / this.metrics.totalQueries;
      this.metrics.lastUpdated = new Date();

      this.logger.debug('Query execution recorded', {
        executionTime,
        totalQueries: this.metrics.totalQueries,
        avgExecutionTime: this.metrics.avgExecutionTime,
      });
    } catch (error) {
      this.logger.error(`Error recording query execution: ${error}`);
      this.errorHandler.handleError(
        new Error(`Query execution recording failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPerformanceMonitor', operation: 'recordQueryExecution' }
      );
    }
  }

  updateCacheHitRate(isHit: boolean): void {
    try {
      if (isHit) {
        this.metrics.cacheHits++;
      } else {
        this.metrics.cacheMisses++;
      }

      const totalAccesses = this.metrics.cacheHits + this.metrics.cacheMisses;
      if (totalAccesses > 0) {
        this.metrics.cacheHitRate = (this.metrics.cacheHits / totalAccesses) * 100;
      }

      this.logger.debug('Cache hit rate updated', {
        isHit,
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses,
        cacheHitRate: this.metrics.cacheHitRate,
      });
    } catch (error) {
      this.logger.error(`Error updating cache hit rate: ${error}`);
      this.errorHandler.handleError(
        new Error(`Cache hit rate update failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPerformanceMonitor', operation: 'updateCacheHitRate' }
      );
    }
  }

  updateBatchSize(size: number): void {
    try {
      this.metrics.currentBatchSize = size;
      this.logger.debug('Batch size updated', { batchSize: size });
    } catch (error) {
      this.logger.error(`Error updating batch size: ${error}`);
      this.errorHandler.handleError(
        new Error(`Batch size update failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPerformanceMonitor', operation: 'updateBatchSize' }
      );
    }
  }

  startPeriodicMonitoring(intervalMs: number = 30000): void { // Default to 30 seconds
    if (this.monitoringInterval) {
      this.logger.warn('Periodic monitoring already running, stopping previous interval');
      this.stopPeriodicMonitoring();
    }

    this.monitoringInterval = setInterval(() => {
      try {
        this.updateMemoryUsage();
        this.logPerformanceMetrics();
      } catch (error) {
        this.logger.error(`Error during periodic monitoring: ${error}`);
        this.errorHandler.handleError(
          new Error(`Periodic monitoring failed: ${error instanceof Error ? error.message : String(error)}`),
          { component: 'GraphPerformanceMonitor', operation: 'periodicMonitoring' }
        );
      }
    }, intervalMs);

    this.logger.info(`Started periodic monitoring with interval: ${intervalMs}ms`);
  }

  stopPeriodicMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped periodic monitoring');
    }
  }

  resetMetrics(): void {
    try {
      this.metrics = {
        totalQueries: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0,
        cacheHitRate: 0,
        cacheHits: 0,
        cacheMisses: 0,
        currentBatchSize: 0,
        memoryUsage: 0,
        activeConnections: 0,
        errorRate: 0,
        lastUpdated: new Date(),
      };

      this.logger.info('Performance metrics reset');
    } catch (error) {
      this.logger.error(`Error resetting metrics: ${error}`);
      this.errorHandler.handleError(
        new Error(`Metrics reset failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPerformanceMonitor', operation: 'resetMetrics' }
      );
    }
  }

 private updateMemoryUsage(): void {
    try {
      const usedMemory = process.memoryUsage().heapUsed;
      this.metrics.memoryUsage = usedMemory;
    } catch (error) {
      this.logger.warn(`Could not update memory usage: ${error}`);
    }
 }

  private logPerformanceMetrics(): void {
    try {
      const metrics = this.getMetrics();
      this.logger.info('Graph performance metrics', {
        totalQueries: metrics.totalQueries,
        avgExecutionTime: metrics.avgExecutionTime,
        cacheHitRate: metrics.cacheHitRate,
        currentBatchSize: metrics.currentBatchSize,
        memoryUsage: metrics.memoryUsage,
        activeConnections: metrics.activeConnections,
      });
    } catch (error) {
      this.logger.error(`Error logging performance metrics: ${error}`);
      this.errorHandler.handleError(
        new Error(`Performance metrics logging failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPerformanceMonitor', operation: 'logPerformanceMetrics' }
      );
    }
  }

  /**
   * 检查性能指标是否超过阈值
   */
  checkPerformanceThresholds(): {
    isHighLatency: boolean;
    isHighMemoryUsage: boolean;
    isHighErrorRate: boolean;
  } {
    const monitoringConfig = this.configService.get('batchProcessing').monitoring;
    const thresholds = monitoringConfig.alertThresholds;

    const isHighLatency = this.metrics.avgExecutionTime > thresholds.highLatency;
    const isHighMemoryUsage = this.metrics.memoryUsage > thresholds.highMemoryUsage;
    const isHighErrorRate = this.metrics.errorRate > thresholds.highErrorRate;

    return {
      isHighLatency,
      isHighMemoryUsage,
      isHighErrorRate,
    };
  }

 /**
   * 获取性能摘要
   */
  getPerformanceSummary(): string {
    const metrics = this.getMetrics();
    return `
Graph Performance Summary:
- Total Queries: ${metrics.totalQueries}
- Average Execution Time: ${metrics.avgExecutionTime.toFixed(2)}ms
- Cache Hit Rate: ${metrics.cacheHitRate.toFixed(2)}%
- Current Batch Size: ${metrics.currentBatchSize}
- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB
- Active Connections: ${metrics.activeConnections}
    `.trim();
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();
    const thresholds = this.configService.get('batchProcessing').monitoring.alertThresholds;

    if (metrics.avgExecutionTime > thresholds.highLatency) {
      recommendations.push('Average execution time is high. Consider optimizing queries or increasing resources.');
    }

    if (metrics.memoryUsage > thresholds.highMemoryUsage) {
      recommendations.push('Memory usage is high. Consider optimizing memory usage or increasing heap size.');
    }

    if (metrics.cacheHitRate < 50) {
      recommendations.push('Cache hit rate is low. Consider improving cache strategies.');
    }

    if (metrics.currentBatchSize === 0) {
      recommendations.push('Batch size is not set. Consider optimizing batch processing.');
    }

    return recommendations;
  }

  /**
   * 检查性能监控服务是否健康
   */
  isHealthy(): boolean {
    try {
      // 检查基本功能是否正常工作
      const initialMetrics = this.getMetrics();
      
      // 执行一个简单的操作
      this.recordQueryExecution(10);
      
      const updatedMetrics = this.getMetrics();
      
      // 检查指标是否正确更新
      return updatedMetrics.totalQueries === initialMetrics.totalQueries + 1 &&
             updatedMetrics.totalExecutionTime === initialMetrics.totalExecutionTime + 10;
    } catch (error) {
      this.logger.error('Health check failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 获取性能监控服务状态
   */
  getStatus(): string {
    try {
      const thresholds = this.configService.get('batchProcessing').monitoring.alertThresholds;
      const metrics = this.getMetrics();
      
      // 检查各项指标是否超出阈值
      const isHighLatency = metrics.avgExecutionTime > thresholds.highLatency;
      const isHighMemoryUsage = metrics.memoryUsage > thresholds.highMemoryUsage;
      const isLowThroughput = metrics.totalQueries < thresholds.lowThroughput;
      
      if (isHighLatency || isHighMemoryUsage) {
        return 'critical'; // 性能严重下降
      } else if (isLowThroughput) {
        return 'warning'; // 吞吐量低
      } else if (metrics.totalQueries === 0) {
        return 'idle'; // 尚未处理任何查询
      } else {
        return 'normal'; // 正常状态
      }
    } catch (error) {
      this.logger.error('Status check failed', { error: (error as Error).message });
      return 'error'; // 检查过程中出错
    }
  }
}