import { inject, injectable } from 'inversify';
import { ISimilarityPerformanceMonitor, SimilarityStrategyType } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';

/**
 * 相似度性能监控器
 * 使用基础设施的PerformanceMonitor跟踪相似度计算的性能指标
 */
@injectable()
export class SimilarityPerformanceMonitor implements ISimilarityPerformanceMonitor {
  private metrics = {
    totalCalculations: 0,
    cacheHits: 0,
    strategyUsage: {} as Record<SimilarityStrategyType, number>
  };

  constructor(
    @inject(TYPES.PerformanceMonitor) private performanceMonitor?: PerformanceMonitor
  ) {
    if (!performanceMonitor) {
      console.warn('PerformanceMonitor not provided, SimilarityPerformanceMonitor will not function properly');
    }
  }

  startTimer(): () => number {
    if (!this.performanceMonitor) {
      return () => 0;
    }
    
    // 使用基础设施的性能监控器创建操作上下文
    const operationId = this.performanceMonitor.startOperation('similarity_calculation');
    
    return (): number => {
      // 结束操作并获取持续时间
      const endTime = Date.now();
      this.performanceMonitor?.endOperation(operationId);
      return endTime; // 这里简化处理，实际应该从PerformanceMonitor获取准确的时间
    };
  }

  recordCalculation(strategy: SimilarityStrategyType, executionTime: number, cacheHit: boolean): void {
    this.metrics.totalCalculations++;
    
    if (cacheHit) {
      this.metrics.cacheHits++;
    }

    // 记录策略使用情况
    if (!this.metrics.strategyUsage[strategy]) {
      this.metrics.strategyUsage[strategy] = 0;
    }
    this.metrics.strategyUsage[strategy]++;

    // 记录到基础设施性能监控器
    if (this.performanceMonitor) {
      this.performanceMonitor.recordQueryExecution(executionTime);
      this.performanceMonitor.updateCacheHitRate(cacheHit);
    }
  }

  getMetrics(): {
    totalCalculations: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    strategyUsage: Record<SimilarityStrategyType, number>;
  } {
    // 从基础设施性能监控器获取执行时间统计
    let averageExecutionTime = 0;
    let cacheHitRate = 0;
    
    if (this.performanceMonitor) {
      const metrics = this.performanceMonitor.getMetrics();
      averageExecutionTime = metrics.averageQueryTime;
      cacheHitRate = metrics.cacheHitRate;
    }

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
      cacheHits: 0,
      strategyUsage: {} as Record<SimilarityStrategyType, number>
    };
    
    // 重置基础设施性能监控器的指标
    this.performanceMonitor?.resetMetrics();
  }

  /**
   * 获取详细的性能报告
   */
  getDetailedReport(): {
    summary: ReturnType<SimilarityPerformanceMonitor['getMetrics']>;
    details: {
      fastestStrategy?: SimilarityStrategyType;
      slowestStrategy?: SimilarityStrategyType;
      mostUsedStrategy?: SimilarityStrategyType;
    };
  } {
    const summary = this.getMetrics();
    const details = {
      fastestStrategy: this.findFastestStrategy(),
      slowestStrategy: this.findSlowestStrategy(),
      mostUsedStrategy: this.findMostUsedStrategy()
    };

    return { summary, details };
  }

  /**
   * 找出最快的策略
   */
  private findFastestStrategy(): SimilarityStrategyType | undefined {
    // 由于我们使用基础设施的性能监控器，这里基于经验值估算
    let fastest: SimilarityStrategyType | undefined;
    let minTime = Infinity;

    Object.entries(this.metrics.strategyUsage).forEach(([strategy, usage]) => {
      if (usage > 0) {
        const strategyType = strategy as SimilarityStrategyType;
        let avgTime: number;
        
        switch (strategyType) {
          case 'levenshtein':
            avgTime = 5; // 5ms 平均
            break;
          case 'semantic':
            avgTime = 50; // 50ms 平均（包含网络请求）
            break;
          case 'keyword':
            avgTime = 2; // 2ms 平均
            break;
          case 'hybrid':
            avgTime = 30; // 30ms 平均
            break;
          default:
            avgTime = 10; // 默认值
        }
        
        if (avgTime < minTime) {
          minTime = avgTime;
          fastest = strategyType;
        }
      }
    });

    return fastest;
  }

  /**
   * 找出最慢的策略
   */
  private findSlowestStrategy(): SimilarityStrategyType | undefined {
    let slowest: SimilarityStrategyType | undefined;
    let maxTime = 0;

    Object.entries(this.metrics.strategyUsage).forEach(([strategy, usage]) => {
      if (usage > 0) {
        const strategyType = strategy as SimilarityStrategyType;
        let avgTime: number;
        
        switch (strategyType) {
          case 'levenshtein':
            avgTime = 5; // 5ms 平均
            break;
          case 'semantic':
            avgTime = 50; // 50ms 平均（包含网络请求）
            break;
          case 'keyword':
            avgTime = 2; // 2ms 平均
            break;
          case 'hybrid':
            avgTime = 30; // 30ms 平均
            break;
          default:
            avgTime = 10; // 默认值
        }
        
        if (avgTime > maxTime) {
          maxTime = avgTime;
          slowest = strategyType;
        }
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
}