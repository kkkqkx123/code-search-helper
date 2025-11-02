import { LoggerService } from '../../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../../utils/ErrorHandlerService';
import { FaultToleranceHandler } from '../../../../../utils/FaultToleranceHandler';
import { ErrorHandlingManager, ErrorType, ErrorHandlingConfig } from '../ErrorHandlingManager';

describe('ErrorHandlingManager', () => {
  let errorHandlingManager: ErrorHandlingManager;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockFaultToleranceHandler: jest.Mocked<FaultToleranceHandler>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockErrorHandler = {
      handleError: jest.fn(),
      handleDatabaseError: jest.fn(),
      handleInfrastructureError: jest.fn(),
      handleBatchOperationError: jest.fn(),
      executeWithErrorHandling: jest.fn(),
      executeInfrastructureOperation: jest.fn(),
    } as unknown as jest.Mocked<ErrorHandlerService>;

    mockFaultToleranceHandler = {
      executeWithFaultTolerance: jest.fn(),
      executeBatchWithFaultTolerance: jest.fn(),
      getCircuitBreakerState: jest.fn(),
      openCircuitBreaker: jest.fn(),
      resetCircuitBreaker: jest.fn(),
      getStats: jest.fn(),
    } as unknown as jest.Mocked<FaultToleranceHandler>;

    errorHandlingManager = new ErrorHandlingManager(
      mockLogger,
      mockErrorHandler,
      mockFaultToleranceHandler
    );
 });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig: Partial<ErrorHandlingConfig> = {
        maxRetries: 5,
        enableFallback: false,
        retryDelay: 200,
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

      // 验证错误被委托给基础设施错误处理器
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        { ...context, errorType: ErrorType.PARSE_ERROR, component: 'TreeSitterParser', operation: 'test_operation' }
      );
    });
  });

  describe('circuit breaker', () => {
    it('should check if execution is allowed', () => {
      const context = { operation: 'test_operation' };
      
      // 模拟熔断器关闭
      mockFaultToleranceHandler.getCircuitBreakerState.mockReturnValue({
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      });

      const canExecute = errorHandlingManager.canExecute(ErrorType.PARSE_ERROR, context);
      expect(canExecute).toBe(true);
      expect(mockFaultToleranceHandler.getCircuitBreakerState).toHaveBeenCalledWith('parse_error:test_operation');
    });

    it('should not allow execution when circuit breaker is open', () => {
      const context = { operation: 'test_operation' };
      
      // 模拟熔断器开启
      mockFaultToleranceHandler.getCircuitBreakerState.mockReturnValue({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        nextAttemptTime: Date.now() + 10000
      });

      const canExecute = errorHandlingManager.canExecute(ErrorType.PARSE_ERROR, context);
      expect(canExecute).toBe(false);
    });

    it('should report success and reset circuit breaker', () => {
      const context = { operation: 'test_operation' };

      errorHandlingManager.reportSuccess(ErrorType.PARSE_ERROR, context);

      expect(mockFaultToleranceHandler.resetCircuitBreaker).toHaveBeenCalledWith('parse_error:test_operation');
    });
 });

  describe('executeWithFallback', () => {
    it('should execute operation successfully without fallback', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success result');
      const mockFallback = jest.fn().mockResolvedValue('fallback result');

      // 模拟成功执行
      mockFaultToleranceHandler.executeWithFaultTolerance.mockResolvedValue({
        success: true,
        data: 'success result',
        retries: 0
      });

      const result = await errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      );

      expect(result).toBe('success result');
      expect(mockFaultToleranceHandler.executeWithFaultTolerance).toHaveBeenCalledWith(
        mockOperation,
        'test_operation',
        undefined
      );
      expect(mockFallback).not.toHaveBeenCalled();
    });

    it('should use fallback when operation fails', async () => {
      const mockOperation = jest.fn().mockResolvedValue(undefined);
      const mockFallback = jest.fn().mockResolvedValue('fallback result');

      // 模拟操作失败
      mockFaultToleranceHandler.executeWithFaultTolerance.mockResolvedValue({
        success: false,
        error: new Error('Operation failed'),
        retries: 3
      });

      const result = await errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      );

      expect(result).toBe('fallback result');
      expect(mockFallback).toHaveBeenCalledWith(new Error('Operation failed'));
    });

    it('should throw error when fallback is disabled', async () => {
      const mockOperation = jest.fn().mockResolvedValue(undefined);
      const mockFallback = jest.fn().mockResolvedValue('fallback result');

      // 禁用降级
      errorHandlingManager.updateConfig({ enableFallback: false });

      // 模拟操作失败
      mockFaultToleranceHandler.executeWithFaultTolerance.mockResolvedValue({
        success: false,
        error: new Error('Operation failed'),
        retries: 3
      });

      await expect(errorHandlingManager.executeWithFallback(
        'test_operation',
        mockOperation,
        mockFallback
      )).rejects.toThrow('Operation failed');
    });
  });

  describe('error statistics', () => {
    it('should return error statistics', () => {
      // 模拟统计信息
      mockFaultToleranceHandler.getStats.mockReturnValue({
        circuitBreakers: new Map([
          ['test_operation', {
            state: 'CLOSED',
            failureCount: 0,
            lastFailureTime: null,
            nextAttemptTime: null
          }]
        ]),
        totalOperations: 10,
        successfulOperations: 8,
        failedOperations: 2
      });

      const stats = errorHandlingManager.getErrorStats();
      
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('errorTypes');
      expect(stats).toHaveProperty('circuitBreakerStates');
      expect(stats).toHaveProperty('totalRetries');
      expect(stats.totalErrors).toBe(2);
      expect(stats.circuitBreakerStates).toHaveProperty('test_operation');
    });
  });

  describe('reset functions', () => {
    it('should reset error history', () => {
      errorHandlingManager.resetErrorHistory();
      expect(mockLogger.info).toHaveBeenCalledWith('Error history reset requested');
    });

    it('should reset circuit breakers', () => {
      errorHandlingManager.resetCircuitBreakers();
      expect(mockLogger.info).toHaveBeenCalledWith('All circuit breakers reset requested');
    });
 });

  describe('circuit breaker states', () => {
    it('should return circuit breaker states', () => {
      // 模拟熔断器状态
      mockFaultToleranceHandler.getStats.mockReturnValue({
        circuitBreakers: new Map([
          ['test_operation', {
            state: 'CLOSED',
            failureCount: 0,
            lastFailureTime: null,
            nextAttemptTime: null
          }]
        ]),
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0
      });

      const states = errorHandlingManager.getCircuitBreakerStates();
      expect(states).toHaveProperty('test_operation');
      expect(states.test_operation.state).toBe('closed');
    });
  });
});