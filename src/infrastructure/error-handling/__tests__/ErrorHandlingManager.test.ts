import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlingManager, ErrorType, ErrorHandlingConfig } from '../ErrorHandlingManager';

describe('ErrorHandlingManager', () => {
  let errorHandlingManager: ErrorHandlingManager;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    
    errorHandlingManager = new ErrorHandlingManager(mockLogger);
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig: Partial<ErrorHandlingConfig> = {
        maxRetries: 5,
        enableFallback: false,
        retryDelay: 2000,
        circuitBreakerThreshold: 10,
        circuitBreakerTimeout: 120000
      };
      
      errorHandlingManager.updateConfig(newConfig);
      
      // 验证配置已更新（通过内部状态检查）
      expect(mockLogger.debug).toHaveBeenCalledWith('Error handling config updated', newConfig);
    });
 });

  describe('error recording', () => {
    it('should record errors', () => {
      const error = new Error('Test error');
      const context = { operation: 'test_operation' };
      
      errorHandlingManager.recordError(ErrorType.PARSE_ERROR, error, context);
      
      const stats = errorHandlingManager.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorTypes[ErrorType.PARSE_ERROR]).toBe(1);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit breaker after threshold exceeded', () => {
      const error = new Error('Test error');
      const context = { operation: 'test_operation' };
      
      // 触发超过阈值的错误
      for (let i = 0; i < 6; i++) {
        errorHandlingManager.recordError(ErrorType.PARSE_ERROR, error, context);
      }
      
      // 验证熔断器是否开启
      const canExecute = errorHandlingManager.canExecute(ErrorType.PARSE_ERROR, context);
      expect(canExecute).toBe(false);
    });

    it('should allow execution when circuit breaker is closed', () => {
      const canExecute = errorHandlingManager.canExecute(ErrorType.PARSE_ERROR);
      expect(canExecute).toBe(true);
    });
  });

 describe('executeWithFallback', () => {
    it('should execute operation successfully without fallback', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success result');
      const mockFallback = jest.fn().mockResolvedValue('fallback result');
      
      const result = await errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      );
      
      expect(result).toBe('success result');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockFallback).not.toHaveBeenCalled();
    });

    it('should retry operation on failure', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First try failed'))
        .mockRejectedValueOnce(new Error('Second try failed'))
        .mockResolvedValue('Success on third try');
      const mockFallback = jest.fn().mockResolvedValue('fallback result');
      
      errorHandlingManager.updateConfig({ maxRetries: 3 });
      
      const result = await errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      );
      
      expect(result).toBe('Success on third try');
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(mockFallback).not.toHaveBeenCalled();
    });

    it('should use fallback when all retries fail', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Always fails'));
      const mockFallback = jest.fn().mockResolvedValue('fallback result');
      
      errorHandlingManager.updateConfig({ maxRetries: 2 });
      
      const result = await errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      );
      
      expect(result).toBe('fallback result');
      expect(mockOperation).toHaveBeenCalledTimes(3); // original + 2 retries
      expect(mockFallback).toHaveBeenCalledTimes(1);
    });

    it('should not use fallback when disabled', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Always fails'));
      const mockFallback = jest.fn().mockResolvedValue('fallback result');
      
      errorHandlingManager.updateConfig({ maxRetries: 0, enableFallback: false });
      
      await expect(errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      )).rejects.toThrow('Always fails');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockFallback).not.toHaveBeenCalled();
    });
 });

  describe('error statistics', () => {
    it('should return error statistics', () => {
      const stats = errorHandlingManager.getErrorStats();
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('errorTypes');
      expect(stats).toHaveProperty('circuitBreakerStates');
      expect(stats).toHaveProperty('totalRetries');
    });
  });

  describe('reset functions', () => {
    it('should reset error history', () => {
      const error = new Error('Test error');
      errorHandlingManager.recordError(ErrorType.PARSE_ERROR, error);
      
      const initialStats = errorHandlingManager.getErrorStats();
      expect(initialStats.totalErrors).toBe(1);
      
      errorHandlingManager.resetErrorHistory();
      
      const afterResetStats = errorHandlingManager.getErrorStats();
      expect(afterResetStats.totalErrors).toBe(0);
    });

    it('should reset circuit breakers', () => {
      // 设置一个开启的熔断器
      const error = new Error('Test error');
      const context = { operation: 'test_operation' };
      
      for (let i = 0; i < 6; i++) {
        errorHandlingManager.recordError(ErrorType.PARSE_ERROR, error, context);
      }
      
      // 验证熔断器是开启的
      let canExecute = errorHandlingManager.canExecute(ErrorType.PARSE_ERROR, context);
      expect(canExecute).toBe(false);
      
      errorHandlingManager.resetCircuitBreakers();
      
      // 验证熔断器已重置
      canExecute = errorHandlingManager.canExecute(ErrorType.PARSE_ERROR, context);
      expect(canExecute).toBe(true);
    });
  });

  describe('circuit breaker states', () => {
    it('should return circuit breaker states', () => {
      const states = errorHandlingManager.getCircuitBreakerStates();
      expect(states).toEqual({});
    });
  });
});