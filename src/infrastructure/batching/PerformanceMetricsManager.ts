import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { IMemoryMonitorService } from '../../service/memory/interfaces/IMemoryMonitorService';
import { TYPES } from '../../types';
import { PerformanceMetrics, PerformanceStats, BatchContext } from './types';
import { BatchProcessingConfig } from './BatchConfigManager';

/**
 * 性能指标管理服务
 */
@injectable()
export class PerformanceMetricsManager {
  private performanceMetrics: PerformanceMetrics[] = [];
  private currentBatchSizes: Map<string, number> = new Map();
  private defaultBatchSize: number = 50;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.MemoryMonitorService) private memoryMonitor: IMemoryMonitorService
  ) {}

  /**
   * 记录性能指标
   */
  recordMetric(
    operationName: string,
    duration: number,
    success: boolean,
    error?: Error
  ): void {
    this.performanceMetrics.push({
      operation: operationName,
      duration,
      success,
      timestamp: new Date(),
      metadata: {
        error: error?.message
      }
    });

    // 限制性能指标数量
    if (this.performanceMetrics.length > 10000) {
      this.performanceMetrics = this.performanceMetrics.slice(-5000);
    }
  }

  /**
   * 获取性能统计
   */
  getStats(operationName?: string): PerformanceStats {
    const metrics = operationName
      ? this.performanceMetrics.filter(m => m.operation === operationName)
      : this.performanceMetrics;

    const count = metrics.length;
    const successfulOperations = metrics.filter(m => m.success).length;
    const averageDuration = count > 0
      ? metrics.reduce((sum, m) => sum + m.duration, 0) / count
      : 0;

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const minDuration = durations.length > 0 ? durations[0] : 0;
    const maxDuration = durations.length > 0 ? durations[durations.length - 1] : 0;
    const p95Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
    const p99Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;

    return {
      count,
      successRate: count > 0 ? successfulOperations / count : 0,
      averageDuration,
      minDuration,
      maxDuration,
      p95Duration,
      p99Duration
    };
  }

  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.performanceMetrics = [];
    this.currentBatchSizes.clear();
    this.logger.info('Performance stats reset');
  }

  /**
   * 获取当前批处理大小
   */
  getCurrentBatchSize(context?: BatchContext): number {
    if (!context) {
      return this.defaultBatchSize;
    }
    const key = JSON.stringify(context);
    return this.currentBatchSizes.get(key) || this.defaultBatchSize;
  }

  /**
   * 设置当前批处理大小
   */
  setCurrentBatchSize(context: BatchContext, size: number): void {
    const key = JSON.stringify(context);
    this.currentBatchSizes.set(key, size);
  }

  /**
   * 优化批处理大小
   */
  optimizeBatchSize(
    context: BatchContext,
    baseSize: number,
    config: BatchProcessingConfig
  ): number {
    // 基于内存使用情况调整批处理大小
    const memoryCheck = this.memoryMonitor.checkMemoryUsage();
    let optimizedSize = baseSize;

    if (memoryCheck.usagePercent > config.memoryThreshold) {
      optimizedSize = Math.max(10, Math.floor(optimizedSize * 0.5)); // 减少批处理大小
      this.logger.warn('Reducing batch size due to high memory usage', {
        usagePercent: memoryCheck.usagePercent,
        optimizedSize
      });
    }

    this.setCurrentBatchSize(context, optimizedSize);
    return optimizedSize;
  }

  /**
   * 内存优化
   */
  async optimizeMemory(config: BatchProcessingConfig): Promise<void> {
    try {
      const memoryCheck = this.memoryMonitor.checkMemoryUsage();

      if (memoryCheck.usagePercent > config.memoryThreshold) {
        this.logger.warn('High memory usage detected, triggering optimization', {
          usagePercent: memoryCheck.usagePercent,
          threshold: config.memoryThreshold
        });

        // 清理性能指标
        if (this.performanceMetrics.length > 1000) {
          this.performanceMetrics = this.performanceMetrics.slice(-500);
        }

        // 触发垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to optimize memory: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'PerformanceMetricsManager', operation: 'optimizeMemory' }
      );
    }
  }

  /**
   * 获取所有性能指标
   */
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }
}
