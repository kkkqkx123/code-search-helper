import { QueryPerformanceMonitor } from '../../query/QueryPerformanceMonitor';

describe('QueryPerformanceMonitor', () => {
  beforeEach(() => {
    QueryPerformanceMonitor.clearMetrics();
  });

  test('should record query metrics', () => {
    QueryPerformanceMonitor.recordQuery('typescript_functions', 10);
    QueryPerformanceMonitor.recordQuery('typescript_functions', 20);
    
    const metrics = QueryPerformanceMonitor.getMetrics();
    expect(metrics.typescript_functions).toEqual({
      count: 2,
      totalTime: 30,
      averageTime: 15,
      maxTime: 20,
      minTime: 10
    });
  });

  test('should clear metrics', () => {
    QueryPerformanceMonitor.recordQuery('javascript_classes', 15);
    QueryPerformanceMonitor.clearMetrics();
    
    const metrics = QueryPerformanceMonitor.getMetrics();
    expect(Object.keys(metrics)).toHaveLength(0);
  });

  test('should handle multiple query types', () => {
    QueryPerformanceMonitor.recordQuery('typescript_functions', 10);
    QueryPerformanceMonitor.recordQuery('typescript_classes', 20);
    QueryPerformanceMonitor.recordQuery('javascript_functions', 15);
    
    const metrics = QueryPerformanceMonitor.getMetrics();
    expect(Object.keys(metrics)).toHaveLength(3);
    expect(metrics.typescript_functions.count).toBe(1);
    expect(metrics.typescript_classes.count).toBe(1);
    expect(metrics.javascript_functions.count).toBe(1);
  });

  test('should calculate summary correctly', () => {
    QueryPerformanceMonitor.recordQuery('typescript_functions', 10);
    QueryPerformanceMonitor.recordQuery('typescript_functions', 20);
    QueryPerformanceMonitor.recordQuery('javascript_classes', 15);
    
    const summary = QueryPerformanceMonitor.getSummary();
    expect(summary).toEqual({
      totalQueries: 3,
      averageExecutionTime: 15,
      maxExecutionTime: 20,
      minExecutionTime: 10
    });
  });

  test('should handle empty metrics', () => {
    const summary = QueryPerformanceMonitor.getSummary();
    expect(summary).toEqual({
      totalQueries: 0,
      averageExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: 0
    });
  });

  test('should update min and max times correctly', () => {
    QueryPerformanceMonitor.recordQuery('test_query', 25);
    QueryPerformanceMonitor.recordQuery('test_query', 5);
    QueryPerformanceMonitor.recordQuery('test_query', 15);
    
    const metrics = QueryPerformanceMonitor.getMetrics();
    expect(metrics.test_query.maxTime).toBe(25);
    expect(metrics.test_query.minTime).toBe(5);
    expect(metrics.test_query.averageTime).toBe(15);
  });

  test('should handle single query correctly', () => {
    QueryPerformanceMonitor.recordQuery('single_query', 42);
    
    const metrics = QueryPerformanceMonitor.getMetrics();
    expect(metrics.single_query).toEqual({
      count: 1,
      totalTime: 42,
      averageTime: 42,
      maxTime: 42,
      minTime: 42
    });
  });
});