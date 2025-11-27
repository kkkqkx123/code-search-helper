import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { IPerformanceMonitor, PerformanceMetrics, OperationContext, OperationResult, ParsingOperationMetric, NormalizationOperationMetric, ChunkingOperationMetric, CachePerformanceStats } from './types';
import { InfrastructureConfigService } from '../config/InfrastructureConfigService';

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

@injectable()
export class PerformanceMonitor implements IPerformanceMonitor {
  private logger: LoggerService;
  private configService: InfrastructureConfigService;
  private metrics: PerformanceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queryExecutionTimes: number[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private batchSizes: number[] = [];
  private batchSuccesses: number = 0;
  private batchFailures: number = 0;
  // 通用操作监控相关属性
  private operationContexts: Map<string, OperationContext> = new Map();

  // 操作统计相关属性
  private operationMetrics: Map<string, PerformanceMetric> = new Map();

  // 缓存监控相关属性
  private cacheHitsByType: Map<string, number> = new Map();
  private cacheMissesByType: Map<string, number> = new Map();
  private cacheEvictionsByType: Map<string, number> = new Map();
  private cacheResponseTimes: Map<string, number[]> = new Map();
  private cacheHistory: CachePerformanceStats[] = [];

  // 配置值缓存
  private monitoringIntervalMs: number = 30000;
  private queryExecutionTimeThreshold: number = 5000;
  private memoryUsageThreshold: number = 80;
  private responseTimeThreshold: number = 2000;
  private enableDetailedLogging: boolean = true;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.InfrastructureConfigService) configService: InfrastructureConfigService
  ) {
    this.logger = logger;
    this.configService = configService;
    this.metrics = this.initializeMetrics();
    this.loadConfiguration();
  }

  /**
    * 从配置服务加载性能配置
    * 注意：性能配置现在由 QdrantConfigService 和 NebulaConfigService 管理
    * InfrastructureConfigService 仅包含通用基础设施配置
    */
  private loadConfiguration(): void {
    try {
      const config = this.configService.getConfig();

      // 尝试从 InfrastructureConfigService 加载性能配置
      // 如果不存在，将使用默认值
      if (config && typeof config === 'object') {
        // 检查 qdrant 对象是否存在且有性能配置
        const qdrant = (config as any).qdrant;
        if (qdrant && qdrant.performance) {
          const perfConfig = qdrant.performance;
          this.monitoringIntervalMs = perfConfig.monitoringInterval || 30000;
          this.enableDetailedLogging = perfConfig.enableDetailedLogging !== false;

          if (perfConfig.performanceThresholds) {
            this.queryExecutionTimeThreshold = perfConfig.performanceThresholds.queryExecutionTime || 5000;
            this.memoryUsageThreshold = perfConfig.performanceThresholds.memoryUsage || 80;
            this.responseTimeThreshold = perfConfig.performanceThresholds.responseTime || 2000;
          }
        }
      }

      this.logger.info('Performance monitor configuration loaded', {
        monitoringIntervalMs: this.monitoringIntervalMs,
        queryExecutionTimeThreshold: this.queryExecutionTimeThreshold,
        memoryUsageThreshold: this.memoryUsageThreshold,
        responseTimeThreshold: this.responseTimeThreshold,
        enableDetailedLogging: this.enableDetailedLogging
      });
    } catch (error) {
      this.logger.warn('Failed to load performance configuration, using defaults', {
        error: (error as Error).message
      });
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      queryExecutionTimes: [],
      averageQueryTime: 0,
      cacheHitRate: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        percentage: 0,
      },
      systemHealthStatus: 'healthy',
      batchProcessingStats: {
        totalBatches: 0,
        averageBatchSize: 0,
        successRate: 0,
      },
      timestamp: Date.now(),
    };
  }

  startPeriodicMonitoring(intervalMs?: number): void {
    if (this.monitoringInterval) {
      this.logger.warn('Performance monitoring is already running');
      return;
    }

    // 使用提供的间隔或从配置加载的间隔
    const interval = intervalMs || this.monitoringIntervalMs;

    this.logger.info('Starting periodic performance monitoring', { intervalMs: interval });

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.logMetricsSummary();
    }, interval);

    // Ensure interval doesn't prevent Node.js from exiting
    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }
  }

  stopPeriodicMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped periodic performance monitoring');
    } else {
      this.logger.warn('Performance monitoring is not running');
    }
  }

  recordQueryExecution(executionTimeMs: number): void {
    this.queryExecutionTimes.push(executionTimeMs);

    // Keep only the last 1000 query execution times
    if (this.queryExecutionTimes.length > 1000) {
      this.queryExecutionTimes = this.queryExecutionTimes.slice(-1000);
    }

    this.updateAverageQueryTime();
    this.logger.debug('Recorded query execution time', { executionTimeMs });
  }

  updateCacheHitRate(isHit: boolean): void {
    if (isHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    this.logger.debug('Updated cache hit rate', {
      isHit,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.metrics.cacheHitRate,
    });
  }

  updateBatchSize(batchSize: number): void {
    this.batchSizes.push(batchSize);

    // Keep only the last 100 batch sizes
    if (this.batchSizes.length > 100) {
      this.batchSizes = this.batchSizes.slice(-100);
    }

    this.updateBatchProcessingStats();
    this.logger.debug('Updated batch size', { batchSize });
  }

  updateSystemHealthStatus(status: 'healthy' | 'degraded' | 'error'): void {
    this.metrics.systemHealthStatus = status;
    this.logger.debug('Updated system health status', { status });
  }

  getMetrics(): PerformanceMetrics {
    // Update timestamp to current time
    this.metrics.timestamp = Date.now();

    // Calculate current memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    };

    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.logger.info('Resetting performance metrics');
    this.queryExecutionTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.batchSizes = [];
    this.batchSuccesses = 0;
    this.batchFailures = 0;
    this.operationMetrics.clear();
    this.resetCacheStats(); // 重置缓存统计
    this.metrics = this.initializeMetrics();
  }

  private updateAverageQueryTime(): void {
    if (this.queryExecutionTimes.length > 0) {
      const sum = this.queryExecutionTimes.reduce((acc, time) => acc + time, 0);
      this.metrics.averageQueryTime = sum / this.queryExecutionTimes.length;
    } else {
      this.metrics.averageQueryTime = 0;
    }
  }

  private updateBatchProcessingStats(): void {
    const totalBatches = this.batchSuccesses + this.batchFailures;
    this.metrics.batchProcessingStats = {
      totalBatches,
      averageBatchSize: this.batchSizes.length > 0
        ? this.batchSizes.reduce((sum, size) => sum + size, 0) / this.batchSizes.length
        : 0,
      successRate: totalBatches > 0 ? this.batchSuccesses / totalBatches : 0,
    };
  }

  private collectSystemMetrics(): void {
    // Update memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    };

    // Update query execution times
    this.metrics.queryExecutionTimes = [...this.queryExecutionTimes];
    this.updateAverageQueryTime();

    // Update batch processing stats
    this.updateBatchProcessingStats();

    // Update timestamp
    this.metrics.timestamp = Date.now();
  }

  private logMetricsSummary(): void {
    if (!this.enableDetailedLogging) {
      return;
    }

    const metrics = this.getMetrics();

    this.logger.info('Performance metrics summary', {
      averageQueryTime: `${metrics.averageQueryTime.toFixed(2)}ms`,
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(2)}%`,
      memoryUsage: `${metrics.memoryUsage.percentage.toFixed(2)}%`,
      systemHealthStatus: metrics.systemHealthStatus,
      batchProcessing: {
        totalBatches: metrics.batchProcessingStats.totalBatches,
        averageBatchSize: Math.round(metrics.batchProcessingStats.averageBatchSize),
        successRate: `${(metrics.batchProcessingStats.successRate * 100).toFixed(2)}%`,
      },
    });

    // Log warnings for potential issues using configured thresholds
    if (metrics.memoryUsage.percentage > this.memoryUsageThreshold) {
      this.logger.warn('High memory usage detected', {
        percentage: metrics.memoryUsage.percentage,
        threshold: this.memoryUsageThreshold,
      });
    }

    if (metrics.averageQueryTime > this.queryExecutionTimeThreshold) {
      this.logger.warn('High average query time detected', {
        averageQueryTime: metrics.averageQueryTime,
        threshold: this.queryExecutionTimeThreshold,
      });
    }

    if (metrics.systemHealthStatus === 'error') {
      this.logger.error('System health status is error');
    }
  }

  // Additional utility methods for batch processing
  recordBatchResult(success: boolean): void {
    if (success) {
      this.batchSuccesses++;
    } else {
      this.batchFailures++;
    }
    this.updateBatchProcessingStats();
  }

  getDetailedMetrics(): PerformanceMetrics & {
    queryExecutionTimes: number[];
    cacheHits: number;
    cacheMisses: number;
    batchSizes: number[];
    batchSuccesses: number;
    batchFailures: number;
  } {
    return {
      ...this.getMetrics(),
      queryExecutionTimes: [...this.queryExecutionTimes],
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      batchSizes: [...this.batchSizes],
      batchSuccesses: this.batchSuccesses,
      batchFailures: this.batchFailures,
    };
  }

  // 通用操作监控功能
  startOperation(operationType: string, metadata?: Record<string, any>): string {
    const operationId = `${operationType}_${Date.now()}_${Math.random()}`;
    const context: OperationContext = {
      operationId,
      operationType,
      startTime: Date.now(),
      metadata
    };

    this.operationContexts.set(operationId, context);
    this.logger.debug('Started operation', { operationId, operationType, metadata });

    return operationId;
  }

  endOperation(operationId: string, result?: Partial<OperationResult>): void {
    const context = this.operationContexts.get(operationId);
    if (!context) {
      this.logger.warn('Attempted to end non-existent operation', {
        operationId,
        operationType: operationId.split('_')[0] // 提取操作类型（ID的第一部分）
      });
      return;
    }

    const duration = Date.now() - context.startTime;
    const operationResult: OperationResult = {
      operationId,
      duration,
      success: result?.success ?? true,
      resultCount: result?.resultCount,
      error: result?.error,
      metadata: result?.metadata
    };

    this.operationContexts.delete(operationId);
    this.logger.debug('Ended operation', { ...operationResult, duration });

    // 可以根据需要记录到特定的指标数组
  }


  /**
   * 记录操作性能（简化版本）
   * @param operation 操作名称
   * @param duration 持续时间（毫秒）
   */
  recordOperation(operation: string, duration: number): void {
    // 记录查询执行时间
    this.recordQueryExecution(duration);

    // 记录操作特定日志
    this.logger.debug('Operation recorded', { operation, duration });

    // 检查阈值并记录警告
    if (duration > this.queryExecutionTimeThreshold) {
      this.logger.warn('Operation exceeded threshold', {
        operation,
        duration,
        threshold: this.queryExecutionTimeThreshold
      });
    }

    // 更新操作统计
    this.updateOperationStats(operation, duration);
  }

  /**
   * 更新操作统计
   */
  private updateOperationStats(operation: string, duration: number): void {
    // 获取或创建操作指标
    const metric = this.operationMetrics.get(operation) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastExecutionTime: new Date()
    };

    // 更新指标统计
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.lastExecutionTime = new Date();

    // 保存更新后的指标
    this.operationMetrics.set(operation, metric);
  }

  /**
   * 获取操作的性能统计
   * @param operation 操作名称
   * @returns 性能统计信息
   */
  getOperationStats(operation: string): OperationStats | null {
    const metric = this.operationMetrics.get(operation);
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
  getAllOperationStats(): OperationStats[] {
    const stats: OperationStats[] = [];
    for (const [operation, metric] of this.operationMetrics.entries()) {
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

  // 缓存监控相关方法实现

  /**
   * 记录缓存操作
   * @param operation 操作名称
   * @param duration 持续时间（毫秒）
   * @param cacheType 缓存类型（可选）
   */
  recordCacheOperation(operation: string, duration: number, cacheType?: string): void {
    const operationName = cacheType ? `cache.${cacheType}.${operation}` : `cache.${operation}`;
    this.recordOperation(operationName, duration);

    // 记录缓存响应时间
    if (cacheType) {
      if (!this.cacheResponseTimes.has(cacheType)) {
        this.cacheResponseTimes.set(cacheType, []);
      }
      const times = this.cacheResponseTimes.get(cacheType)!;
      times.push(duration);

      // 只保留最近100次响应时间
      if (times.length > 100) {
        times.splice(0, times.length - 100);
      }
    }
  }

  /**
   * 记录缓存命中
   * @param cacheType 缓存类型（可选）
   */
  recordCacheHit(cacheType?: string): void {
    this.updateCacheHitRate(true);

    if (cacheType) {
      const currentHits = this.cacheHitsByType.get(cacheType) || 0;
      this.cacheHitsByType.set(cacheType, currentHits + 1);
    }
  }

  /**
   * 记录缓存未命中
   * @param cacheType 缓存类型（可选）
   */
  recordCacheMiss(cacheType?: string): void {
    this.updateCacheHitRate(false);

    if (cacheType) {
      const currentMisses = this.cacheMissesByType.get(cacheType) || 0;
      this.cacheMissesByType.set(cacheType, currentMisses + 1);
    }
  }

  /**
   * 记录缓存驱逐
   * @param cacheType 缓存类型（可选）
   */
  recordCacheEviction(cacheType?: string): void {
    if (cacheType) {
      const currentEvictions = this.cacheEvictionsByType.get(cacheType) || 0;
      this.cacheEvictionsByType.set(cacheType, currentEvictions + 1);
    }
  }

  /**
   * 获取缓存性能统计
   * @returns 缓存性能统计信息
   */
  getCacheStats(): CachePerformanceStats {
    // 计算总体统计
    const totalHits = Array.from(this.cacheHitsByType.values()).reduce((sum, hits) => sum + hits, 0) + this.cacheHits;
    const totalMisses = Array.from(this.cacheMissesByType.values()).reduce((sum, misses) => sum + misses, 0) + this.cacheMisses;
    const totalEvictions = Array.from(this.cacheEvictionsByType.values()).reduce((sum, evictions) => sum + evictions, 0);
    const totalRequests = totalHits + totalMisses;

    // 计算平均响应时间
    let averageResponseTime = 0;
    if (this.cacheResponseTimes.size > 0) {
      const allTimes = Array.from(this.cacheResponseTimes.values()).flat();
      if (allTimes.length > 0) {
        averageResponseTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
      }
    }

    // 计算命中率趋势
    const hitRateTrend = this.calculateCacheHitRateTrend();

    const stats: CachePerformanceStats = {
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      missRate: totalRequests > 0 ? totalMisses / totalRequests : 0,
      evictionRate: totalRequests > 0 ? totalEvictions / totalRequests : 0,
      averageResponseTime,
      totalRequests,
      hits: totalHits,
      misses: totalMisses,
      evictions: totalEvictions,
      size: 0, // 需要从实际缓存服务获取
      memoryUsage: 0, // 需要从实际缓存服务获取
      hitRateTrend,
      timestamp: Date.now()
    };

    // 保存到历史记录
    this.cacheHistory.push(stats);

    // 限制历史记录大小
    if (this.cacheHistory.length > 1000) {
      this.cacheHistory = this.cacheHistory.slice(-500);
    }

    return stats;
  }

  /**
   * 计算缓存命中率趋势
   */
  private calculateCacheHitRateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.cacheHistory.length < 2) {
      return 'stable';
    }

    const recentStats = this.cacheHistory.slice(-10); // 最近10个数据点
    if (recentStats.length < 2) {
      return 'stable';
    }

    const first = recentStats[0].hitRate;
    const last = recentStats[recentStats.length - 1].hitRate;

    const change = last - first;
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  /**
   * 获取特定缓存类型的统计
   * @param cacheType 缓存类型
   * @returns 特定缓存类型的统计信息
   */
  getCacheStatsByType(cacheType: string): {
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
    averageResponseTime: number;
  } {
    const hits = this.cacheHitsByType.get(cacheType) || 0;
    const misses = this.cacheMissesByType.get(cacheType) || 0;
    const evictions = this.cacheEvictionsByType.get(cacheType) || 0;
    const totalRequests = hits + misses;

    // 计算平均响应时间
    let averageResponseTime = 0;
    const times = this.cacheResponseTimes.get(cacheType);
    if (times && times.length > 0) {
      averageResponseTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return {
      hits,
      misses,
      evictions,
      hitRate: totalRequests > 0 ? hits / totalRequests : 0,
      averageResponseTime
    };
  }


  /**
   * 重置缓存统计
   * @param cacheType 缓存类型（可选，如果不提供则重置所有）
   */
  resetCacheStats(cacheType?: string): void {
    if (cacheType) {
      this.cacheHitsByType.delete(cacheType);
      this.cacheMissesByType.delete(cacheType);
      this.cacheEvictionsByType.delete(cacheType);
      this.cacheResponseTimes.delete(cacheType);
    } else {
      this.cacheHitsByType.clear();
      this.cacheMissesByType.clear();
      this.cacheEvictionsByType.clear();
      this.cacheResponseTimes.clear();
      this.cacheHistory = [];
    }
  }
  resetOperationStats(operation: string): void {
    this.operationMetrics.delete(operation);
  }

  /**
   * 重置所有操作的性能统计
   */
  resetAllOperationStats(): void {
    this.operationMetrics.clear();
  
  
  }
}