import { PerformanceMonitor } from '../PerformanceMonitor';
import { IPerformanceMonitor } from '../types';

describe('PerformanceMonitor', () => {
  let performanceMonitor: IPerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    // Clean up any active monitoring
    performanceMonitor.stopPeriodicMonitoring();
  });

  describe('constructor', () => {
    it('should initialize with default metrics', () => {
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.queryExecutionTimes).toEqual([]);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.batchSizes).toEqual([]);
      expect(metrics.memoryUsage).toEqual([]);
      expect(metrics.errorRates).toEqual([]);
    });
  });

  describe('recordQueryExecution', () => {
    it('should record query execution time', () => {
      performanceMonitor.recordQueryExecution(100);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.queryExecutionTimes).toContain(100);
    });

    it('should calculate average query execution time', () => {
      performanceMonitor.recordQueryExecution(100);
      performanceMonitor.recordQueryExecution(200);
      performanceMonitor.recordQueryExecution(300);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.averageQueryTime).toBe(200);
    });
  });

  describe('updateCacheHitRate', () => {
    it('should update cache hit rate for hit', () => {
      performanceMonitor.updateCacheHitRate(true);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.cacheHitRate).toBe(1);
    });

    it('should update cache hit rate for miss', () => {
      performanceMonitor.updateCacheHitRate(false);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should calculate cache hit rate correctly', () => {
      performanceMonitor.updateCacheHitRate(true);
      performanceMonitor.updateCacheHitRate(true);
      performanceMonitor.updateCacheHitRate(false);
      performanceMonitor.updateCacheHitRate(true);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.cacheHitRate).toBe(0.75); // 3 hits out of 4 requests
    });
  });

  describe('updateBatchSize', () => {
    it('should record batch size', () => {
      performanceMonitor.updateBatchSize(50);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.batchSizes).toContain(50);
    });

    it('should calculate average batch size', () => {
      performanceMonitor.updateBatchSize(50);
      performanceMonitor.updateBatchSize(100);
      performanceMonitor.updateBatchSize(150);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.averageBatchSize).toBe(100);
    });
  });

  describe('recordMemoryUsage', () => {
    it('should record memory usage', () => {
      performanceMonitor.recordMemoryUsage(75);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toContain(75);
    });

    it('should calculate average memory usage', () => {
      performanceMonitor.recordMemoryUsage(50);
      performanceMonitor.recordMemoryUsage(75);
      performanceMonitor.recordMemoryUsage(100);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.averageMemoryUsage).toBe(75);
    });
  });

  describe('recordError', () => {
    it('should record error', () => {
      performanceMonitor.recordError('TestError');
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.errorRates).toContain('TestError');
    });

    it('should calculate error rate', () => {
      performanceMonitor.recordError('TestError');
      performanceMonitor.recordError('AnotherError');
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.errorRate).toBe(2);
    });
  });

  describe('startPeriodicMonitoring', () => {
    it('should start periodic monitoring', () => {
      const callback = jest.fn();
      performanceMonitor.startPeriodicMonitoring(1000, callback);
      
      // Wait for at least one callback execution
      setTimeout(() => {
        expect(callback).toHaveBeenCalled();
      }, 1500);
    });

    it('should stop periodic monitoring when requested', () => {
      const callback = jest.fn();
      performanceMonitor.startPeriodicMonitoring(1000, callback);
      performanceMonitor.stopPeriodicMonitoring();
      
      // Wait to ensure no more callbacks
      setTimeout(() => {
        expect(callback).toHaveBeenCalledTimes(1); // Only the initial call
      }, 1500);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to default values', () => {
      // Add some metrics
      performanceMonitor.recordQueryExecution(100);
      performanceMonitor.updateCacheHitRate(true);
      performanceMonitor.updateBatchSize(50);
      performanceMonitor.recordMemoryUsage(75);
      performanceMonitor.recordError('TestError');
      
      // Reset metrics
      performanceMonitor.resetMetrics();
      
      // Check if all metrics are reset
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.queryExecutionTimes).toEqual([]);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.batchSizes).toEqual([]);
      expect(metrics.memoryUsage).toEqual([]);
      expect(metrics.errorRates).toEqual([]);
      expect(metrics.averageQueryTime).toBe(0);
      expect(metrics.averageBatchSize).toBe(0);
      expect(metrics.averageMemoryUsage).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveProperty('queryExecutionTimes');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('batchSizes');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('errorRates');
      expect(metrics).toHaveProperty('averageQueryTime');
      expect(metrics).toHaveProperty('averageBatchSize');
      expect(metrics).toHaveProperty('averageMemoryUsage');
      expect(metrics).toHaveProperty('errorRate');
    });
  });
});