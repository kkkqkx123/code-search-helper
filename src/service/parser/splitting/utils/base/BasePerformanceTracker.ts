import { PerformanceStats } from '../..';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 性能监控基类
 * 提供统一的性能监控公共方法
 */
export abstract class BasePerformanceTracker {
  protected totalLines: number = 0;
  protected totalTime: number = 0;
  protected cacheHits: number = 0;
  protected totalRequests: number = 0;
  protected logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 记录性能指标
   * @param startTime 开始时间
   * @param linesProcessed 处理的行数
   * @param cacheHit 是否缓存命中
   */
  record(startTime: number, linesProcessed: number, cacheHit: boolean): void {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    const timePerLine = processingTime / linesProcessed;

    this.totalLines += linesProcessed;
    this.totalTime += processingTime;
    this.totalRequests++;
    if (cacheHit) {
      this.cacheHits++;
    }

    this.logger?.debug(`Performance metrics: ${linesProcessed} lines processed in ${processingTime}ms (${timePerLine.toFixed(3)}ms per line), cache hit: ${cacheHit}`);

    // 如果处理时间过长，记录警告
    if (timePerLine > 1.0) {
      this.logger?.warn(`Slow processing detected: ${timePerLine.toFixed(3)}ms per line`);
    }
  }

  /**
   * 获取性能统计
   */
  getStats(): PerformanceStats {
    return {
      totalLines: this.totalLines,
      totalTime: this.totalTime,
      averageTimePerLine: this.totalLines > 0 ? this.totalTime / this.totalLines : 0,
      cacheHitRate: this.totalRequests > 0 ? this.cacheHits / this.totalRequests : 0,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * 重置性能统计
   */
  reset(): void {
    this.totalLines = 0;
    this.totalTime = 0;
    this.cacheHits = 0;
    this.totalRequests = 0;
  }

  /**
   * 计算处理指标
   */
  calculateProcessingMetrics(startTime: number, linesProcessed: number): ProcessingMetrics {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    const timePerLine = processingTime / linesProcessed;

    return {
      processingTime,
      linesProcessed,
      timePerLine,
      linesPerSecond: linesProcessed / (processingTime / 1000),
      isSlow: timePerLine > 1.0
    };
  }

  /**
   * 获取缓存命中率
   */
  protected calculateCacheHitRate(): number {
    const total = this.cacheHits + (this.totalRequests - this.cacheHits);
    return total > 0 ? this.cacheHits / total : 0;
  }

  /**
   * 监控内存使用情况
   */
  monitorMemoryUsage(): {
    current: NodeJS.MemoryUsage;
    threshold: number;
    isHighUsage: boolean;
  } {
    const current = process.memoryUsage();
    const threshold = 500 * 1024 * 1024; // 500MB
    const isHighUsage = current.heapUsed > threshold;

    return {
      current,
      threshold,
      isHighUsage
    };
  }
}

/**
 * 处理指标接口
 */
export interface ProcessingMetrics {
  processingTime: number;
  linesProcessed: number;
  timePerLine: number;
  linesPerSecond: number;
  isSlow: boolean;
}