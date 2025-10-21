import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 查询性能监控器
 * 使用项目现有的监控模块
 */
export class QueryPerformanceMonitor {
  private static performanceMonitor = new PerformanceMonitor(new LoggerService());
  private static queryMetrics = new Map<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    maxTime: number;
    minTime: number;
  }>();

  static recordQuery(queryType: string, executionTime: number): void {
    // 使用现有的性能监控器记录查询执行时间
    this.performanceMonitor.recordQueryExecution(executionTime);
    
    // 维护查询类型的详细统计
    const current = this.queryMetrics.get(queryType) || {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: Number.MAX_VALUE
    };

    current.count++;
    current.totalTime += executionTime;
    current.averageTime = current.totalTime / current.count;
    current.maxTime = Math.max(current.maxTime, executionTime);
    current.minTime = Math.min(current.minTime, executionTime);

    this.queryMetrics.set(queryType, current);
  }

  static recordCacheHit(isHit: boolean): void {
    // 使用现有的性能监控器记录缓存命中率
    this.performanceMonitor.updateCacheHitRate(isHit);
  }

  static getMetrics() {
    return Object.fromEntries(this.queryMetrics);
  }

  static getSystemMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  static getDetailedMetrics() {
    return this.performanceMonitor.getDetailedMetrics();
  }

  static clearMetrics(): void {
    this.queryMetrics.clear();
    this.performanceMonitor.resetMetrics();
  }

  static getSummary() {
    const allMetrics = Array.from(this.queryMetrics.values());
    if (allMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: 0
      };
    }

    const totalQueries = allMetrics.reduce((sum, metric) => sum + metric.count, 0);
    const totalTime = allMetrics.reduce((sum, metric) => sum + metric.totalTime, 0);
    const maxTime = Math.max(...allMetrics.map(metric => metric.maxTime));
    const minTime = Math.min(...allMetrics.map(metric => metric.minTime));

    return {
      totalQueries,
      averageExecutionTime: totalTime / totalQueries,
      maxExecutionTime: maxTime,
      minExecutionTime: minTime
    };
  }

  static startPeriodicMonitoring(intervalMs: number = 30000): void {
    this.performanceMonitor.startPeriodicMonitoring(intervalMs);
  }

  static stopPeriodicMonitoring(): void {
    this.performanceMonitor.stopPeriodicMonitoring();
  }
}