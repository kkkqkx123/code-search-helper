
import { ProcessingGuard } from '../ProcessingGuard';
import { ErrorThresholdManager } from '../ErrorThresholdManager';
import { MemoryGuard } from '../MemoryGuard';
import { BackupFileProcessor } from '../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ProcessingGuard Integration Tests', () => {
  let processingGuard: ProcessingGuard;
  let mockLogger: jest.Mocked<LoggerService>;
  let errorThresholdManager: ErrorThresholdManager;
  let memoryGuard: MemoryGuard;
  let backupFileProcessor: BackupFileProcessor;
  let extensionlessFileProcessor: ExtensionlessFileProcessor;
  let universalTextSplitter: UniversalTextSplitter;

  beforeEach(() => {
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
      setMemoryLimit: jest.fn()
    };
    
    memoryGuard = new MemoryGuard(mockMemoryMonitor, 500, 1000, mockLogger); // Short interval for testing
    backupFileProcessor = new BackupFileProcessor(mockLogger);
    extensionlessFileProcessor = new ExtensionlessFileProcessor(mockLogger);
    universalTextSplitter = new UniversalTextSplitter(mockLogger);

    processingGuard = new ProcessingGuard(
      mockLogger,
      errorThresholdManager,
      memoryGuard,
      backupFileProcessor,
      extensionlessFileProcessor,
      universalTextSplitter
    );
  });

  afterEach(() => {
    processingGuard.destroy();
  });

  describe('Initialization and Cleanup', () => {
    it('should initialize and destroy correctly', () => {
      processingGuard.initialize();
      expect(mockLogger.info).toHaveBeenCalledWith('ProcessingGuard initialized successfully');
      
      processingGuard.destroy();
      expect(mockLogger.info).toHaveBeenCalledWith('ProcessingGuard destroyed');
    });

    it('should handle multiple initialization calls', () => {
      processingGuard.initialize();
      processingGuard.initialize();
      expect(mockLogger.warn).toHaveBeenCalledWith('ProcessingGuard is already initialized');
    });
  });

  describe('Error Threshold Management', () => {
    beforeEach(() => {
      processingGuard.initialize();
    });

    it('should use fallback when error threshold is reached', async () => {
      // Record errors to reach threshold
      const maxErrors = 5;
      for (let i = 0; i < maxErrors; i++) {
        errorThresholdManager.recordError(new Error(`Test error ${i}`));
      }

      const result = await processingGuard.processFile('test.js', 'const x = 1;');
      
      expect(result.fallbackReason).toContain('Error threshold exceeded');
      expect(result.processingStrategy).toBe('fallback-line');
      expect(result.language).toBe('text');
    });

    it('should reset error counter after reset interval', async () => {
      // Record errors to reach threshold
      const maxErrors = 5;
      for (let i = 0; i < maxErrors; i++) {
        errorThresholdManager.recordError(new Error(`Test error ${i}`));
      }

      // Manually reset the counter for testing
      errorThresholdManager.resetCounter();

      const result = await processingGuard.processFile('test.js', 'const x = 1;');
      
      // Should not use fallback since counter was reset
      expect(result.fallbackReason).toBeUndefined();
    });
  });

  describe('Backup File Processing', () => {
    beforeEach(() => {
      processingGuard.initialize();
    });

    it('should process backup files correctly', async () => {
      const jsCode = `
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}
      `.trim();

      const result = await processingGuard.processFile('script.js.bak', jsCode);
      
      expect(result.language).toBe('javascript');
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should process various backup file types', async () => {
      const testCases = [
        { file: 'script.py.backup', content: 'print("Hello, World!")', expectedLang: 'python' },
        { file: 'config.json.old', content: '{"name": "test", "value": 123}', expectedLang: 'json' },
        { file: 'style.css.tmp', content: 'body { margin: 0; padding: 0; }', expectedLang: 'css' }
      ];

      for (const testCase of testCases) {
        const result = await processingGuard.processFile(testCase.file, testCase.content);
        expect(result.language).toBe(testCase.expectedLang);
      }
    });
  });

  describe('Extensionless File Processing', () => {
    beforeEach(() => {
      processingGuard.initialize();
    });

    it('should process extensionless files correctly', async () => {
      const jsCode = `
function calculateSum(a, b) {
  return a + b;
}
      `.trim();

      const result = await processingGuard.processFile('script', jsCode);
      
      expect(result.language).toBe('javascript');
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });
});