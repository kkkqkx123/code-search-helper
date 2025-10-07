import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { TransactionLogger } from './TransactionLogger';

export interface TransactionPerformanceMetrics {
  transactionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  databasesInvolved: number;
  operationsCount: number;
  success: boolean;
  error?: string;
  batchSize?: number;
  concurrencyLevel?: number;
}

export interface PerformanceOptimizationConfig {
  minBatchSize: number;
  maxBatchSize: number;
  defaultBatchSize: number;
  minConcurrency: number;
  maxConcurrency: number;
  defaultConcurrency: number;
  performanceThreshold: number; // 毫秒
  adjustmentFactor: number; // 调整因子
  metricsRetentionPeriod: number; // 毫秒
}

@injectable()
export class TransactionPerformanceOptimizer {
  private logger: LoggerService;
  private transactionLogger: TransactionLogger;
  private config: PerformanceOptimizationConfig;
  private performanceMetrics: TransactionPerformanceMetrics[] = [];
  private currentBatchSize: number;
  private currentConcurrency: number;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.TransactionLogger) transactionLogger: TransactionLogger,
    config?: Partial<PerformanceOptimizationConfig>
  ) {
    this.logger = logger;
    this.transactionLogger = transactionLogger;
    this.config = {
      minBatchSize: 10,
      maxBatchSize: 500,
      defaultBatchSize: 50,
      minConcurrency: 1,
      maxConcurrency: 10,
      defaultConcurrency: 3,
      performanceThreshold: 1000, // 1秒
      adjustmentFactor: 0.1,
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24小时
      ...config
    };

    this.currentBatchSize = this.config.defaultBatchSize;
    this.currentConcurrency = this.config.defaultConcurrency;

    this.logger.info('TransactionPerformanceOptimizer initialized', { config: this.config });
  }

  /**
   * 优化事务执行参数
   */
  async optimizeTransactionParams(
    expectedOperationsCount: number
  ): Promise<{ batchSize: number; concurrency: number; }> {
    const { avgDuration, successRate } = this.getHistoricalPerformance();

    let optimizedBatchSize = this.currentBatchSize;
    let optimizedConcurrency = this.currentConcurrency;

    // 根据历史性能调整批大小
    if (avgDuration > this.config.performanceThreshold) {
      // 如果平均执行时间过长，减小批大小和并发数
      optimizedBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(this.currentBatchSize * (1 - this.config.adjustmentFactor))
      );
      optimizedConcurrency = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentConcurrency * (1 - this.config.adjustmentFactor * 0.5))
      );
    } else if (successRate < 0.95) {
      // 如果成功率低，减小并发数
      optimizedConcurrency = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentConcurrency * (1 - this.config.adjustmentFactor))
      );
    } else {
      // 如果性能良好，可以适当增加批大小和并发数
      if (expectedOperationsCount > 100) { // 大量操作时可以增加批大小
        optimizedBatchSize = Math.min(
          this.config.maxBatchSize,
          Math.ceil(this.currentBatchSize * (1 + this.config.adjustmentFactor * 0.5))
        );
      }
      optimizedConcurrency = Math.min(
        this.config.maxConcurrency,
        Math.ceil(this.currentConcurrency * (1 + this.config.adjustmentFactor * 0.2))
      );
    }

    // 更新当前值
    this.currentBatchSize = optimizedBatchSize;
    this.currentConcurrency = optimizedConcurrency;

    this.logger.debug('Optimized transaction parameters', {
      expectedOperationsCount,
      batchSize: optimizedBatchSize,
      concurrency: optimizedConcurrency,
      avgDuration,
      successRate
    });

    return { batchSize: optimizedBatchSize, concurrency: optimizedConcurrency };
  }

  /**
   * 记录事务性能指标
   */
  async recordTransactionMetrics(metrics: TransactionPerformanceMetrics): Promise<void> {
    this.performanceMetrics.push(metrics);

    // 清理过期指标
    this.cleanupExpiredMetrics();

    this.logger.debug('Recorded transaction performance metrics', {
      transactionId: metrics.transactionId,
      duration: metrics.duration,
      success: metrics.success
    });

    // 根据新指标调整优化参数
    await this.adjustOptimizationParams();
  }

  /**
   * 执行批量事务优化
   */
  async executeBatchOptimizedTransaction<T>(
    operations: Array<() => Promise<T>>,
    executeTransaction: (batch: Array<() => Promise<T>>) => Promise<T[]>
  ): Promise<T[]> {
    const { batchSize, concurrency } = await this.optimizeTransactionParams(operations.length);
    
    this.logger.debug('Executing batch optimized transaction', {
      operationCount: operations.length,
      batchSize,
      concurrency
    });

    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      // 创建批次
      const batches = this.createBatches(operations, batchSize);
      const results: T[] = [];

      // 并发处理批次
      for (let i = 0; i < batches.length; i += concurrency) {
        const concurrentBatches = batches.slice(i, i + concurrency);
        const batchPromises = concurrentBatches.map(batch => executeTransaction(batch));
        
        const batchResults = await Promise.all(batchPromises);
        for (const batchResult of batchResults) {
          results.push(...batchResult);
        }
      }

      return results;
    } catch (err) {
      success = false;
      error = (err as Error).message;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      // 记录性能指标
      await this.recordTransactionMetrics({
        transactionId: `batch_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startTime,
        endTime: Date.now(),
        duration,
        databasesInvolved: 2, // 假设有2个数据库参与
        operationsCount: operations.length,
        success,
        error,
        batchSize,
        concurrencyLevel: concurrency
      });
    }
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): {
    avgDuration: number;
    successRate: number;
    totalTransactions: number;
    avgBatchSize: number;
    avgConcurrency: number;
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        avgDuration: 0,
        successRate: 1,
        totalTransactions: 0,
        avgBatchSize: this.currentBatchSize,
        avgConcurrency: this.currentConcurrency
      };
    }

    const successfulTransactions = this.performanceMetrics.filter(m => m.success);
    const totalDuration = this.performanceMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const avgDuration = totalDuration / this.performanceMetrics.length;
    const successRate = successfulTransactions.length / this.performanceMetrics.length;

    const totalBatchSize = this.performanceMetrics.reduce((sum, metric) => 
      sum + (metric.batchSize || 0), 0);
    const avgBatchSize = this.performanceMetrics.length > 0 
      ? totalBatchSize / this.performanceMetrics.length 
      : this.currentBatchSize;

    const totalConcurrency = this.performanceMetrics.reduce((sum, metric) => 
      sum + (metric.concurrencyLevel || 0), 0);
    const avgConcurrency = this.performanceMetrics.length > 0 
      ? totalConcurrency / this.performanceMetrics.length 
      : this.currentConcurrency;

    return {
      avgDuration,
      successRate,
      totalTransactions: this.performanceMetrics.length,
      avgBatchSize,
      avgConcurrency
    };
  }

  /**
   * 调整优化参数基于最新性能数据
   */
  private async adjustOptimizationParams(): Promise<void> {
    const stats = this.getPerformanceStats();
    
    if (stats.totalTransactions < 10) {
      // 如果事务数量太少，不调整参数
      return;
    }

    // 如果平均执行时间超过阈值，减少批大小
    if (stats.avgDuration > this.config.performanceThreshold) {
      this.currentBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(this.currentBatchSize * (1 - this.config.adjustmentFactor))
      );
    } else if (stats.avgDuration < this.config.performanceThreshold * 0.7) {
      // 如果平均执行时间远低于阈值，可以增加批大小
      this.currentBatchSize = Math.min(
        this.config.maxBatchSize,
        Math.ceil(this.currentBatchSize * (1 + this.config.adjustmentFactor * 0.5))
      );
    }

    // 根据成功率调整并发数
    if (stats.successRate < 0.9) {
      this.currentConcurrency = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentConcurrency * (1 - this.config.adjustmentFactor))
      );
    } else if (stats.successRate > 0.98) {
      this.currentConcurrency = Math.min(
        this.config.maxConcurrency,
        Math.ceil(this.currentConcurrency * (1 + this.config.adjustmentFactor * 0.2))
      );
    }

    this.logger.debug('Adjusted optimization parameters', {
      newBatchSize: this.currentBatchSize,
      newConcurrency: this.currentConcurrency,
      avgDuration: stats.avgDuration,
      successRate: stats.successRate
    });
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private cleanupExpiredMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    this.performanceMetrics = this.performanceMetrics.filter(
      metric => metric.endTime > cutoffTime
    );
  }

  private getHistoricalPerformance(): { avgDuration: number; successRate: number } {
    if (this.performanceMetrics.length === 0) {
      return { avgDuration: 0, successRate: 1 };
    }

    const totalDuration = this.performanceMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const avgDuration = totalDuration / this.performanceMetrics.length;
    
    const successfulTransactions = this.performanceMetrics.filter(m => m.success);
    const successRate = successfulTransactions.length / this.performanceMetrics.length;

    return { avgDuration, successRate };
  }

  /**
   * 重置优化参数到默认值
   */
  resetToDefaults(): void {
    this.currentBatchSize = this.config.defaultBatchSize;
    this.currentConcurrency = this.config.defaultConcurrency;
    this.logger.info('Reset optimization parameters to defaults');
  }

  /**
   * 获取当前优化参数
   */
  getCurrentParams(): { batchSize: number; concurrency: number; } {
    return {
      batchSize: this.currentBatchSize,
      concurrency: this.currentConcurrency
    };
  }
}