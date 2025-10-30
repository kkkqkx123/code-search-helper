import { IntelligentFallbackEngine } from '../IntelligentFallbackEngine';
import { LoggerService } from '../../../../utils/LoggerService';
import { DetectionResult, ProcessingStrategyType } from '../../processing/detection/UnifiedDetectionService';

// Mock LoggerService
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
} as unknown as LoggerService;

// Mock FileFeatureDetector
jest.mock('../../processing/detection/FileFeatureDetector', () => {
  return {
    FileFeatureDetector: {
      getInstance: jest.fn().mockReturnValue({
        isCodeLanguage: jest.fn().mockReturnValue(true),
        isMarkdown: jest.fn().mockReturnValue(false),
        isXML: jest.fn().mockReturnValue(false)
      })
    }
  };
});

describe('IntelligentFallbackEngine', () => {
  let fallbackEngine: IntelligentFallbackEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    fallbackEngine = new IntelligentFallbackEngine(mockLogger);
  });

  describe('determineFallbackStrategy', () => {
    const mockDetection: DetectionResult = {
      language: 'javascript',
      confidence: 0.9,
      detectionMethod: 'hybrid',
      fileType: 'normal',
      processingStrategy: ProcessingStrategyType.TREESITTER_AST,
      metadata: {
        fileFeatures: {
          isCodeFile: true,
          isTextFile: true,
          isMarkdownFile: false,
          isXMLFile: false,
          isStructuredFile: true,
          isHighlyStructured: true,
          complexity: 1,
          lineCount: 10,
          size: 500,
          hasImports: false,
          hasExports: false,
          hasFunctions: true,
          hasClasses: false
        }
      }
    };

    it('should handle memory error with UNIVERSAL_LINE strategy', async () => {
      const error = new Error('Memory allocation failed');
      const strategy = await fallbackEngine.determineFallbackStrategy('test.js', error, mockDetection);

      expect(strategy.strategy).toBe(ProcessingStrategyType.UNIVERSAL_LINE);
      expect(strategy.reason).toContain('Memory constraint');
    });

    it('should handle parse error for code language with UNIVERSAL_SEMANTIC_FINE', async () => {
      const error = new Error('Parse error in tree-sitter');
      const strategy = await fallbackEngine.determineFallbackStrategy('test.js', error, mockDetection);

      expect(strategy.strategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE);
      expect(strategy.reason).toContain('AST parsing failed');
    });

    it('should handle timeout error with UNIVERSAL_LINE strategy', async () => {
      const error = new Error('Processing timeout');
      const strategy = await fallbackEngine.determineFallbackStrategy('test.js', error, mockDetection);

      expect(strategy.strategy).toBe(ProcessingStrategyType.UNIVERSAL_LINE);
      expect(strategy.reason).toContain('Processing timeout');
    });

    it('should handle syntax error with UNIVERSAL_LINE strategy', async () => {
      const error = new Error('Syntax error detected');
      const strategy = await fallbackEngine.determineFallbackStrategy('test.js', error, mockDetection);

      expect(strategy.strategy).toBe(ProcessingStrategyType.UNIVERSAL_LINE);
      expect(strategy.reason).toContain('Syntax error');
    });

    it('should handle IO error with EMERGENCY_SINGLE_CHUNK strategy', async () => {
      const error = new Error('File read error');
      const strategy = await fallbackEngine.determineFallbackStrategy('test.js', error, mockDetection);

      expect(strategy.strategy).toBe(ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK);
      expect(strategy.reason).toContain('IO error');
    });

    it('should use file characteristics for unknown error', async () => {
      const error = new Error('Unknown error');
      const strategy = await fallbackEngine.determineFallbackStrategy('test.js', error, mockDetection);

      expect(strategy.strategy).toBeDefined();
      expect(strategy.reason).toBeDefined();
    });
  });

  describe('error classification', () => {
    it('should classify memory errors correctly', () => {
      const error = new Error('Memory allocation failed');
      const result = (fallbackEngine as any).classifyError(error);
      expect(result).toBe('memory_error');
    });

    it('should classify parse errors correctly', () => {
      const error = new Error('Parse error in tree-sitter');
      const result = (fallbackEngine as any).classifyError(error);
      expect(result).toBe('parse_error');
    });

    it('should classify timeout errors correctly', () => {
      const error = new Error('Processing timed out');
      const result = (fallbackEngine as any).classifyError(error);
      expect(result).toBe('timeout_error');
    });

    it('should classify IO errors correctly', () => {
      const error = new Error('File access denied');
      const result = (fallbackEngine as any).classifyError(error);
      expect(result).toBe('io_error');
    });
  });

  describe('error pattern recording', () => {
    it('should record error patterns correctly', () => {
      const error = new Error('Test error');
      const filePath = 'test.js';

      fallbackEngine.recordErrorPattern(filePath, error);

      const history = fallbackEngine.getErrorHistory(filePath);
      expect(history).toHaveLength(1);
      expect(history[0].errorType).toBe('unknown_error');
      expect(history[0].filePath).toBe(filePath);
    });

    it('should limit error history size', () => {
      const filePath = 'test.js';

      // Add more than 100 errors
      for (let i = 0; i < 105; i++) {
        fallbackEngine.recordErrorPattern(filePath, new Error(`Error ${i}`));
      }

      const history = fallbackEngine.getErrorHistory(filePath);
      expect(history).toHaveLength(100); // Should be limited to 100
    });
  });

  describe('performance metrics', () => {
    it('should record performance metrics correctly', () => {
      const filePath = 'test.js';
      const metrics = {
        processingTime: 100,
        memoryUsage: 1024,
        successRate: 0.95
      };

      fallbackEngine.recordPerformanceMetrics(filePath, metrics);

      const recordedMetrics = fallbackEngine.getPerformanceMetrics(filePath);
      expect(recordedMetrics).toHaveLength(1);
      expect(recordedMetrics[0]).toEqual(metrics);
    });

    it('should limit performance metrics size', () => {
      const filePath = 'test.js';

      // Add more than 50 metrics
      for (let i = 0; i < 55; i++) {
        fallbackEngine.recordPerformanceMetrics(filePath, {
          processingTime: i,
          memoryUsage: i * 1024,
          successRate: 0.9
        });
      }

      const metrics = fallbackEngine.getPerformanceMetrics(filePath);
      expect(metrics).toHaveLength(50); // Should be limited to 50
    });
  });

  describe('clear methods', () => {
    it('should clear error history', () => {
      const filePath = 'test.js';
      fallbackEngine.recordErrorPattern(filePath, new Error('Test error'));

      fallbackEngine.clearErrorHistory();

      const history = fallbackEngine.getErrorHistory(filePath);
      expect(history).toHaveLength(0);
    });

    it('should clear performance metrics', () => {
      const filePath = 'test.js';
      fallbackEngine.recordPerformanceMetrics(filePath, {
        processingTime: 100,
        memoryUsage: 1024,
        successRate: 0.95
      });

      fallbackEngine.clearPerformanceMetrics();

      const metrics = fallbackEngine.getPerformanceMetrics(filePath);
      expect(metrics).toHaveLength(0);
    });
  });
});