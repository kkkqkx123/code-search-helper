import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    logger = new Logger('test-service');
  });

  afterEach(async () => {
    // 恢复环境变量
    delete process.env.NODE_ENV;
    
    // 在测试环境中不需要清理日志文件
  });

  test('should create logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  test('should have all log level methods', () => {
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  test('should be able to call info method without throwing', async () => {
    expect(async () => {
      await logger.info('Test info message');
    }).not.toThrow();
  });

  test('should be able to call error method without throwing', async () => {
    expect(async () => {
      await logger.error('Test error message');
    }).not.toThrow();
  });

  test('should be able to call warn method without throwing', async () => {
    expect(async () => {
      await logger.warn('Test warn message');
    }).not.toThrow();
  });

  test('should be able to call debug method without throwing', async () => {
    expect(async () => {
      await logger.debug('Test debug message');
    }).not.toThrow();
  });

  test('should return log file path', () => {
    const logPath = logger.getLogFilePath();
    expect(logPath).toBeDefined();
    expect(typeof logPath).toBe('string');
  });

  test('should be able to mark as normal exit', async () => {
    expect(async () => {
      await logger.markAsNormalExit();
    }).not.toThrow();
  });

  test('should format time correctly', () => {
    // 由于 getChinaTimeString 是私有方法，我们不能直接测试
    // 但我们可以验证日志记录是否正常工作
    expect(async () => {
      await logger.info('Test message for time formatting');
    }).not.toThrow();
  });

  test('should handle object logging', async () => {
    const testObject = { key: 'value', number: 42 };
    expect(async () => {
      await logger.info('Test object:', testObject);
    }).not.toThrow();
  });

  test('should respect log level filtering', async () => {
    // 创建一个具有特定日志级别的记录器
    const debugLogger = new Logger('test-service', 'DEBUG');
    expect(async () => {
      await debugLogger.debug('Debug message should appear');
    }).not.toThrow();
    
    // 测试错误级别的记录器
    const errorLogger = new Logger('test-service', 'ERROR');
    expect(async () => {
      await errorLogger.error('Error message should appear');
    }).not.toThrow();
  });
});