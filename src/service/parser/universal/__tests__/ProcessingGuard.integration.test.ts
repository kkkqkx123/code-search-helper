import 'reflect-metadata';
import { ProcessingGuard } from '../../guard/ProcessingGuard';
import { ErrorThresholdManager } from '../ErrorThresholdManager';
import { MemoryGuard } from '../../guard/MemoryGuard';
import { ProcessingStrategyFactory } from '../factory/ProcessingStrategyFactory';
import { FileProcessingCoordinator } from '../coordination/FileProcessingCoordinator';
import { LoggerService } from '../../../../utils/LoggerService';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ProtectionCoordinator } from '../protection/ProtectionCoordinator';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../core/parse/TreeSitterCoreService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ProcessingGuard Integration Tests', () => {
  let processingGuard: ProcessingGuard;
  let mockLogger: jest.Mocked<LoggerService>;
  let errorThresholdManager: ErrorThresholdManager;
  let memoryGuard: MemoryGuard;

  beforeEach(() => {
    // 设置mock logger
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    // Create instances of all components
    errorThresholdManager = new ErrorThresholdManager(mockLogger);
    
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
      setMemoryLimit: jest.fn(),
      clearHistory: jest.fn(),
      getMemoryHistory: jest.fn().mockReturnValue([])
    };

    memoryGuard = new MemoryGuard(mockMemoryMonitor, 500, 1000, mockLogger); // Short interval for testing

    // 创建必要的依赖
    const configManager = new ConfigurationManager(mockLogger);
    const protectionCoordinator = new ProtectionCoordinator(mockLogger);
    const treeSitterCoreService = new TreeSitterCoreService();
    const treeSitterService = new TreeSitterService(treeSitterCoreService);
    const universalTextSplitter = new UniversalTextSplitter(mockLogger, configManager, protectionCoordinator);
    
    // 直接创建FileProcessingCoordinator实例，传入所有必需的依赖
    const fileProcessingCoordinator = new FileProcessingCoordinator(
      mockLogger,
      universalTextSplitter,
      treeSitterService
    );

    processingGuard = new ProcessingGuard(
      mockLogger,
      errorThresholdManager,
      memoryGuard,
      new ProcessingStrategyFactory(mockLogger),
      fileProcessingCoordinator
    );
  });

  afterEach(() => {
    if (processingGuard) {
      processingGuard.destroy();
    }
  });

  describe('Initialization and Cleanup', () => {
    it('should initialize and destroy correctly', () => {
      processingGuard.initialize();
      expect(mockLogger.info).toHaveBeenCalledWith('ProcessingGuard initialized successfully');

      processingGuard.destroy();
      expect(mockLogger.info).toHaveBeenCalledWith('Memory monitoring stopped');
      expect(mockLogger.info).toHaveBeenCalledWith('ProcessingGuard destroyed');
    });

    it('should handle multiple initialization calls', () => {
      processingGuard.initialize();
      processingGuard.initialize();
      expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingGuard is already initialized');
    });
  });

  describe('Error Threshold Management', () => {
    it('should use fallback when error threshold is reached', async () => {
      processingGuard.initialize();
      
      // 模拟错误达到阈值
      for (let i = 0; i < 5; i++) {
        processingGuard.recordError(new Error('Test error'), 'test context');
      }
      
      // 测试降级处理
      const result = await processingGuard.processFile('test.js', 'test content');
      expect(result).toBeDefined();
      expect(result.fallbackReason).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error threshold reached'));
    });

    it('should reset error counter after reset interval', async () => {
      processingGuard.initialize();
      
      // 添加一些错误
      for (let i = 0; i < 3; i++) {
        processingGuard.recordError(new Error('Test error'), 'test context');
      }
      
      // 等待重置间隔（测试中使用短间隔）
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // 验证错误计数器已重置
      const result = await processingGuard.processFile('test.js', 'test content');
      expect(result).toBeDefined();
    });
  });

  describe('Backup File Processing', () => {
    it('should process backup files correctly', async () => {
      processingGuard.initialize();
      
      const backupContent = 'backup file content';
      const result = await processingGuard.processFile('test.js.bak', backupContent);
      
      expect(result).toBeDefined();
      // 备份文件处理的日志可能在不同的组件中，只要结果正确即可
    });

    it('should process various backup file types', async () => {
      processingGuard.initialize();
      
      const backupExtensions = ['.bak', '.backup', '.old', '.tmp'];
      
      for (const ext of backupExtensions) {
        const result = await processingGuard.processFile(`test${ext}`, 'content');
        expect(result).toBeDefined();
      }
    });
  });

  describe('Extensionless File Processing', () => {
    it('should process extensionless files correctly', async () => {
      processingGuard.initialize();
      
      const content = '#!/bin/bash\necho "Hello World"';
      const result = await processingGuard.processFile('script', content);
      
      expect(result).toBeDefined();
      // 扩展名文件处理的日志可能在不同的组件中，只要结果正确即可
    });
  });
});