import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  /** 操作名称 */
  operation: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 内存使用情况 */
  memoryUsage?: MemoryUsage;
  /** CPU使用情况 */
  cpuUsage?: number;
  /** 自定义指标 */
  customMetrics?: Record<string, any>;
}

/**
 * 内存使用情况
 */
export interface MemoryUsage {
  /** 堆内存使用量（字节） */
  heapUsed: number;
  /** 堆内存总量（字节） */
  heapTotal: number;
  /** 外部内存使用量（字节） */
  external: number;
  /** 数组缓冲区使用量（字节） */
  arrayBuffers: number;
  /** 使用百分比 */
  percentage: number;
}

/**
 * 批处理统计
 */
export interface BatchProcessingStats {
  /** 总批次数 */
  totalBatches: number;
  /** 成功批次数 */
  successfulBatches: number;
  /** 失败批次数 */
  failedBatches: number;
  /** 平均批次处理时间 */
  averageBatchTime: number;
  /** 最快批次处理时间 */
  fastestBatchTime: number;
  /** 最慢批次处理时间 */
  slowestBatchTime: number;
  /** 总处理项目数 */
  totalItems: number;
  /** 成功处理项目数 */
  successfulItems: number;
  /** 失败处理项目数 */
  failedItems: number;
  /** 吞吐量（项目/秒） */
  throughput: number;
}

/**
 * 性能监控配置
 */
export interface PerformanceMonitorConfig {
  /** 是否启用内存监控 */
  enableMemoryMonitoring: boolean;
  /** 是否启用CPU监控 */
  enableCpuMonitoring: boolean;
  /** 内存监控间隔（毫秒） */
  memoryMonitorInterval: number;
  /** 最大历史记录数 */
  maxHistorySize: number;
  /** 是否启用自动清理 */
  enableAutoCleanup: boolean;
  /** 清理间隔（毫秒） */
  cleanupInterval: number;
}

/**
 * 性能监控服务
 * 负责监控批处理过程中的性能指标和内存使用情况
 */
@injectable()
export class PerformanceMonitor {
  private metricsHistory: PerformanceMetrics[] = [];
  private batchStats: Map<string, BatchProcessingStats> = new Map();
  private memoryMonitorInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  
  private readonly defaultConfig: PerformanceMonitorConfig = {
    enableMemoryMonitoring: true,
    enableCpuMonitoring: false,
    memoryMonitorInterval: 1000,
    maxHistorySize: 1000,
    enableAutoCleanup: true,
    cleanupInterval: 60000 // 1分钟
  };

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    private config: Partial<PerformanceMonitorConfig> = {}
  ) {
    this.config = { ...this.defaultConfig, ...this.config };
    
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * 开始监控操作
   */
  startMonitoring(operation: string, customMetrics?: Record<string, any>): string {
    const monitoringId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metrics: PerformanceMetrics = {
      operation,
      startTime: Date.now(),
      memoryUsage: this.config.enableMemoryMonitoring ? this.getCurrentMemoryUsage() : undefined,
      customMetrics
    };

    this.metricsHistory.push(metrics);
    
    this.logger.debug(`Started monitoring operation`, {
      monitoringId,
      operation,
      memoryUsage: metrics.memoryUsage
    });

    return monitoringId;
  }

  /**
   * 结束监控操作
   */
  endMonitoring(monitoringId: string, customMetrics?: Record<string, any>): PerformanceMetrics | null {
    const metrics = this.findMetricsById(monitoringId);
    if (!metrics) {
      this.logger.warn(`Monitoring session not found`, { monitoringId });
      return null;
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    
    if (this.config.enableMemoryMonitoring) {
      const finalMemoryUsage = this.getCurrentMemoryUsage();
      metrics.memoryUsage = finalMemoryUsage;
      
      // 计算内存增长
      if (metrics.customMetrics) {
        metrics.customMetrics.memoryGrowth = finalMemoryUsage.heapUsed - (metrics.memoryUsage?.heapUsed || 0);
      }
    }

    if (customMetrics) {
      metrics.customMetrics = { ...metrics.customMetrics, ...customMetrics };
    }

    this.logger.debug(`Completed monitoring operation`, {
      monitoringId,
      operation: metrics.operation,
      duration: metrics.duration,
      memoryUsage: metrics.memoryUsage
    });

    return metrics;
  }

  /**
   * 记录批处理统计
   */
  recordBatchStats(
    operation: string,
    batchStats: {
      batchSize: number;
      duration: number;
      successCount: number;
      failureCount: number;
    }
  ): void {
    const existing = this.batchStats.get(operation) || {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      averageBatchTime: 0,
      fastestBatchTime: Infinity,
      slowestBatchTime: 0,
      totalItems: 0,
      successfulItems: 0,
      failedItems: 0,
      throughput: 0
    };

    // 更新统计
    existing.totalBatches++;
    existing.totalItems += batchStats.batchSize;
    existing.successfulItems += batchStats.successCount;
    existing.failedItems += batchStats.failureCount;

    if (batchStats.failureCount === 0) {
      existing.successfulBatches++;
    } else {
      existing.failedBatches++;
    }

    // 更新时间统计
    existing.averageBatchTime = (existing.averageBatchTime * (existing.totalBatches - 1) + batchStats.duration) / existing.totalBatches;
    existing.fastestBatchTime = Math.min(existing.fastestBatchTime, batchStats.duration);
    existing.slowestBatchTime = Math.max(existing.slowestBatchTime, batchStats.duration);

    // 计算吞吐量
    const totalDuration = existing.averageBatchTime * existing.totalBatches;
    existing.throughput = totalDuration > 0 ? (existing.successfulItems / totalDuration) * 1000 : 0;

    this.batchStats.set(operation, existing);

    this.logger.debug(`Recorded batch statistics`, {
      operation,
      batchSize: batchStats.batchSize,
      duration: batchStats.duration,
      successCount: batchStats.successCount,
      failureCount: batchStats.failureCount
    });
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemoryUsage(): MemoryUsage {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const percentage = heapTotal > 0 ? (heapUsed / heapTotal) * 100 : 0;

    return {
      heapUsed,
      heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      percentage
    };
  }

  /**
   * 获取操作性能统计
   */
  getOperationStats(operation: string): {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
    successRate: number;
  } | null {
    const operationMetrics = this.metricsHistory.filter(m => m.operation === operation && m.duration);
    
    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration!);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    
    return {
      count: operationMetrics.length,
      averageDuration: totalDuration / operationMetrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration,
      successRate: 100 // 这里可以根据成功/失败状态计算
    };
  }

  /**
   * 获取批处理统计
   */
  getBatchStats(operation: string): BatchProcessingStats | null {
    return this.batchStats.get(operation) || null;
  }

  /**
   * 获取所有批处理统计
   */
  getAllBatchStats(): Record<string, BatchProcessingStats> {
    return Object.fromEntries(this.batchStats);
  }

  /**
   * 获取内存使用趋势
   */
  getMemoryTrend(limit: number = 100): Array<{
    timestamp: number;
    memoryUsage: MemoryUsage;
  }> {
    const memoryMetrics = this.metricsHistory
      .filter(m => m.memoryUsage)
      .slice(-limit);

    return memoryMetrics.map(m => ({
      timestamp: m.startTime,
      memoryUsage: m.memoryUsage!
    }));
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): {
    totalOperations: number;
    averageOperationTime: number;
    memoryUsage: MemoryUsage;
    topOperations: Array<{
      operation: string;
      count: number;
      averageDuration: number;
    }>;
    batchOperations: Array<{
      operation: string;
      totalBatches: number;
      throughput: number;
    }>;
  } {
    const operationCounts = new Map<string, { count: number; totalDuration: number }>();
    
    for (const metrics of this.metricsHistory) {
      if (metrics.duration) {
        const existing = operationCounts.get(metrics.operation) || { count: 0, totalDuration: 0 };
        existing.count++;
        existing.totalDuration += metrics.duration;
        operationCounts.set(metrics.operation, existing);
      }
    }

    const topOperations = Array.from(operationCounts.entries())
      .map(([operation, stats]) => ({
        operation,
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const batchOperations = Array.from(this.batchStats.entries())
      .map(([operation, stats]) => ({
        operation,
        totalBatches: stats.totalBatches,
        throughput: stats.throughput
      }))
      .sort((a, b) => b.throughput - a.throughput);

    const totalOperations = this.metricsHistory.length;
    const completedOperations = this.metricsHistory.filter(m => m.duration).length;
    const averageOperationTime = completedOperations > 0 
      ? this.metricsHistory.reduce((sum, m) => sum + (m.duration || 0), 0) / completedOperations 
      : 0;

    return {
      totalOperations,
      averageOperationTime,
      memoryUsage: this.getCurrentMemoryUsage(),
      topOperations,
      batchOperations
    };
  }

  /**
   * 清理历史记录
   */
  cleanup(): void {
    const beforeCount = this.metricsHistory.length;
    
    // 保留最近的记录
    const maxHistorySize = this.config.maxHistorySize || this.defaultConfig.maxHistorySize;
    this.metricsHistory = this.metricsHistory.slice(-maxHistorySize);
    
    // 清理过期的批处理统计（超过1小时的）
    const oneHourAgo = Date.now() - 3600000;
    for (const [operation, stats] of this.batchStats.entries()) {
      // 这里可以添加时间戳检查逻辑
      // 暂时保留所有统计，因为 BatchProcessingStats 中没有时间戳
      if (this.config.enableAutoCleanup) {
        // stats 不包含时间戳，所以无法进行基于时间的清理
      }
    }

    const afterCount = this.metricsHistory.length;
    
    this.logger.debug(`Performance monitor cleanup completed`, {
      beforeCount,
      afterCount,
      removedCount: beforeCount - afterCount
    });
  }

  /**
   * 重置所有统计
   */
  reset(): void {
    this.metricsHistory = [];
    this.batchStats.clear();
    
    this.logger.info(`Performance monitor reset completed`);
  }

  /**
   * 启动自动清理
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 根据ID查找指标
   */
  private findMetricsById(monitoringId: string): PerformanceMetrics | null {
    // 这里可以实现更复杂的ID查找逻辑
    // 暂时返回最新的匹配操作
    const operation = monitoringId.split('_')[0];
    const candidates = this.metricsHistory.filter(m => 
      m.operation === operation && !m.endTime
    );
    
    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.reset();
    
    this.logger.info(`Performance monitor destroyed`);
  }

  /**
   * 导出性能数据
   */
  exportData(): {
    timestamp: number;
    metricsHistory: PerformanceMetrics[];
    batchStats: Record<string, BatchProcessingStats>;
    config: PerformanceMonitorConfig;
  } {
    return {
      timestamp: Date.now(),
      metricsHistory: [...this.metricsHistory],
      batchStats: this.getAllBatchStats(),
      config: { ...this.defaultConfig, ...this.config }
    };
  }

  /**
   * 导入性能数据
   */
  importData(data: {
    metricsHistory: PerformanceMetrics[];
    batchStats: Record<string, BatchProcessingStats>;
  }): void {
    this.metricsHistory = [...data.metricsHistory];
    this.batchStats = new Map(Object.entries(data.batchStats));
    
    this.logger.info(`Performance data imported`, {
      metricsCount: data.metricsHistory.length,
      batchStatsCount: Object.keys(data.batchStats).length
    });
  }
}