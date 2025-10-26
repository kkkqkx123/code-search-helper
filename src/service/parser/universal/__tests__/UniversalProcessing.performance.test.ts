import { Container } from 'inversify';
import { TYPES } from '../../../../types/index';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { ProcessingGuard } from '../../guard/ProcessingGuard';
import { ErrorThresholdManager } from '../ErrorThresholdManager';
import { MemoryGuard } from '../../guard/MemoryGuard';
import { ProcessingStrategyFactory } from '../strategies/ProcessingStrategyFactory';
import { FileProcessingCoordinator } from '../coordination/FileProcessingCoordinator';
import { LoggerService } from '../../../../utils/LoggerService';
import { SegmentationContextManager } from '../context/SegmentationContextManager';
import { UniversalProcessingConfig } from '../UniversalProcessingConfig';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../core/parse/TreeSitterCoreService';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ProtectionCoordinator } from '../protection/ProtectionCoordinator';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('Universal Processing Performance Tests', () => {
  let mockLogger: jest.Mocked<LoggerService>;
  let processingGuard: ProcessingGuard;
  let container: Container;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    // 创建容器并注册服务
    container = new Container();
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLogger);

    // 创建 IMemoryMonitorService 的模拟实现
    const mockMemoryMonitor: any = {
      getMemoryStatus: jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 500 * 1024 * 1024, // 500MB
        heapUsedPercent: 0.2,
        rss: 200 * 1024 * 1024, // 200MB
        external: 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'stable',
        averageUsage: 150 * 1024 * 1024, // 150MB
        timestamp: new Date()
      }),
      forceGarbageCollection: jest.fn(),
      triggerCleanup: jest.fn(),
      isWithinLimit: jest.fn().mockReturnValue(true),
      setMemoryLimit: jest.fn()
    };

    container.bind(TYPES.MemoryMonitorService).toConstantValue(mockMemoryMonitor);

    // 创建并绑定配置
    const config = new UniversalProcessingConfig();
    container.bind<UniversalProcessingConfig>(TYPES.UniversalProcessingConfig).toConstantValue(config);

    // 创建并绑定配置管理器
    const configManager = new ConfigurationManager(mockLogger);
    container.bind<ConfigurationManager>(TYPES.ConfigurationManager).toConstantValue(configManager);

    // 创建并绑定保护协调器
    const protectionCoordinator = new ProtectionCoordinator(mockLogger);
    container.bind<ProtectionCoordinator>(TYPES.ProtectionCoordinator).toConstantValue(protectionCoordinator);

    // 创建并绑定TreeSitterCoreService
    const treeSitterCoreService = new TreeSitterCoreService();
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).toConstantValue(treeSitterCoreService);

    // 创建并绑定TreeSitterService
    const treeSitterService = new TreeSitterService(treeSitterCoreService);
    container.bind<TreeSitterService>(TYPES.TreeSitterService).toConstantValue(treeSitterService);

    // 创建并绑定上下文管理器
    const contextManager = new SegmentationContextManager(mockLogger, configManager);
    container.bind<SegmentationContextManager>(TYPES.SegmentationContextManager).toConstantValue(contextManager);

    // 创建并绑定UniversalTextSplitter
    const universalTextSplitter = new UniversalTextSplitter(mockLogger, configManager, protectionCoordinator);
    container.bind<UniversalTextSplitter>(TYPES.UniversalTextSplitter).toConstantValue(universalTextSplitter);

    // 创建并绑定FileProcessingCoordinator
    const fileProcessingCoordinator = new FileProcessingCoordinator(mockLogger, universalTextSplitter, treeSitterService);
    container.bind<FileProcessingCoordinator>(TYPES.FileProcessingCoordinator).toConstantValue(fileProcessingCoordinator);

    // 创建并绑定ProcessingStrategyFactory
    const processingStrategyFactory = new ProcessingStrategyFactory(mockLogger);
    container.bind<ProcessingStrategyFactory>(TYPES.ProcessingStrategyFactory).toConstantValue(processingStrategyFactory);

    // 创建其他依赖
    const errorThresholdManager = new ErrorThresholdManager(mockLogger);
    const memoryGuard = new MemoryGuard(mockMemoryMonitor, 1000, 10000, mockLogger);

    processingGuard = new ProcessingGuard(
      mockLogger,
      errorThresholdManager,
      memoryGuard,
      processingStrategyFactory,
      fileProcessingCoordinator
    );

    processingGuard.initialize();
  });

  afterEach(() => {
    processingGuard && processingGuard.destroy();
  });

  describe('Large File Processing Performance', () => {
    it('should process large JavaScript files within reasonable time', async () => {
      // Generate a large JavaScript file (approximately 100 lines for performance test)
      const largeJSCode = generateLargeJavaScriptFile(10);

      const startTime = performance.now();
      const result = await processingGuard.processFile('large.js', largeJSCode);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.language).toBe('javascript');

      console.log(`Large JS file processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });

    it('should process large TypeScript files within reasonable time', async () => {
      // Generate a large TypeScript file (approximately 100 lines for performance test)
      const largeTSCode = generateLargeTypeScriptFile(100);

      const startTime = performance.now();
      const result = await processingGuard.processFile('large.ts', largeTSCode);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.language).toBe('typescript');

      console.log(`Large TS file processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });

    it('should process large Python files within reasonable time', async () => {
      // Generate a large Python file (approximately 100 lines for performance test)
      const largePythonCode = generateLargePythonFile(10);

      const startTime = performance.now();
      const result = await processingGuard.processFile('large.py', largePythonCode);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.language).toBe('python');

      console.log(`Large Python file processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not exceed memory limits during processing', async () => {
      // Generate a medium-sized file that could cause memory issues
      const veryLargeCode = generateLargeJavaScriptFile(1000); // 1000 lines

      const initialMemory = process.memoryUsage();
      const result = await processingGuard.processFile('very-large.js', veryLargeCode);
      const finalMemory = process.memoryUsage();

      // Check that memory usage is reasonable
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      expect(memoryIncreaseMB).toBeLessThan(200); // Should not increase by more than 200MB
      expect(result.chunks.length).toBeGreaterThan(0);

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });
  });

  // Helper functions for generating test data
  function generateLargeJavaScriptFile(lines: number): string {
    const functions = [
      `function calculateTotal(items) {
    let total = 0;
    for (const item of items) {
      total += item.price * item.quantity;
    }
    return total;
  }`,
      `function filterActiveUsers(users) {
    return users.filter(user => user.isActive && user.lastLogin > new Date(Date.now() - 30 * 24 * 60 * 1000));
      }`,
      `function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
      }`
    ];

    let result = [];
    let lineCount = 0;

    while (lineCount < lines) {
      for (const func of functions) {
        if (lineCount >= lines) break;

        const funcLines = func.split('\n');
        for (const funcLine of funcLines) {
          if (lineCount >= lines) break;
          result.push(funcLine);
          lineCount++;
        }

        if (lineCount < lines) {
          result.push('');
          lineCount++;
        }
      }
    }

    return result.join('\n');
  }

  function generateLargeTypeScriptFile(lines: number): string {
    const interfaces = [
      `interface User {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    lastLogin: Date;
    roles: Role[];
  }`,
      `interface Product {
    id: string;
    name: string;
    price: number;
    category: Category;
    tags: string[];
    inStock: boolean;
  }`
    ];

    let result = [];
    let lineCount = 0;

    while (lineCount < lines) {
      for (const iface of interfaces) {
        if (lineCount >= lines) break;

        const ifaceLines = iface.split('\n');
        for (const ifaceLine of ifaceLines) {
          if (lineCount >= lines) break;
          result.push(ifaceLine);
          lineCount++;
        }

        if (lineCount < lines) {
          result.push('');
          lineCount++;
        }
      }
    }

    return result.join('\n');
  }

  function generateLargePythonFile(lines: number): string {
    const functions = [
      `def calculate_total(items):
    total = 0
    for item in items:
        total += item['price'] * item['quantity']
    return total`,
      `def filter_active_users(users):
    from datetime import datetime, timedelta
    threshold = datetime.now() - timedelta(days=30)
    return [user for user in users if user['is_active'] and user['last_login'] > threshold]`
    ];

    let result = [];
    let lineCount = 0;

    while (lineCount < lines) {
      for (const func of functions) {
        if (lineCount >= lines) break;

        const funcLines = func.split('\n');
        for (const funcLine of funcLines) {
          if (lineCount >= lines) break;
          result.push(funcLine);
          lineCount++;
        }

        if (lineCount < lines) {
          result.push('');
          lineCount++;
        }
      }
    }

    return result.join('\n');
  }
});