import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphBatchOptimizer } from '../batching/GraphBatchOptimizer';
import { PerformanceDashboard, PerformanceMetric } from '../monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../monitoring/PerformanceMetricsCollector';

export interface BatchOptimizationConfig {
  minBatchSize: number;
  maxBatchSize: number;
  defaultBatchSize: number;
  minConcurrency: number;
  maxConcurrency: number;
  defaultConcurrency: number;
  performanceThreshold: number; // 毫秒
  adjustmentFactor: number; // 调整因子
  metricsRetentionPeriod: number; // 毫秒
  enableAutoTuning: boolean;
  tuningInterval: number; // 毫秒
}

export interface BatchPerformanceMetrics {
  batchSize: number;
  concurrency: number;
  processingTime: number; // 毫秒
  itemsProcessed: number;
  throughput: number; // items per second
  successRate: number;
  errorCount: number;
  timestamp: number;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'batch_size' | 'concurrency' | 'strategy';
  currentValue: number;
  recommendedValue: number;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  reason: string;
  expectedImprovement: number; // percentage improvement
  timestamp: number;
}

@injectable()
export class BatchProcessingOptimizer {
  private logger: LoggerService;
  private batchOptimizer: GraphBatchOptimizer;
  private dashboard: PerformanceDashboard;
  private metricsCollector: PerformanceMetricsCollector;
  private config: BatchOptimizationConfig;
  private performanceHistory: BatchPerformanceMetrics[] = [];
  private optimizationRecommendations: OptimizationRecommendation[] = [];
  private tuningInterval: NodeJS.Timeout | null = null;
  private currentBatchSize: number;
  private currentConcurrency: number;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
    @inject(TYPES.PerformanceDashboard) dashboard: PerformanceDashboard,
    @inject(TYPES.PerformanceMetricsCollector) metricsCollector: PerformanceMetricsCollector,
    config?: Partial<BatchOptimizationConfig>
  ) {
    this.logger = logger;
    this.batchOptimizer = batchOptimizer;
    this.dashboard = dashboard;
    this.metricsCollector = metricsCollector;

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
      enableAutoTuning: true,
      tuningInterval: 600, // 1分钟
      ...config
    };

    this.currentBatchSize = this.config.defaultBatchSize;
    this.currentConcurrency = this.config.defaultConcurrency;

    this.logger.info('BatchProcessingOptimizer initialized', { config: this.config });

    if (this.config.enableAutoTuning) {
      this.startAutoTuning();
    }
  }

  /**
   * 开始自动调优
   */
  startAutoTuning(): void {
    if (this.tuningInterval) {
      this.logger.warn('Auto tuning already started');
      return;
    }

    this.logger.info('Starting batch processing auto tuning', {
      interval: this.config.tuningInterval
    });

    this.tuningInterval = setInterval(async () => {
      await this.performAutoTuning();
    }, this.config.tuningInterval);
  }

  /**
   * 停止自动调优
   */
  stopAutoTuning(): void {
    if (this.tuningInterval) {
      clearInterval(this.tuningInterval);
      this.tuningInterval = null;
      this.logger.info('Stopped batch processing auto tuning');
    }
  }

  /**
   * 执行自动调优
   */
  async performAutoTuning(): Promise<void> {
    this.logger.debug('Performing auto tuning');

    // 分析历史性能数据
    const analysis = this.analyzePerformanceHistory();

    // 根据分析结果调整参数
    if (analysis.recommendations.length > 0) {
      const primaryRecommendation = analysis.recommendations[0]; // 最重要的建议

      switch (primaryRecommendation.type) {
        case 'batch_size':
          this.currentBatchSize = Math.max(
            this.config.minBatchSize,
            Math.min(this.config.maxBatchSize, primaryRecommendation.recommendedValue as number)
          );
          break;
        case 'concurrency':
          this.currentConcurrency = Math.max(
            this.config.minConcurrency,
            Math.min(this.config.maxConcurrency, primaryRecommendation.recommendedValue as number)
          );
          break;
      }

      this.logger.info('Auto tuning applied', {
        batchSize: this.currentBatchSize,
        concurrency: this.currentConcurrency,
        recommendation: primaryRecommendation.reason
      });
    }

    // 记录调优指标到仪表板
    await this.dashboard.recordMetric({
      timestamp: Date.now(),
      metricName: 'batch.optimizer.batch_size',
      value: this.currentBatchSize,
      unit: 'count'
    });

    await this.dashboard.recordMetric({
      timestamp: Date.now(),
      metricName: 'batch.optimizer.concurrency',
      value: this.currentConcurrency,
      unit: 'count'
    });
  }

  /**
   * 执行优化的批处理操作
   */
  async executeOptimizedBatch<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    options?: {
      targetThroughput?: number; // 目标吞吐量
      maxLatency?: number; // 最大延迟
      strategy?: 'throughput' | 'latency' | 'balanced';
    }
  ): Promise<{
    results: any[];
    batchSize: number;
    concurrency: number;
    processingTime: number;
    throughput: number;
  }> {
    const startTime = Date.now();

    // 根据目标和策略调整参数
    const { batchSize, concurrency } = this.calculateOptimalParams(
      items.length,
      options?.targetThroughput,
      options?.maxLatency,
      options?.strategy || 'balanced'
    );

    this.logger.debug('Executing optimized batch operation', {
      itemCount: items.length,
      calculatedBatchSize: batchSize,
      calculatedConcurrency: concurrency
    });

    try {
      // 执行批处理操作
      const batchResult = await this.batchOptimizer.executeBatch(
        items,
        operation,
        { batchSize, concurrency }
      );

      const processingTime = Date.now() - startTime;
      const throughput = items.length > 0 ? (items.length / processingTime) * 1000 : 0; // items per second

      // 记录性能指标
      const metrics: BatchPerformanceMetrics = {
        batchSize,
        concurrency,
        processingTime,
        itemsProcessed: items.length,
        throughput,
        successRate: batchResult.successfulItems.length / items.length,
        errorCount: batchResult.failedItems.length,
        timestamp: Date.now()
      };

      this.performanceHistory.push(metrics);
      this.cleanupHistoricalData();

      // 记录到仪表板
      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'batch.processing_time',
        value: processingTime,
        unit: 'milliseconds'
      });

      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'batch.throughput',
        value: throughput,
        unit: 'items_per_second'
      });

      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'batch.success_rate',
        value: metrics.successRate,
        unit: 'ratio'
      });

      this.logger.info('Optimized batch operation completed', {
        itemCount: items.length,
        processingTime,
        throughput: throughput.toFixed(2),
        successRate: (metrics.successRate * 100).toFixed(2) + '%'
      });

      return {
        results: batchResult.results,
        batchSize,
        concurrency,
        processingTime,
        throughput
      };
    } catch (error) {
      this.logger.error('Optimized batch operation failed', {
        error: (error as Error).message,
        itemCount: items.length
      });
      throw error;
    }
  }

  /**
   * 分析性能历史数据
   */
  private analyzePerformanceHistory(): {
    avgProcessingTime: number;
    avgThroughput: number;
    avgSuccessRate: number;
    recommendations: OptimizationRecommendation[];
  } {
    if (this.performanceHistory.length === 0) {
      return {
        avgProcessingTime: 0,
        avgThroughput: 0,
        avgSuccessRate: 1,
        recommendations: []
      };
    }

    const recentHistory = this.performanceHistory.slice(-20); // 分析最近20次操作

    const avgProcessingTime = recentHistory.reduce((sum, m) => sum + m.processingTime, 0) / recentHistory.length;
    const avgThroughput = recentHistory.reduce((sum, m) => sum + m.throughput, 0) / recentHistory.length;
    const avgSuccessRate = recentHistory.reduce((sum, m) => sum + m.successRate, 0) / recentHistory.length;

    const recommendations: OptimizationRecommendation[] = [];

    // 根据性能数据生成建议
    if (avgProcessingTime > this.config.performanceThreshold) {
      // 处理时间过长，建议减小批大小
      recommendations.push({
        id: `rec_batch_size_${Date.now()}`,
        type: 'batch_size',
        currentValue: this.currentBatchSize,
        recommendedValue: Math.max(
          this.config.minBatchSize,
          Math.floor(this.currentBatchSize * (1 - this.config.adjustmentFactor))
        ),
        confidence: 0.8,
        impact: 'high',
        reason: 'Processing time above threshold, reducing batch size',
        expectedImprovement: 15,
        timestamp: Date.now()
      });
    } else if (avgThroughput < 100) { // 假设吞吐量阈值
      // 吞吐量较低，建议增加批大小或并发数
      recommendations.push({
        id: `rec_concurrency_${Date.now()}`,
        type: 'concurrency',
        currentValue: this.currentConcurrency,
        recommendedValue: Math.min(
          this.config.maxConcurrency,
          Math.ceil(this.currentConcurrency * (1 + this.config.adjustmentFactor))
        ),
        confidence: 0.7,
        impact: 'medium',
        reason: 'Low throughput, increasing concurrency',
        expectedImprovement: 25,
        timestamp: Date.now()
      });
    }

    if (avgSuccessRate < 0.95) {
      // 成功率较低，建议减小批大小或并发数
      recommendations.push({
        id: `rec_stability_${Date.now()}`,
        type: 'batch_size',
        currentValue: this.currentBatchSize,
        recommendedValue: Math.max(
          this.config.minBatchSize,
          Math.floor(this.currentBatchSize * 0.8)
        ),
        confidence: 0.85,
        impact: 'high',
        reason: 'Low success rate, reducing batch size for stability',
        expectedImprovement: 10,
        timestamp: Date.now()
      });
    }

    return {
      avgProcessingTime,
      avgThroughput,
      avgSuccessRate,
      recommendations
    };
  }

  /**
   * 计算最优参数
   */
  private calculateOptimalParams(
    itemCount: number,
    targetThroughput?: number,
    maxLatency?: number,
    strategy: 'throughput' | 'latency' | 'balanced' = 'balanced'
  ): { batchSize: number; concurrency: number; } {
    let batchSize = this.currentBatchSize;
    let concurrency = this.currentConcurrency;

    switch (strategy) {
      case 'throughput':
        // 优化吞吐量：增加批大小和并发数
        if (targetThroughput && this.getEstimatedThroughput(batchSize, concurrency) < targetThroughput) {
          batchSize = Math.min(
            this.config.maxBatchSize,
            Math.ceil(batchSize * 1.2)
          );
          concurrency = Math.min(
            this.config.maxConcurrency,
            Math.ceil(concurrency * 1.1)
          );
        }
        break;

      case 'latency':
        // 优化延迟：减小批大小
        if (maxLatency) {
          const estimatedLatency = this.getEstimatedLatency(batchSize, concurrency);
          if (estimatedLatency > maxLatency) {
            batchSize = Math.max(
              this.config.minBatchSize,
              Math.floor(batchSize * 0.8)
            );
          }
        }
        break;

      case 'balanced':
      default:
        // 平衡：基于历史性能调整
        const analysis = this.analyzePerformanceHistory();
        if (analysis.avgProcessingTime > this.config.performanceThreshold) {
          batchSize = Math.max(
            this.config.minBatchSize,
            Math.floor(batchSize * 0.9)
          );
        } else if (analysis.avgThroughput < 100) {
          concurrency = Math.min(
            this.config.maxConcurrency,
            Math.ceil(concurrency * 1.1)
          );
        }
        break;
    }

    // 确保在有效范围内
    batchSize = Math.max(this.config.minBatchSize, Math.min(this.config.maxBatchSize, batchSize));
    concurrency = Math.max(this.config.minConcurrency, Math.min(this.config.maxConcurrency, concurrency));

    return { batchSize, concurrency };
  }

  /**
   * 获取估计吞吐量
   */
  private getEstimatedThroughput(batchSize: number, concurrency: number): number {
    // 简化的吞吐量估算模型
    // 实际实现中应基于历史数据进行更精确的估算
    return (batchSize * concurrency * 10); // 示例计算
  }

  /**
   * 获取估计延迟
   */
  private getEstimatedLatency(batchSize: number, concurrency: number): number {
    // 简化的延迟估算模型
    // 实际实现中应基于历史数据进行更精确的估算
    return (batchSize * 0.5 + concurrency * 10); // 示例计算
  }

  /**
   * 清理历史数据
   */
  private cleanupHistoricalData(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    this.performanceHistory = this.performanceHistory.filter(m => m.timestamp > cutoffTime);

    // 限制历史记录数量以避免内存问题
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-500); // 保留最近500条记录
    }
  }

  /**
   * 获取性能历史
   */
  async getPerformanceHistory(hours: number = 24): Promise<BatchPerformanceMetrics[]> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(m => m.timestamp > since);
  }

  /**
   * 获取优化建议
   */
  async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    return [...this.optimizationRecommendations].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取当前参数
   */
  getCurrentParams(): { batchSize: number; concurrency: number; } {
    return {
      batchSize: this.currentBatchSize,
      concurrency: this.currentConcurrency
    };
  }

  /**
   * 设置参数
   */
  setParams(batchSize: number, concurrency: number): void {
    this.currentBatchSize = Math.max(
      this.config.minBatchSize,
      Math.min(this.config.maxBatchSize, batchSize)
    );
    this.currentConcurrency = Math.max(
      this.config.minConcurrency,
      Math.min(this.config.maxConcurrency, concurrency)
    );

    this.logger.info('Batch processing parameters updated', {
      batchSize: this.currentBatchSize,
      concurrency: this.currentConcurrency
    });
  }

  /**
   * 获取性能摘要
   */
  async getPerformanceSummary(): Promise<{
    currentParams: { batchSize: number; concurrency: number };
    avgProcessingTime: number;
    avgThroughput: number;
    avgSuccessRate: number;
    recommendations: OptimizationRecommendation[];
  }> {
    const analysis = this.analyzePerformanceHistory();

    return {
      currentParams: this.getCurrentParams(),
      avgProcessingTime: analysis.avgProcessingTime,
      avgThroughput: analysis.avgThroughput,
      avgSuccessRate: analysis.avgSuccessRate,
      recommendations: await this.getOptimizationRecommendations()
    };
  }

  /**
   * 重置优化器
   */
  async reset(): Promise<void> {
    this.performanceHistory = [];
    this.optimizationRecommendations = [];
    this.currentBatchSize = this.config.defaultBatchSize;
    this.currentConcurrency = this.config.defaultConcurrency;

    this.logger.info('BatchProcessingOptimizer reset to defaults');
  }

  /**
   * 销毁优化器
   */
  async destroy(): Promise<void> {
    this.stopAutoTuning();
    this.logger.info('BatchProcessingOptimizer destroyed');
  }
}