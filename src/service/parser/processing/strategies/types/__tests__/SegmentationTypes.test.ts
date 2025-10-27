import {
  UniversalChunkingOptions,
  SegmentationContext,
  ISegmentationStrategy,
  ISegmentationProcessor,
  ISegmentationContextManager,
  IConfigurationManager,
  IProtectionCoordinator,
  ProtectionContext,
  ProtectionDecision,
  IProtectionInterceptor,
  IChunkFilter,
  IChunkRebalancer,
  ChunkFilterContext,
  ChunkRebalancerContext,
  FilterResult,
  RebalancerResult
} from '../SegmentationTypes';
import { CodeChunk } from '../../../types/splitting-types';

describe('SegmentationTypes', () => {
  describe('UniversalChunkingOptions', () => {
    it('should create valid options with default values', () => {
      const options: UniversalChunkingOptions = {
        maxChunkSize: 2000,
        overlapSize: 200,
        maxLinesPerChunk: 50,
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

      expect(options.maxChunkSize).toBe(2000);
      expect(options.overlapSize).toBe(200);
      expect(options.maxLinesPerChunk).toBe(50);
      expect(options.enableBracketBalance).toBe(true);
      expect(options.enableSemanticDetection).toBe(true);
      expect(options.enableCodeOverlap).toBe(false);
      expect(options.enableStandardization).toBe(true);
      expect(options.standardizationFallback).toBe(true);
      expect(options.maxOverlapRatio).toBe(0.3);
      expect(options.errorThreshold).toBe(5);
      expect(options.memoryLimitMB).toBe(500);
      expect(options.strategyPriorities).toBeDefined();
      expect(options.filterConfig).toBeDefined();
      expect(options.protectionConfig).toBeDefined();
    });

    it('should allow partial options', () => {
      const partialOptions: Partial<UniversalChunkingOptions> = {
        maxChunkSize: 1000,
        enableBracketBalance: false
      };

      expect(partialOptions.maxChunkSize).toBe(1000);
      expect(partialOptions.enableBracketBalance).toBe(false);
      expect(partialOptions.overlapSize).toBeUndefined();
    });
  });

  describe('SegmentationContext', () => {
    it('should create valid context', () => {
      const context: SegmentationContext = {
        content: 'test content',
        options: {
          maxChunkSize: 2000,
          overlapSize: 200,
          maxLinesPerChunk: 50,
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
        },
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      expect(context.content).toBe('test content');
      expect(context.options).toBeDefined();
      expect(context.metadata).toBeDefined();
      expect(context.metadata.contentLength).toBe(12);
      expect(context.metadata.lineCount).toBe(1);
      expect(context.metadata.isSmallFile).toBe(true);
      expect(context.metadata.isCodeFile).toBe(true);
      expect(context.metadata.isMarkdownFile).toBe(false);
    });
  });

  describe('ISegmentationStrategy', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockStrategy: ISegmentationStrategy = {
        getName: jest.fn().mockReturnValue('test'),
        getPriority: jest.fn().mockReturnValue(1),
        getSupportedLanguages: jest.fn().mockReturnValue(['javascript']),
        canHandle: jest.fn().mockReturnValue(true),
        segment: jest.fn().mockResolvedValue([])
      };

      expect(typeof mockStrategy.getName).toBe('function');
      expect(typeof mockStrategy.getPriority).toBe('function');
      expect(typeof mockStrategy.getSupportedLanguages).toBe('function');
      expect(typeof mockStrategy.canHandle).toBe('function');
      expect(typeof mockStrategy.segment).toBe('function');

      expect(mockStrategy.getName()).toBe('test');
      expect(mockStrategy.getPriority()).toBe(1);
      expect(mockStrategy.getSupportedLanguages?.()).toEqual(['javascript']);
      expect(mockStrategy.canHandle({} as SegmentationContext)).toBe(true);
    });
  });

  describe('ISegmentationProcessor', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockProcessor: ISegmentationProcessor = {
        getName: jest.fn().mockReturnValue('test'),
        shouldApply: jest.fn().mockReturnValue(true),
        process: jest.fn().mockResolvedValue([])
      };

      expect(typeof mockProcessor.getName).toBe('function');
      expect(typeof mockProcessor.shouldApply).toBe('function');
      expect(typeof mockProcessor.process).toBe('function');

      expect(mockProcessor.getName()).toBe('test');
      expect(mockProcessor.shouldApply([], {} as SegmentationContext)).toBe(true);
    });
  });

  describe('ISegmentationContextManager', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockContextManager: ISegmentationContextManager = {
        createSegmentationContext: jest.fn().mockReturnValue({} as SegmentationContext),
        selectStrategy: jest.fn().mockReturnValue({} as ISegmentationStrategy),
        executeStrategy: jest.fn().mockResolvedValue([]),
        getStrategies: jest.fn().mockReturnValue([]),
        addStrategy: jest.fn(),
        removeStrategy: jest.fn()
      };

      expect(typeof mockContextManager.createSegmentationContext).toBe('function');
      expect(typeof mockContextManager.selectStrategy).toBe('function');
      expect(typeof mockContextManager.executeStrategy).toBe('function');
      expect(typeof mockContextManager.getStrategies).toBe('function');

      expect(mockContextManager.createSegmentationContext('test', 'test.js', 'javascript', {} as UniversalChunkingOptions)).toBeDefined();
      expect(mockContextManager.getStrategies()).toEqual([]);
    });
  });

  describe('IConfigurationManager', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockConfigManager: IConfigurationManager = {
        getDefaultOptions: jest.fn().mockReturnValue({} as UniversalChunkingOptions),
        mergeOptions: jest.fn().mockReturnValue({} as UniversalChunkingOptions),
        validateOptions: jest.fn().mockReturnValue(true),
        getLanguageSpecificConfig: jest.fn().mockReturnValue({})
      };

      expect(typeof mockConfigManager.getDefaultOptions).toBe('function');
      expect(typeof mockConfigManager.mergeOptions).toBe('function');
      expect(typeof mockConfigManager.validateOptions).toBe('function');

      expect(mockConfigManager.getDefaultOptions()).toBeDefined();
      expect(mockConfigManager.validateOptions({} as UniversalChunkingOptions)).toBe(true);
    });
  });

  describe('IProtectionCoordinator', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockProtectionCoordinator: IProtectionCoordinator = {
        createProtectionContext: jest.fn().mockReturnValue({} as ProtectionContext),
        checkProtection: jest.fn().mockResolvedValue(true),
        setProtectionChain: jest.fn()
      };

      expect(typeof mockProtectionCoordinator.createProtectionContext).toBe('function');
      expect(typeof mockProtectionCoordinator.checkProtection).toBe('function');
      expect(typeof mockProtectionCoordinator.setProtectionChain).toBe('function');

      expect(mockProtectionCoordinator.createProtectionContext('test', {} as SegmentationContext)).toBeDefined();
    });
  });

  describe('ProtectionContext', () => {
    it('should create valid protection context', () => {
      const context: ProtectionContext = {
        operation: 'test_operation',
        filePath: 'test.js',
        content: 'test content',
        language: 'javascript',
        metadata: {
          contentLength: 12,
          lineCount: 1
        }
      };

      expect(context.operation).toBe('test_operation');
      expect(context.filePath).toBe('test.js');
      expect(context.content).toBe('test content');
      expect(context.language).toBe('javascript');
      expect(context.metadata).toBeDefined();
      expect(context.metadata?.contentLength).toBe(12);
      expect(context.metadata?.lineCount).toBe(1);
    });
  });

  describe('ProtectionDecision', () => {
    it('should create valid protection decision', () => {
      const decision: ProtectionDecision = {
        shouldProceed: true,
        reason: 'Test reason',
        metadata: {
          checkType: 'test',
          threshold: 0.5
        }
      };

      expect(decision.shouldProceed).toBe(true);
      expect(decision.reason).toBe('Test reason');
      expect(decision.metadata).toBeDefined();
      expect(decision.metadata?.checkType).toBe('test');
      expect(decision.metadata?.threshold).toBe(0.5);
    });
  });

  describe('IProtectionInterceptor', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockInterceptor: IProtectionInterceptor = {
        name: 'test',
        priority: 1,
        description: 'test description',
        intercept: jest.fn().mockResolvedValue({ allow: true, reason: 'test', shouldFallback: false }),
        isApplicable: jest.fn().mockReturnValue(true),
        isAvailable: jest.fn().mockReturnValue(true)
      };

      expect(mockInterceptor.name).toBe('test');
      expect(typeof mockInterceptor.intercept).toBe('function');
      expect(typeof mockInterceptor.isApplicable).toBe('function');
      expect(typeof mockInterceptor.isAvailable).toBe('function');

      expect(mockInterceptor.name).toBe('test');
    });
  });

  describe('IChunkFilter', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockFilter: IChunkFilter = {
        getName: jest.fn().mockReturnValue('test'),
        shouldApply: jest.fn().mockReturnValue(true),
        filter: jest.fn().mockResolvedValue({ chunks: [], filtered: 0 })
      };

      expect(typeof mockFilter.getName).toBe('function');
      expect(typeof mockFilter.shouldApply).toBe('function');
      expect(typeof mockFilter.filter).toBe('function');

      expect(mockFilter.getName()).toBe('test');
      expect(mockFilter.shouldApply([], {} as ChunkFilterContext)).toBe(true);
    });
  });

  describe('IChunkRebalancer', () => {
    it('should define required methods', () => {
      // Create a mock implementation
      const mockRebalancer: IChunkRebalancer = {
        getName: jest.fn().mockReturnValue('test'),
        shouldApply: jest.fn().mockReturnValue(true),
        rebalance: jest.fn().mockResolvedValue({ chunks: [], rebalanced: 0 })
      };

      expect(typeof mockRebalancer.getName).toBe('function');
      expect(typeof mockRebalancer.shouldApply).toBe('function');
      expect(typeof mockRebalancer.rebalance).toBe('function');

      expect(mockRebalancer.getName()).toBe('test');
      expect(mockRebalancer.shouldApply([], {} as ChunkRebalancerContext)).toBe(true);
    });
  });

  describe('ChunkFilterContext', () => {
    it('should create valid chunk filter context', () => {
      const context: ChunkFilterContext = {
        chunks: [
          {
            content: 'test content',
            metadata: {
              startLine: 1,
              endLine: 1,
              language: 'javascript',
              filePath: 'test.js',
              type: 'code',
              complexity: 1
            }
          }
        ],
        options: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        },
        metadata: {
          totalChunks: 1,
          averageChunkSize: 12
        }
      };

      expect(context.chunks).toHaveLength(1);
      expect(context.chunks[0].content).toBe('test content');
      expect(context.options).toBeDefined();
      expect(context.options.enableSmallChunkFilter).toBe(true);
      expect(context.metadata).toBeDefined();
      expect(context.metadata.totalChunks).toBe(1);
      expect(context.metadata.averageChunkSize).toBe(12);
    });
  });

  describe('ChunkRebalancerContext', () => {
    it('should create valid chunk rebalancer context', () => {
      const context: ChunkRebalancerContext = {
        chunks: [
          {
            content: 'test content',
            metadata: {
              startLine: 1,
              endLine: 1,
              language: 'javascript',
              filePath: 'test.js',
              type: 'code',
              complexity: 1
            }
          }
        ],
        options: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        },
        metadata: {
          totalChunks: 1,
          averageChunkSize: 12
        }
      };

      expect(context.chunks).toHaveLength(1);
      expect(context.chunks[0].content).toBe('test content');
      expect(context.options).toBeDefined();
      expect(context.options.enableChunkRebalancing).toBe(true);
      expect(context.metadata).toBeDefined();
      expect(context.metadata.totalChunks).toBe(1);
      expect(context.metadata.averageChunkSize).toBe(12);
    });
  });

  describe('FilterResult', () => {
    it('should create valid filter result', () => {
      const result: FilterResult = {
        chunks: [
          {
            content: 'filtered content',
            metadata: {
              startLine: 1,
              endLine: 1,
              language: 'javascript',
              filePath: 'test.js',
              type: 'code',
              complexity: 1
            }
          }
        ],
        filtered: 1,
        metadata: {
          filterReason: 'Too small',
          originalSize: 10,
          filteredSize: 5
        }
      };

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe('filtered content');
      expect(result.filtered).toBe(1);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.filterReason).toBe('Too small');
      expect(result.metadata?.originalSize).toBe(10);
      expect(result.metadata?.filteredSize).toBe(5);
    });
  });

  describe('RebalancerResult', () => {
    it('should create valid rebalancer result', () => {
      const result: RebalancerResult = {
        chunks: [
          {
            content: 'rebalanced content',
            metadata: {
              startLine: 1,
              endLine: 1,
              language: 'javascript',
              filePath: 'test.js',
              type: 'code',
              complexity: 1
            }
          }
        ],
        rebalanced: 1,
        metadata: {
          rebalanceReason: 'Too small',
          originalSize: 10,
          rebalancedSize: 15
        }
      };

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe('rebalanced content');
      expect(result.rebalanced).toBe(1);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rebalanceReason).toBe('Too small');
      expect(result.metadata?.originalSize).toBe(10);
      expect(result.metadata?.rebalancedSize).toBe(15);
    });
  });

  describe('Type Compatibility', () => {
    it('should ensure type compatibility between interfaces', () => {
      // Test that interfaces can be used together
      const strategy: ISegmentationStrategy = {
        getName: () => 'test',
        getPriority: () => 1,
        getSupportedLanguages: () => ['javascript'],
        canHandle: () => true,
        segment: async () => []
      };

      const processor: ISegmentationProcessor = {
        getName: () => 'test',
        shouldApply: () => true,
        process: async (chunks) => chunks
      };

      const context: SegmentationContext = {
        content: 'test',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      // These should compile without errors
      const canHandle = strategy.canHandle(context);
      const shouldApply = processor.shouldApply([], context);

      expect(canHandle).toBe(true);
      expect(shouldApply).toBe(true);
    });
  });
});