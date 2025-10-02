import { Container } from 'inversify';
import { TYPES } from '../../types';
import { ErrorHandlerService } from '../ErrorHandlerService';
import { LoggerService } from '../LoggerService';
import { ErrorReport } from '../ErrorHandlerService';

describe('ErrorHandlerService', () => {
  let container: Container;
  let errorHandlerService: ErrorHandlerService;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    container = new Container();
    
    // 创建模拟的LoggerService
    mockLoggerService = {
      error: jest.fn().mockResolvedValue(undefined),
      info: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      getLogFilePath: jest.fn().mockReturnValue('./logs/app.log'),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn().mockResolvedValue(undefined)
    } as any;
    
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService);
    
    errorHandlerService = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
  });

  test('should be able to instantiate ErrorHandlerService via DI container', () => {
    expect(errorHandlerService).toBeDefined();
    expect(errorHandlerService).toBeInstanceOf(ErrorHandlerService);
  });

  test('should handle error and create error report', () => {
    const error = new Error('Test error message');
    const context = {
      component: 'TestComponent',
      operation: 'testOperation',
      additionalInfo: 'some value'
    };

    const report = errorHandlerService.handleError(error, context);

    expect(report).toBeDefined();
    expect(report.id).toBeDefined();
    expect(report.timestamp).toBeInstanceOf(Date);
    expect(report.component).toBe('TestComponent');
    expect(report.operation).toBe('testOperation');
    expect(report.message).toBe('Test error message');
    expect(report.stack).toBe(error.stack);
    expect(report.context).toEqual({
      additionalInfo: 'some value',
      component: undefined,
      operation: undefined
    });
  });

  test('should call logger.error when handling error', () => {
    const error = new Error('Test error message');
    const context = {
      component: 'TestComponent',
      operation: 'testOperation'
    };

    errorHandlerService.handleError(error, context);

    expect(mockLoggerService.error).toHaveBeenCalledWith(
      'Error in TestComponent.testOperation: Test error message',
      expect.objectContaining({
        errorId: expect.any(String),
        timestamp: expect.any(String),
        stack: error.stack,
        context: expect.objectContaining({
          component: undefined,
          operation: undefined
        })
      })
    );
  });

  test('should store error report and retrieve it by ID', () => {
    const error = new Error('Test error message');
    const context = {
      component: 'TestComponent',
      operation: 'testOperation'
    };

    const report = errorHandlerService.handleError(error, context);
    const retrievedReport = errorHandlerService.getErrorReport(report.id);

    expect(retrievedReport).toEqual(report);
  });

  test('should return null when getting non-existent error report', () => {
    const retrievedReport = errorHandlerService.getErrorReport('non-existent-id');
    expect(retrievedReport).toBeNull();
  });

  test('should get all error reports', () => {
    const error1 = new Error('Test error message 1');
    const context1 = {
      component: 'TestComponent',
      operation: 'testOperation1'
    };

    const error2 = new Error('Test error message 2');
    const context2 = {
      component: 'TestComponent',
      operation: 'testOperation2'
    };

    const report1 = errorHandlerService.handleError(error1, context1);
    const report2 = errorHandlerService.handleError(error2, context2);

    const allReports = errorHandlerService.getAllErrorReports();

    expect(allReports).toHaveLength(2);
    expect(allReports).toContainEqual(report1);
    expect(allReports).toContainEqual(report2);
  });

  test('should clear error report by ID', () => {
    const error = new Error('Test error message');
    const context = {
      component: 'TestComponent',
      operation: 'testOperation'
    };

    const report = errorHandlerService.handleError(error, context);
    const result = errorHandlerService.clearErrorReport(report.id);

    expect(result).toBe(true);
    expect(errorHandlerService.getErrorReport(report.id)).toBeNull();
  });

  test('should return false when clearing non-existent error report', () => {
    const result = errorHandlerService.clearErrorReport('non-existent-id');
    expect(result).toBe(false);
  });

  test('should clear all error reports', () => {
    const error1 = new Error('Test error message 1');
    const context1 = {
      component: 'TestComponent',
      operation: 'testOperation1'
    };

    const error2 = new Error('Test error message 2');
    const context2 = {
      component: 'TestComponent',
      operation: 'testOperation2'
    };

    errorHandlerService.handleError(error1, context1);
    errorHandlerService.handleError(error2, context2);

    errorHandlerService.clearAllErrorReports();

    expect(errorHandlerService.getAllErrorReports()).toHaveLength(0);
  });

  test('should get error statistics', () => {
    const error1 = new Error('Test error message 1');
    const context1 = {
      component: 'TestComponent',
      operation: 'testOperation1'
    };

    const error2 = new Error('Test error message 2');
    const context2 = {
      component: 'TestComponent',
      operation: 'testOperation2'
    };

    const error3 = new Error('Test error message 3');
    const context3 = {
      component: 'AnotherComponent',
      operation: 'testOperation1'
    };

    errorHandlerService.handleError(error1, context1);
    errorHandlerService.handleError(error2, context2);
    errorHandlerService.handleError(error3, context3);

    const stats = errorHandlerService.getErrorStats();

    expect(stats.total).toBe(3);
    expect(stats.byComponent).toEqual({
      'TestComponent': 2,
      'AnotherComponent': 1
    });
    expect(stats.byOperation).toEqual({
      'testOperation1': 2,
      'testOperation2': 1
    });
  });

  test('should generate unique error IDs', () => {
    const error1 = new Error('Test error message 1');
    const context1 = {
      component: 'TestComponent',
      operation: 'testOperation1'
    };

    const error2 = new Error('Test error message 2');
    const context2 = {
      component: 'TestComponent',
      operation: 'testOperation2'
    };

    const report1 = errorHandlerService.handleError(error1, context1);
    const report2 = errorHandlerService.handleError(error2, context2);

    expect(report1.id).not.toBe(report2.id);
  });

  test('should handle error with undefined stack', () => {
    const error = new Error('Test error message');
    error.stack = undefined;
    
    const context = {
      component: 'TestComponent',
      operation: 'testOperation'
    };

    const report = errorHandlerService.handleError(error, context);

    expect(report.stack).toBeUndefined();
  });

  test('should handle logger error gracefully', async () => {
    // 模拟logger.error抛出错误
    mockLoggerService.error.mockRejectedValue(new Error('Logger failed'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new Error('Test error message');
    const context = {
      component: 'TestComponent',
      operation: 'testOperation'
    };

    // 应该不会抛出错误
    expect(() => {
      errorHandlerService.handleError(error, context);
    }).not.toThrow();
    
    // 等待异步操作完成
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // 应该在控制台记录错误
    expect(consoleSpy).toHaveBeenCalledWith('Failed to log error:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});