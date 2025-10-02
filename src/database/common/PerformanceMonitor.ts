import { injectable, inject } from 'inversify';
import { DatabaseLoggerService } from './DatabaseLoggerService';
import { DatabaseEventType } from './DatabaseEventTypes';
import { TYPES } from '../../types';

/**
 * 数据库性能监控器
 * 记录和监控数据库操作的性能指标
 */
@injectable()
export class PerformanceMonitor {
  private databaseLogger: DatabaseLoggerService;
  private metrics: Map<string, PerformanceMetric> = new Map();
 private performanceThreshold: number = 1000; // 默认1秒阈值

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService
  ) {
    this.databaseLogger = databaseLogger;
  }

  /**
   * 记录操作性能
   * @param operation 操作名称
   * @param duration 持续时间（毫秒）
   * @param additionalData 附加数据
   */
  recordOperation(operation: string, duration: number, additionalData?: Record<string, any>): void {
    // 更新指标统计
    const metric = this.metrics.get(operation) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastExecutionTime: new Date()
    };

    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.lastExecutionTime = new Date();

    this.metrics.set(operation, metric);

    // 记录性能日志
    this.logPerformance(operation, duration, additionalData);

    // 如果操作时间超过阈值，记录警告
    if (duration > this.performanceThreshold) {
      this.logPerformanceWarning(operation, duration, additionalData);
    }
 }

  /**
   * 记录性能日志
   * @param operation 操作名称
   * @param duration 持续时间
   * @param additionalData 附加数据
   */
  private async logPerformance(operation: string, duration: number, additionalData?: Record<string, any>): Promise<void> {
    const performanceData = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    await this.databaseLogger.logQueryPerformance(operation, duration);
  }

  /**
   * 记录性能警告
   * @param operation 操作名称
   * @param duration 持续时间
   * @param additionalData 附加数据
   */
  private async logPerformanceWarning(operation: string, duration: number, additionalData?: Record<string, any>): Promise<void> {
    const warningData = {
      operation,
      duration,
      threshold: this.performanceThreshold,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.PERFORMANCE_METRIC,
      timestamp: new Date(),
      source: 'common',
      data: { ...warningData, metricType: 'performance_threshold_exceeded' }
    });
 }

  /**
   * 获取操作的性能统计
   * @param operation 操作名称
   * @returns 性能统计信息
   */
  getOperationStats(operation: string): OperationStats | null {
    const metric = this.metrics.get(operation);
    if (!metric) {
      return null;
    }

    return {
      operation,
      count: metric.count,
      averageDuration: metric.count > 0 ? metric.totalDuration / metric.count : 0,
      minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
      maxDuration: metric.maxDuration,
      totalDuration: metric.totalDuration,
      lastExecutionTime: metric.lastExecutionTime
    };
  }

  /**
   * 获取所有操作的性能统计
   * @returns 所有操作的性能统计
   */
  getAllStats(): OperationStats[] {
    const stats: OperationStats[] = [];
    for (const [operation, metric] of this.metrics.entries()) {
      stats.push({
        operation,
        count: metric.count,
        averageDuration: metric.count > 0 ? metric.totalDuration / metric.count : 0,
        minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
        maxDuration: metric.maxDuration,
        totalDuration: metric.totalDuration,
        lastExecutionTime: metric.lastExecutionTime
      });
    }
    return stats;
  }

  /**
   * 重置特定操作的性能统计
   * @param operation 操作名称
   */
  resetOperationStats(operation: string): void {
    this.metrics.delete(operation);
  }

  /**
   * 重置所有性能统计
   */
  resetAllStats(): void {
    this.metrics.clear();
  }

 /**
   * 设置性能阈值
   * @param threshold 阈值（毫秒）
   */
  setPerformanceThreshold(threshold: number): void {
    this.performanceThreshold = threshold;
  }

  /**
   * 获取当前性能阈值
   * @returns 性能阈值
   */
  getPerformanceThreshold(): number {
    return this.performanceThreshold;
  }
}

/**
 * 性能指标接口
 */
interface PerformanceMetric {
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecutionTime: Date;
}

/**
 * 操作统计接口
 */
export interface OperationStats {
  operation: string;
  count: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastExecutionTime: Date;
}