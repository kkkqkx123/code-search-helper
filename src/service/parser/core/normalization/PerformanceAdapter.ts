import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';

export interface OperationTimer {
  startTime: number;
  operation: string;
  language?: string;
  queryType?: string;
}

export class NormalizationPerformanceAdapter {
  private monitor: PerformanceMonitor;
  private operationTimers: Map<string, OperationTimer>;
  
  constructor() {
    this.monitor = new PerformanceMonitor();
    this.operationTimers = new Map();
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
    const metricPrefix = `normalization.${timer.operation}`;
    this.monitor.recordMetric(`${metricPrefix}.duration`, duration);
    this.monitor.recordMetric(`${metricPrefix}.timestamp`, endTime);
    
    if (timer.language) {
      this.monitor.recordMetric(`${metricPrefix}.${timer.language}.duration`, duration);
    }
    
    if (timer.queryType) {
      this.monitor.recordMetric(`${metricPrefix}.${timer.queryType}.duration`, duration);
    }
    
    this.operationTimers.delete(timerKey);
    return duration;
  }
  
  recordCacheHit(queryType: string): void {
    const key = `normalization.cache.hits.${queryType}`;
    const current = this.monitor.getMetric(key) || 0;
    this.monitor.recordMetric(key, current + 1);
  }
  
  recordOperation(operation: string, count: number, duration: number, language?: string): void {
    const metricPrefix = `normalization.${operation}`;
    this.monitor.recordMetric(`${metricPrefix}.count`, count);
    this.monitor.recordMetric(`${metricPrefix}.duration`, duration);
    
    if (language) {
      this.monitor.recordMetric(`${metricPrefix}.${language}.count`, count);
      this.monitor.recordMetric(`${metricPrefix}.${language}.duration`, duration);
    }
  }
  
  recordError(operation: string, error: Error, language?: string): void {
    const metricPrefix = `normalization.${operation}.errors`;
    const current = this.monitor.getMetric(metricPrefix) || 0;
    this.monitor.recordMetric(metricPrefix, current + 1);
    
    if (language) {
      const langSpecificKey = `normalization.${operation}.${language}.errors`;
      const currentLang = this.monitor.getMetric(langSpecificKey) || 0;
      this.monitor.recordMetric(langSpecificKey, currentLang + 1);
    }
  }
  
  getMetrics(): any {
    return this.monitor.getMetrics();
  }
  
  getOperationCount(operation: string): number {
    return this.monitor.getMetric(`normalization.${operation}.count`) || 0;
  }
  
  getAverageDuration(operation: string): number {
    const durations = this.monitor.getMetric(`normalization.${operation}.duration`) || [];
    if (Array.isArray(durations) && durations.length > 0) {
      return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    }
    return 0;
  }
}