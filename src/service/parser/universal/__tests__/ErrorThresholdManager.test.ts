import { ErrorThresholdManager } from '../ErrorThresholdManager';
import { LoggerService } from '../../../../utils/LoggerService';
import { CleanupManager } from '../../../../infrastructure/cleanup/CleanupManager';
import { TYPES } from '../../../../types';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock CleanupManager
jest.mock('../../../../infrastructure/cleanup/CleanupManager');
const MockCleanupManager = CleanupManager as jest.MockedClass<typeof CleanupManager>;

describe('ErrorThresholdManager', () => {
  let errorManager: ErrorThresholdManager;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCleanupManager: jest.Mocked<CleanupManager>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockCleanupManager = new MockCleanupManager() as jest.Mocked<CleanupManager>;
    mockCleanupManager.performCleanup = jest.fn().mockResolvedValue({
      success: true,
      memoryFreed: 1024 * 1024, // 1MB
      cleanedCaches: ['test-cache'],
      duration: 100
    });

    errorManager = new ErrorThresholdManager(
      mockLogger,
      mockCleanupManager,
      5, // maxErrors
      60000 // resetInterval
    );
  });

  describe('shouldUseFallback', () => {
    it('should return false when no errors have been recorded', () => {
      expect(errorManager.shouldUseFallback()).toBe(false);
    });

    it('should return false when error count is below threshold', () => {
      // Record 3 errors (threshold is 5)
      for (let i = 0; i < 3; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }
      expect(errorManager.shouldUseFallback()).toBe(false);
    });

    it('should return true when error count reaches threshold', () => {
      // Record 5 errors (threshold is 5)
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }
      expect(errorManager.shouldUseFallback()).toBe(true);
    });

    it('should return false after reset interval has passed', () => {
      // Record 5 errors (threshold is 5)
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }
      expect(errorManager.shouldUseFallback()).toBe(true);

      // Mock time passing beyond reset interval
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 70000); // 70 seconds later

      expect(errorManager.shouldUseFallback()).toBe(false);
    });
  });

  describe('recordError', () => {
    it('should increment error count and log warning', () => {
      const testError = new Error('Test error');
      errorManager.recordError(testError, 'test context');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Processing error #1: Test error',
        expect.objectContaining({
          context: 'test context',
          stack: testError.stack,
          errorCount: 1,
          maxErrors: 5
        })
      );
    });

    it('should trigger cleanup when threshold is reached', () => {
      // Record 5 errors to reach threshold
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error threshold reached (5/5), triggering cleanup'
      );
      expect(mockCleanupManager.performCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerReason: 'error_threshold_reached_5_5',
          errorStats: expect.objectContaining({
            count: 5,
            lastErrorTime: expect.any(Number),
            errorRate: expect.any(Number)
          }),
          timestamp: expect.any(Date)
        })
      );
    });

    it('should handle cleanup manager not being available', () => {
      // Create manager without cleanup manager
      const errorManagerNoCleanup = new ErrorThresholdManager(mockLogger, undefined, 5, 60000);

      // Record 5 errors to reach threshold
      for (let i = 0; i < 5; i++) {
        errorManagerNoCleanup.recordError(new Error(`Test error ${i}`));
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CleanupManager not available, cleanup skipped'
      );
    });

    it('should handle cleanup execution errors', () => {
      mockCleanupManager.performCleanup.mockRejectedValue(new Error('Cleanup failed'));

      // Record 5 errors to reach threshold
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cleanup execution failed: Error: Cleanup failed'
      );
    });
  });

  describe('resetCounter', () => {
    it('should reset error count to zero', () => {
      // Record some errors
      for (let i = 0; i < 3; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      errorManager.resetCounter();

      expect(mockLogger.info).toHaveBeenCalledWith('Resetting error counter from 3 to 0');
      expect(errorManager.shouldUseFallback()).toBe(false);
    });

    it('should not log when error count is already zero', () => {
      errorManager.resetCounter();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return current status information', () => {
      // Record 2 errors
      for (let i = 0; i < 2; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      const status = errorManager.getStatus();

      expect(status).toEqual({
        errorCount: 2,
        maxErrors: 5,
        lastErrorTime: expect.any(Number),
        shouldUseFallback: false,
        timeUntilReset: expect.any(Number)
      });
    });

    it('should calculate timeUntilReset correctly', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // Record an error
      errorManager.recordError(new Error('Test error'));

      const status = errorManager.getStatus();
      expect(status.timeUntilReset).toBeCloseTo(60000, -2); // Should be close to 60 seconds
    });
  });

  describe('setMaxErrors', () => {
    it('should update max errors threshold', () => {
      errorManager.setMaxErrors(10);
      expect(mockLogger.info).toHaveBeenCalledWith('Max errors set to 10');
    });

    it('should not update with invalid value', () => {
      errorManager.setMaxErrors(0);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('setResetInterval', () => {
    it('should update reset interval', () => {
      errorManager.setResetInterval(120000);
      expect(mockLogger.info).toHaveBeenCalledWith('Reset interval set to 120000ms');
    });

    it('should not update with invalid value', () => {
      errorManager.setResetInterval(0);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('getErrorRate', () => {
    it('should calculate error rate correctly', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // Record 3 errors
      for (let i = 0; i < 3; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      // Mock time passing 30 seconds (0.5 minutes)
      jest.spyOn(Date, 'now').mockReturnValue(now + 30000);

      const errorRate = errorManager.getErrorRate();
      expect(errorRate).toBe(6); // 3 errors / 0.5 minutes = 6 errors per minute
    });

    it('should handle zero time difference', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // Record an error
      errorManager.recordError(new Error('Test error'));

      // Mock no time passing
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const errorRate = errorManager.getErrorRate();
      expect(errorRate).toBe(0);
    });
  });

  describe('setCleanupManager', () => {
    it('should set cleanup manager', () => {
      const newCleanupManager = new MockCleanupManager() as jest.Mocked<CleanupManager>;
      errorManager.setCleanupManager(newCleanupManager);

      expect(mockLogger.info).toHaveBeenCalledWith('CleanupManager injected into ErrorThresholdManager');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      // This is a private method, but we can test its behavior through the cleanup process
      // by checking the logged message
      mockCleanupManager.performCleanup.mockResolvedValue({
        success: true,
        memoryFreed: 1024 * 1024 * 1024, // 1GB
        cleanedCaches: ['test-cache'],
        duration: 100
      });

      // Record 5 errors to trigger cleanup
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      // Check if the cleanup completion message includes formatted bytes
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('1.0GB')
      );
    });
  });

  describe('Integration Tests', () => {
    it('should work with custom configuration', () => {
      const customErrorManager = new ErrorThresholdManager(
        mockLogger,
        mockCleanupManager,
        3, // maxErrors
        30000 // resetInterval
      );

      // Record 3 errors to reach threshold
      for (let i = 0; i < 3; i++) {
        customErrorManager.recordError(new Error(`Test error ${i}`));
      }

      expect(customErrorManager.shouldUseFallback()).toBe(true);
    });

    it('should handle cleanup success and failure scenarios', async () => {
      // Test successful cleanup
      mockCleanupManager.performCleanup.mockResolvedValue({
        success: true,
        memoryFreed: 1024 * 1024,
        cleanedCaches: ['cache1', 'cache2'],
        duration: 150
      });

      // Record 5 errors to trigger cleanup
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup completed successfully')
      );

      // Test failed cleanup
      mockCleanupManager.performCleanup.mockResolvedValue({
        success: false,
        error: new Error('Cleanup failed'),
        memoryFreed: 0,
        cleanedCaches: [],
        duration: 50
      });

      // Reset and record errors again
      errorManager.resetCounter();
      for (let i = 0; i < 5; i++) {
        errorManager.recordError(new Error(`Test error ${i}`));
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cleanup failed: Cleanup failed'
      );
    });
  });
});