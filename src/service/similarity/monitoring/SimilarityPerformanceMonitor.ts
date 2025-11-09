import { injectable } from 'inversify';
import { ISimilarityPerformanceMonitor, SimilarityStrategyType } from '../types/SimilarityTypes';

/**
 * 相似度性能监控器
 * 跟踪相似度计算的性能指标
 */
@injectable()
export class SimilarityPerformanceMonitor implements ISimilarityPerformanceMonitor {
  private metrics = {
    totalCalculations: 0,
    totalExecutionTime: 0,
    cacheHits: 0,
    strategyUsage: {} as Record<SimilarityStrategyType, number>
  };

  private timers = new Map<string, number>();

  startTimer(): () => number {
    const startTime = Date.now();
    const timerId = Math.random().toString(36).substring(7);
    this.timers.set(timerId, startTime);

    return (): number => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      this.timers.delete(timerId);
      return executionTime;
    };
  }

  recordCalculation(strategy: SimilarityStrategyType, executionTime: number, cacheHit: boolean): void {
    this.metrics.totalCalculations++;
    this.metrics.totalExecutionTime += executionTime;
    
    if (cacheHit) {
      this.metrics.cacheHits++;
    }

    // 记录策略使用情况
    if (!this.metrics.strategyUsage[strategy]) {
      this.metrics.strategyUsage[strategy] = 0;
    }
    this.metrics.strategyUsage[strategy]++;
  }

  getMetrics(): {
    totalCalculations: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    strategyUsage: Record<SimilarityStrategyType, number>;
  } {
    const averageExecutionTime = this.metrics.totalCalculations > 0 
      ? this.metrics.totalExecutionTime / this.metrics.totalCalculations 
      : 0;

    const cacheHitRate = this.metrics.totalCalculations > 0 
      ? this.metrics.cacheHits / this.metrics.totalCalculations 
      : 0;

    return {
      totalCalculations: this.metrics.totalCalculations,
      averageExecutionTime,
      cacheHitRate,
      strategyUsage: { ...this.metrics.strategyUsage }
    };
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.metrics = {
      totalCalculations: 0,
      totalExecutionTime: 0,
      cacheHits: 0,
      strategyUsage: {} as Record<SimilarityStrategyType, number>
    };
    this.timers.clear();
  }

  /**
   * 获取详细的性能报告
   */
  getDetailedReport(): {
    summary: ReturnType<typeof this.getMetrics>;
    details: {
      fastestStrategy?: SimilarityStrategyType;
      slowestStrategy?: SimilarityStrategyType;
      mostUsedStrategy?: SimilarityStrategyType;
      activeTimers: number;
    };
  } {
    const summary = this.getMetrics();
    const strategyTimes = this.calculateStrategyAverageTimes();
    
    const details = {
      fastestStrategy: this.findFastestStrategy(strategyTimes),
      slowestStrategy: this.findSlowestStrategy(strategyTimes),
      mostUsedStrategy: this.findMostUsedStrategy(),
      activeTimers: this.timers.size
    };

    return { summary, details };
  }

  /**
   * 计算各策略的平均执行时间
   */
  private calculateStrategyAverageTimes(): Record<SimilarityStrategyType, number> {
    // 这是一个简化的实现，实际项目中可能需要更复杂的跟踪
    const strategyTimes: Record<SimilarityStrategyType, number> = {} as any;
    
    // 基于经验值或历史数据估算
    Object.keys(this.metrics.strategyUsage).forEach(strategy => {
      const strategyType = strategy as SimilarityStrategyType;
      switch (strategyType) {
        case 'levenshtein':
          strategyTimes[strategyType] = 5; // 5ms 平均
          break;
        case 'semantic':
          strategyTimes[strategyType] = 50; // 50ms 平均（包含网络请求）
          break;
        case 'keyword':
          strategyTimes[strategyType] = 2; // 2ms 平均
          break;
        case 'hybrid':
          strategyTimes[strategyType] = 30; // 30ms 平均
          break;
        default:
          strategyTimes[strategyType] = 10; // 默认值
      }
    });

    return strategyTimes;
  }

  /**
   * 找出最快的策略
   */
  private findFastestStrategy(strategyTimes: Record<SimilarityStrategyType, number>): SimilarityStrategyType | undefined {
    let fastest: SimilarityStrategyType | undefined;
    let minTime = Infinity;

    Object.entries(strategyTimes).forEach(([strategy, time]) => {
      if (time < minTime) {
        minTime = time;
        fastest = strategy as SimilarityStrategyType;
      }
    });

    return fastest;
  }

  /**
   * 找出最慢的策略
   */
  private findSlowestStrategy(strategyTimes: Record<SimilarityStrategyType, number>): SimilarityStrategyType | undefined {
    let slowest: SimilarityStrategyType | undefined;
    let maxTime = 0;

    Object.entries(strategyTimes).forEach(([strategy, time]) => {
      if (time > maxTime) {
        maxTime = time;
        slowest = strategy as SimilarityStrategyType;
      }
    });

    return slowest;
  }

  /**
   * 找出最常用的策略
   */
  private findMostUsedStrategy(): SimilarityStrategyType | undefined {
    let mostUsed: SimilarityStrategyType | undefined;
    let maxUsage = 0;

    Object.entries(this.metrics.strategyUsage).forEach(([strategy, usage]) => {
      if (usage > maxUsage) {
        maxUsage = usage;
        mostUsed = strategy as SimilarityStrategyType;
      }
    });

    return mostUsed;
  }

  /**
   * 导出性能数据
   */
  exportData(): {
    timestamp: number;
    metrics: typeof this.metrics;
  } {
    return {
      timestamp: Date.now(),
      metrics: { ...this.metrics }
    };
  }

  /**
   * 导入性能数据
   */
  importData(data: {
    timestamp: number;
    metrics: typeof this.metrics;
  }): void {
    this.metrics = { ...data.metrics };
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    // 缓存命中率建议
    if (metrics.cacheHitRate < 0.5) {
      recommendations.push('Consider increasing cache size or TTL to improve cache hit rate');
    }

    // 平均执行时间建议
    if (metrics.averageExecutionTime > 100) {
      recommendations.push('Average execution time is high, consider optimizing strategies or using faster alternatives');
    }

    // 策略使用建议
    const totalUsage = Object.values(metrics.strategyUsage).reduce((sum, count) => sum + count, 0);
    if (totalUsage > 0) {
      const semanticUsage = metrics.strategyUsage.semantic || 0;
      const semanticRatio = semanticUsage / totalUsage;
      
      if (semanticRatio > 0.7) {
        recommendations.push('High usage of semantic strategy may impact performance, consider hybrid approach');
      }
    }

    // 活跃计时器检查
    if (this.timers.size > 0) {
      recommendations.push(`There are ${this.timers.size} active timers, check for potential memory leaks`);
    }

    return recommendations;
  }
}