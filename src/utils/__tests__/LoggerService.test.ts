import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../LoggerService';
import { ConfigService } from '../../config/ConfigService';

describe('LoggerService', () => {
  let container: Container;
  let loggerService: LoggerService;
  let configService: ConfigService;

  beforeEach(() => {
    container = new Container();
    configService = ConfigService.getInstance();
    container.bind<ConfigService>(TYPES.ConfigService).toConstantValue(configService);
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    
    loggerService = container.get<LoggerService>(TYPES.LoggerService);
  });

  afterEach(async () => {
    // 确保清理日志资源
    await loggerService.markAsNormalExit();
  });

  test('should be able to instantiate LoggerService via DI container', () => {
    expect(loggerService).toBeDefined();
    expect(loggerService).toBeInstanceOf(LoggerService);
  });

 test('should have log methods available', () => {
    expect(loggerService.info).toBeDefined();
    expect(loggerService.error).toBeDefined();
    expect(loggerService.warn).toBeDefined();
    expect(loggerService.debug).toBeDefined();
  });

  test('should be able to call info method without throwing', async () => {
    expect(async () => {
      await loggerService.info('Test info message');
    }).not.toThrow();
  });

  test('should be able to call error method without throwing', async () => {
    expect(async () => {
      await loggerService.error('Test error message');
    }).not.toThrow();
  });

 test('should be able to call warn method without throwing', async () => {
    expect(async () => {
      await loggerService.warn('Test warn message');
    }).not.toThrow();
  });

  test('should be able to call debug method without throwing', async () => {
    expect(async () => {
      await loggerService.debug('Test debug message');
    }).not.toThrow();
  });

  test('should be able to call getLogFilePath method without throwing', () => {
    expect(() => {
      const logFilePath = loggerService.getLogFilePath();
      expect(logFilePath).toBeDefined();
      expect(typeof logFilePath).toBe('string');
    }).not.toThrow();
  });

  test('should be able to call markAsNormalExit method without throwing', async () => {
    expect(async () => {
      await loggerService.markAsNormalExit();
    }).not.toThrow();
  });
});