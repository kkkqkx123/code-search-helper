import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { NormalizationOperationMetric } from '../../../../infrastructure/monitoring/types';
import { LoggerService } from '../../../../utils/LoggerService';

export interface OperationTimer {
  startTime: number;
  operation: string;
  language?: string;
  queryType?: string;
}

export class NormalizationPerformanceAdapter {
  private monitor: PerformanceMonitor;
  private operationTimers: Map<string, OperationTimer>;
  private customMetrics: Map<string, any>;

  constructor() {
    // 创建一个简单的 logger 实例
    const logger = new LoggerService();
    this.monitor = new PerformanceMonitor(logger);
    this.operationTimers = new Map();
    this.customMetrics = new Map();
  }

  // 自定义指标存储方法
  private setMetric(key: string, value: any): void {
    this.customMetrics.set(key, value);
  }

  private getMetric(key: string): any {
    return this.customMetrics.get(key);
  }

  private incrementMetric(key: string, increment: number = 1): void {
    const current = this.getMetric(key) || 0;
    this.setMetric(key, current + increment);
  }

  startOperation(operation: string, language?: string, queryType?: string): string {
    const key = `${operation}:${language || 'unknown'}:${queryType || 'unknown'}:${Date.now()}`;
    const startTime = Date.now();
    this.operationTimers.set(key, { startTime, operation, language, queryType });
    return key;
  }

  endOperation(timerKey: string): number | null {
    const timer = this.operationTimers.get(timerKey);
    if (!timer) {
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - timer.startTime;

    // 记录特定于查询标准化的指标
    const metric: NormalizationOperationMetric = {
      operation: 'normalize' as const,
      language: timer.language || 'unknown',
      queryType: timer.queryType || 'unknown',
      duration,
      success: true,
      timestamp: endTime,
      metadata: {
        resultCount: 1,
        adapterType: 'NormalizationPerformanceAdapter'
      }
    };
    
    this.monitor.recordNormalizationOperation(metric);

    this.operationTimers.delete(timerKey);
    return duration;
  }

  recordCacheHit(queryType: string): void {
    const key = `normalization.cache.hits.${queryType}`;
    this.incrementMetric(key);
  }

  recordOperation(operation: string, count: number, duration: number, language?: string): void {
    const metricPrefix = `normalization.${operation}`;
    this.setMetric(`${metricPrefix}.count`, count);
    this.setMetric(`${metricPrefix}.duration`, duration);

    if (language) {
      this.setMetric(`${metricPrefix}.${language}.count`, count);
      this.setMetric(`${metricPrefix}.${language}.duration`, duration);
    }
  }

  recordError(operation: string, error: Error, language?: string): void {
    const metricPrefix = `normalization.${operation}.errors`;
    this.incrementMetric(metricPrefix);

    if (language) {
      const langSpecificKey = `normalization.${operation}.${language}.errors`;
      this.incrementMetric(langSpecificKey);
    }
  }

  getMetrics(): any {
    return this.monitor.getMetrics();
  }

  getOperationCount(operation: string): number {
    return this.getMetric(`normalization.${operation}.count`) || 0;
  }

  getAverageDuration(operation: string): number {
    const durations = this.getMetric(`normalization.${operation}.duration`) || [];
    if (Array.isArray(durations) && durations.length > 0) {
      return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    }
    return 0;
  }
}