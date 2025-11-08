import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

export interface PerformanceMetric {
  timestamp: number;
  metricName: string;
  value: number | string | boolean;
  tags?: { [key: string]: string };
  unit?: string;
}

export interface DashboardStats {
  qdrant: {
    operationsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
  };
  graph: {
    operationsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    nodeCount: number;
    relationshipCount: number;
  };
  cache: {
    hitRate: number | null;
    evictionsPerSecond: number;
    memoryUsage: number;
  };
  transaction: {
    successRate: number;
    averageDuration: number;
    activeTransactions: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metricName: string;
  currentValue: number;
  threshold: number;
}

export interface PerformanceTrend {
  metricName: string;
  values: Array<{ timestamp: number; value: number }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
}

@injectable()
export class PerformanceDashboard {
  private logger: LoggerService;
  private cache: GraphMappingCache;
  private metrics: PerformanceMetric[] = [];
  private alerts: Alert[] = [];
  private dashboardStats: DashboardStats;
  private readonly maxMetrics: number = 10000;
  private readonly alertThresholds: { [key: string]: number } = {
    'qdrant.response_time': 1000, // 1秒
    'graph.response_time': 2000, // 2秒
    'cache.hit_rate': 0.8        // 80%
  };

  private readonly MIN_STATISTICALLY_SIGNIFICANT_ACCESSES = 10; // 最少10次访问才认为统计显著
  private readonly ALERT_CONSECUTIVE_THRESHOLD = 3; // 连续3次低于阈值才触发
  private recentCacheHitRateMetrics: PerformanceMetric[] = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache
  ) {
    try {
      this.logger = logger;
      this.cache = cache;

      // 初始化仪表板统计
      this.dashboardStats = {
        qdrant: {
          operationsPerSecond: 0,
          averageResponseTime: 0,
          errorRate: 0,
          memoryUsage: 0
        },
        graph: {
          operationsPerSecond: 0,
          averageResponseTime: 0,
          errorRate: 0,
          nodeCount: 0,
          relationshipCount: 0
        },
        cache: {
          hitRate: null,
          evictionsPerSecond: 0,
          memoryUsage: 0
        },
        transaction: {
          successRate: 0,
          averageDuration: 0,
          activeTransactions: 0
        },
        system: {
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0
        }
      };

      this.logger.info('PerformanceDashboard initialized');
    } catch (error) {
      logger.error('Failed to initialize PerformanceDashboard', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  /**
   * 记录性能指标
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    this.metrics.push(metric);

    // 限制指标数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-Math.floor(this.maxMetrics * 0.8)); // 保留80%的指标
    }

    // 检查是否触发警报
    await this.checkAlerts(metric);

    this.logger.debug('Recorded performance metric', {
      metricName: metric.metricName,
      value: metric.value,
      tags: metric.tags
    });
  }

  /**
   * 获取仪表板统计数据
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // 计算实时统计信息
    const now = Date.now();
    const lastMinute = now - 60000; // 1分钟前

    // Qdrant相关统计
    const qdrantOps = this.metrics.filter(m =>
      m.metricName.startsWith('qdrant.') && m.timestamp > lastMinute
    );
    this.dashboardStats.qdrant.operationsPerSecond = qdrantOps.length / 60;

    const qdrantResponseTimes = qdrantOps
      .filter(m => m.metricName === 'qdrant.response_time')
      .map(m => m.value as number);
    this.dashboardStats.qdrant.averageResponseTime =
      qdrantResponseTimes.length > 0
        ? qdrantResponseTimes.reduce((a, b) => a + b, 0) / qdrantResponseTimes.length
        : 0;

    const qdrantErrors = qdrantOps.filter(m =>
      m.metricName === 'qdrant.error' || (typeof m.value === 'string' && m.value === 'error')
    );
    this.dashboardStats.qdrant.errorRate =
      qdrantOps.length > 0 ? qdrantErrors.length / qdrantOps.length : 0;

    // Graph相关统计
    const graphOps = this.metrics.filter(m =>
      m.metricName.startsWith('graph.') && m.timestamp > lastMinute
    );
    this.dashboardStats.graph.operationsPerSecond = graphOps.length / 60;

    const graphResponseTimes = graphOps
      .filter(m => m.metricName === 'graph.response_time')
      .map(m => m.value as number);
    this.dashboardStats.graph.averageResponseTime =
      graphResponseTimes.length > 0
        ? graphResponseTimes.reduce((a, b) => a + b, 0) / graphResponseTimes.length
        : 0;

    const graphErrors = graphOps.filter(m =>
      m.metricName === 'graph.error' || (typeof m.value === 'string' && m.value === 'error')
    );
    this.dashboardStats.graph.errorRate =
      graphOps.length > 0 ? graphErrors.length / graphOps.length : 0;

    // 缓存相关统计
    const cacheStats = await this.cache.getStats();
    this.dashboardStats.cache.hitRate = cacheStats.hitRate;
    this.dashboardStats.cache.memoryUsage = cacheStats.memoryUsage;

    return this.dashboardStats;
  }

  /**
   * 获取性能趋势
   */
  async getPerformanceTrends(metricName: string, hours: number = 24): Promise<PerformanceTrend> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const relevantMetrics = this.metrics
      .filter(m => m.metricName === metricName && m.timestamp > since)
      .sort((a, b) => a.timestamp - b.timestamp);

    const values = relevantMetrics.map(m => ({
      timestamp: m.timestamp,
      value: typeof m.value === 'number' ? m.value : 0
    }));

    // 计算趋势
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let changeRate = 0;

    if (values.length >= 2) {
      const firstValue = values[0].value;
      const lastValue = values[values.length - 1].value;

      if (firstValue !== 0) {
        changeRate = (lastValue - firstValue) / firstValue;

        if (changeRate > 0.1) {
          trend = 'increasing';
        } else if (changeRate < -0.1) {
          trend = 'decreasing';
        }
      }
    }

    return {
      metricName,
      values,
      trend,
      changeRate
    };
  }

  /**
   * 获取所有警报
   */
  async getAlerts(since?: number): Promise<Alert[]> {
    if (since) {
      return this.alerts.filter(alert => alert.timestamp > since);
    }
    return [...this.alerts];
  }

  /**
    * 获取指标历史数据
    */
  async getMetricHistory(
    metricName: string,
    fromTime: number,
    toTime: number,
    aggregation?: 'avg' | 'sum' | 'min' | 'max'
  ): Promise<Array<{ timestamp: number; value: number }>> {
    const filteredMetrics = this.metrics
      .filter(m =>
        m.metricName === metricName &&
        m.timestamp >= fromTime &&
        m.timestamp <= toTime &&
        typeof m.value === 'number'
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    if (!aggregation) {
      return filteredMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.value as number
      }));
    }

    // 实现聚合逻辑（这里简化处理）
    // 实现聚合逻辑（这里简化处理）
    return filteredMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.value as number
    }));
  }

  /**
   * 检查警报条件
   */
  private async checkAlerts(metric: PerformanceMetric): Promise<void> {
    if (typeof metric.value !== 'number') {
      return; // 只对数值型指标检查警报
    }

    const threshold = this.alertThresholds[metric.metricName];
    if (threshold !== undefined) {
      let shouldAlert = false;
      let severity: Alert['severity'] = 'medium';

      if (metric.metricName === 'cache.hit_rate') {
        // 特殊处理缓存命中率：检查统计数据是否充足
        const cacheStats = await this.cache.getStats();
        if (!cacheStats.hasSufficientData) {
          this.logger.debug('Skipping cache hit rate alert - insufficient data', {
            totalAccesses: cacheStats.hits + cacheStats.misses,
            requiredAccesses: this.MIN_STATISTICALLY_SIGNIFICANT_ACCESSES
          });
          return;
        }

        // 检查连续低于阈值的次数
        this.recentCacheHitRateMetrics.push(metric);
        this.recentCacheHitRateMetrics = this.recentCacheHitRateMetrics
          .filter(m => Date.now() - m.timestamp < 300000); // 保留最近5分钟的数据

        // 只有当连续多次低于阈值时才触发警报
        const lowHitRateCount = this.recentCacheHitRateMetrics.filter(
          m => m.metricName === 'cache.hit_rate' && typeof m.value === 'number' && m.value < threshold
        ).length;

        if (lowHitRateCount >= this.ALERT_CONSECUTIVE_THRESHOLD) {
          shouldAlert = true;
          // 基于命中率与阈值的差距调整严重程度
          if (metric.value < threshold * 0.5) severity = 'critical';
          else if (metric.value < threshold * 0.75) severity = 'high';
        }
      } else if (metric.metricName.includes('response_time')) {
        // 响应时间：超过阈值则警报
        shouldAlert = metric.value > threshold;
        if (metric.value > threshold * 2) severity = 'high';
        if (metric.value > threshold * 3) severity = 'critical';
      } else if (metric.metricName.includes('error_rate')) {
        // 错误率：高于阈值则警报
        shouldAlert = metric.value > threshold;
        if (metric.value > threshold * 1.5) severity = 'high';
        if (metric.value > threshold * 2) severity = 'critical';
      }

      if (shouldAlert) {
        let message: string;
        if (metric.metricName === 'cache.hit_rate') {
          message = `Metric ${metric.metricName} exceeded threshold: ${metric.value} < ${threshold} (连续低于阈值警报)`;
        } else if (metric.metricName.includes('response_time') || metric.metricName.includes('error_rate')) {
          message = `Metric ${metric.metricName} exceeded threshold: ${metric.value} > ${threshold}`;
        } else {
          // 通用消息
          message = `Metric ${metric.metricName} exceeded threshold: ${metric.value} > ${threshold}`;
        }

        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          severity,
          message,
          metricName: metric.metricName,
          currentValue: metric.value,
          threshold
        };

        this.alerts.push(alert);
        this.logger.warn('Performance alert triggered', alert);

        // 限制警报数量
        if (this.alerts.length > 1000) {
          this.alerts = this.alerts.slice(-500); // 保留最近500个警报
        }
      }
    }
  }
  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<{
    overallStatus: 'healthy' | 'degraded' | 'critical';
    components: {
      qdrant: 'healthy' | 'degraded' | 'critical';
      graph: 'healthy' | 'degraded' | 'critical';
      cache: 'healthy' | 'degraded' | 'critical';
      transaction: 'healthy' | 'degraded' | 'critical';
    };
    issues: string[];
  }> {
    const stats = await this.getDashboardStats();
    const issues: string[] = [];

    // 检查各组件健康状态
    let qdrantStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (stats.qdrant.errorRate > 0.1) {
      qdrantStatus = 'critical';
      issues.push(`Qdrant error rate high: ${stats.qdrant.errorRate}`);
    } else if (stats.qdrant.errorRate > 0.05 || stats.qdrant.averageResponseTime > 2000) {
      qdrantStatus = 'degraded';
      issues.push(`Qdrant performance degraded: response time ${stats.qdrant.averageResponseTime}ms`);
    }

    let graphStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (stats.graph.errorRate > 0.1) {
      graphStatus = 'critical';
      issues.push(`Graph error rate high: ${stats.graph.errorRate}`);
    } else if (stats.graph.errorRate > 0.05 || stats.graph.averageResponseTime > 3000) {
      graphStatus = 'degraded';
      issues.push(`Graph performance degraded: response time ${stats.graph.averageResponseTime}ms`);
    }

    let cacheStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (stats.cache.hitRate !== null) {
      if (stats.cache.hitRate < 0.7) {
        cacheStatus = 'critical';
        issues.push(`Cache hit rate low: ${stats.cache.hitRate}`);
      } else if (stats.cache.hitRate < 0.85) {
        cacheStatus = 'degraded';
        issues.push(`Cache hit rate suboptimal: ${stats.cache.hitRate}`);
      }
    } else {
      // 当命中率不可用时，不触发警报
      this.logger.debug('Cache hit rate not available for health check');
    }

    let transactionStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (stats.transaction.successRate < 0.9) {
      transactionStatus = 'critical';
      issues.push(`Transaction success rate low: ${stats.transaction.successRate}`);
    } else if (stats.transaction.successRate < 0.95) {
      transactionStatus = 'degraded';
      issues.push(`Transaction success rate suboptimal: ${stats.transaction.successRate}`);
    }

    // 计算整体状态
    const criticalComponents = [qdrantStatus, graphStatus, cacheStatus, transactionStatus]
      .filter(status => status === 'critical').length;

    const degradedComponents = [qdrantStatus, graphStatus, cacheStatus, transactionStatus]
      .filter(status => status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalComponents > 0) {
      overallStatus = 'critical';
    } else if (degradedComponents > 0) {
      overallStatus = 'degraded';
    }

    return {
      overallStatus,
      components: {
        qdrant: qdrantStatus,
        graph: graphStatus,
        cache: cacheStatus,
        transaction: transactionStatus
      },
      issues
    };
  }

  /**
   * 重置仪表板数据
   */
  async reset(): Promise<void> {
    this.metrics = [];
    this.alerts = [];
    this.logger.info('Performance dashboard reset');
  }
}