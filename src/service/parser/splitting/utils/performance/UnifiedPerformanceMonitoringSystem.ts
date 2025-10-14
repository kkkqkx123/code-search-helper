import {
  IPerformanceMonitoringSystem,
  OperationMetrics,
  MemoryUsageStats,
  CacheStats,
  PerformanceReport,
  PerformanceThresholds,
  PerformanceAlert
} from './IPerformanceMonitoringSystem';
import { LoggerService } from '../../../../../utils/LoggerService';
import { EventEmitter } from 'events';

/**
 * 统一性能监控系统实现
 * 提供全面的性能监控、报告和告警功能
 */
export class UnifiedPerformanceMonitoringSystem extends EventEmitter implements IPerformanceMonitoringSystem {
  private logger?: LoggerService;
  private operations: OperationMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private memorySnapshots: NodeJS.MemoryUsage[] = [];
  private cacheStats: CacheStats;
  private startTime: number;
  private lastReport: PerformanceReport | null = null;

  // 默认阈值
  private readonly DEFAULT_THRESHOLDS: PerformanceThresholds = {
    maxProcessingTime: 5000,      // 5秒
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    minCacheHitRate: 0.3,         // 30%
    maxErrorRate: 0.1,            // 10%
    slowOperationThreshold: 1000  // 1秒
  };

  constructor(logger?: LoggerService, thresholds?: Partial<PerformanceThresholds>) {
    super();
    this.logger = logger;
    this.thresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
    this.startTime = Date.now();
    
    this.cacheStats = {
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      averageAccessTime: 0
    };

    this.startMemoryMonitoring();
  }

  /**
   * 记录操作指标
   */
  recordOperation(operation: string, metrics: OperationMetrics): void {
    const operationMetric: OperationMetrics = {
      duration: metrics.duration,
      operation: operation,
      success: metrics.success,
      error: metrics.error,
      metadata: metrics.metadata,
      timestamp: Date.now()
    };

    this.operations.push(operationMetric);
    
    // 检查是否需要告警
    this.checkForAlerts(operationMetric);
    
    this.logger?.debug('Performance operation recorded', {
      operation,
      duration: metrics.duration,
      success: metrics.success
    });

    this.emit('operation-recorded', operationMetric);
  }

  /**
   * 监控内存使用
   */
  monitorMemoryUsage(): MemoryUsageStats {
    const current = process.memoryUsage();
    this.memorySnapshots.push(current);

    // 限制快照数量
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots.shift();
    }

    const peak = this.memorySnapshots.reduce((max, snapshot) => ({
      rss: Math.max(max.rss, snapshot.rss),
      heapTotal: Math.max(max.heapTotal, snapshot.heapTotal),
      heapUsed: Math.max(max.heapUsed, snapshot.heapUsed),
      external: Math.max(max.external, snapshot.external),
      arrayBuffers: Math.max(max.arrayBuffers, snapshot.arrayBuffers)
    }), current);

    const average = this.calculateAverageMemoryUsage();
    const isHighUsage = current.heapUsed > this.thresholds.maxMemoryUsage;

    const stats: MemoryUsageStats = {
      current,
      peak,
      average,
      threshold: this.thresholds.maxMemoryUsage,
      isHighUsage
    };

    if (isHighUsage) {
      this.generateAlert('memory-usage', current.heapUsed, this.thresholds.maxMemoryUsage, 
        `High memory usage detected: ${(current.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    return stats;
  }

  /**
   * 获取缓存统计
   */
  getCacheStatistics(): CacheStats {
    return { ...this.cacheStats };
  }

  /**
   * 更新缓存统计
   */
  updateCacheStats(update: Partial<CacheStats>): void {
    this.cacheStats = { ...this.cacheStats, ...update };
    
    // 重新计算命中率
    const total = this.cacheStats.hits + this.cacheStats.misses;
    if (total > 0) {
      this.cacheStats.hitRate = this.cacheStats.hits / total;
    }

    // 检查缓存命中率告警
    if (this.cacheStats.hitRate < this.thresholds.minCacheHitRate) {
      this.generateAlert('cache-hit-rate', this.cacheStats.hitRate, this.thresholds.minCacheHitRate,
        `Low cache hit rate: ${(this.cacheStats.hitRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): PerformanceReport {
    const now = Date.now();
    const duration = now - this.startTime;
    
    const successfulOps = this.operations.filter(op => op.success);
    const failedOps = this.operations.filter(op => !op.success);
    const totalOps = this.operations.length;
    
    const avgProcessingTime = totalOps > 0 
      ? this.operations.reduce((sum, op) => sum + op.duration, 0) / totalOps 
      : 0;

    const slowOps = this.operations.filter(op => op.duration > this.thresholds.slowOperationThreshold);
    
    const errorGroups = this.groupErrors(failedOps);
    
    const recommendations = this.generateRecommendations();

    const report: PerformanceReport = {
      timestamp: now,
      duration,
      totalOperations: totalOps,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      errorRate: totalOps > 0 ? failedOps.length / totalOps : 0,
      averageProcessingTime: avgProcessingTime,
      memoryUsage: this.monitorMemoryUsage(),
      cacheStats: this.getCacheStatistics(),
      slowOperations: slowOps,
      topErrors: errorGroups,
      recommendations
    };

    this.lastReport = report;
    this.emit('report-generated', report);
    
    return report;
  }

  /**
   * 设置性能告警
   */
  setupPerformanceAlerts(thresholds: PerformanceThresholds): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger?.info('Performance alert thresholds updated', this.thresholds);
  }

  /**
   * 获取当前告警
   */
  getCurrentAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.operations = [];
    this.alerts = [];
    this.memorySnapshots = [];
    this.cacheStats = {
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      averageAccessTime: 0
    };
    this.startTime = Date.now();
    this.lastReport = null;
    
    this.logger?.info('Performance monitoring system reset');
    this.emit('system-reset');
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): {
    isHealthy: boolean;
    alerts: PerformanceAlert[];
    lastReport: PerformanceReport | null;
  } {
    const criticalAlerts = this.alerts.filter(alert => alert.type === 'critical');
    const hasRecentOps = this.operations.length > 0 &&
      (Date.now() - (this.operations[this.operations.length - 1].timestamp || 0)) < 30000; // 30秒内

    return {
      isHealthy: criticalAlerts.length === 0 && hasRecentOps,
      alerts: [...this.alerts],
      lastReport: this.lastReport
    };
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring(): void {
    // 每30秒检查一次内存使用
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 30000);

    this.logger?.info('Memory monitoring started');
  }

  /**
   * 检查是否需要告警
   */
  private checkForAlerts(metric: OperationMetrics): void {
    // 检查处理时间告警
    if (metric.duration > this.thresholds.maxProcessingTime) {
      this.generateAlert('processing-time', metric.duration, this.thresholds.maxProcessingTime,
        `Slow operation detected: ${metric.operation} took ${metric.duration}ms`);
    }

    // 检查慢操作告警
    if (metric.duration > this.thresholds.slowOperationThreshold) {
      this.generateAlert('slow-operation', metric.duration, this.thresholds.slowOperationThreshold,
        `Slow operation: ${metric.operation}`);
    }

    // 检查错误率告警
    const recentOps = this.getRecentOperations(100);
    const errorRate = recentOps.filter(op => !op.success).length / recentOps.length;
    if (errorRate > this.thresholds.maxErrorRate) {
      this.generateAlert('error-rate', errorRate, this.thresholds.maxErrorRate,
        `High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * 生成告警
   */
  private generateAlert(metric: string, value: number, threshold: number, message: string): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: value > threshold * 1.5 ? 'critical' : 'warning',
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      message,
      recommendation: this.getRecommendationForMetric(metric, value, threshold)
    };

    this.alerts.push(alert);
    
    // 限制告警数量
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    this.logger?.warn('Performance alert generated', alert);
    this.emit('alert-generated', alert);
  }

  /**
   * 获取最近的操作
   */
  private getRecentOperations(count: number): OperationMetrics[] {
    return this.operations.slice(-count);
  }

  /**
   * 计算平均内存使用
   */
  private calculateAverageMemoryUsage(): NodeJS.MemoryUsage {
    if (this.memorySnapshots.length === 0) {
      return process.memoryUsage();
    }

    const sum = this.memorySnapshots.reduce((acc, snapshot) => ({
      rss: acc.rss + snapshot.rss,
      heapTotal: acc.heapTotal + snapshot.heapTotal,
      heapUsed: acc.heapUsed + snapshot.heapUsed,
      external: acc.external + snapshot.external,
      arrayBuffers: acc.arrayBuffers + snapshot.arrayBuffers
    }), { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 });

    const count = this.memorySnapshots.length;
    return {
      rss: sum.rss / count,
      heapTotal: sum.heapTotal / count,
      heapUsed: sum.heapUsed / count,
      external: sum.external / count,
      arrayBuffers: sum.arrayBuffers / count
    };
  }

  /**
   * 分组错误
   */
  private groupErrors(failedOps: OperationMetrics[]): Array<{ error: string; count: number; percentage: number }> {
    const errorGroups = new Map<string, number>();
    
    failedOps.forEach(op => {
      const error = op.error || 'Unknown error';
      errorGroups.set(error, (errorGroups.get(error) || 0) + 1);
    });

    const total = failedOps.length;
    return Array.from(errorGroups.entries())
      .map(([error, count]) => ({
        error,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // 只显示前5个错误
  }

  /**
   * 生成建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // 内存使用建议
    const memoryStats = this.monitorMemoryUsage();
    if (memoryStats.isHighUsage) {
      recommendations.push('Consider reducing memory usage by optimizing data structures');
    }

    // 缓存命中率建议
    if (this.cacheStats.hitRate < this.thresholds.minCacheHitRate) {
      recommendations.push('Cache hit rate is low, consider adjusting cache strategy');
    }

    // 处理时间建议
    const avgTime = this.operations.length > 0 
      ? this.operations.reduce((sum, op) => sum + op.duration, 0) / this.operations.length 
      : 0;
    if (avgTime > this.thresholds.slowOperationThreshold) {
      recommendations.push('Average processing time is high, consider optimizing algorithms');
    }

    // 错误率建议
    const errorRate = this.operations.length > 0 
      ? this.operations.filter(op => !op.success).length / this.operations.length 
      : 0;
    if (errorRate > this.thresholds.maxErrorRate) {
      recommendations.push('Error rate is high, review error handling and input validation');
    }

    return recommendations;
  }

  /**
   * 获取指标的建议
   */
  private getRecommendationForMetric(metric: string, value: number, threshold: number): string {
    const recommendations: Record<string, string> = {
      'processing-time': 'Consider optimizing the operation algorithm or reducing complexity',
      'memory-usage': 'Review memory usage patterns and implement better cleanup strategies',
      'cache-hit-rate': 'Adjust cache size or eviction policies to improve hit rate',
      'error-rate': 'Implement better error handling and input validation',
      'slow-operation': 'Profile the operation to identify bottlenecks'
    };

    return recommendations[metric] || 'Review the operation for optimization opportunities';
  }
}