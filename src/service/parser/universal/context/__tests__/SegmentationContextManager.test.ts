import { SegmentationContextManager } from '../SegmentationContextManager';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ConfigurationManager } from '../../config/ConfigurationManager';
import { ISegmentationStrategy, SegmentationContext, UniversalChunkingOptions } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock ConfigurationManager
jest.mock('../../config/ConfigurationManager');
const MockConfigurationManager = ConfigurationManager as jest.MockedClass<typeof ConfigurationManager>;

describe('SegmentationContextManager', () => {
  let contextManager: SegmentationContextManager;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;

  // Mock strategy for testing
  const createMockStrategy = (name: string, priority: number, canHandle: boolean = true): ISegmentationStrategy => ({
    getName: () => name,
    getPriority: () => priority,
    canHandle: jest.fn().mockReturnValue(canHandle),
    segment: jest.fn().mockResolvedValue([]),
    validateContext: jest.fn().mockReturnValue(true),
    getSupportedLanguages: jest.fn().mockReturnValue(['javascript', 'typescript'])
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockConfigManager = new MockConfigurationManager() as jest.Mocked<ConfigurationManager>;
    mockConfigManager.getDefaultOptions = jest.fn().mockReturnValue({
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
      strategyPriorities: {
        'markdown': 1,
        'standardization': 2,
        'semantic': 3,
        'bracket': 4,
        'line': 5
      },
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
    });
    mockConfigManager.getLanguageSpecificConfig = jest.fn().mockReturnValue({});
    mockConfigManager.mergeOptions = jest.fn().mockImplementation((base, override) => ({ ...base, ...override }));

    contextManager = new SegmentationContextManager(mockLogger, mockConfigManager);
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(contextManager.getStrategies()).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith('SegmentationContextManager initialized');
    });

    it('should create default config manager if none provided', () => {
      const managerWithoutConfig = new SegmentationContextManager(mockLogger);
      expect(managerWithoutConfig).toBeDefined();
    });
  });

  describe('addStrategy', () => {
    it('should add a new strategy', () => {
      const strategy = createMockStrategy('test', 1);
      
      contextManager.addStrategy(strategy);
      
      const strategies = contextManager.getStrategies();
      expect(strategies).toHaveLength(1);
      expect(strategies[0]).toBe(strategy);
      expect(mockLogger.debug).toHaveBeenCalledWith('Added new strategy: test');
    });

    it('should replace existing strategy with same name', () => {
      const strategy1 = createMockStrategy('test', 1);
      const strategy2 = createMockStrategy('test', 2);
      
      contextManager.addStrategy(strategy1);
      contextManager.addStrategy(strategy2);
      
      const strategies = contextManager.getStrategies();
      expect(strategies).toHaveLength(1);
      expect(strategies[0]).toBe(strategy2);
      expect(mockLogger.debug).toHaveBeenCalledWith('Replaced existing strategy: test');
    });

    it('should sort strategies by priority', () => {
      const strategy1 = createMockStrategy('high', 3);
      const strategy2 = createMockStrategy('low', 1);
      const strategy3 = createMockStrategy('medium', 2);
      
      contextManager.addStrategy(strategy1);
      contextManager.addStrategy(strategy2);
      contextManager.addStrategy(strategy3);
      
      const strategies = contextManager.getStrategies();
      expect(strategies[0].getName()).toBe('low');
      expect(strategies[1].getName()).toBe('medium');
      expect(strategies[2].getName()).toBe('high');
    });

    it('should clear cache when adding strategy', () => {
      const strategy = createMockStrategy('test', 1);
      
      // Add a strategy to populate cache
      contextManager.addStrategy(strategy);
      
      // Get cache stats to verify cache is cleared
      const stats = contextManager.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('removeStrategy', () => {
    it('should remove an existing strategy', () => {
      const strategy = createMockStrategy('test', 1);
      
      contextManager.addStrategy(strategy);
      expect(contextManager.getStrategies()).toHaveLength(1);
      
      contextManager.removeStrategy('test');
      expect(contextManager.getStrategies()).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Removed strategy: test');
    });

    it('should handle removing non-existent strategy', () => {
      contextManager.removeStrategy('nonexistent');
      expect(mockLogger.warn).toHaveBeenCalledWith('Strategy not found for removal: nonexistent');
    });

    it('should clear cache when removing strategy', () => {
      const strategy = createMockStrategy('test', 1);
      
      contextManager.addStrategy(strategy);
      contextManager.removeStrategy('test');
      
      const stats = contextManager.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getStrategies and getStrategyInfo', () => {
    it('should return all strategies', () => {
      const strategy1 = createMockStrategy('test1', 1);
      const strategy2 = createMockStrategy('test2', 2);
      
      contextManager.addStrategy(strategy1);
      contextManager.addStrategy(strategy2);
      
      const strategies = contextManager.getStrategies();
      expect(strategies).toHaveLength(2);
      expect(strategies[0]).toBe(strategy1);
      expect(strategies[1]).toBe(strategy2);
    });

    it('should return strategy information', () => {
      const strategy = createMockStrategy('test', 1);
      
      contextManager.addStrategy(strategy);
      
      const info = contextManager.getStrategyInfo();
      expect(info).toHaveLength(1);
      expect(info[0].name).toBe('test');
      expect(info[0].priority).toBe(1);
      expect(info[0].supportedLanguages).toEqual(['javascript', 'typescript']);
    });
  });

  describe('selectStrategy', () => {
    it('should select strategy by priority', () => {
      const strategy1 = createMockStrategy('low', 2);
      const strategy2 = createMockStrategy('high', 1);
      
      contextManager.addStrategy(strategy1);
      contextManager.addStrategy(strategy2);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      const selectedStrategy = contextManager.selectStrategy(context);
      expect(selectedStrategy.getName()).toBe('high');
    });

    it('should select preferred strategy if available', () => {
      const strategy1 = createMockStrategy('preferred', 2);
      const strategy2 = createMockStrategy('other', 1);
      
      contextManager.addStrategy(strategy1);
      contextManager.addStrategy(strategy2);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      const selectedStrategy = contextManager.selectStrategy(context, 'preferred');
      expect(selectedStrategy.getName()).toBe('preferred');
    });

    it('should use cached strategy when available', () => {
      const strategy = createMockStrategy('test', 1);
      
      contextManager.addStrategy(strategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      // First call should cache the strategy
      const selected1 = contextManager.selectStrategy(context);
      expect(selected1.getName()).toBe('test');
      
      // Second call should use cached strategy
      const selected2 = contextManager.selectStrategy(context);
      expect(selected2.getName()).toBe('test');
      
      // Verify canHandle was called twice (once for initial selection, once for cache validation)
      expect(strategy.canHandle).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no suitable strategy found', () => {
      const strategy = createMockStrategy('test', 1, false); // Cannot handle
      
      contextManager.addStrategy(strategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      expect(() => contextManager.selectStrategy(context)).toThrow('No suitable segmentation strategy found');
    });
  });

  describe('executeStrategy', () => {
    it('should execute strategy successfully', async () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'code', complexity: 1 } }
      ];
      const strategy = createMockStrategy('test', 1);
      strategy.segment = jest.fn().mockResolvedValue(chunks);
      
      contextManager.addStrategy(strategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      const result = await contextManager.executeStrategy(strategy, context);
      
      expect(result).toEqual(chunks);
      expect(strategy.segment).toHaveBeenCalledWith(context);
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing strategy: test');
    });

    it('should handle strategy execution error with fallback', async () => {
      const errorStrategy = createMockStrategy('error', 1);
      errorStrategy.segment = jest.fn().mockRejectedValue(new Error('Strategy failed'));
      
      const fallbackStrategy = createMockStrategy('line', 5);
      fallbackStrategy.segment = jest.fn().mockResolvedValue([
        { content: 'fallback', metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'line', complexity: 1 } }
      ]);
      
      contextManager.addStrategy(errorStrategy);
      contextManager.addStrategy(fallbackStrategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      const result = await contextManager.executeStrategy(errorStrategy, context);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('fallback');
      expect(mockLogger.warn).toHaveBeenCalledWith('Falling back to line-based segmentation');
    });

    it('should throw error when no fallback available', async () => {
      const errorStrategy = createMockStrategy('error', 1);
      errorStrategy.segment = jest.fn().mockRejectedValue(new Error('Strategy failed'));
      
      contextManager.addStrategy(errorStrategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      await expect(contextManager.executeStrategy(errorStrategy, context)).rejects.toThrow('Strategy failed');
    });

    it('should validate context if strategy supports it', async () => {
      const strategy = createMockStrategy('test', 1);
      strategy.validateContext = jest.fn().mockReturnValue(false);
      
      contextManager.addStrategy(strategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      await expect(contextManager.executeStrategy(strategy, context)).rejects.toThrow('Context validation failed for strategy: test');
    });
  });

  describe('createSegmentationContext', () => {
    it('should create context with default options', () => {
      const content = 'test content';
      
      const context = contextManager.createSegmentationContext(content);
      
      expect(context.content).toBe(content);
      expect(context.options).toEqual(mockConfigManager.getDefaultOptions());
      expect(mockConfigManager.getDefaultOptions).toHaveBeenCalled();
    });

    it('should create context with custom options', () => {
      const content = 'test content';
      const customOptions: UniversalChunkingOptions = {
        maxChunkSize: 3000,
        overlapSize: 300,
        maxLinesPerChunk: 100,
        enableBracketBalance: true,
        enableSemanticDetection: true,
        enableCodeOverlap: false,
        enableStandardization: true,
        standardizationFallback: true,
        maxOverlapRatio: 0.3,
        errorThreshold: 5,
        memoryLimitMB: 500,
        strategyPriorities: {
          'markdown': 1,
          'standardization': 2,
          'semantic': 3,
          'bracket': 4,
          'line': 5
        },
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        },
        protectionConfig: {
          enableProtection: true,
          protectionLevel: 'medium'
        }
      };
      
      const context = contextManager.createSegmentationContext(content, undefined, undefined, customOptions);
      
      expect(context.content).toBe(content);
      expect(context.options.maxChunkSize).toBe(3000);
      expect(context.options.overlapSize).toBe(300);
    });

    it('should apply language-specific configuration', () => {
      const content = 'test content';
      const languageConfig = { maxChunkSize: 2500 };
      
      mockConfigManager.getLanguageSpecificConfig.mockReturnValue(languageConfig);
      mockConfigManager.mergeOptions.mockReturnValue({
        ...mockConfigManager.getDefaultOptions(),
        ...languageConfig
      });
      
      const context = contextManager.createSegmentationContext(content, undefined, 'javascript');
      
      expect(mockConfigManager.getLanguageSpecificConfig).toHaveBeenCalledWith('javascript');
      expect(mockConfigManager.mergeOptions).toHaveBeenCalled();
      expect(context.options.maxChunkSize).toBe(2500);
    });

    it('should not apply language config if empty', () => {
      const content = 'test content';
      
      mockConfigManager.getLanguageSpecificConfig.mockReturnValue({});
      
      const context = contextManager.createSegmentationContext(content, undefined, 'javascript');
      
      expect(mockConfigManager.getLanguageSpecificConfig).toHaveBeenCalledWith('javascript');
      expect(mockConfigManager.mergeOptions).not.toHaveBeenCalled();
      expect(context.options).toEqual(mockConfigManager.getDefaultOptions());
    });
  });

  describe('selectStrategyWithHeuristics', () => {
    it('should select strategy based on content analysis', () => {
      const markdownStrategy = createMockStrategy('markdown', 1);
      const semanticStrategy = createMockStrategy('semantic', 2);
      const lineStrategy = createMockStrategy('line', 3);
      
      contextManager.addStrategy(markdownStrategy);
      contextManager.addStrategy(semanticStrategy);
      contextManager.addStrategy(lineStrategy);
      
      const markdownContext: SegmentationContext = {
        content: '# Title\n\nContent',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 15,
          lineCount: 3,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: true
        }
      };
      
      const selectedStrategy = contextManager.selectStrategyWithHeuristics(markdownContext);
      expect(selectedStrategy.getName()).toBe('markdown');
    });

    it('should select line strategy for small files', () => {
      const semanticStrategy = createMockStrategy('semantic', 1);
      const lineStrategy = createMockStrategy('line', 2);
      
      contextManager.addStrategy(semanticStrategy);
      contextManager.addStrategy(lineStrategy);
      
      const smallFileContext: SegmentationContext = {
        content: 'small content',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 13,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };
      
      const selectedStrategy = contextManager.selectStrategyWithHeuristics(smallFileContext);
      expect(selectedStrategy.getName()).toBe('line');
    });

    it('should select semantic strategy for complex code', () => {
      const semanticStrategy = createMockStrategy('semantic', 1);
      const bracketStrategy = createMockStrategy('bracket', 2);
      
      contextManager.addStrategy(semanticStrategy);
      contextManager.addStrategy(bracketStrategy);
      
      const complexCodeContext: SegmentationContext = {
        content: `
function complexFunction() {
  if (condition) {
    for (let i = 0; i < 10; i++) {
      while (nested) {
        // Deep nesting
      }
    }
  }
}
        `.trim(),
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 150,
          lineCount: 10,
          isSmallFile: false,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };
      
      const selectedStrategy = contextManager.selectStrategyWithHeuristics(complexCodeContext);
      expect(selectedStrategy.getName()).toBe('semantic');
    });

    it('should select bracket strategy for simple code', () => {
      const semanticStrategy = createMockStrategy('semantic', 1);
      const bracketStrategy = createMockStrategy('bracket', 2);
      
      contextManager.addStrategy(semanticStrategy);
      contextManager.addStrategy(bracketStrategy);
      
      const simpleCodeContext: SegmentationContext = {
        content: 'const x = 1;',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };
      
      const selectedStrategy = contextManager.selectStrategyWithHeuristics(simpleCodeContext);
      expect(selectedStrategy.getName()).toBe('bracket');
    });

    it('should throw error when no suitable strategy found', () => {
      const strategy = createMockStrategy('test', 1, false);
      
      contextManager.addStrategy(strategy);
      
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      expect(() => contextManager.selectStrategyWithHeuristics(context)).toThrow('No suitable segmentation strategy found');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      const strategy = createMockStrategy('test', 1);
      
      contextManager.addStrategy(strategy);
      
      // Select a strategy to populate cache
      const context: SegmentationContext = {
        content: 'test',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };
      
      contextManager.selectStrategy(context);
      
      // Verify cache has entries
      let stats = contextManager.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Clear cache
      contextManager.clearCache();
      
      // Verify cache is empty
      stats = contextManager.getCacheStats();
      expect(stats.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Strategy cache cleared');
    });

    it('should get cache stats', () => {
      const strategy1 = createMockStrategy('test1', 1);
      const strategy2 = createMockStrategy('test2', 2);
      
      contextManager.addStrategy(strategy1);
      contextManager.addStrategy(strategy2);
      
      // Select strategies to populate cache
      const context1: SegmentationContext = {
        content: 'test1',
        language: 'javascript',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 5,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };
      
      const context2: SegmentationContext = {
        content: 'test2',
        language: 'python',
        options: mockConfigManager.getDefaultOptions(),
        metadata: {
          contentLength: 5,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };
      
      contextManager.selectStrategy(context1);
      contextManager.selectStrategy(context2);
      
      const stats = contextManager.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('javascript:code:small:plain:auto');
      expect(stats.keys).toContain('python:code:small:plain:auto');
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete workflow', async () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'code', complexity: 1 } },
        { content: 'chunk2', metadata: { startLine: 2, endLine: 2, language: 'javascript', type: 'code', complexity: 1 } }
      ];
      
      const strategy = createMockStrategy('test', 1);
      strategy.segment = jest.fn().mockResolvedValue(chunks);
      
      contextManager.addStrategy(strategy);
      
      const content = 'function test() { return 1; }';
      const context = contextManager.createSegmentationContext(content, 'test.js', 'javascript');
      
      const selectedStrategy = contextManager.selectStrategy(context);
      const result = await contextManager.executeStrategy(selectedStrategy, context);
      
      expect(result).toEqual(chunks);
      expect(selectedStrategy.getName()).toBe('test');
      expect(strategy.segment).toHaveBeenCalledWith(context);
    });

    it('should handle complex scenarios with multiple strategies', () => {
      const strategies = [
        createMockStrategy('markdown', 1),
        createMockStrategy('semantic', 2),
        createMockStrategy('bracket', 3),
        createMockStrategy('line', 4)
      ];
      
      strategies.forEach(strategy => contextManager.addStrategy(strategy));
      
      // Test different content types
      const testCases = [
        {
          content: '# Title\n\nContent',
          language: 'markdown',
          expectedStrategy: 'markdown'
        },
        {
          content: 'const x = 1;',
          language: 'javascript',
          expectedStrategy: 'line' // Small files use line strategy
        },
        {
          content: 'x'.repeat(1000), // Large content
          language: 'text',
          expectedStrategy: 'line' // Based on priority
        }
      ];
      
      testCases.forEach(testCase => {
        const context = contextManager.createSegmentationContext(
          testCase.content,
          `test.${testCase.language === 'markdown' ? 'md' : testCase.language}`,
          testCase.language
        );
        
        const selectedStrategy = contextManager.selectStrategyWithHeuristics(context);
        expect(selectedStrategy.getName()).toBe(testCase.expectedStrategy);
      });
    });
  });
});