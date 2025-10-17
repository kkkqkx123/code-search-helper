import { PerformanceStats } from '../..';

/**
 * 操作指标接口
 */
export interface OperationMetrics {
  duration: number;
  operation: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

/**
 * 内存使用统计
 */
export interface MemoryUsageStats {
  current: NodeJS.MemoryUsage;
  peak: NodeJS.MemoryUsage;
  average: NodeJS.MemoryUsage;
  threshold: number;
  isHighUsage: boolean;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  averageAccessTime: number;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  maxProcessingTime: number;      // 最大处理时间 (ms)
  maxMemoryUsage: number;         // 最大内存使用 (bytes)
  minCacheHitRate: number;        // 最小缓存命中率
  maxErrorRate: number;           // 最大错误率
  slowOperationThreshold: number; // 慢操作阈值 (ms)
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  timestamp: number;
  duration: number;           // 报告期间长度 (ms)
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  errorRate: number;
  averageProcessingTime: number;
  memoryUsage: MemoryUsageStats;
  cacheStats: CacheStats;
  slowOperations: OperationMetrics[];
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  recommendations: string[];
}

/**
 * 性能告警
 */
export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
  recommendation?: string;
}

/**
 * 统一性能监控系统接口
 */
export interface IPerformanceMonitoringSystem {
  /**
   * 记录操作指标
   */
  recordOperation(operation: string, metrics: OperationMetrics): void;

  /**
   * 监控内存使用
   */
  monitorMemoryUsage(): MemoryUsageStats;

  /**
   * 获取缓存统计
   */
  getCacheStatistics(): CacheStats;

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): PerformanceReport;

  /**
   * 设置性能告警
   */
  setupPerformanceAlerts(thresholds: PerformanceThresholds): void;

  /**
   * 获取当前告警
   */
  getCurrentAlerts(): PerformanceAlert[];

  /**
   * 重置统计
   */
  reset(): void;

  /**
   * 获取系统状态
   */
  getSystemStatus(): {
    isHealthy: boolean;
    alerts: PerformanceAlert[];
    lastReport: PerformanceReport | null;
  };
}