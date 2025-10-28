import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

/**
 * 性能监控协调器
 * 负责收集、记录和分析性能指标
 */
@injectable()
export class PerformanceMonitoringCoordinator {
  private logger?: LoggerService;
  private enabled: boolean = true;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private thresholds: Map<string, number> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
    this.initializeDefaultThresholds();
    this.logger?.debug('PerformanceMonitoringCoordinator initialized');
  }

  /**
   * 初始化默认阈值
   */
  private initializeDefaultThresholds(): void {
    // 设置默认性能阈值（毫秒）
    this.thresholds.set('processFile', 5000);        // 文件处理最大时间
    this.thresholds.set('executeStrategy', 2000);    // 策略执行最大时间
    this.thresholds.set('detectFile', 1000);         // 文件检测最大时间
    this.thresholds.set('parseCode', 500);           // 代码解析最大时间
  }

  /**
   * 记录操作性能指标
   */
  recordOperation(metrics: PerformanceMetrics): void {
    if (!this.enabled) return;

    const { operation, duration, success, error, metadata } = metrics;
    
    // 记录到内存
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push({
      operation,
      duration,
      success,
      error,
      metadata: {
        ...metadata,
        timestamp: Date.now()
      }
    });

    // 检查是否超过阈值
    const threshold = this.thresholds.get(operation);
    if (threshold && duration > threshold) {
      this.logger?.warn(`Performance threshold exceeded for ${operation}: ${duration}ms > ${threshold}ms`, {
        operation,
        duration,
        threshold,
        metadata
      });
    }

    // 记录到日志
    const logLevel = success ? 'debug' : 'error';
    this.logger?.[logLevel](`Performance metric recorded: ${operation}`, {
      duration,
      success,
      error,
      metadata
    });
  }

  /**
   * 包装异步操作进行性能监控
   */
  async monitorAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.recordOperation({
        operation: operationName,
        duration,
        success: true,
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordOperation({
        operation: operationName,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata
      });
      
      throw error;
    }
  }

  /**
   * 包装同步操作进行性能监控
   */
  monitorSyncOperation<T>(
    operationName: string,
    operation: () => T,
    metadata?: any
  ): T {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = operation();
      const endTime = process.hrtime.bigint();
      // 将纳秒转换为毫秒，保留小数点后几位
      const duration = Number(endTime - startTime) / 10000;
      
      this.recordOperation({
        operation: operationName,
        duration: Math.max(1, Math.round(duration)), // 确保最小值为1ms
        success: true,
        metadata
      });
      
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      // 将纳秒转换为毫秒，保持与成功路径的一致性
      const duration = Number(endTime - startTime) / 10000;
      
      this.recordOperation({
        operation: operationName,
        duration: Math.max(1, Math.round(duration)), // 确保最小值为1ms
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata
      });
      
      throw error;
    }
 }

  /**
   * 获取性能报告
   */
  generateReport(): {
    summary: Map<string, {
      totalOperations: number;
      averageDuration: number;
      minDuration: number;
      maxDuration: number;
      successRate: number;
      thresholdExceedances: number;
    }>;
    recentMetrics: Map<string, PerformanceMetrics[]>;
    alerts: Array<{
      operation: string;
      message: string;
      severity: 'warning' | 'error';
      timestamp: number;
    }>;
  } {
    const summary = new Map<string, {
      totalOperations: number;
      averageDuration: number;
      minDuration: number;
      maxDuration: number;
      successRate: number;
      thresholdExceedances: number;
    }>();

    const alerts: Array<{
      operation: string;
      message: string;
      severity: 'warning' | 'error';
      timestamp: number;
    }> = [];

    // 计算每个操作的统计信息
    for (const [operation, metrics] of this.metrics) {
      if (metrics.length === 0) continue;

      const durations = metrics.map(m => m.duration);
      const totalOperations = metrics.length;
      const successfulOperations = metrics.filter(m => m.success).length;
      const threshold = this.thresholds.get(operation) || Infinity;
      const thresholdExceedances = metrics.filter(m => m.duration > threshold).length;

      summary.set(operation, {
        totalOperations,
        averageDuration: durations.reduce((a, b) => a + b, 0) / totalOperations,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        successRate: successfulOperations / totalOperations,
        thresholdExceedances
      });

      // 生成告警
      if (thresholdExceedances > 0) {
        alerts.push({
          operation,
          message: `Operation ${operation} exceeded threshold ${thresholdExceedances} times`,
          severity: 'warning',
          timestamp: Date.now()
        });
      }

      const errorRate = (totalOperations - successfulOperations) / totalOperations;
      if (errorRate > 0.1) { // 错误率超过10%
        alerts.push({
          operation,
          message: `Operation ${operation} has high error rate: ${(errorRate * 100).toFixed(1)}%`,
          severity: 'error',
          timestamp: Date.now()
        });
      }
    }

    // 获取最近的指标（最近100个）
    const recentMetrics = new Map<string, PerformanceMetrics[]>();
    for (const [operation, metrics] of this.metrics) {
      recentMetrics.set(operation, metrics.slice(-100));
    }

    return {
      summary,
      recentMetrics,
      alerts
    };
  }

  /**
   * 设置监控阈值
   */
  setThreshold(operation: string, thresholdMs: number): void {
    this.thresholds.set(operation, thresholdMs);
    this.logger?.info(`Performance threshold set for ${operation}: ${thresholdMs}ms`);
  }

  /**
   * 批量设置阈值
   */
  setThresholds(thresholds: Record<string, number>): void {
    for (const [operation, threshold] of Object.entries(thresholds)) {
      this.setThreshold(operation, threshold);
    }
  }

  /**
   * 启用/禁用监控
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger?.info(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 清理旧的指标数据
   */
  cleanup(keepLast: number = 1000): void {
    for (const [operation, metrics] of this.metrics) {
      if (metrics.length > keepLast) {
        this.metrics.set(operation, metrics.slice(-keepLast));
      }
    }
    this.logger?.debug(`Performance metrics cleaned up, keeping last ${keepLast} entries per operation`);
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.metrics.clear();
    this.logger?.info('Performance metrics reset');
  }

  /**
   * 获取特定操作的指标
   */
  getOperationMetrics(operation: string): PerformanceMetrics[] {
    return this.metrics.get(operation) || [];
  }

  /**
   * 获取所有操作名称
   */
  getOperations(): string[] {
    return Array.from(this.metrics.keys());
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      enabled: boolean;
      totalOperations: number;
      totalMetrics: number;
      recentAlerts: number;
    };
  }> {
    const report = this.generateReport();
    const totalMetrics = Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0);
    const recentAlerts = report.alerts.filter(alert =>
      Date.now() - alert.timestamp < 300000 // 最近5分钟的告警
    ).length;

    const hasCriticalAlerts = report.alerts.some(alert =>
      alert.severity === 'error' && Date.now() - alert.timestamp < 60000 // 最近1分钟的严重告警
    );

    // 检查警告级别的告警，如果存在则标记为降级
    const hasWarningAlerts = report.alerts.some(alert =>
      alert.severity === 'warning' && Date.now() - alert.timestamp < 60000 // 最近1分钟的警告
    );

    return {
      status: hasCriticalAlerts ? 'unhealthy' : hasWarningAlerts ? 'degraded' : 'healthy',
      details: {
        enabled: this.enabled,
        totalOperations: this.metrics.size,
        totalMetrics,
        recentAlerts
      }
    };
  }
}