import { PerformanceMonitor } from '../PerformanceMonitor';
import { IPerformanceMonitor, PerformanceMetrics } from '../types';
import { LoggerService } from '../../../utils/LoggerService';
import { InfrastructureConfigService } from '../../config/InfrastructureConfigService';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<InfrastructureConfigService>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
      log: jest.fn(),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      withContext: jest.fn(),
      createChild: jest.fn(),
      getLevel: jest.fn(),
      setLevel: jest.fn(),
      isLevelEnabled: jest.fn(),
      close: jest.fn(),
      flush: jest.fn(),
      child: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getConfig: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      getAll: jest.fn(),
      reload: jest.fn(),
      watch: jest.fn(),
      unwatch: jest.fn(),
    } as any;

    // Mock configuration values
    mockConfigService.getConfig.mockReturnValue({
      common: {
        enableCache: true,
        enableMonitoring: true,
        enableBatching: true,
        logLevel: 'debug',
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        gracefulShutdownTimeout: 5000,
      },
      qdrant: {
        cache: {
          defaultTTL: 300000,
          maxEntries: 1000,
          cleanupInterval: 60000,
          enableStats: true,
          databaseSpecific: {},
        },
        performance: {
          monitoringInterval: 30000,
          metricsRetentionPeriod: 86400000,
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 5000,
            memoryUsage: 80,
            responseTime: 2000,
          },
          databaseSpecific: {},
        },
        batch: {
          maxConcurrentOperations: 10,
          defaultBatchSize: 100,
          maxBatchSize: 1000,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000,
          adjustmentFactor: 0.1,
          databaseSpecific: {},
        },
      },
      nebula: {
        cache: {
          defaultTTL: 300000,
          maxEntries: 1000,
          cleanupInterval: 60000,
          enableStats: true,
          databaseSpecific: {},
        },
        performance: {
          monitoringInterval: 30000,
          metricsRetentionPeriod: 86400000,
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 5000,
            memoryUsage: 80,
            responseTime: 2000,
          },
          databaseSpecific: {},
        },
        batch: {
          maxConcurrentOperations: 10,
          defaultBatchSize: 100,
          maxBatchSize: 1000,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000,
          adjustmentFactor: 0.1,
          databaseSpecific: {},
        },
        graph: {
          defaultSpace: 'test_space',
        },
      },
    });

    performanceMonitor = new PerformanceMonitor(mockLogger, mockConfigService);
  });

  describe('recordOperation', () => {
    it('should record operation with simplified interface', () => {
      const operation = 'test_operation';
      const duration = 100;

      performanceMonitor.recordOperation(operation, duration);

      expect(mockLogger.debug).toHaveBeenCalledWith('Operation recorded', {
        operation,
        duration
      });
    });

    it('should log warning when operation exceeds threshold', () => {
      const operation = 'slow_operation';
      const duration = 6000; // 超过默认阈值

      performanceMonitor.recordOperation(operation, duration);

      expect(mockLogger.warn).toHaveBeenCalledWith('Operation exceeded threshold', {
        operation,
        duration,
        threshold: 5000
      });
    });

    it('should record query execution time', () => {
      const duration = 200;

      performanceMonitor.recordOperation('test_operation', duration);

      const metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(1);
      expect(metrics.queryExecutionTimes[0]).toBe(duration);
    });

    it('should handle multiple operations', () => {
      performanceMonitor.recordOperation('operation1', 100);
      performanceMonitor.recordOperation('operation2', 200);
      performanceMonitor.recordOperation('operation3', 300);

      const metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(3);
      expect(metrics.queryExecutionTimes.reduce((sum, time) => sum + time, 0)).toBe(600);
    });

    it('should handle zero duration operations', () => {
      performanceMonitor.recordOperation('instant_operation', 0);

      expect(mockLogger.debug).toHaveBeenCalledWith('Operation recorded', {
        operation: 'instant_operation',
        duration: 0
      });

      const metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(1);
      expect(metrics.queryExecutionTimes[0]).toBe(0);
    });

    it('should handle negative duration operations', () => {
      performanceMonitor.recordOperation('negative_operation', -100);

      expect(mockLogger.debug).toHaveBeenCalledWith('Operation recorded', {
        operation: 'negative_operation',
        duration: -100
      });

      const metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(1);
      expect(metrics.queryExecutionTimes[0]).toBe(-100);
    });
  });

  describe('integration with existing methods', () => {
    it('should work alongside recordQueryExecution', () => {
      performanceMonitor.recordQueryExecution(150);
      performanceMonitor.recordOperation('test_operation', 250);

      const metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(2);
      expect(metrics.queryExecutionTimes.reduce((sum, time) => sum + time, 0)).toBe(400);
    });

    it('should maintain metrics consistency', () => {
      // Use recordOperation
      performanceMonitor.recordOperation('op1', 100);
      performanceMonitor.recordOperation('op2', 200);

      // Use recordQueryExecution
      performanceMonitor.recordQueryExecution(150);

      const detailedMetrics = performanceMonitor.getDetailedMetrics();
      expect(detailedMetrics.queryExecutionTimes.length).toBe(3);
      expect(detailedMetrics.queryExecutionTimes.reduce((sum, time) => sum + time, 0)).toBe(450);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.averageQueryTime).toBe(150);
    });
  });

  describe('resetMetrics', () => {
    it('should reset operation metrics', () => {
      performanceMonitor.recordOperation('test_operation', 100);
      performanceMonitor.recordOperation('another_operation', 200);

      let metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(2);

      performanceMonitor.resetMetrics();

      metrics = performanceMonitor.getDetailedMetrics();
      expect(metrics.queryExecutionTimes.length).toBe(0);
      expect(metrics.queryExecutionTimes.reduce((sum, time) => sum + time, 0)).toBe(0);
    });
  });

  describe('configuration integration', () => {
    it('should use custom threshold from config', () => {
      mockConfigService.getConfig.mockReturnValue({
        common: {
          enableCache: true,
          enableMonitoring: true,
          enableBatching: true,
          logLevel: 'debug',
          enableHealthChecks: true,
          healthCheckInterval: 30000,
          gracefulShutdownTimeout: 5000,
        },
        qdrant: {
          cache: {
            defaultTTL: 300000,
            maxEntries: 1000,
            cleanupInterval: 60000,
            enableStats: true,
            databaseSpecific: {},
          },
          performance: {
            monitoringInterval: 30000,
            metricsRetentionPeriod: 86400000,
            enableDetailedLogging: true,
            performanceThresholds: {
              queryExecutionTime: 1000,
              memoryUsage: 80,
              responseTime: 2000,
            },
            databaseSpecific: {},
          },
          batch: {
            maxConcurrentOperations: 10,
            defaultBatchSize: 100,
            maxBatchSize: 1000,
            minBatchSize: 10,
            memoryThreshold: 80,
            processingTimeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            adaptiveBatchingEnabled: true,
            performanceThreshold: 1000,
            adjustmentFactor: 0.1,
            databaseSpecific: {},
          },
        },
        nebula: {
          cache: {
            defaultTTL: 300000,
            maxEntries: 1000,
            cleanupInterval: 60000,
            enableStats: true,
            databaseSpecific: {},
          },
          performance: {
            monitoringInterval: 30000,
            metricsRetentionPeriod: 86400000,
            enableDetailedLogging: true,
            performanceThresholds: {
              queryExecutionTime: 5000,
              memoryUsage: 80,
              responseTime: 2000,
            },
            databaseSpecific: {},
          },
          batch: {
            maxConcurrentOperations: 10,
            defaultBatchSize: 100,
            maxBatchSize: 1000,
            minBatchSize: 10,
            memoryThreshold: 80,
            processingTimeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            adaptiveBatchingEnabled: true,
            performanceThreshold: 1000,
            adjustmentFactor: 0.1,
            databaseSpecific: {},
          },
          graph: {
            defaultSpace: 'test_space',
          },
        },
      });

      const customMonitor = new PerformanceMonitor(mockLogger, mockConfigService);
      customMonitor.recordOperation('slow_operation', 1500);

      expect(mockLogger.warn).toHaveBeenCalledWith('Operation exceeded threshold', {
        operation: 'slow_operation',
        duration: 1500,
        threshold: 1000
      });
    });
  });

  describe('operation statistics', () => {
    it('should get operation stats for recorded operations', () => {
      performanceMonitor.recordOperation('test_operation', 100);
      performanceMonitor.recordOperation('test_operation', 200);
      performanceMonitor.recordOperation('test_operation', 300);

      const stats = performanceMonitor.getOperationStats('test_operation');
      
      expect(stats).not.toBeNull();
      expect(stats!.operation).toBe('test_operation');
      expect(stats!.count).toBe(3);
      expect(stats!.averageDuration).toBe(200);
      expect(stats!.minDuration).toBe(100);
      expect(stats!.maxDuration).toBe(300);
      expect(stats!.totalDuration).toBe(600);
      expect(stats!.lastExecutionTime).toBeInstanceOf(Date);
    });

    it('should return null for non-existent operation', () => {
      const stats = performanceMonitor.getOperationStats('non_existent_operation');
      expect(stats).toBeNull();
    });

    it('should get all operation stats', () => {
      performanceMonitor.recordOperation('operation1', 100);
      performanceMonitor.recordOperation('operation1', 200);
      performanceMonitor.recordOperation('operation2', 300);

      const allStats = performanceMonitor.getAllOperationStats();
      
      expect(allStats).toHaveLength(2);
      
      const op1Stats = allStats.find((s: any) => s.operation === 'operation1');
      const op2Stats = allStats.find((s: any) => s.operation === 'operation2');
      
      expect(op1Stats).toBeDefined();
      expect(op1Stats!.count).toBe(2);
      expect(op1Stats!.averageDuration).toBe(150);
      
      expect(op2Stats).toBeDefined();
      expect(op2Stats!.count).toBe(1);
      expect(op2Stats!.averageDuration).toBe(300);
    });

    it('should reset specific operation stats', () => {
      performanceMonitor.recordOperation('operation1', 100);
      performanceMonitor.recordOperation('operation2', 200);

      let stats = performanceMonitor.getOperationStats('operation1');
      expect(stats).not.toBeNull();

      performanceMonitor.resetOperationStats('operation1');
      
      stats = performanceMonitor.getOperationStats('operation1');
      expect(stats).toBeNull();
      
      const op2Stats = performanceMonitor.getOperationStats('operation2');
      expect(op2Stats).not.toBeNull();
    });

    it('should reset all operation stats', () => {
      performanceMonitor.recordOperation('operation1', 100);
      performanceMonitor.recordOperation('operation2', 200);

      let allStats = performanceMonitor.getAllOperationStats();
      expect(allStats).toHaveLength(2);

      performanceMonitor.resetAllOperationStats();
      
      allStats = performanceMonitor.getAllOperationStats();
      expect(allStats).toHaveLength(0);
    });

    it('should handle single operation correctly', () => {
      performanceMonitor.recordOperation('single_operation', 150);

      const stats = performanceMonitor.getOperationStats('single_operation');
      
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.averageDuration).toBe(150);
      expect(stats!.minDuration).toBe(150);
      expect(stats!.maxDuration).toBe(150);
      expect(stats!.totalDuration).toBe(150);
    });

    it('should handle zero duration operations in stats', () => {
      performanceMonitor.recordOperation('zero_operation', 0);

      const stats = performanceMonitor.getOperationStats('zero_operation');
      
      expect(stats).not.toBeNull();
      expect(stats!.minDuration).toBe(0);
      expect(stats!.maxDuration).toBe(0);
      expect(stats!.averageDuration).toBe(0);
    });

    it('should clear operation stats when resetMetrics is called', () => {
      performanceMonitor.recordOperation('operation1', 100);
      performanceMonitor.recordOperation('operation2', 200);

      let allStats = performanceMonitor.getAllOperationStats();
      expect(allStats).toHaveLength(2);

      performanceMonitor.resetMetrics();
      
      allStats = performanceMonitor.getAllOperationStats();
      expect(allStats).toHaveLength(0);
    });
  });
});