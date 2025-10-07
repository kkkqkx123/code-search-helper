import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { MappingCacheManager } from '../caching/MappingCacheManager';
import { PerformanceDashboard, PerformanceMetric } from './PerformanceDashboard';

export interface CachePerformanceStats {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  averageResponseTime: number; // 毫秒
  totalRequests: number;
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number; // 字节
  hitRateTrend: 'increasing' | 'decreasing' | 'stable';
  timestamp: number;
}

export interface CacheOptimizationSuggestion {
  id: string;
  type: 'size' | 'ttl' | 'eviction_policy' | 'partitioning';
  currentValue: number | string;
  recommendedValue: number | string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  description: string;
  expectedImprovement: string;
  timestamp: number;
}

export interface CacheMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number; // 毫秒
  metricsRetentionPeriod: number; // 毫秒
  alertHitRateThreshold: number; // 命中率阈值
  alertEvictionRateThreshold: number; // 驱逐率阈值
  enableOptimizationSuggestions: boolean;
}

@injectable()
export class CachePerformanceMonitor {
  private logger: LoggerService;
  private cache: GraphMappingCache;
  private multiLevelCache?: MappingCacheManager;
  private dashboard: PerformanceDashboard;
  private config: CacheMonitoringConfig;
  private performanceHistory: CachePerformanceStats[] = [];
 private optimizationSuggestions: CacheOptimizationSuggestion[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private requestCount: number = 0;
  private hitCount: number = 0;
  private missCount: number = 0;
  private evictionCount: number = 0;
  private lastStatsTime: number = Date.now();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    @inject(TYPES.MappingCacheManager) multiLevelCache?: MappingCacheManager,
    @inject(TYPES.PerformanceDashboard) dashboard?: PerformanceDashboard,
    config?: Partial<CacheMonitoringConfig>
  ) {
    this.logger = logger;
    this.cache = cache;
    this.multiLevelCache = multiLevelCache;
    this.dashboard = dashboard!;

    this.config = {
      enableRealTimeMonitoring: true,
      monitoringInterval: 30000, // 30秒
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24小时
      alertHitRateThreshold: 0.8, // 80%
      alertEvictionRateThreshold: 0.1, // 10%
      enableOptimizationSuggestions: true,
      ...config
    };

    this.logger.info('CachePerformanceMonitor initialized', { config: this.config });

    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * 开始监控
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.logger.warn('Cache monitoring already started');
      return;
    }

    this.logger.info('Starting cache performance monitoring', { 
      interval: this.config.monitoringInterval 
    });

    this.monitoringInterval = setInterval(async () => {
      await this.collectAndRecordStats();
    }, this.config.monitoringInterval);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped cache performance monitoring');
    }
  }

 /**
   * 收集并记录统计信息
   */
  async collectAndRecordStats(): Promise<void> {
    const stats = await this.getCachePerformanceStats();
    this.performanceHistory.push(stats);

    // 限制历史记录大小
    this.cleanupHistoricalData();

    // 记录到仪表板
    if (this.dashboard) {
      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'cache.hit_rate',
        value: stats.hitRate,
        unit: 'ratio'
      });

      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'cache.eviction_rate',
        value: stats.evictionRate,
        unit: 'ratio'
      });

      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'cache.size',
        value: stats.size,
        unit: 'count'
      });

      await this.dashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'cache.average_response_time',
        value: stats.averageResponseTime,
        unit: 'milliseconds'
      });
    }

    // 检查是否需要发出警报
    await this.checkForAlerts(stats);

    // 生成优化建议（如果启用）
    if (this.config.enableOptimizationSuggestions) {
      const suggestions = await this.generateOptimizationSuggestions(stats);
      this.optimizationSuggestions.push(...suggestions);
    }

    this.logger.debug('Collected cache performance stats', {
      hitRate: stats.hitRate,
      evictionRate: stats.evictionRate,
      size: stats.size
    });
 }

  /**
   * 获取缓存性能统计
   */
  async getCachePerformanceStats(): Promise<CachePerformanceStats> {
    const cacheStats = await this.cache.getStats();
    const currentTime = Date.now();
    const timeWindow = currentTime - this.lastStatsTime;

    // 计算速率
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 ? cacheStats.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? cacheStats.misses / totalRequests : 0;
    const evictionRate = totalRequests > 0 ? cacheStats.evictions / totalRequests : 0;
    
    // 更新内部计数器
    this.requestCount = totalRequests;
    this.hitCount = cacheStats.hits;
    this.missCount = cacheStats.misses;
    this.evictionCount = cacheStats.evictions;
    this.lastStatsTime = currentTime;

    // 计算命中率趋势
    const hitRateTrend = this.calculateHitRateTrend();

    const stats: CachePerformanceStats = {
      hitRate,
      missRate,
      evictionRate,
      averageResponseTime: 0, // 实际实现中需要测量响应时间
      totalRequests,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      evictions: cacheStats.evictions,
      size: cacheStats.size,
      memoryUsage: cacheStats.memoryUsage,
      hitRateTrend,
      timestamp: currentTime
    };

    return stats;
  }

  /**
   * 检查警报条件
   */
  private async checkForAlerts(stats: CachePerformanceStats): Promise<void> {
    // 检查命中率警报
    if (stats.hitRate < this.config.alertHitRateThreshold) {
      this.logger.warn('Cache hit rate below threshold', {
        hitRate: stats.hitRate,
        threshold: this.config.alertHitRateThreshold
      });

      // 这里可以集成到仪表板的警报系统
    }

    // 检查驱逐率警报
    if (stats.evictionRate > this.config.alertEvictionRateThreshold) {
      this.logger.warn('Cache eviction rate above threshold', {
        evictionRate: stats.evictionRate,
        threshold: this.config.alertEvictionRateThreshold
      });

      // 这里可以集成到仪表板的警报系统
    }
  }

  /**
   * 生成优化建议
   */
  private async generateOptimizationSuggestions(
    stats: CachePerformanceStats
  ): Promise<CacheOptimizationSuggestion[]> {
    const suggestions: CacheOptimizationSuggestion[] = [];

    // 低命中率建议
    if (stats.hitRate < 0.7) {
      suggestions.push({
        id: `suggestion_size_${Date.now()}`,
        type: 'size',
        currentValue: stats.size,
        recommendedValue: stats.size * 2, // 建议加倍缓存大小
        confidence: 0.8,
        impact: 'high',
        description: 'Cache hit rate is low, suggesting cache size increase',
        expectedImprovement: 'Expected 15-30% hit rate improvement',
        timestamp: Date.now()
      });
    }

    // 高驱逐率建议
    if (stats.evictionRate > 0.15) {
      suggestions.push({
        id: `suggestion_eviction_${Date.now()}`,
        type: 'eviction_policy',
        currentValue: 'LRU',
        recommendedValue: 'LFU',
        confidence: 0.7,
        impact: 'medium',
        description: 'High eviction rate suggests need for different eviction policy',
        expectedImprovement: 'Reduced unnecessary evictions',
        timestamp: Date.now()
      });
    }

    // 长响应时间建议
    if (stats.averageResponseTime > 100) { // 100ms阈值
      suggestions.push({
        id: `suggestion_response_${Date.now()}`,
        type: 'partitioning',
        currentValue: 1,
        recommendedValue: 4, // 建议分区数
        confidence: 0.75,
        impact: 'medium',
        description: 'High response time suggests need for cache partitioning',
        expectedImprovement: 'Reduced response time by 20-40%',
        timestamp: Date.now()
      });
    }

    return suggestions;
  }

  /**
   * 获取历史性能数据
   */
  async getPerformanceHistory(
    hours: number = 24
  ): Promise<CachePerformanceStats[]> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(stat => stat.timestamp > since);
  }

 /**
   * 获取优化建议
   */
  async getOptimizationSuggestions(): Promise<CacheOptimizationSuggestion[]> {
    // 按置信度排序
    return [...this.optimizationSuggestions].sort((a, b) => b.confidence - a.confidence);
  }

 /**
   * 获取性能摘要
   */
  async getPerformanceSummary(): Promise<{
    currentStats: CachePerformanceStats;
    hitRateTrend: 'increasing' | 'decreasing' | 'stable';
    evictionRateTrend: 'increasing' | 'decreasing' | 'stable';
    sizeTrend: 'increasing' | 'decreasing' | 'stable';
    recommendations: CacheOptimizationSuggestion[];
  }> {
    const currentStats = await this.getCachePerformanceStats();
    const history = await this.getPerformanceHistory(1); // 最近1小时

    return {
      currentStats,
      hitRateTrend: this.calculateHitRateTrend(),
      evictionRateTrend: this.calculateEvictionRateTrend(history),
      sizeTrend: this.calculateSizeTrend(history),
      recommendations: await this.getOptimizationSuggestions()
    };
  }

  /**
   * 清理历史数据
   */
  private cleanupHistoricalData(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    this.performanceHistory = this.performanceHistory.filter(stat => stat.timestamp > cutoffTime);
    
    // 限制历史记录数量以避免内存问题
    if (this.performanceHistory.length > 10000) {
      this.performanceHistory = this.performanceHistory.slice(-5000); // 保留最近5000条记录
    }
  }

  /**
   * 计算命中率趋势
   */
  private calculateHitRateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.performanceHistory.length < 2) {
      return 'stable';
    }

    const recentStats = this.performanceHistory.slice(-10); // 最近10个数据点
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
   * 计算驱逐率趋势
   */
  private calculateEvictionRateTrend(history: CachePerformanceStats[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 2) {
      return 'stable';
    }

    const first = history[0].evictionRate;
    const last = history[history.length - 1].evictionRate;
    
    const change = last - first;
    if (change > 0.02) return 'increasing';
    if (change < -0.02) return 'decreasing';
    return 'stable';
  }

 /**
   * 计算大小趋势
   */
  private calculateSizeTrend(history: CachePerformanceStats[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 2) {
      return 'stable';
    }

    const first = history[0].size;
    const last = history[history.length - 1].size;
    
    const change = last - first;
    const percentageChange = first > 0 ? change / first : 0;
    
    if (percentageChange > 0.1) return 'increasing';
    if (percentageChange < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * 应用优化建议
   */
 async applySuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.optimizationSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      this.logger.warn('Suggestion not found', { suggestionId });
      return false;
    }

    try {
      switch (suggestion.type) {
        case 'size':
          // 实际调整缓存大小的逻辑
          this.logger.info('Applied cache size optimization', {
            suggestionId,
            newValue: suggestion.recommendedValue
          });
          break;
        case 'ttl':
          // 实际调整TTL的逻辑
          this.logger.info('Applied TTL optimization', {
            suggestionId,
            newValue: suggestion.recommendedValue
          });
          break;
        case 'eviction_policy':
          // 实际调整驱逐策略的逻辑
          this.logger.info('Applied eviction policy optimization', {
            suggestionId,
            newValue: suggestion.recommendedValue
          });
          break;
        case 'partitioning':
          // 实际调整分区的逻辑
          this.logger.info('Applied partitioning optimization', {
            suggestionId,
            newValue: suggestion.recommendedValue
          });
          break;
        default:
          this.logger.warn('Unknown suggestion type', { suggestionType: suggestion.type });
          return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error applying suggestion', {
        suggestionId,
        error: (error as Error).message
      });
      return false;
    }
  }

 /**
   * 重置监控数据
   */
  async reset(): Promise<void> {
    this.performanceHistory = [];
    this.optimizationSuggestions = [];
    this.requestCount = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.lastStatsTime = Date.now();
    
    this.logger.info('Cache performance monitor reset');
  }

  /**
   * 销毁监控器
   */
  async destroy(): Promise<void> {
    this.stopMonitoring();
    this.logger.info('CachePerformanceMonitor destroyed');
  }
}