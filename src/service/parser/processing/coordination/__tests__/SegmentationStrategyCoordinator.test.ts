import { SegmentationStrategyCoordinator } from '../SegmentationStrategyCoordinator';
import { LoggerService } from '../../../../../utils/LoggerService';
import { PriorityManager } from '../../strategies/priority/PriorityManager';
import { FileFeatureDetector } from '../../detection/FileFeatureDetector';
import { SegmentationContextFactory } from '../SegmentationContextFactory';
import { ISegmentationStrategy, SegmentationContext, UniversalChunkingOptions } from '../../strategies/types/SegmentationTypes';
import { CodeChunk } from '../../types/splitting-types';

// Mock dependencies
jest.mock('../../../../../utils/LoggerService');
jest.mock('../../strategies/priority/PriorityManager');
jest.mock('../../detection/FileFeatureDetector');
jest.mock('../SegmentationContextFactory');

const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;
const MockPriorityManager = PriorityManager as jest.MockedClass<typeof PriorityManager>;
const MockFileFeatureDetector = FileFeatureDetector as jest.MockedClass<typeof FileFeatureDetector>;
const MockSegmentationContextFactory = SegmentationContextFactory as jest.Mocked<typeof SegmentationContextFactory>;

// Mock segmentation strategy
class MockSegmentationStrategy implements ISegmentationStrategy {
  constructor(
    private name: string,
    private supportedLanguages: string[] = ['javascript', 'typescript'],
    private canHandleResult: boolean = true
  ) {}

  getName(): string {
    return this.name;
  }

  canHandle(context: SegmentationContext): boolean {
    return this.canHandleResult;
  }

  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const lines = context.content.split('\n');
    return lines.map((line, index) => ({
      id: `chunk_${index}`,
      content: line,
      metadata: {
        startLine: index + 1,
        endLine: index + 1,
        language: context.language || 'unknown',
        filePath: context.filePath,
        type: 'line'
      }
    }));
  }

  getSupportedLanguages(): string[] {
    return this.supportedLanguages;
  }

  validateContext?(context: SegmentationContext): boolean {
    return context.content.length > 0;
  }
}

describe('SegmentationStrategyCoordinator', () => {
  let coordinator: SegmentationStrategyCoordinator;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockPriorityManager: jest.Mocked<PriorityManager>;
  let mockFileFeatureDetector: jest.Mocked<FileFeatureDetector>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockPriorityManager = new MockPriorityManager() as jest.Mocked<PriorityManager>;
    mockFileFeatureDetector = new MockFileFeatureDetector() as jest.Mocked<FileFeatureDetector>;

    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    mockPriorityManager.getPriority = jest.fn().mockReturnValue(1);
    mockPriorityManager.updatePerformance = jest.fn();
    mockPriorityManager.getPerformanceStats = jest.fn().mockReturnValue(new Map());
    mockPriorityManager.reloadConfig = jest.fn();

    mockFileFeatureDetector.calculateComplexity = jest.fn().mockReturnValue(15);

    MockSegmentationContextFactory.create = jest.fn().mockImplementation((content, filePath, language, options) => ({
      content,
      filePath,
      language,
      options: options || {},
      metadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        isSmallFile: content.length <= 10000,
        isCodeFile: language !== 'markdown',
        isMarkdownFile: language === 'markdown'
      }
    }));

    coordinator = new SegmentationStrategyCoordinator(mockLogger, undefined, mockPriorityManager);
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(coordinator).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('SegmentationStrategyCoordinator initialized with new priority system');
    });

    it('should initialize without optional dependencies', () => {
      const minimalCoordinator = new SegmentationStrategyCoordinator();
      expect(minimalCoordinator).toBeDefined();
    });
  });

  describe('addStrategy', () => {
    it('should add new strategy', () => {
      const strategy = new MockSegmentationStrategy('testStrategy');

      coordinator.addStrategy(strategy);

      const strategies = coordinator.getStrategies();
      expect(strategies).toContain(strategy);
      expect(mockLogger.debug).toHaveBeenCalledWith('Added new strategy: testStrategy');
    });

    it('should replace existing strategy with same name', () => {
      const strategy1 = new MockSegmentationStrategy('testStrategy');
      const strategy2 = new MockSegmentationStrategy('testStrategy');

      coordinator.addStrategy(strategy1);
      coordinator.addStrategy(strategy2);

      const strategies = coordinator.getStrategies();
      expect(strategies).toHaveLength(1);
      expect(strategies[0]).toBe(strategy2);
      expect(mockLogger.debug).toHaveBeenCalledWith('Replaced existing strategy: testStrategy');
    });

    it('should clear strategy cache when adding new strategy', () => {
      const strategy = new MockSegmentationStrategy('testStrategy');
      
      // Add strategy and verify cache is cleared
      coordinator.addStrategy(strategy);
      
      // The cache clearing is internal, but we can verify the debug log
      expect(mockLogger.debug).toHaveBeenCalledWith('Added new strategy: testStrategy');
    });
  });

  describe('removeStrategy', () => {
    it('should remove existing strategy', () => {
      const strategy = new MockSegmentationStrategy('testStrategy');
      coordinator.addStrategy(strategy);

      coordinator.removeStrategy('testStrategy');

      const strategies = coordinator.getStrategies();
      expect(strategies).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Removed strategy: testStrategy');
    });

    it('should warn when trying to remove non-existent strategy', () => {
      coordinator.removeStrategy('nonExistent');

      expect(mockLogger.warn).toHaveBeenCalledWith('Strategy not found for removal: nonExistent');
    });
  });

  describe('selectStrategy', () => {
    beforeEach(() => {
      // Add multiple strategies for testing selection
      coordinator.addStrategy(new MockSegmentationStrategy('semantic', ['javascript', 'typescript'], true));
      coordinator.addStrategy(new MockSegmentationStrategy('bracket', ['javascript', 'typescript'], true));
      coordinator.addStrategy(new MockSegmentationStrategy('line', ['javascript', 'typescript'], true));
    });

    it('should select strategy using cache', () => {
      const context: SegmentationContext = {
        content: 'test content',
        filePath: '/path/file.js',
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      // First selection should not use cache
      const strategy1 = coordinator.selectStrategy(context);
      expect(strategy1.getName()).toBe('semantic'); // Based on priority

      // Second selection should use cache
      const strategy2 = coordinator.selectStrategy(context);
      expect(strategy2.getName()).toBe('semantic');
    });

    it('should select preferred strategy when specified', () => {
      const context: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const strategy = coordinator.selectStrategy(context, 'bracket');

      expect(strategy.getName()).toBe('bracket');
      expect(mockLogger.debug).toHaveBeenCalledWith('Using preferred strategy: bracket');
    });

    it('should throw error when no suitable strategy found', () => {
      const context: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: 'unknown-language',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      // Remove all strategies
      coordinator.removeStrategy('semantic');
      coordinator.removeStrategy('bracket');
      coordinator.removeStrategy('line');

      expect(() => coordinator.selectStrategy(context)).toThrow('No suitable segmentation strategy found');
    });

    it('should use priority system for strategy selection', () => {
      const context: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      // Mock priority manager to return different priorities
      mockPriorityManager.getPriority
        .mockReturnValueOnce(1) // semantic
        .mockReturnValueOnce(2) // bracket
        .mockReturnValueOnce(3); // line

      const strategy = coordinator.selectStrategy(context);

      expect(strategy.getName()).toBe('semantic'); // Should select highest priority (lowest number)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selected strategy: semantic with priority 1')
      );
    });
  });

  describe('executeStrategy', () => {
    let mockStrategy: MockSegmentationStrategy;

    beforeEach(() => {
      mockStrategy = new MockSegmentationStrategy('testStrategy');
      coordinator.addStrategy(mockStrategy);
    });

    it('should execute strategy successfully', async () => {
      const context: SegmentationContext = {
        content: 'line1\nline2',
        filePath: '/path/file.js',
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 10,
          lineCount: 2,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const chunks = await coordinator.executeStrategy(mockStrategy, context);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe('line1');
      expect(chunks[1].content).toBe('line2');
      expect(mockPriorityManager.updatePerformance).toHaveBeenCalledWith('testStrategy', expect.any(Number), true);
    });

    it('should handle strategy validation failure', async () => {
      const failingStrategy = new MockSegmentationStrategy('failingStrategy');
      failingStrategy.validateContext = () => false;

      coordinator.addStrategy(failingStrategy);

      const context: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      await expect(coordinator.executeStrategy(failingStrategy, context))
        .rejects.toThrow('Context validation failed for strategy: failingStrategy');
    });

    it('should handle strategy execution failure with fallback', async () => {
      const failingStrategy = new MockSegmentationStrategy('failingStrategy');
      failingStrategy.segment = jest.fn().mockRejectedValue(new Error('Strategy failed'));

      const fallbackStrategy = new MockSegmentationStrategy('line');
      coordinator.addStrategy(failingStrategy);
      coordinator.addStrategy(fallbackStrategy);

      const context: SegmentationContext = {
        content: 'line1\nline2',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 10,
          lineCount: 2,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const chunks = await coordinator.executeStrategy(failingStrategy, context);

      expect(chunks).toHaveLength(2); // Should fallback to line strategy
      expect(mockLogger.warn).toHaveBeenCalledWith('Falling back to line-based segmentation');
      expect(mockPriorityManager.updatePerformance).toHaveBeenCalledWith('failingStrategy', 0, false);
    });

    it('should throw error when fallback strategy also fails', async () => {
      const failingStrategy = new MockSegmentationStrategy('failingStrategy');
      failingStrategy.segment = jest.fn().mockRejectedValue(new Error('Strategy failed'));

      // No fallback strategy available
      coordinator.addStrategy(failingStrategy);

      const context: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      await expect(coordinator.executeStrategy(failingStrategy, context))
        .rejects.toThrow('Strategy failed');
    });
  });

  describe('createSegmentationContext', () => {
    it('should create context with default options', () => {
      const content = 'test content';
      const filePath = '/path/file.js';
      const language = 'javascript';

      const context = coordinator.createSegmentationContext(content, filePath, language);

      expect(context.content).toBe(content);
      expect(context.filePath).toBe(filePath);
      expect(context.language).toBe(language);
      expect(context.options).toBeDefined();
      expect(MockSegmentationContextFactory.create).toHaveBeenCalled();
    });

    it('should create context with custom options', () => {
      const content = 'test content';
      const options: UniversalChunkingOptions = {
        maxChunkSize: 3000,
        overlapSize: 300,
        maxLinesPerChunk: 150,
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
      };

      const context = coordinator.createSegmentationContext(content, undefined, undefined, options);

      expect(context.options).toEqual(options);
    });
  });

  describe('selectStrategyWithHeuristics', () => {
    beforeEach(() => {
      coordinator.addStrategy(new MockSegmentationStrategy('markdown', ['markdown'], true));
      coordinator.addStrategy(new MockSegmentationStrategy('line', ['javascript'], true));
      coordinator.addStrategy(new MockSegmentationStrategy('semantic', ['javascript'], true));
      coordinator.addStrategy(new MockSegmentationStrategy('standardization', ['javascript'], true));
      coordinator.addStrategy(new MockSegmentationStrategy('bracket', ['javascript'], true));
    });

    it('should select markdown strategy for markdown files', () => {
      const context: SegmentationContext = {
        content: '# Title\n\nContent',
        filePath: undefined,
        language: 'markdown',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 15,
          lineCount: 3,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: true
        }
      };

      const strategy = coordinator.selectStrategyWithHeuristics(context);

      expect(strategy.getName()).toBe('markdown');
    });

    it('should select line strategy for small files', () => {
      const context: SegmentationContext = {
        content: 'small content',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 13,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const strategy = coordinator.selectStrategyWithHeuristics(context);

      expect(strategy.getName()).toBe('line');
    });

    it('should select semantic strategy for complex code', () => {
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(25); // High complexity

      const context: SegmentationContext = {
        content: 'complex code structure',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 22,
          lineCount: 1,
          isSmallFile: false,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const strategy = coordinator.selectStrategyWithHeuristics(context);

      expect(strategy.getName()).toBe('semantic');
    });

    it('should select bracket strategy for simple code', () => {
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(15); // Low complexity

      const context: SegmentationContext = {
        content: 'simple code',
        filePath: undefined,
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 11,
          lineCount: 1,
          isSmallFile: false,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const strategy = coordinator.selectStrategyWithHeuristics(context);

      expect(strategy.getName()).toBe('bracket');
    });
  });

  describe('getStrategyInfo', () => {
    it('should return strategy information', () => {
      coordinator.addStrategy(new MockSegmentationStrategy('strategy1', ['javascript']));
      coordinator.addStrategy(new MockSegmentationStrategy('strategy2', ['typescript']));

      const strategyInfo = coordinator.getStrategyInfo();

      expect(strategyInfo).toHaveLength(2);
      expect(strategyInfo[0]).toEqual({
        name: 'strategy1',
        priority: 1,
        supportedLanguages: ['javascript']
      });
      expect(strategyInfo[1]).toEqual({
        name: 'strategy2',
        priority: 1,
        supportedLanguages: ['typescript']
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear strategy cache', () => {
      coordinator.clearCache();

      expect(mockLogger.debug).toHaveBeenCalledWith('Strategy cache cleared');
    });

    it('should return cache statistics', () => {
      const cacheStats = coordinator.getCacheStats();

      expect(cacheStats).toEqual({
        size: 0,
        keys: []
      });
    });
  });

  describe('Performance Management', () => {
    it('should reload priority configuration', () => {
      coordinator.reloadPriorityConfig();

      expect(mockPriorityManager.reloadConfig).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Priority configuration reloaded');
    });

    it('should return performance statistics', () => {
      const performanceStats = coordinator.getPerformanceStats();

      expect(performanceStats).toBeInstanceOf(Map);
      expect(mockPriorityManager.getPerformanceStats).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete strategy lifecycle', async () => {
      // Add strategies
      const semanticStrategy = new MockSegmentationStrategy('semantic', ['javascript']);
      const lineStrategy = new MockSegmentationStrategy('line', ['javascript']);
      coordinator.addStrategy(semanticStrategy);
      coordinator.addStrategy(lineStrategy);

      // Create context
      const context = coordinator.createSegmentationContext(
        'function test() { return true; }',
        '/path/file.js',
        'javascript'
      );

      // Select strategy
      const selectedStrategy = coordinator.selectStrategy(context);

      // Execute strategy
      const chunks = await coordinator.executeStrategy(selectedStrategy, context);

      // Verify results
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('function test() { return true; }');

      // Get strategy info
      const strategyInfo = coordinator.getStrategyInfo();
      expect(strategyInfo).toHaveLength(2);

      // Clear cache and verify
      coordinator.clearCache();
      expect(mockLogger.debug).toHaveBeenCalledWith('Strategy cache cleared');
    });

    it('should handle multiple concurrent operations', async () => {
      const strategies = [
        new MockSegmentationStrategy('strategy1', ['javascript']),
        new MockSegmentationStrategy('strategy2', ['typescript']),
        new MockSegmentationStrategy('strategy3', ['python'])
      ];

      strategies.forEach(strategy => coordinator.addStrategy(strategy));

      const contexts = [
        coordinator.createSegmentationContext('content1', '/path1.js', 'javascript'),
        coordinator.createSegmentationContext('content2', '/path2.ts', 'typescript'),
        coordinator.createSegmentationContext('content3', '/path3.py', 'python')
      ];

      const promises = contexts.map(context => 
        coordinator.selectStrategyWithHeuristics(context)
      );

      const selectedStrategies = await Promise.all(promises);

      expect(selectedStrategies).toHaveLength(3);
      expect(selectedStrategies[0].getName()).toBe('strategy1');
      expect(selectedStrategies[1].getName()).toBe('strategy2');
      expect(selectedStrategies[2].getName()).toBe('strategy3');
    });
  });
});