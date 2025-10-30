import { UnifiedProcessingCoordinator, ProcessingContext, ProcessingResult } from '../UnifiedProcessingCoordinator';
import { UnifiedStrategyManager } from '../../strategies/manager/UnifiedStrategyManager';
import { UnifiedDetectionService, DetectionResult } from '../../detection/UnifiedDetectionService';
import { UnifiedConfigManager } from '../../../config/UnifiedConfigManager';
import { UnifiedGuardCoordinator } from '../../../guard/UnifiedGuardCoordinator';
import { PerformanceMonitoringCoordinator } from '../PerformanceMonitoringCoordinator';
import { ConfigCoordinator } from '../ConfigCoordinator';
import { SegmentationStrategyCoordinator } from '../SegmentationStrategyCoordinator';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ISplitStrategy } from '../../interfaces/ISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../types/splitting-types';

// Mock dependencies
jest.mock('../../../../../utils/LoggerService');
jest.mock('../../strategies/manager/UnifiedStrategyManager');
jest.mock('../../detection/UnifiedDetectionService');
jest.mock('../../../config/UnifiedConfigManager');
jest.mock('../../../guard/UnifiedGuardCoordinator');
jest.mock('../PerformanceMonitoringCoordinator');
jest.mock('../ConfigCoordinator');
jest.mock('../SegmentationStrategyCoordinator');

const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;
const MockUnifiedStrategyManager = UnifiedStrategyManager as jest.MockedClass<typeof UnifiedStrategyManager>;
const MockUnifiedDetectionService = UnifiedDetectionService as jest.MockedClass<typeof UnifiedDetectionService>;
const MockUnifiedConfigManager = UnifiedConfigManager as jest.MockedClass<typeof UnifiedConfigManager>;
// 由于 UnifiedGuardCoordinator 是单例类，使用 jest.mock 创建 mock
// 这里保持原来的定义，但需要修复初始化顺序问题
const MockPerformanceMonitoringCoordinator = PerformanceMonitoringCoordinator as jest.MockedClass<typeof PerformanceMonitoringCoordinator>;
const MockConfigCoordinator = ConfigCoordinator as jest.MockedClass<typeof ConfigCoordinator>;
const MockSegmentationStrategyCoordinator = SegmentationStrategyCoordinator as jest.MockedClass<typeof SegmentationStrategyCoordinator>;

// Mock split strategy
class MockSplitStrategy implements ISplitStrategy {
  constructor(private name: string) { }

  getName(): string {
    return this.name;
  }

  supportsLanguage(language: string): boolean {
    return true;
  }

  async split(
   content: string,
   language: string,
   filePath?: string,
   options?: any,
   nodeTracker?: any,
   ast?: any
 ): Promise<CodeChunk[]> {
   const lines = content.split('\n');
   return lines.map((line, index) => ({
     id: `chunk_${index}`,
     content: line,
     metadata: {
       startLine: index + 1,
       endLine: index + 1,
       language,
       filePath,
       type: 'line'
     }
   }));
 }
}

describe('UnifiedProcessingCoordinator', () => {
  let coordinator: UnifiedProcessingCoordinator;
  let mockStrategyManager: jest.Mocked<UnifiedStrategyManager>;
  let mockDetectionService: jest.Mocked<UnifiedDetectionService>;
  let mockConfigManager: jest.Mocked<UnifiedConfigManager>;
  let mockGuardCoordinator: jest.Mocked<UnifiedGuardCoordinator>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitoringCoordinator>;
  let mockConfigCoordinator: jest.Mocked<ConfigCoordinator>;
  let mockSegmentationCoordinator: jest.Mocked<SegmentationStrategyCoordinator>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    // Initialize mocks
    mockStrategyManager = {} as any;
    mockDetectionService = {} as any;
    mockConfigManager = {} as any;
    mockGuardCoordinator = {} as any;
    mockPerformanceMonitor = {} as any;
    mockConfigCoordinator = {} as any;
    mockSegmentationCoordinator = {} as any;
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockDetectionService.detectFile = jest.fn().mockResolvedValue({
      language: 'javascript',
      detectionMethod: 'extension',
      confidence: 0.9,
      metadata: {
        fileFeatures: {
          isCodeFile: true,
          isTextFile: false,
          isMarkdownFile: false,
          isXMLFile: false,
          isStructuredFile: true,
          isHighlyStructured: false,
          complexity: 10,
          lineCount: 10,
          size: 100,
          hasImports: false,
          hasExports: false,
          hasFunctions: true,
          hasClasses: false
        },
        processingStrategy: 'semantic',
        astInfo: {}
      }
    });

    mockConfigManager.getMergedConfig = jest.fn().mockReturnValue({
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLines: 100,
      minChunkSize: 100,
      maxOverlapRatio: 0.3,
      optimizationLevel: 'medium',
      addOverlap: false
    });
mockConfigManager.getUniversalConfig = jest.fn().mockReturnValue({
  memory: { memoryLimitMB: 512, memoryCheckInterval: 5000 },
  error: { maxErrors: 5, errorResetInterval: 6000 },
  chunking: { maxChunkSize: 2000, chunkOverlap: 200, maxLinesPerChunk: 50 },
  backup: { backupFilePatterns: ['.bak'], backupFileConfidenceThreshold: 0.7 }
});

    mockStrategyManager.selectOptimalStrategy = jest.fn().mockReturnValue(new MockSplitStrategy('semantic'));
    mockStrategyManager.executeStrategy = jest.fn().mockResolvedValue({
      success: true,
      chunks: [{ id: 'chunk1', content: 'test', metadata: { startLine: 1, endLine: 1, language: 'javascript' } }],
      executionTime: 50,
      strategyName: 'semantic'
    });
    mockStrategyManager.getFallbackPath = jest.fn().mockReturnValue(['line']);
    mockStrategyManager.createFallbackStrategy = jest.fn().mockReturnValue(new MockSplitStrategy('line'));
    mockStrategyManager.getAvailableStrategies = jest.fn().mockReturnValue([
      {
        name: 'semantic',
        description: 'Semantic strategy',
        supportedLanguages: ['javascript', 'typescript'],
        priority: 1,
        supportsAST: true
      }
    ]);
    mockStrategyManager.clearPerformanceStats = jest.fn();

    mockGuardCoordinator.shouldUseFallback = jest.fn().mockReturnValue(false);
    mockGuardCoordinator.checkMemoryUsage = jest.fn().mockReturnValue({ isWithinLimit: true, usagePercent: 20, heapUsed: 100, heapTotal: 5000, external: 50, arrayBuffers: 10 });
    mockGuardCoordinator.setMemoryLimit = jest.fn();
    mockGuardCoordinator.recordError = jest.fn();
    mockGuardCoordinator.processFileWithDetection = jest.fn().mockResolvedValue({
      chunks: [{ id: 'fallback', content: 'fallback content', metadata: {} }],
      language: 'text',
      processingStrategy: 'fallback',
      success: true,
      duration: 10,
      metadata: { detectionMethod: 'fallback', confidence: 0.1 }
    });

    // 修复性能监控mock，确保duration大于0
    mockPerformanceMonitor.monitorAsyncOperation = jest.fn().mockImplementation(async (name, operation) => {
      const startTime = Date.now();
      const result = await operation();
      // 确保至少经过1ms，这样duration会大于0
      await new Promise(resolve => setTimeout(resolve, 1));
      const duration = Math.max(1, Date.now() - startTime);
      return result;
    });

    mockConfigCoordinator.onConfigUpdate = jest.fn().mockImplementation((callback) => {
      // Store callback for testing
      (mockConfigCoordinator as any).configCallback = callback;
    });

    mockSegmentationCoordinator.createSegmentationContext = jest.fn().mockReturnValue({
      content: '',
      filePath: undefined,
      language: 'javascript',
      options: {
        maxChunkSize: 2000,
        overlapSize: 200,
        maxLinesPerChunk: 100,
        enableBracketBalance: true,
        enableSemanticDetection: true,
        enableCodeOverlap: false,
        enableStandardization: true,
        standardizationFallback: true,
        maxOverlapRatio: 0.3,
        errorThreshold: 10,
        memoryLimitMB: 512,
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 100,
          maxChunkSize: 4000
        },
        protectionConfig: {
          enableProtection: true,
          protectionLevel: 'medium'
        }
      },
      metadata: {
        contentLength: 0,
        lineCount: 0,
        isSmallFile: true,
        isCodeFile: true,
        isMarkdownFile: false
      }
    });
    mockSegmentationCoordinator.selectStrategyWithHeuristics = jest.fn().mockReturnValue({
      getName: () => 'semantic',
      canHandle: () => true,
      segment: async () => [{ id: 'chunk1', content: 'test', metadata: { startLine: 1, endLine: 1, language: 'javascript' } }],
      getSupportedLanguages: () => ['javascript']
    });

    // Create coordinator
    coordinator = new UnifiedProcessingCoordinator(
      mockStrategyManager,
      mockDetectionService,
      mockConfigManager,
      mockGuardCoordinator as UnifiedGuardCoordinator,
      mockPerformanceMonitor,
      mockConfigCoordinator,
      mockSegmentationCoordinator,
      mockLogger
    );
  });

  describe('Constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(coordinator).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('UnifiedProcessingCoordinator initialized');
      expect(mockConfigCoordinator.onConfigUpdate).toHaveBeenCalled();
    });

    it('should handle config update events', () => {
      // Simulate config update
      const configCallback = (mockConfigCoordinator as any).configCallback;
      const configEvent = {
        type: 'config-updated',
        changes: ['memoryLimitMB'],
        timestamp: new Date()
      };

      configCallback(configEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Processing config update', {
        changes: ['memoryLimitMB']
      });
    });
  });

  describe('processFile', () => {
    it('should process file successfully', async () => {
      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");'
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.language).toBe('javascript');
      expect(result.processingStrategy).toBe('semantic');
      expect(result.chunks).toHaveLength(1);
      expect(mockDetectionService.detectFile).toHaveBeenCalledWith('/path/to/file.js', 'console.log("Hello");');
      expect(mockStrategyManager.selectOptimalStrategy).toHaveBeenCalled();
    });

    it('should use forced strategy when specified', async () => {
      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");',
        forceStrategy: 'line'
      };

      await coordinator.processFile(context);

      expect(mockStrategyManager.selectOptimalStrategy).toHaveBeenCalled();
    });

    it('should use fallback when system constraints require it', async () => {
      mockGuardCoordinator.shouldUseFallback.mockReturnValue(true);

      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");'
      };

      const result = await coordinator.processFile(context);

      expect(result.fallbackReason).toBe('System constraints');
      expect(mockGuardCoordinator.processFileWithDetection).toHaveBeenCalled();
    });

    it('should use fallback when memory limit exceeded', async () => {
      mockGuardCoordinator.checkMemoryUsage.mockReturnValue({ isWithinLimit: false, usagePercent: 120, heapUsed: 60000, heapTotal: 500000, external: 100, arrayBuffers: 20 });

      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");'
      };

      const result = await coordinator.processFile(context);

      expect(result.fallbackReason).toBe('Memory limit exceeded');
    });

    it('should handle processing failures gracefully', async () => {
      mockDetectionService.detectFile.mockRejectedValue(new Error('Detection failed'));

      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");'
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(false);
      expect(result.fallbackReason).toBe('Detection failed');
      expect(mockGuardCoordinator.recordError).toHaveBeenCalled();
    });

    it('should handle strategy execution with retries', async () => {
      // Mock strategy to fail first, then succeed
      let callCount = 0;
      mockStrategyManager.executeStrategy.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First attempt failed');
        }
        return {
          success: true,
          chunks: [{ id: 'chunk1', content: 'test', metadata: { startLine: 1, endLine: 1, language: 'javascript' } }],
          executionTime: 50,
          strategyName: 'semantic'
        };
      });

      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");',
        maxRetries: 3
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(callCount).toBe(2); // Should retry once
    });

    it('should handle all strategies failing', async () => {
      mockStrategyManager.executeStrategy.mockRejectedValue(new Error('All strategies failed'));
      mockStrategyManager.getFallbackPath.mockReturnValue([]); // No fallback path

      const context: ProcessingContext = {
        filePath: '/path/to/file.js',
        content: 'console.log("Hello");'
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(false);
      expect(result.fallbackReason).toBe('All strategies failed');
    });
  });

  describe('processFiles', () => {
    it('should process multiple files sequentially', async () => {
      mockConfigManager.getUniversalConfig.mockReturnValue({
        memory: { memoryLimitMB: 500, memoryCheckInterval: 5000 },
        error: { maxErrors: 5, errorResetInterval: 600 },
        chunking: { maxChunkSize: 2000, chunkOverlap: 200, maxLinesPerChunk: 50 },
        backup: { backupFilePatterns: ['.bak'], backupFileConfidenceThreshold: 0.7 }
      });

      const contexts: ProcessingContext[] = [
        { filePath: '/path/file1.js', content: 'content1' },
        { filePath: '/path/file2.js', content: 'content2' },
        { filePath: '/path/file3.js', content: 'content3' }
      ];

      const results = await coordinator.processFiles(contexts);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Processing 3 files');
      expect(mockLogger.info).toHaveBeenCalledWith('Batch processing completed: 3/3 files successful');
    });

    it('should process multiple files in parallel when enabled', async () => {
      mockConfigManager.getUniversalConfig.mockReturnValue({
        memory: { memoryLimitMB: 2000, memoryCheckInterval: 5000 },
        error: { maxErrors: 5, errorResetInterval: 6000 },
        chunking: { maxChunkSize: 2000, chunkOverlap: 200, maxLinesPerChunk: 50 },
        backup: { backupFilePatterns: ['.bak'], backupFileConfidenceThreshold: 0.7 }
      });

      const contexts: ProcessingContext[] = [
        { filePath: '/path/file1.js', content: 'content1' },
        { filePath: '/path/file2.js', content: 'content2' }
      ];

      const results = await coordinator.processFiles(contexts);

      expect(results).toHaveLength(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Processing 2 files');
    });

    it('should handle mixed success/failure in batch processing', async () => {
      let callCount = 0;
      mockDetectionService.detectFile.mockImplementation(async (filePath, content) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second file failed');
        }
        return {
          language: 'javascript',
          detectionMethod: 'extension',
          confidence: 0.9,
          metadata: {
            fileFeatures: {
              isCodeFile: true,
              isTextFile: false,
              isMarkdownFile: false,
              isXMLFile: false,
              isStructuredFile: true,
              isHighlyStructured: false,
              complexity: 10,
              lineCount: 10,
              size: 100,
              hasImports: false,
              hasExports: false,
              hasFunctions: true,
              hasClasses: false
            },
            processingStrategy: 'semantic'
          }
        };
      });

      const contexts: ProcessingContext[] = [
        { filePath: '/path/file1.js', content: 'content1' },
        { filePath: '/path/file2.js', content: 'content2' },
        { filePath: '/path/file3.js', content: 'content3' }
      ];

      const results = await coordinator.processFiles(contexts);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Batch processing completed: 2/3 files successful')
      );
    });
  });

  describe('validateProcessingResult', () => {
    it('should validate valid processing result', () => {
      const validResult: ProcessingResult = {
        chunks: [
          {
            id: 'chunk1',
            content: 'valid content',
            metadata: { startLine: 1, endLine: 1, language: 'javascript' }
          }
        ],
        language: 'javascript',
        processingStrategy: 'semantic',
        success: true,
        duration: 100,
        metadata: {
          detectionMethod: 'extension',
          confidence: 0.9,
          strategyExecutionTime: 50,
          errorCount: 0
        }
      };

      const validation = coordinator.validateProcessingResult(validResult);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject result with invalid chunks', () => {
      const invalidResult: ProcessingResult = {
        chunks: null as any,
        language: 'javascript',
        processingStrategy: 'semantic',
        success: true,
        duration: 100
      };

      const validation = coordinator.validateProcessingResult(invalidResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid chunks array');
    });

    it('should reject result with invalid chunk content', () => {
      const invalidResult: ProcessingResult = {
        chunks: [
          {
            id: 'chunk1',
            content: null as any,
            metadata: { startLine: 1, endLine: 1, language: 'javascript' }
          }
        ],
        language: 'javascript',
        processingStrategy: 'semantic',
        success: true,
        duration: 100
      };

      const validation = coordinator.validateProcessingResult(invalidResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid chunk content at index 0');
    });

    it('should reject result with invalid metadata', () => {
      const invalidResult: ProcessingResult = {
        chunks: [
          {
            id: 'chunk1',
            content: 'content',
            metadata: null as any
          }
        ],
        language: 'javascript',
        processingStrategy: 'semantic',
        success: true,
        duration: 100
      };

      const validation = coordinator.validateProcessingResult(invalidResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid chunk metadata at index 0');
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', () => {
      // Process some files to generate stats
      const context: ProcessingContext = {
        filePath: '/path/file.js',
        content: 'content'
      };

      // We need to actually process files to populate stats
      // For now, test that the method exists and returns a Map
      const stats = coordinator.getProcessingStats();

      expect(stats).toBeInstanceOf(Map);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return available strategies', () => {
      const strategies = coordinator.getAvailableStrategies();

      expect(strategies).toEqual([
        {
          name: 'semantic',
          description: 'Semantic strategy',
          supportedLanguages: ['javascript', 'typescript'],
          priority: 1,
          supportsAST: true
        }
      ]);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const languages = coordinator.getSupportedLanguages();

      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('markdown');
    });
  });

  describe('resetStats', () => {
    it('should reset processing statistics', () => {
      coordinator.resetStats();

      expect(mockStrategyManager.clearPerformanceStats).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Processing stats reset');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are healthy', async () => {
      const health = await coordinator.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.strategyManager).toBe(true);
      expect(health.details.detectionService).toBe(true);
      expect(health.details.configManager).toBe(true);
    });

    it('should return degraded status when some services are unhealthy', async () => {
      // 修改现有的mock，使其在健康检查时抛出错误
      const originalDetectFile = mockDetectionService.detectFile;
      mockDetectionService.detectFile.mockRejectedValue(new Error('Detection service error'));

      const health = await coordinator.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.details.detectionService).toBe(false);

      // 恢复原始mock
      mockDetectionService.detectFile = originalDetectFile;
    });

    it('should return unhealthy status when critical services are down', async () => {
      // 修改现有的mock，使其在健康检查时抛出错误
      // 根据健康检查逻辑，只有当strategyManager为false时才返回unhealthy
      // 所以我们需要让strategyManager检查失败
      
      // 临时替换checkStrategyManager方法，使其返回false
      const originalCheckStrategyManager = (coordinator as any).checkStrategyManager;
      (coordinator as any).checkStrategyManager = jest.fn().mockResolvedValue(false);

      const health = await coordinator.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.strategyManager).toBe(false);

      // 恢复原始方法
      (coordinator as any).checkStrategyManager = originalCheckStrategyManager;
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete processing workflow', async () => {
      const context: ProcessingContext = {
        filePath: '/path/to/complex/file.js',
        content: `
          function complexFunction() {
            const data = { key: 'value' };
            if (data.key === 'value') {
              return true;
            }
            return false;
          }
        `.trim(),
        options: {
          basic: {
            maxChunkSize: 1500,
            overlapSize: 150,
            maxLines: 50
          }
        },
        forceStrategy: 'semantic',
        enableFallback: true,
        maxRetries: 2
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.language).toBe('javascript');
      expect(result.processingStrategy).toBe('semantic');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);

      // Validate the result
      const validation = coordinator.validateProcessingResult(result);
      expect(validation.isValid).toBe(true);

      // Check that stats were updated
      const stats = coordinator.getProcessingStats();
      expect(stats.get('javascript')).toBeDefined();
    });

    it('should handle emergency fallback scenarios', async () => {
      // Mock complete failure scenario
      mockGuardCoordinator.shouldUseFallback.mockReturnValue(true);
      mockGuardCoordinator.processFileWithDetection.mockRejectedValue(new Error('Fallback also failed'));

      const context: ProcessingContext = {
        filePath: '/path/emergency/file.js',
        content: 'emergency content'
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true); // Emergency fallback should still succeed
      expect(result.processingStrategy).toBe('emergency-single-chunk');
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe('emergency content');
    });

    it('should handle configuration updates during processing', async () => {
      // Simulate config update during processing
      const configCallback = (mockConfigCoordinator as any).configCallback;

      const context: ProcessingContext = {
        filePath: '/path/file.js',
        content: 'content'
      };

      // Start processing
      const processPromise = coordinator.processFile(context);

      // Simulate config update during processing
      configCallback({
        type: 'config-updated',
        changes: ['memoryLimitMB'],
        timestamp: new Date()
      });

      const result = await processPromise;

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Processing config update', {
        changes: ['memoryLimitMB']
      });
    });
  });
});