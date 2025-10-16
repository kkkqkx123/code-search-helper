import { injectable, inject, unmanaged } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { PerformanceDashboard } from '../monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../monitoring/PerformanceMetricsCollector';
import { GraphBatchOptimizer } from '../graph/utils/GraphBatchOptimizer';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { GraphCacheStats } from '../caching/GraphMappingCache';

export interface OptimizationRecommendation {
  id: string;
  category: 'cache' | 'batching' | 'indexing' | 'query' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestedAction: string;
  expectedImprovement: string;
  currentValue?: number;
  recommendedValue?: number;
  confidence: number; // 0-1
  timestamp: number;
}

export interface OptimizationHistory {
  recommendationId: string;
  applied: boolean;
  appliedAt: number;
  effectiveness?: number; // -1 to 1, where positive is improvement
}

export interface AdvisorOptions {
  minConfidence: number; // 最小置信度阈值
  checkInterval: number; // 检查间隔（毫秒）
  maxRecommendations: number; // 最大推荐数
  enableAutoApply: boolean; // 是否启用自动应用
}

@injectable()
export class AutoOptimizationAdvisor {
  private logger: LoggerService;
  private dashboard: PerformanceDashboard;
  private metricsCollector: PerformanceMetricsCollector;
  private batchOptimizer: GraphBatchOptimizer;
  private cache: GraphMappingCache;
  private options: AdvisorOptions;
  private recommendations: OptimizationRecommendation[] = [];
  private history: OptimizationHistory[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.PerformanceDashboard) dashboard: PerformanceDashboard,
    @inject(TYPES.PerformanceMetricsCollector) metricsCollector: PerformanceMetricsCollector,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    options?: Partial<AdvisorOptions>
  ) {
    try {
      this.logger = logger;
      this.dashboard = dashboard;
      this.metricsCollector = metricsCollector;
      this.batchOptimizer = batchOptimizer;
      this.cache = cache;

      this.options = {
        minConfidence: 0.7,
        checkInterval: 300000, // 5分钟
        maxRecommendations: 50,
        enableAutoApply: false,
        ...options
      };

      this.logger.info('AutoOptimizationAdvisor initialized', { options: this.options });

      // 在测试环境中不启动定期分析
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
      if (!isTestEnv) {
        // 开始定期分析
        this.startAnalysis();
      } else {
        this.logger.info('AutoOptimizationAdvisor running in test mode - periodic analysis disabled');
      }
    } catch (error) {
      logger.error('Failed to initialize AutoOptimizationAdvisor', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  /**
   * 开始定期分析
   */
  startAnalysis(): void {
    if (this.checkInterval) {
      this.logger.warn('Analysis already started');
      return;
    }

    this.logger.info('Starting auto optimization analysis', {
      interval: this.options.checkInterval
    });

    this.checkInterval = setInterval(async () => {
      await this.analyzeAndRecommend();
    }, this.options.checkInterval);
  }

  /**
   * 停止定期分析
   */
  stopAnalysis(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Stopped auto optimization analysis');
    }
  }

  /**
   * 分析性能并生成推荐
   */
  async analyzeAndRecommend(): Promise<OptimizationRecommendation[]> {
    this.logger.debug('Starting optimization analysis');

    // 清除旧的推荐
    this.recommendations = this.recommendations.filter(
      rec => Date.now() - rec.timestamp < 24 * 60 * 60 * 1000 // 保留24小时内的推荐
    );

    const newRecommendations: OptimizationRecommendation[] = [];

    // 分析缓存性能并生成推荐
    const cacheRecommendations = await this.analyzeCachePerformance();
    newRecommendations.push(...cacheRecommendations);

    // 分析批处理性能并生成推荐
    const batchingRecommendations = await this.analyzeBatchingPerformance();
    newRecommendations.push(...batchingRecommendations);

    // 分析整体系统性能并生成推荐
    const systemRecommendations = await this.analyzeSystemPerformance();
    newRecommendations.push(...systemRecommendations);

    // 过滤掉低置信度的推荐
    const filteredRecommendations = newRecommendations.filter(
      rec => rec.confidence >= this.options.minConfidence
    );

    // 添加到推荐列表
    this.recommendations.push(...filteredRecommendations);

    // 限制推荐数量
    if (this.recommendations.length > this.options.maxRecommendations) {
      this.recommendations = this.recommendations.slice(-this.options.maxRecommendations);
    }

    this.logger.info('Optimization analysis completed', {
      newRecommendations: filteredRecommendations.length,
      totalRecommendations: this.recommendations.length
    });

    return filteredRecommendations;
  }

  /**
   * 获取推荐列表
   */
  async getRecommendations(
    category?: 'cache' | 'batching' | 'indexing' | 'query' | 'system',
    priority?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<OptimizationRecommendation[]> {
    let recommendations = [...this.recommendations];

    if (category) {
      recommendations = recommendations.filter(rec => rec.category === category);
    }

    if (priority) {
      recommendations = recommendations.filter(rec => rec.priority === priority);
    }

    // 按优先级和置信度排序
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  /**
    * 应用推荐
    */
  async applyRecommendation(recommendationId: string): Promise<boolean> {
    const recommendation = this.recommendations.find(rec => rec.id === recommendationId);
    if (!recommendation) {
      this.logger.warn('Recommendation not found', { recommendationId });
      return false;
    }

    try {
      let applied = false;

      switch (recommendation.category) {
        case 'cache':
          applied = await this.applyCacheRecommendation(recommendation);
          break;
        case 'batching':
          applied = await this.applyBatchingRecommendation(recommendation);
          break;
        default:
          this.logger.warn('Unknown recommendation category', { category: recommendation.category });
          return false;
      }

      if (applied) {
        // 记录应用历史
        this.history.push({
          recommendationId,
          applied: true,
          appliedAt: Date.now()
        });

        this.logger.info('Applied optimization recommendation', { recommendationId });
      }

      return applied;
    } catch (error) {
      this.logger.error('Error applying recommendation', {
        recommendationId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
    * 分析缓存性能
    */
  private async analyzeCachePerformance(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const cacheStats = await this.cache.getStats();

    // 低命中率推荐
    if (cacheStats.hitRate !== null && cacheStats.hitRate < 0.7) {
      recommendations.push({
        id: `rec_cache_hitrate_${Date.now()}`,
        category: 'cache',
        priority: 'high',
        title: 'Low Cache Hit Rate',
        description: `Current cache hit rate is ${Math.round((cacheStats.hitRate || 0) * 100)}%, which is below optimal threshold.`,
        suggestedAction: 'Increase cache size or adjust eviction policy',
        expectedImprovement: '5-15% performance improvement',
        currentValue: cacheStats.hitRate !== null ? cacheStats.hitRate : undefined,
        recommendedValue: 0.85, // 目标命中率
        confidence: 0.85,
        timestamp: Date.now()
      });
    }

    // 高驱逐率推荐
    if (cacheStats.evictions > 100) { // 假设阈值
      recommendations.push({
        id: `rec_cache_evictions_${Date.now()}`,
        category: 'cache',
        priority: 'medium',
        title: 'High Cache Eviction Rate',
        description: `Cache is evicting items frequently, which may impact performance.`,
        suggestedAction: 'Increase cache size or adjust TTL settings',
        expectedImprovement: 'Reduced latency for cached items',
        currentValue: cacheStats.evictions,
        confidence: 0.75,
        timestamp: Date.now()
      });
    }

    return recommendations;
  }

  /**
   * 分析批处理性能
   */
  private async analyzeBatchingPerformance(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const batchStats = this.batchOptimizer.getPerformanceStats();

    // 低吞吐量推荐
    if (batchStats.avgItemsPerMs < 0.1) { // 假设阈值
      recommendations.push({
        id: `rec_batch_throughput_${Date.now()}`,
        category: 'batching',
        priority: 'medium',
        title: 'Low Batch Processing Throughput',
        description: `Current batch processing throughput is below optimal level.`,
        suggestedAction: 'Increase batch size or adjust concurrency settings',
        expectedImprovement: '20-40% throughput improvement',
        currentValue: batchStats.avgItemsPerMs,
        recommendedValue: 0.2,
        confidence: 0.8,
        timestamp: Date.now()
      });
    }

    // 高延迟推荐
    if (batchStats.avgProcessingTime > 1000) { // 1秒以上
      recommendations.push({
        id: `rec_batch_latency_${Date.now()}`,
        category: 'batching',
        priority: 'high',
        title: 'High Batch Processing Latency',
        description: `Batch operations are taking too long to complete.`,
        suggestedAction: 'Reduce batch size or optimize processing logic',
        expectedImprovement: 'Reduced processing time',
        currentValue: batchStats.avgProcessingTime,
        recommendedValue: 500, // 目标毫秒
        confidence: 0.78,
        timestamp: Date.now()
      });
    }

    return recommendations;
  }

  /**
   * 分析系统性能
   */
  private async analyzeSystemPerformance(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const dashboardStats = await this.dashboard.getDashboardStats();

    // 高错误率推荐
    if (dashboardStats.qdrant.errorRate > 0.05) {
      recommendations.push({
        id: `rec_qdrant_errors_${Date.now()}`,
        category: 'system',
        priority: 'high',
        title: 'High Qdrant Error Rate',
        description: `Qdrant operations are failing at a high rate: ${(dashboardStats.qdrant.errorRate * 100).toFixed(2)}%`,
        suggestedAction: 'Check Qdrant connection and configuration',
        expectedImprovement: 'Improved reliability',
        currentValue: dashboardStats.qdrant.errorRate,
        recommendedValue: 0.01,
        confidence: 0.9,
        timestamp: Date.now()
      });
    }

    // 高响应时间推荐
    if (dashboardStats.graph.averageResponseTime > 2000) {
      recommendations.push({
        id: `rec_graph_response_${Date.now()}`,
        category: 'system',
        priority: 'medium',
        title: 'High Graph Database Response Time',
        description: `Graph database operations are taking too long: ${dashboardStats.graph.averageResponseTime}ms`,
        suggestedAction: 'Optimize queries or add indexes',
        expectedImprovement: 'Reduced response time',
        currentValue: dashboardStats.graph.averageResponseTime,
        recommendedValue: 1000,
        confidence: 0.82,
        timestamp: Date.now()
      });
    }

    return recommendations;
  }

  /**
   * 应用缓存推荐
   */
  private async applyCacheRecommendation(rec: OptimizationRecommendation): Promise<boolean> {
    // 实际应用缓存优化的逻辑
    // 这里只是示例，实际实现会根据推荐内容调整缓存配置
    this.logger.debug('Applying cache optimization', { recommendationId: rec.id });

    // 例如：调整缓存大小或TTL
    return true;
  }

  /**
    * 应用批处理推荐
    */
  private async applyBatchingRecommendation(rec: OptimizationRecommendation): Promise<boolean> {
    // 实际应用批处理优化的逻辑
    // 这里只是示例，实际实现会根据推荐内容调整批处理参数
    this.logger.debug('Applying batching optimization', { recommendationId: rec.id });

    // 例如：调整批大小或并发数
    return true;
  }

  /**
   * 获取优化历史
   */
  async getOptimizationHistory(): Promise<OptimizationHistory[]> {
    return [...this.history];
  }

  /**
   * 获取优化统计
   */
  async getOptimizationStats(): Promise<{
    totalRecommendations: number;
    appliedRecommendations: number;
    effectiveness: number;
    categoryBreakdown: { [key: string]: number };
  }> {
    const total = this.recommendations.length;
    const applied = this.history.filter(h => h.applied).length;
    const categoryBreakdown: { [key: string]: number } = {};

    for (const rec of this.recommendations) {
      categoryBreakdown[rec.category] = (categoryBreakdown[rec.category] || 0) + 1;
    }

    return {
      totalRecommendations: total,
      appliedRecommendations: applied,
      effectiveness: applied > 0 ? 0.8 : 0, // 模拟效果
      categoryBreakdown
    };
  }

  /**
   * 销毁顾问实例
   */
  async destroy(): Promise<void> {
    this.stopAnalysis();
    this.logger.info('AutoOptimizationAdvisor destroyed');
  }
}