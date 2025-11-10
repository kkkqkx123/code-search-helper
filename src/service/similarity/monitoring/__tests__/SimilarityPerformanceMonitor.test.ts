import { SimilarityPerformanceMonitor } from '../SimilarityPerformanceMonitor';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { SimilarityStrategyType } from '../../types/SimilarityTypes';

// Mock PerformanceMonitor
class MockPerformanceMonitor {
  private operations = new Map<string, { startTime: number }>();
  private queryExecutionTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  startOperation(operationType: string): string {
    const operationId = `${operationType}_${Date.now()}_${Math.random()}`;
    this.operations.set(operationId, { startTime: Date.now() });
    return operationId;
  }

  endOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (operation) {
      this.operations.delete(operationId);
    }
  }

  recordQueryExecution(executionTime: number): void {
    this.queryExecutionTimes.push(executionTime);
  }

  updateCacheHitRate(isHit: boolean): void {
    if (isHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  getMetrics() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
    const averageQueryTime = this.queryExecutionTimes.length > 0
      ? this.queryExecutionTimes.reduce((sum, time) => sum + time, 0) / this.queryExecutionTimes.length
      : 0;

    return {
      averageQueryTime,
      cacheHitRate: hitRate,
      totalEntries: 0,
      hitCount: this.cacheHits,
      missCount: this.cacheMisses
    };
  }

  resetMetrics(): void {
    this.queryExecutionTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

describe('SimilarityPerformanceMonitor', () => {
  let monitor: SimilarityPerformanceMonitor;
  let mockPerformanceMonitor: MockPerformanceMonitor;

  beforeEach(() => {
    mockPerformanceMonitor = new MockPerformanceMonitor();
    monitor = new SimilarityPerformanceMonitor(mockPerformanceMonitor as any);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(monitor).toBeInstanceOf(SimilarityPerformanceMonitor);
    });

    it('should warn when PerformanceMonitor is not provided', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const monitorWithoutPerf = new SimilarityPerformanceMonitor(undefined);
      
      expect(consoleSpy).toHaveBeenCalledWith('PerformanceMonitor not provided, SimilarityPerformanceMonitor will not function properly');
      
      consoleSpy.mockRestore();
    });
  });

  describe('startTimer', () => {
    it('should return a function that ends the operation', () => {
      const endTimer = monitor.startTimer();
      expect(typeof endTimer).toBe('function');
    });

    it('should record operation duration when timer is ended', () => {
      const endTimer = monitor.startTimer();
      
      // Simulate some work
      setTimeout(() => {
        const endTime = endTimer();
        expect(typeof endTime).toBe('number');
        expect(endTime).toBeGreaterThan(0);
      }, 10);
    });

    it('should return 0 when PerformanceMonitor is not available', () => {
      const monitorWithoutPerf = new SimilarityPerformanceMonitor(undefined);
      const endTimer = monitorWithoutPerf.startTimer();
      const endTime = endTimer();
      
      expect(endTime).toBe(0);
    });
  });

  describe('recordCalculation', () => {
    it('should record calculation metrics', () => {
      const strategy: SimilarityStrategyType = 'levenshtein';
      const executionTime = 25;
      const cacheHit = true;

      monitor.recordCalculation(strategy, executionTime, cacheHit);

      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.strategyUsage[strategy]).toBe(1);
    });

    it('should record multiple calculations for the same strategy', () => {
      const strategy: SimilarityStrategyType = 'semantic';
      
      monitor.recordCalculation(strategy, 50, false);
      monitor.recordCalculation(strategy, 45, true);
      monitor.recordCalculation(strategy, 55, false);

      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(3);
      expect(metrics.strategyUsage[strategy]).toBe(3);
    });

    it('should record different strategies separately', () => {
      monitor.recordCalculation('levenshtein', 10, false);
      monitor.recordCalculation('semantic', 50, true);
      monitor.recordCalculation('keyword', 5, false);

      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(3);
      expect(metrics.strategyUsage['levenshtein']).toBe(1);
      expect(metrics.strategyUsage['semantic']).toBe(1);
      expect(metrics.strategyUsage['keyword']).toBe(1);
    });

    it('should delegate to PerformanceMonitor when available', () => {
      const recordQuerySpy = jest.spyOn(mockPerformanceMonitor, 'recordQueryExecution');
      const updateCacheSpy = jest.spyOn(mockPerformanceMonitor, 'updateCacheHitRate');

      monitor.recordCalculation('hybrid', 30, true);

      expect(recordQuerySpy).toHaveBeenCalledWith(30);
      expect(updateCacheSpy).toHaveBeenCalledWith(true);
    });

    it('should not throw when PerformanceMonitor is not available', () => {
      const monitorWithoutPerf = new SimilarityPerformanceMonitor(undefined);
      
      expect(() => {
        monitorWithoutPerf.recordCalculation('levenshtein', 10, false);
      }).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    it('should return correct metrics after recordings', () => {
      monitor.recordCalculation('levenshtein', 10, false);
      monitor.recordCalculation('semantic', 50, true);
      monitor.recordCalculation('keyword', 5, false);

      const metrics = monitor.getMetrics();

      expect(metrics.totalCalculations).toBe(3);
      expect(metrics.strategyUsage['levenshtein']).toBe(1);
      expect(metrics.strategyUsage['semantic']).toBe(1);
      expect(metrics.strategyUsage['keyword']).toBe(1);
      expect(typeof metrics.averageExecutionTime).toBe('number');
      expect(typeof metrics.cacheHitRate).toBe('number');
    });

    it('should return default metrics when no calculations recorded', () => {
      const metrics = monitor.getMetrics();

      expect(metrics.totalCalculations).toBe(0);
      expect(Object.keys(metrics.strategyUsage)).toHaveLength(0);
      expect(metrics.averageExecutionTime).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should use PerformanceMonitor metrics when available', () => {
      // Pre-populate the mock PerformanceMonitor
      mockPerformanceMonitor.recordQueryExecution(20);
      mockPerformanceMonitor.recordQueryExecution(40);
      mockPerformanceMonitor.updateCacheHitRate(true);
      mockPerformanceMonitor.updateCacheHitRate(false);

      const metrics = monitor.getMetrics();

      expect(metrics.averageExecutionTime).toBe(30); // (20 + 40) / 2
      expect(metrics.cacheHitRate).toBe(0.5); // 1 hit / 2 total
    });

    it('should return zero metrics when PerformanceMonitor is not available', () => {
      const monitorWithoutPerf = new SimilarityPerformanceMonitor(undefined);
      const metrics = monitorWithoutPerf.getMetrics();

      expect(metrics.averageExecutionTime).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      monitor.recordCalculation('levenshtein', 10, false);
      monitor.recordCalculation('semantic', 50, true);

      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(0);
      expect(Object.keys(metrics.strategyUsage)).toHaveLength(0);
    });

    it('should reset PerformanceMonitor metrics when available', () => {
      const resetSpy = jest.spyOn(mockPerformanceMonitor, 'resetMetrics');
      
      monitor.reset();
      
      expect(resetSpy).toHaveBeenCalled();
    });

    it('should not throw when PerformanceMonitor is not available', () => {
      const monitorWithoutPerf = new SimilarityPerformanceMonitor(undefined);
      
      expect(() => {
        monitorWithoutPerf.reset();
      }).not.toThrow();
    });
  });

  describe('getDetailedReport', () => {
    it('should return detailed report with summary and details', () => {
      monitor.recordCalculation('levenshtein', 5, false);
      monitor.recordCalculation('semantic', 50, true);
      monitor.recordCalculation('keyword', 2, false);

      const report = monitor.getDetailedReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('details');
      expect(report.summary.totalCalculations).toBe(3);
      expect(report.details.fastestStrategy).toBe('keyword');
      expect(report.details.slowestStrategy).toBe('semantic');
      expect(report.details.mostUsedStrategy).toBeDefined();
    });

    it('should identify fastest strategy correctly', () => {
      monitor.recordCalculation('levenshtein', 5, false);
      monitor.recordCalculation('keyword', 2, false);
      monitor.recordCalculation('semantic', 50, true);

      const report = monitor.getDetailedReport();
      expect(report.details.fastestStrategy).toBe('keyword');
    });

    it('should identify slowest strategy correctly', () => {
      monitor.recordCalculation('levenshtein', 5, false);
      monitor.recordCalculation('keyword', 2, false);
      monitor.recordCalculation('semantic', 50, true);

      const report = monitor.getDetailedReport();
      expect(report.details.slowestStrategy).toBe('semantic');
    });

    it('should identify most used strategy correctly', () => {
      monitor.recordCalculation('levenshtein', 5, false);
      monitor.recordCalculation('levenshtein', 6, false);
      monitor.recordCalculation('semantic', 50, true);

      const report = monitor.getDetailedReport();
      expect(report.details.mostUsedStrategy).toBe('levenshtein');
    });

    it('should handle empty metrics gracefully', () => {
      const report = monitor.getDetailedReport();

      expect(report.summary.totalCalculations).toBe(0);
      expect(report.details.fastestStrategy).toBeUndefined();
      expect(report.details.slowestStrategy).toBeUndefined();
      expect(report.details.mostUsedStrategy).toBeUndefined();
    });

    it('should handle single strategy usage', () => {
      monitor.recordCalculation('hybrid', 30, false);

      const report = monitor.getDetailedReport();
      expect(report.details.fastestStrategy).toBe('hybrid');
      expect(report.details.slowestStrategy).toBe('hybrid');
      expect(report.details.mostUsedStrategy).toBe('hybrid');
    });
  });

  describe('strategy performance estimation', () => {
    it('should estimate performance for all strategy types', () => {
      const strategies: SimilarityStrategyType[] = ['levenshtein', 'semantic', 'keyword', 'hybrid'];
      
      strategies.forEach(strategy => {
        monitor.recordCalculation(strategy, 10, false);
      });

      const report = monitor.getDetailedReport();
      
      expect(report.details.fastestStrategy).toBeDefined();
      expect(report.details.slowestStrategy).toBeDefined();
      expect(report.details.mostUsedStrategy).toBeDefined();
    });

    it('should use predefined average times for strategy estimation', () => {
      // The implementation uses predefined average times:
      // keyword: 2ms, levenshtein: 5ms, hybrid: 30ms, semantic: 50ms
      
      monitor.recordCalculation('keyword', 1, false);
      monitor.recordCalculation('levenshtein', 1, false);
      monitor.recordCalculation('hybrid', 1, false);
      monitor.recordCalculation('semantic', 1, false);

      const report = monitor.getDetailedReport();
      
      expect(report.details.fastestStrategy).toBe('keyword');
      expect(report.details.slowestStrategy).toBe('semantic');
    });
  });

  describe('integration tests', () => {
    it('should handle complete monitoring workflow', () => {
      // Start timer
      const endTimer = monitor.startTimer();
      
      // Simulate calculation
      monitor.recordCalculation('levenshtein', 15, false);
      
      // End timer
      const endTime = endTimer();
      
      // Get metrics
      const metrics = monitor.getMetrics();
      const report = monitor.getDetailedReport();
      
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.strategyUsage['levenshtein']).toBe(1);
      expect(endTime).toBeGreaterThan(0);
      expect(report.summary.totalCalculations).toBe(1);
    });

    it('should handle multiple calculations with different strategies', () => {
      const calculations = [
        { strategy: 'levenshtein' as SimilarityStrategyType, time: 10, cacheHit: false },
        { strategy: 'semantic' as SimilarityStrategyType, time: 50, cacheHit: true },
        { strategy: 'keyword' as SimilarityStrategyType, time: 5, cacheHit: false },
        { strategy: 'hybrid' as SimilarityStrategyType, time: 30, cacheHit: true },
        { strategy: 'levenshtein' as SimilarityStrategyType, time: 12, cacheHit: false }
      ];

      calculations.forEach(calc => {
        monitor.recordCalculation(calc.strategy, calc.time, calc.cacheHit);
      });

      const metrics = monitor.getMetrics();
      const report = monitor.getDetailedReport();

      expect(metrics.totalCalculations).toBe(5);
      expect(metrics.strategyUsage['levenshtein']).toBe(2);
      expect(metrics.strategyUsage['semantic']).toBe(1);
      expect(metrics.strategyUsage['keyword']).toBe(1);
      expect(metrics.strategyUsage['hybrid']).toBe(1);
      expect(report.details.mostUsedStrategy).toBe('levenshtein');
      expect(report.details.fastestStrategy).toBe('keyword');
      expect(report.details.slowestStrategy).toBe('semantic');
    });

    it('should reset and start fresh monitoring', () => {
      // Record some calculations
      monitor.recordCalculation('levenshtein', 10, false);
      monitor.recordCalculation('semantic', 50, true);

      // Verify metrics
      let metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(2);

      // Reset
      monitor.reset();

      // Verify reset
      metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(0);
      expect(Object.keys(metrics.strategyUsage)).toHaveLength(0);

      // Record new calculations
      monitor.recordCalculation('keyword', 5, false);

      // Verify new metrics
      metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.strategyUsage['keyword']).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero execution time', () => {
      monitor.recordCalculation('levenshtein', 0, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.strategyUsage['levenshtein']).toBe(1);
    });

    it('should handle very large execution times', () => {
      monitor.recordCalculation('semantic', 10000, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.strategyUsage['semantic']).toBe(1);
    });

    it('should handle all cache hits', () => {
      monitor.recordCalculation('levenshtein', 10, true);
      monitor.recordCalculation('semantic', 50, true);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(2);
    });

    it('should handle all cache misses', () => {
      monitor.recordCalculation('levenshtein', 10, false);
      monitor.recordCalculation('semantic', 50, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(2);
    });

    it('should handle mixed cache hits and misses', () => {
      monitor.recordCalculation('levenshtein', 10, true);
      monitor.recordCalculation('semantic', 50, false);
      monitor.recordCalculation('keyword', 5, true);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalCalculations).toBe(3);
    });
  });
});