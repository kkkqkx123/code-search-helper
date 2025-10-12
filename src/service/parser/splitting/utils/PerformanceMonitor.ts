import { PerformanceMonitor as PerformanceMonitorInterface, PerformanceStats } from '../types';
import { LoggerService } from '../../../../utils/LoggerService';

export class PerformanceMonitor implements PerformanceMonitorInterface {
 private totalLines: number = 0;
  private totalTime: number = 0;
  private cacheHits: number = 0;
  private totalRequests: number = 0;
  private logger?: LoggerService;

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
}