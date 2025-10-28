import { PerformanceMonitoringCoordinator, PerformanceMetrics } from '../PerformanceMonitoringCoordinator';
import { LoggerService } from '../../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('PerformanceMonitoringCoordinator', () => {
  let performanceMonitor: PerformanceMonitoringCoordinator;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    performanceMonitor = new PerformanceMonitoringCoordinator(mockLogger);
  });

  describe('Constructor', () => {
    it('should initialize with default thresholds', () => {
      expect(performanceMonitor).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('PerformanceMonitoringCoordinator initialized');
    });

    it('should initialize without logger when not provided', () => {
      const monitor = new PerformanceMonitoringCoordinator();
      expect(monitor).toBeDefined();
    });
  });

  describe('recordOperation', () => {
    it('should record successful operation', () => {
      const metrics: PerformanceMetrics = {
        operation: 'testOperation',
        duration: 100,
        success: true,
        metadata: { test: 'data' }
      };

      performanceMonitor.recordOperation(metrics);

      const operationMetrics = performanceMonitor.getOperationMetrics('testOperation');
      expect(operationMetrics).toHaveLength(1);
      expect(operationMetrics[0]).toEqual(expect.objectContaining({
        operation: 'testOperation',
        duration: 100,
        success: true,
        metadata: expect.objectContaining({ test: 'data', timestamp: expect.any(Number) })
      }));
    });

    it('should record failed operation', () => {
      const metrics: PerformanceMetrics = {
        operation: 'testOperation',
        duration: 200,
        success: false,
        error: 'Test error'
      };

      performanceMonitor.recordOperation(metrics);

      const operationMetrics = performanceMonitor.getOperationMetrics('testOperation');
      expect(operationMetrics[0].success).toBe(false);
      expect(operationMetrics[0].error).toBe('Test error');
    });

    it('should log performance warnings when threshold exceeded', () => {
      performanceMonitor.setThreshold('testOperation', 50);

      const metrics: PerformanceMetrics = {
        operation: 'testOperation',
        duration: 100,
        success: true
      };

      performanceMonitor.recordOperation(metrics);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded for testOperation: 100ms > 50ms',
        expect.objectContaining({
          operation: 'testOperation',
          duration: 100,
          threshold: 50
        })
      );
    });

    it('should not record when monitoring is disabled', () => {
      performanceMonitor.setEnabled(false);

      const metrics: PerformanceMetrics = {
        operation: 'testOperation',
        duration: 100,
        success: true
      };

      performanceMonitor.recordOperation(metrics);

      const operationMetrics = performanceMonitor.getOperationMetrics('testOperation');
      expect(operationMetrics).toHaveLength(0);
    });
  });

  describe('monitorAsyncOperation', () => {
    it('should monitor successful async operation', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await performanceMonitor.monitorAsyncOperation(
        'asyncTest',
        operation,
        { test: 'metadata' }
      );

      expect(result).toBe('result');

      const metrics = performanceMonitor.getOperationMetrics('asyncTest');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should monitor failed async operation', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async error');
      };

      await expect(
        performanceMonitor.monitorAsyncOperation('asyncTest', operation)
      ).rejects.toThrow('Async error');

      const metrics = performanceMonitor.getOperationMetrics('asyncTest');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(false);
      expect(metrics[0].error).toBe('Async error');
    });

    it('should handle operation with custom metadata', async () => {
      const operation = async () => 'result';

      await performanceMonitor.monitorAsyncOperation(
        'asyncTest',
        operation,
        { custom: 'data' }
      );

      const metrics = performanceMonitor.getOperationMetrics('asyncTest');
      expect(metrics[0].metadata).toEqual(
        expect.objectContaining({ custom: 'data' })
      );
    });
  });

  describe('monitorSyncOperation', () => {
    it('should monitor successful sync operation', () => {
      const operation = () => 'result';

      const result = performanceMonitor.monitorSyncOperation(
        'syncTest',
        operation,
        { test: 'metadata' }
      );

      expect(result).toBe('result');

      const metrics = performanceMonitor.getOperationMetrics('syncTest');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should monitor failed sync operation', () => {
      const operation = () => {
        throw new Error('Sync error');
      };

      expect(() => 
        performanceMonitor.monitorSyncOperation('syncTest', operation)
      ).toThrow('Sync error');

      const metrics = performanceMonitor.getOperationMetrics('syncTest');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(false);
      expect(metrics[0].error).toBe('Sync error');
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      // Add some test data
      performanceMonitor.recordOperation({
        operation: 'processFile',
        duration: 100,
        success: true
      });
      performanceMonitor.recordOperation({
        operation: 'processFile',
        duration: 200,
        success: true
      });
      performanceMonitor.recordOperation({
        operation: 'processFile',
        duration: 300,
        success: false
      });
      performanceMonitor.recordOperation({
        operation: 'parseCode',
        duration: 50,
        success: true
      });
    });

    it('should generate correct summary statistics', () => {
      const report = performanceMonitor.generateReport();

      const processFileStats = report.summary.get('processFile');
      expect(processFileStats).toEqual({
        totalOperations: 3,
        averageDuration: 200, // (100 + 200 + 300) / 3
        minDuration: 100,
        maxDuration: 300,
        successRate: 2/3,
        thresholdExceedances: 0
      });

      const parseCodeStats = report.summary.get('parseCode');
      expect(parseCodeStats).toEqual({
        totalOperations: 1,
        averageDuration: 50,
        minDuration: 50,
        maxDuration: 50,
        successRate: 1,
        thresholdExceedances: 0
      });
    });

    it('should generate alerts for threshold exceedances', () => {
      performanceMonitor.setThreshold('processFile', 150);

      const report = performanceMonitor.generateReport();

      expect(report.alerts).toContainEqual(
        expect.objectContaining({
          operation: 'processFile',
          message: expect.stringContaining('exceeded threshold'),
          severity: 'warning'
        })
      );
    });

    it('should generate alerts for high error rates', () => {
      // Add more failed operations to trigger error rate alert
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordOperation({
          operation: 'errorProneOp',
          duration: 100,
          success: false
        });
      }
      performanceMonitor.recordOperation({
        operation: 'errorProneOp',
        duration: 100,
        success: true
      });

      const report = performanceMonitor.generateReport();

      expect(report.alerts).toContainEqual(
        expect.objectContaining({
          operation: 'errorProneOp',
          message: expect.stringContaining('high error rate'),
          severity: 'error'
        })
      );
    });

    it('should return recent metrics', () => {
      const report = performanceMonitor.generateReport();

      expect(report.recentMetrics.get('processFile')).toHaveLength(3);
      expect(report.recentMetrics.get('parseCode')).toHaveLength(1);
    });
  });

  describe('Threshold Management', () => {
    it('should set individual threshold', () => {
      performanceMonitor.setThreshold('customOperation', 500);
      
      // Verify threshold was set
      performanceMonitor.recordOperation({
        operation: 'customOperation',
        duration: 600,
        success: true
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded for customOperation: 600ms > 500ms',
        expect.any(Object)
      );
    });

    it('should set multiple thresholds', () => {
      const thresholds = {
        op1: 100,
        op2: 200,
        op3: 300
      };

      performanceMonitor.setThresholds(thresholds);

      performanceMonitor.recordOperation({ operation: 'op1', duration: 150, success: true });
      performanceMonitor.recordOperation({ operation: 'op2', duration: 250, success: true });

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Management', () => {
    it('should cleanup old metrics', () => {
      // Add many operations
      for (let i = 0; i < 1500; i++) {
        performanceMonitor.recordOperation({
          operation: 'testOp',
          duration: i,
          success: true
        });
      }

      performanceMonitor.cleanup(1000);

      const metrics = performanceMonitor.getOperationMetrics('testOp');
      expect(metrics).toHaveLength(1000);
      expect(metrics[0].duration).toBe(500); // Should keep the last 1000 entries
    });

    it('should reset all metrics', () => {
      performanceMonitor.recordOperation({
        operation: 'testOp',
        duration: 100,
        success: true
      });

      performanceMonitor.reset();

      const metrics = performanceMonitor.getOperationMetrics('testOp');
      expect(metrics).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Performance metrics reset');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when no recent alerts', async () => {
      const health = await performanceMonitor.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.enabled).toBe(true);
      expect(health.details.totalOperations).toBe(0);
      expect(health.details.totalMetrics).toBe(0);
      expect(health.details.recentAlerts).toBe(0);
    });

    it('should return degraded status with recent warnings', async () => {
      // Add operations that will trigger warnings
      performanceMonitor.setThreshold('testOp', 10);
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordOperation({
          operation: 'testOp',
          duration: 100,
          success: true
        });
      }

      const health = await performanceMonitor.healthCheck();

      expect(health.status).toBe('degraded');
    });

    it('should return unhealthy status with recent critical errors', async () => {
      // Add operations with high error rate
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordOperation({
          operation: 'errorOp',
          duration: 100,
          success: false
        });
      }

      const health = await performanceMonitor.healthCheck();

      expect(health.status).toBe('unhealthy');
    });

    it('should handle disabled monitoring', async () => {
      performanceMonitor.setEnabled(false);

      const health = await performanceMonitor.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.enabled).toBe(false);
    });
  });

  describe('Operation Management', () => {
    it('should get all operation names', () => {
      performanceMonitor.recordOperation({ operation: 'op1', duration: 100, success: true });
      performanceMonitor.recordOperation({ operation: 'op2', duration: 200, success: true });

      const operations = performanceMonitor.getOperations();
      expect(operations).toContain('op1');
      expect(operations).toContain('op2');
    });

    it('should return empty array for unknown operation', () => {
      const metrics = performanceMonitor.getOperationMetrics('unknownOp');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex monitoring scenarios', async () => {
      // Monitor multiple async operations
      const results = await Promise.all([
        performanceMonitor.monitorAsyncOperation('batchOp', async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'result1';
        }),
        performanceMonitor.monitorAsyncOperation('batchOp', async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return 'result2';
        })
      ]);

      expect(results).toEqual(['result1', 'result2']);

      // Monitor sync operations
      performanceMonitor.monitorSyncOperation('syncOp', () => 'syncResult');

      // Generate report
      const report = performanceMonitor.generateReport();

      expect(report.summary.get('batchOp')?.totalOperations).toBe(2);
      expect(report.summary.get('syncOp')?.totalOperations).toBe(1);
    });

    it('should maintain data consistency under load', async () => {
      const operations = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        operations.push(
          performanceMonitor.monitorAsyncOperation(`op${i % 10}`, async () => {
            await new Promise(resolve => setTimeout(resolve, 1));
            return `result${i}`;
          })
        );
      }

      await Promise.all(operations);

      const report = performanceMonitor.generateReport();
      expect(report.summary.size).toBe(10); // 10 unique operations
      
      // Each operation should have 10 entries
      for (let i = 0; i < 10; i++) {
        expect(report.summary.get(`op${i}`)?.totalOperations).toBe(10);
      }
    });
  });
});