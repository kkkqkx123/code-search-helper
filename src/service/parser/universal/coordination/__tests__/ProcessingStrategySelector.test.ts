import { ProcessingStrategySelector } from '../ProcessingStrategySelector';
import { LoggerService } from '../../../../../utils/LoggerService';
import { BackupFileProcessor } from '../../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../ExtensionlessFileProcessor';
import { UniversalProcessingConfig } from '../../UniversalProcessingConfig';
import { IStrategySelectionContext, ILanguageDetectionInfo } from '../interfaces/IProcessingStrategySelector';
import { ProcessingStrategyType } from '../interfaces/IProcessingStrategySelector';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock BackupFileProcessor
jest.mock('../BackupFileProcessor');
const MockBackupFileProcessor = BackupFileProcessor as jest.MockedClass<typeof BackupFileProcessor>;

// Mock ExtensionlessFileProcessor
jest.mock('../ExtensionlessFileProcessor');
const MockExtensionlessFileProcessor = ExtensionlessFileProcessor as jest.MockedClass<typeof ExtensionlessFileProcessor>;

// Mock UniversalProcessingConfig
jest.mock('../UniversalProcessingConfig');
const MockUniversalProcessingConfig = UniversalProcessingConfig as jest.MockedClass<typeof UniversalProcessingConfig>;

describe('ProcessingStrategySelector', () => {
  let selector: ProcessingStrategySelector;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockBackupProcessor: jest.Mocked<BackupFileProcessor>;
  let mockExtensionlessProcessor: jest.Mocked<ExtensionlessFileProcessor>;
  let mockConfig: jest.Mocked<UniversalProcessingConfig>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockBackupProcessor = new MockBackupFileProcessor() as jest.Mocked<BackupFileProcessor>;
    mockBackupProcessor.isBackupFile = jest.fn().mockReturnValue(false);
    mockBackupProcessor.inferOriginalType = jest.fn().mockReturnValue({
      originalExtension: '.js',
      originalLanguage: 'javascript',
      originalFileName: 'test.js',
      confidence: 0.9
    });

    mockExtensionlessProcessor = new MockExtensionlessFileProcessor() as jest.Mocked<ExtensionlessFileProcessor>;
    mockExtensionlessProcessor.detectLanguageByContent = jest.fn().mockReturnValue({
      language: 'javascript',
      confidence: 0.8,
      indicators: ['pattern1', 'pattern2']
    });

    mockConfig = new MockUniversalProcessingConfig() as jest.Mocked<UniversalProcessingConfig>;
    mockConfig.getBackupFileConfidenceThreshold = jest.fn().mockReturnValue(0.7);

    selector = new ProcessingStrategySelector(
      mockLogger,
      mockBackupProcessor,
      mockExtensionlessProcessor,
      mockConfig
    );
  });

  describe('Constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(selector.name).toBe('ProcessingStrategySelector');
      expect(selector.description).toBe('Intelligent language detection and processing strategy selection');
    });

    it('should create default instances when dependencies not provided', () => {
      const selectorWithoutDeps = new ProcessingStrategySelector(mockLogger);
      expect(selectorWithoutDeps).toBeDefined();
    });
  });

  describe('detectLanguageIntelligently', () => {
    it('should detect language from backup file with high confidence', async () => {
      mockBackupProcessor.isBackupFile.mockReturnValue(true);
      mockBackupProcessor.inferOriginalType.mockReturnValue({
        originalExtension: '.js',
        originalLanguage: 'javascript',
        originalFileName: 'test.js',
        confidence: 0.9
      });

      const result = await selector.detectLanguageIntelligently('test.js.bak', 'function test() {}');

      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.9);
      expect(result.detectionMethod).toBe('backup');
      expect(result.metadata?.originalExtension).toBe('.js');
      expect(mockBackupProcessor.isBackupFile).toHaveBeenCalledWith('test.js.bak');
      expect(mockBackupProcessor.inferOriginalType).toHaveBeenCalledWith('test.js.bak');
    });

    it('should ignore backup file detection with low confidence', async () => {
      mockBackupProcessor.isBackupFile.mockReturnValue(true);
      mockBackupProcessor.inferOriginalType.mockReturnValue({
        originalExtension: '.js',
        originalLanguage: 'javascript',
        originalFileName: 'test.js',
        confidence: 0.5 // Below threshold
      });

      const result = await selector.detectLanguageIntelligently('test.js.bak', 'function test() {}');

      expect(result.language).not.toBe('javascript');
      expect(result.detectionMethod).not.toBe('backup');
    });

    it('should detect language from file extension', async () => {
      const result = await selector.detectLanguageIntelligently('test.js', 'function test() {}');

      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.8);
      expect(result.detectionMethod).toBe('extension');
      expect(result.metadata?.extension).toBe('.js');
    });

    it('should override extension detection with content detection for markdown', async () => {
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.8,
        indicators: ['python_pattern']
      });

      const result = await selector.detectLanguageIntelligently('test.md', '#!/usr/bin/env python\nprint("hello")');

      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.8);
      expect(result.detectionMethod).toBe('content');
      expect(result.metadata?.originalExtension).toBe('markdown');
      expect(result.metadata?.overrideReason).toBe('content_confidence_higher');
    });

    it('should use content detection when extension is unknown', async () => {
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.7,
        indicators: ['python_pattern']
      });

      const result = await selector.detectLanguageIntelligently('test.unknown', 'print("hello")');

      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.7);
      expect(result.detectionMethod).toBe('content');
      expect(result.metadata?.indicators).toEqual(['python_pattern']);
    });

    it('should default to text when no detection succeeds', async () => {
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.01,
        indicators: []
      });

      const result = await selector.detectLanguageIntelligently('test.xyz', 'some random content');

      expect(result.language).toBe('text');
      expect(result.confidence).toBe(0.1);
      expect(result.detectionMethod).toBe('default');
      expect(result.metadata?.reason).toBe('no_clear_detection');
    });

    it('should handle detection errors gracefully', async () => {
      mockExtensionlessProcessor.detectLanguageByContent.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      const result = await selector.detectLanguageIntelligently('test.js', 'function test() {}');

      expect(result.language).toBe('text');
      expect(result.confidence).toBe(0.05);
      expect(result.detectionMethod).toBe('default');
      expect(result.metadata?.error).toBe('Detection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Error in language detection: Error: Detection failed');
    });
  });

  describe('selectProcessingStrategy', () => {
    it('should select bracket strategy for backup files', async () => {
      mockBackupProcessor.isBackupFile.mockReturnValue(true);
      
      const context: IStrategySelectionContext = {
        filePath: 'test.js.bak',
        content: 'function test() {}',
        languageInfo: {
          language: 'javascript',
          confidence: 0.9,
          detectionMethod: 'backup'
        },
        timestamp: new Date()
      };

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.UNIVERSAL_BRACKET);
      expect(result.reason).toContain('Backup file');
      expect(result.shouldFallback).toBe(false);
      expect(result.parameters?.backupType).toBe('detected');
    });

    it('should select TreeSitter strategy for code languages with TreeSitter support', async () => {
      const context: IStrategySelectionContext = {
        filePath: 'test.js',
        content: 'function test() {}',
        languageInfo: {
          language: 'javascript',
          confidence: 0.8,
          detectionMethod: 'extension'
        },
        timestamp: new Date()
      };

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.TREESITTER_AST);
      expect(result.reason).toContain('TreeSitter AST parsing');
      expect(result.shouldFallback).toBe(false);
      expect(result.parameters?.language).toBe('javascript');
      expect(result.parameters?.hasTreeSitterSupport).toBe(true);
    });

    it('should select fine semantic strategy for code languages without TreeSitter support', async () => {
      const context: IStrategySelectionContext = {
        filePath: 'test.lua',
        content: 'function test() end',
        languageInfo: {
          language: 'lua',
          confidence: 0.8,
          detectionMethod: 'extension'
        },
        timestamp: new Date()
      };

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE);
      expect(result.reason).toContain('fine semantic segmentation');
      expect(result.shouldFallback).toBe(false);
      expect(result.parameters?.language).toBe('lua');
      expect(result.parameters?.hasTreeSitterSupport).toBe(false);
    });

    it('should select semantic strategy for text languages', async () => {
      const context: IStrategySelectionContext = {
        filePath: 'test.md',
        content: '# Title\n\nSome content',
        languageInfo: {
          language: 'markdown',
          confidence: 0.8,
          detectionMethod: 'extension'
        },
        timestamp: new Date()
      };

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC);
      expect(result.reason).toContain('semantic segmentation');
      expect(result.shouldFallback).toBe(false);
      expect(result.parameters?.language).toBe('markdown');
      expect(result.parameters?.contentType).toBe('text');
    });

    it('should select bracket strategy for structured files', async () => {
      const context: IStrategySelectionContext = {
        filePath: 'test.json',
        content: '{"key": "value", "nested": {"array": [1, 2, 3]}}',
        languageInfo: {
          language: 'json',
          confidence: 0.8,
          detectionMethod: 'extension'
        },
        timestamp: new Date()
      };

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.UNIVERSAL_BRACKET);
      expect(result.reason).toContain('bracket-balanced segmentation');
      expect(result.shouldFallback).toBe(false);
      expect(result.parameters?.language).toBe('json');
      expect(result.parameters?.structuredType).toBe('detected');
    });

    it('should select line strategy as default', async () => {
      const context: IStrategySelectionContext = {
        filePath: 'test.txt',
        content: 'Just plain text content',
        languageInfo: {
          language: 'text',
          confidence: 0.1,
          detectionMethod: 'default'
        },
        timestamp: new Date()
      };

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.UNIVERSAL_LINE);
      expect(result.reason).toContain('line-based segmentation');
      expect(result.shouldFallback).toBe(false);
      expect(result.parameters?.language).toBe('text');
      expect(result.parameters?.defaultStrategy).toBe(true);
    });

    it('should handle strategy selection errors with fallback', async () => {
      const context: IStrategySelectionContext = {
        filePath: 'test.js',
        content: 'function test() {}',
        languageInfo: {
          language: 'javascript',
          confidence: 0.8,
          detectionMethod: 'extension'
        },
        timestamp: new Date()
      };

      // Mock an error in the selection process
      const originalIsCodeLanguage = selector.isCodeLanguage;
      selector.isCodeLanguage = jest.fn().mockImplementation(() => {
        throw new Error('Selection error');
      });

      const result = await selector.selectProcessingStrategy(context);

      expect(result.strategy).toBe(ProcessingStrategyType.UNIVERSAL_LINE);
      expect(result.shouldFallback).toBe(true);
      expect(result.fallbackReason).toContain('Strategy selection error');
      expect(result.parameters?.error).toBe('Selection error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error in strategy selection: Error: Selection error');

      // Restore original method
      selector.isCodeLanguage = originalIsCodeLanguage;
    });
  });

  describe('isCodeLanguage', () => {
    it('should return true for code languages', () => {
      expect(selector.isCodeLanguage('javascript')).toBe(true);
      expect(selector.isCodeLanguage('typescript')).toBe(true);
      expect(selector.isCodeLanguage('python')).toBe(true);
      expect(selector.isCodeLanguage('java')).toBe(true);
      expect(selector.isCodeLanguage('cpp')).toBe(true);
      expect(selector.isCodeLanguage('go')).toBe(true);
      expect(selector.isCodeLanguage('rust')).toBe(true);
    });

    it('should return false for non-code languages', () => {
      expect(selector.isCodeLanguage('markdown')).toBe(false);
      expect(selector.isCodeLanguage('text')).toBe(false);
      expect(selector.isCodeLanguage('log')).toBe(false);
      expect(selector.isCodeLanguage('unknown')).toBe(false);
    });
  });

  describe('isTextLanguage', () => {
    it('should return true for text languages', () => {
      expect(selector.isTextLanguage('markdown')).toBe(true);
      expect(selector.isTextLanguage('text')).toBe(true);
      expect(selector.isTextLanguage('log')).toBe(true);
      expect(selector.isTextLanguage('ini')).toBe(true);
      expect(selector.isTextLanguage('cfg')).toBe(true);
      expect(selector.isTextLanguage('conf')).toBe(true);
      expect(selector.isTextLanguage('toml')).toBe(true);
    });

    it('should return false for non-text languages', () => {
      expect(selector.isTextLanguage('javascript')).toBe(false);
      expect(selector.isTextLanguage('python')).toBe(false);
      expect(selector.isTextLanguage('java')).toBe(false);
      expect(selector.isTextLanguage('unknown')).toBe(false);
    });
  });

  describe('canUseTreeSitter', () => {
    it('should return true for supported languages', () => {
      expect(selector.canUseTreeSitter('javascript')).toBe(true);
      expect(selector.canUseTreeSitter('typescript')).toBe(true);
      expect(selector.canUseTreeSitter('python')).toBe(true);
      expect(selector.canUseTreeSitter('java')).toBe(true);
      expect(selector.canUseTreeSitter('cpp')).toBe(true);
      expect(selector.canUseTreeSitter('c')).toBe(true);
      expect(selector.canUseTreeSitter('csharp')).toBe(true);
      expect(selector.canUseTreeSitter('go')).toBe(true);
      expect(selector.canUseTreeSitter('rust')).toBe(true);
      expect(selector.canUseTreeSitter('php')).toBe(true);
      expect(selector.canUseTreeSitter('ruby')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(selector.canUseTreeSitter('lua')).toBe(false);
      expect(selector.canUseTreeSitter('markdown')).toBe(false);
      expect(selector.canUseTreeSitter('text')).toBe(false);
      expect(selector.canUseTreeSitter('unknown')).toBe(false);
    });
  });

  describe('isStructuredFile', () => {
    it('should return true for structured languages', () => {
      expect(selector.isStructuredFile('{"key": "value"}', 'json')).toBe(true);
      expect(selector.isStructuredFile('<root><item>test</item></root>', 'xml')).toBe(true);
      expect(selector.isStructuredFile('key: value\nlist:\n  - item1', 'yaml')).toBe(true);
      expect(selector.isStructuredFile('body { color: red; }', 'css')).toBe(true);
    });

    it('should return true for content with high bracket ratio', () => {
      const content = '{a: {b: {c: {d: {e: "value"}}}}}';
      expect(selector.isStructuredFile(content, 'unknown')).toBe(true);
    });

    it('should return true for content with high tag ratio', () => {
      const content = '<root><item><subitem>value</subitem></item></root>';
      expect(selector.isStructuredFile(content, 'unknown')).toBe(true);
    });

    it('should return false for unstructured content', () => {
      const content = 'This is just plain text with no special structure.';
      expect(selector.isStructuredFile(content, 'text')).toBe(false);
    });

    it('should log debug information for structured files', () => {
      const content = '{a: {b: {c: "value"}}}';
      selector.isStructuredFile(content, 'unknown');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Detected structured file')
      );
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete workflow for JavaScript file', async () => {
      const languageInfo = await selector.detectLanguageIntelligently(
        'test.js',
        'function test() { return 1; }'
      );

      expect(languageInfo.language).toBe('javascript');
      expect(languageInfo.detectionMethod).toBe('extension');

      const context: IStrategySelectionContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        languageInfo,
        timestamp: new Date()
      };

      const strategyResult = await selector.selectProcessingStrategy(context);

      expect(strategyResult.strategy).toBe(ProcessingStrategyType.TREESITTER_AST);
      expect(strategyResult.reason).toContain('TreeSitter AST parsing');
    });

    it('should work with complete workflow for backup file', async () => {
      mockBackupProcessor.isBackupFile.mockReturnValue(true);
      mockBackupProcessor.inferOriginalType.mockReturnValue({
        originalExtension: '.py',
        originalLanguage: 'python',
        originalFileName: 'test.py',
        confidence: 0.9
      });

      const languageInfo = await selector.detectLanguageIntelligently(
        'test.py.bak',
        'def test():\n    return 1'
      );

      expect(languageInfo.language).toBe('python');
      expect(languageInfo.detectionMethod).toBe('backup');

      const context: IStrategySelectionContext = {
        filePath: 'test.py.bak',
        content: 'def test():\n    return 1',
        languageInfo,
        timestamp: new Date()
      };

      const strategyResult = await selector.selectProcessingStrategy(context);

      expect(strategyResult.strategy).toBe(ProcessingStrategyType.UNIVERSAL_BRACKET);
      expect(strategyResult.reason).toContain('Backup file');
    });

    it('should work with complete workflow for unknown file type', async () => {
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.7,
        indicators: ['python_pattern']
      });

      const languageInfo = await selector.detectLanguageIntelligently(
        'test.unknown',
        'def test():\n    return 1'
      );

      expect(languageInfo.language).toBe('python');
      expect(languageInfo.detectionMethod).toBe('content');

      const context: IStrategySelectionContext = {
        filePath: 'test.unknown',
        content: 'def test():\n    return 1',
        languageInfo,
        timestamp: new Date()
      };

      const strategyResult = await selector.selectProcessingStrategy(context);

      expect(strategyResult.strategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE);
      expect(strategyResult.reason).toContain('fine semantic segmentation');
    });
  });
});