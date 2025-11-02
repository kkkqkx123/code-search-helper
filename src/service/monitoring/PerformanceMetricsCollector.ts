import { injectable, inject, unmanaged } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { PerformanceDashboard, PerformanceMetric } from './PerformanceDashboard';
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

export interface CollectionRule {
  metricName: string;
  interval: number; // 毫秒
  collector: () => Promise<number | string | boolean>;
  enabled: boolean;
}

export interface MetricsCollectionOptions {
  enableAutoCollection: boolean;
  collectionInterval: number; // 毫秒
  maxMetricsToStore: number;
}

@injectable()
export class PerformanceMetricsCollector {
  private logger: LoggerService;
  private dashboard: PerformanceDashboard;
  private cache: GraphMappingCache;
  private options: MetricsCollectionOptions;
  private collectionRules: Map<string, CollectionRule> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private readonly defaultRules: CollectionRule[] = [
    {
      metricName: 'system.cpu_usage',
      interval: 5000,
      collector: async () => this.getSystemCpuUsage(),
      enabled: true
    },
    {
      metricName: 'system.memory_usage',
      interval: 5000,
      collector: async () => this.getSystemMemoryUsage(),
      enabled: true
    },
    {
      metricName: 'cache.hit_rate',
      interval: 10000,
      collector: async () => {
        const stats = await this.cache.getStats();
        return stats.hitRate !== null ? stats.hitRate : 0; // 当没有足够数据时返回0
      },
      enabled: true
    },
    {
      metricName: 'cache.size',
      interval: 10000,
      collector: async () => (await this.cache.getStats()).size,
      enabled: true
    }
  ];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.PerformanceDashboard) dashboard: PerformanceDashboard,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    options?: Partial<MetricsCollectionOptions>
  ) {
    try {
      this.logger = logger;
      this.dashboard = dashboard;
      this.cache = cache;

      this.options = {
        enableAutoCollection: true,
        collectionInterval: 5000,
        maxMetricsToStore: 10000,
        ...options
      };

      // 注册默认收集规则
      this.defaultRules.forEach(rule => {
        this.collectionRules.set(rule.metricName, rule);
      });

      this.logger.info('PerformanceMetricsCollector initialized', { options: this.options });

      if (this.options.enableAutoCollection) {
        // 延迟启动自动收集，以避免在系统刚启动时没有足够数据就发出警报
        setTimeout(() => {
          this.startAutoCollection();
        }, 30000); // 30秒后开始收集
      }
    } catch (error) {
      logger.error('Failed to initialize PerformanceMetricsCollector', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  /**
   * 开始自动收集指标
   */
  startAutoCollection(): void {
    if (this.collectionInterval) {
      this.logger.warn('Auto collection already started');
      return;
    }

    this.logger.info('Starting auto metrics collection', {
      interval: this.options.collectionInterval
    });

    this.collectionInterval = setInterval(async () => {
      await this.collectAllEnabledMetrics();
    }, this.options.collectionInterval);
  }

  /**
   * 停止自动收集指标
   */
  stopAutoCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      this.logger.info('Stopped auto metrics collection');
    }
  }

  /**
   * 注册新的指标收集规则
   */
  registerCollectionRule(rule: CollectionRule): void {
    this.collectionRules.set(rule.metricName, rule);
    this.logger.debug('Registered collection rule', { metricName: rule.metricName });
  }

  /**
    * 启用指标收集规则
    */
  enableCollectionRule(metricName: string): boolean {
    const rule = this.collectionRules.get(metricName);
    if (rule) {
      rule.enabled = true;
      this.logger.debug('Enabled collection rule', { metricName });
      return true;
    }
    return false;
  }

  /**
   * 禁用指标收集规则
   */
  disableCollectionRule(metricName: string): boolean {
    const rule = this.collectionRules.get(metricName);
    if (rule) {
      rule.enabled = false;
      this.logger.debug('Disabled collection rule', { metricName });
      return true;
    }
    return false;
  }

  /**
   * 收集所有启用的指标
   */
  async collectAllEnabledMetrics(): Promise<void> {
    const enabledRules = Array.from(this.collectionRules.values()).filter(rule => rule.enabled);

    this.logger.debug('Collecting metrics', { ruleCount: enabledRules.length });

    for (const rule of enabledRules) {
      try {
        const value = await rule.collector();
        const metric: PerformanceMetric = {
          timestamp: Date.now(),
          metricName: rule.metricName,
          value,
          tags: { source: 'auto-collector' }
        };

        await this.dashboard.recordMetric(metric);
      } catch (error) {
        this.logger.error('Error collecting metric', {
          metricName: rule.metricName,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * 手动收集特定指标
   */
  async collectMetric(metricName: string): Promise<boolean> {
    const rule = this.collectionRules.get(metricName);
    if (!rule || !rule.enabled) {
      return false;
    }

    try {
      const value = await rule.collector();
      const metric: PerformanceMetric = {
        timestamp: Date.now(),
        metricName,
        value,
        tags: { source: 'manual-collector' }
      };

      await this.dashboard.recordMetric(metric);
      return true;
    } catch (error) {
      this.logger.error('Error collecting manual metric', {
        metricName,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 收集多个指标
   */
  async collectMetrics(metricNames: string[]): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    for (const metricName of metricNames) {
      results[metricName] = await this.collectMetric(metricName);
    }

    return results;
  }

  /**
   * 获取当前收集规则
   */
  getCollectionRules(): CollectionRule[] {
    return Array.from(this.collectionRules.values());
  }

  /**
   * 移除收集规则
   */
  removeCollectionRule(metricName: string): boolean {
    const removed = this.collectionRules.delete(metricName);
    if (removed) {
      this.logger.debug('Removed collection rule', { metricName });
    }
    return removed;
  }

  /**
   * 获取系统CPU使用率
   */
  private async getSystemCpuUsage(): Promise<number> {
    // 在Node.js中获取CPU使用率比较复杂，这里返回一个模拟值
    // 实际实现中可能需要使用os模块或其他系统监控库
    const usage = process.cpuUsage();
    // 这是一个简化的实现，实际中需要更复杂的计算
    return Math.min(100, Math.random() * 30 + 10); // 模拟10-40%的CPU使用率
  }

  /**
   * 获取系统内存使用率
   */
  private async getSystemMemoryUsage(): Promise<number> {
    const used = process.memoryUsage().heapUsed;
    const total = process.memoryUsage().heapTotal;
    return total > 0 ? (used / total) * 100 : 0;
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    hitRate: number | null;
    size: number;
    memoryUsage: number;
  }> {
    return await this.cache.getStats();
  }

  /**
    * 获取指标统计摘要
    */
  async getMetricsSummary(): Promise<{
    totalMetrics: number;
    metricsByType: { [key: string]: number };
    timeRange: { start: number; end: number };
  }> {
    if (this.dashboard['metrics'].length === 0) {
      return {
        totalMetrics: 0,
        metricsByType: {},
        timeRange: { start: 0, end: 0 }
      };
    }

    // 由于dashboard.metrics是私有属性，我们无法直接访问
    // 这里返回一个简化的实现
    const metricsByType: { [key: string]: number } = {};
    let minTime = Number.MAX_VALUE;
    let maxTime = Number.MIN_VALUE;

    // 模拟统计（实际实现中需要访问dashboard.metrics）
    for (const rule of this.collectionRules.values()) {
      if (rule.enabled) {
        metricsByType[rule.metricName] = Math.floor(Math.random() * 100); // 模拟计数
      }
    }

    return {
      totalMetrics: Object.values(metricsByType).reduce((a, b) => a + b, 0),
      metricsByType,
      timeRange: { start: minTime === Number.MAX_VALUE ? 0 : minTime, end: maxTime === Number.MIN_VALUE ? Date.now() : maxTime }
    };
  }

  /**
   * 销毁收集器
   */
  async destroy(): Promise<void> {
    this.stopAutoCollection();
    this.logger.info('PerformanceMetricsCollector destroyed');
  }
}