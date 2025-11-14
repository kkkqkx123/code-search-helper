import { VectorMetricsCollector, VectorMetrics } from '../monitoring/VectorMetricsCollector';
import { LoggerService } from '../../../utils/LoggerService';

describe('VectorMetricsCollector', () => {
  let vectorMetricsCollector: VectorMetricsCollector;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    vectorMetricsCollector = new VectorMetricsCollector(mockLoggerService);
  });

  describe('recordOperation', () => {
    it('should record successful operation', () => {
      // Arrange
      const operation = 'test-operation';
      const duration = 100;

      // Act
      vectorMetricsCollector.recordOperation(operation, duration, true);

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(1);
      expect(metrics.averageDuration).toBe(100);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should record failed operation', () => {
      // Arrange
      const operation = 'test-operation';
      const duration = 100;

      // Act
      vectorMetricsCollector.recordOperation(operation, duration, false);

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(1);
      expect(metrics.averageDuration).toBe(100);
      expect(metrics.errorRate).toBe(1);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should record multiple operations correctly', () => {
      // Arrange
      const operation1 = 'operation1';
      const operation2 = 'operation2';

      // Act
      vectorMetricsCollector.recordOperation(operation1, 100, true);
      vectorMetricsCollector.recordOperation(operation2, 200, true);
      vectorMetricsCollector.recordOperation(operation1, 150, false);

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.averageDuration).toBe(150); // (100 + 200 + 150) / 3
      expect(metrics.errorRate).toBe(1/3); // 1 error out of 3 operations
    });

    it('should record operations with different types', () => {
      // Arrange
      const searchOperation = 'search';
      const indexOperation = 'index';

      // Act
      vectorMetricsCollector.recordOperation(searchOperation, 50, true);
      vectorMetricsCollector.recordOperation(indexOperation, 200, true);
      vectorMetricsCollector.recordOperation(searchOperation, 75, true);

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.averageDuration).toBe(108.33); // (50 + 200 + 75) / 3
      expect(metrics.errorRate).toBe(0);
    });

    it('should update last operation time', () => {
      // Arrange
      const operation = 'test-operation';
      const duration = 100;

      // Act
      const beforeTime = Date.now();
      vectorMetricsCollector.recordOperation(operation, duration, true);
      const afterTime = Date.now();

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
      expect(metrics.lastOperationTime!.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(metrics.lastOperationTime!.getTime()).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('getMetrics', () => {
    it('should return zero metrics when no operations recorded', () => {
      // Act
      const metrics = vectorMetricsCollector.getMetrics();

      // Assert
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.lastOperationTime).toBeUndefined();
    });

    it('should return correct metrics after operations', () => {
      // Arrange
      vectorMetricsCollector.recordOperation('operation1', 100, true);
      vectorMetricsCollector.recordOperation('operation2', 200, false);
      vectorMetricsCollector.recordOperation('operation1', 150, true);

      // Act
      const metrics = vectorMetricsCollector.getMetrics();

      // Assert
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.averageDuration).toBe(150); // (100 + 200 + 150) / 3
      expect(metrics.errorRate).toBe(1/3); // 1 error out of 3 operations
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should calculate cache hit rate correctly', () => {
      // Arrange
      // Manually set cache metrics to test calculation
      (vectorMetricsCollector as any).metrics.set('cache_hits', 80);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 20);

      // Act
      const metrics = vectorMetricsCollector.getMetrics();

      // Assert
      expect(metrics.cacheHitRate).toBe(0.8); // 80 / (80 + 20)
    });

    it('should handle zero cache operations', () => {
      // Act
      const metrics = vectorMetricsCollector.getMetrics();

      // Assert
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should handle only cache hits', () => {
      // Arrange
      (vectorMetricsCollector as any).metrics.set('cache_hits', 100);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 0);

      // Act
      const metrics = vectorMetricsCollector.getMetrics();

      // Assert
      expect(metrics.cacheHitRate).toBe(1);
    });

    it('should handle only cache misses', () => {
      // Arrange
      (vectorMetricsCollector as any).metrics.set('cache_hits', 0);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 100);

      // Act
      const metrics = vectorMetricsCollector.getMetrics();

      // Assert
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      // Arrange
      vectorMetricsCollector.recordOperation('operation1', 100, true);
      vectorMetricsCollector.recordOperation('operation2', 200, false);
      (vectorMetricsCollector as any).metrics.set('cache_hits', 80);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 20);

      // Verify metrics are set
      let metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(2);
      expect(metrics.cacheHitRate).toBe(0.8);

      // Act
      vectorMetricsCollector.reset();

      // Assert
      metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.lastOperationTime).toBeUndefined();
    });
  });

  describe('calculateCacheHitRate', () => {
    it('should calculate hit rate correctly with hits and misses', () => {
      // Arrange
      (vectorMetricsCollector as any).metrics.set('cache_hits', 75);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 25);

      // Act
      const hitRate = (vectorMetricsCollector as any).calculateCacheHitRate();

      // Assert
      expect(hitRate).toBe(0.75);
    });

    it('should return 0 when no cache operations', () => {
      // Act
      const hitRate = (vectorMetricsCollector as any).calculateCacheHitRate();

      // Assert
      expect(hitRate).toBe(0);
    });

    it('should return 1 when only hits', () => {
      // Arrange
      (vectorMetricsCollector as any).metrics.set('cache_hits', 100);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 0);

      // Act
      const hitRate = (vectorMetricsCollector as any).calculateCacheHitRate();

      // Assert
      expect(hitRate).toBe(1);
    });

    it('should return 0 when only misses', () => {
      // Arrange
      (vectorMetricsCollector as any).metrics.set('cache_hits', 0);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 100);

      // Act
      const hitRate = (vectorMetricsCollector as any).calculateCacheHitRate();

      // Assert
      expect(hitRate).toBe(0);
    });
  });

  describe('integration tests', () => {
    it('should track complete workflow metrics', () => {
      // Arrange & Act - Simulate a complete workflow
      // Cache operations
      (vectorMetricsCollector as any).metrics.set('cache_hits', 80);
      (vectorMetricsCollector as any).metrics.set('cache_misses', 20);

      // Vector operations
      vectorMetricsCollector.recordOperation('vector-create', 150, true);
      vectorMetricsCollector.recordOperation('vector-search', 50, true);
      vectorMetricsCollector.recordOperation('vector-create', 200, false);
      vectorMetricsCollector.recordOperation('vector-search', 75, true);
      vectorMetricsCollector.recordOperation('vector-delete', 100, true);

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(5);
      expect(metrics.averageDuration).toBe(115); // (150 + 50 + 200 + 75 + 100) / 5
      expect(metrics.errorRate).toBe(0.2); // 1 error out of 5 operations
      expect(metrics.cacheHitRate).toBe(0.8); // 80 / (80 + 20)
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should handle high volume operations', () => {
      // Arrange & Act - Simulate high volume operations
      for (let i = 0; i < 1000; i++) {
        const success = i % 10 !== 0; // 10% failure rate
        const duration = 50 + Math.random() * 100; // Random duration between 50-150ms
        vectorMetricsCollector.recordOperation('bulk-operation', duration, success);
      }

      // Assert
      const metrics = vectorMetricsCollector.getMetrics();
      expect(metrics.totalOperations).toBe(1000);
      expect(metrics.averageDuration).toBeGreaterThan(50);
      expect(metrics.averageDuration).toBeLessThan(150);
      expect(metrics.errorRate).toBeCloseTo(0.1, 1); // Approximately 10%
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });
  });
});