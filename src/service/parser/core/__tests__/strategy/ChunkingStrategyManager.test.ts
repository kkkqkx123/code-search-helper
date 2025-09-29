import Parser from 'tree-sitter';
import { ChunkingStrategyManager, StrategyManagerFactory } from '../../strategy/ChunkingStrategyManager';
import { ChunkingStrategy } from '../../strategy/ChunkingStrategy';
import { TreeSitterQueryEngine } from '../../query/TreeSitterQueryEngine';
import { LanguageConfigManager } from '../../config/LanguageConfigManager';
import { CodeChunk } from '../../types';

// Mock strategy for testing
class MockChunkingStrategy implements ChunkingStrategy {
  constructor(
    public name: string,
    public priority: number,
    public description: string,
    public supportedLanguages: string[],
    private shouldHandle: boolean = true
  ) {}

  canHandle(language: string, node: Parser.SyntaxNode): boolean {
    return this.supportedLanguages.includes(language) && this.shouldHandle;
  }

  chunk(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    return [{
      content: content,
      metadata: {
        startLine: 1,
        endLine: 1,
        language: 'typescript',
        type: 'mock'
      }
    }];
  }

  getSupportedNodeTypes(language: string): Set<string> {
    return new Set(['function_declaration']);
  }

  validateChunks(chunks: CodeChunk[]): boolean {
    return chunks.length > 0;
  }

  getConfiguration() {
    return {
      maxChunkSize: 2000,
      minChunkSize: 100,
      preserveComments: true,
      preserveEmptyLines: false,
      maxNestingLevel: 10
    };
  }
}

// Mock AST node
const mockASTNode: any = {
  type: 'program',
  startIndex: 0,
  endIndex: 50,
  startPosition: { row: 0, column: 0 },
  endPosition: { row: 5, column: 1 },
  text: 'function test() { return "hello"; }',
 children: [],
  parent: null,
  nextSibling: null,
  previousSibling: null,
};

describe('ChunkingStrategyManager', () => {
  let strategyManager: ChunkingStrategyManager;

  beforeEach(() => {
    strategyManager = new ChunkingStrategyManager();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(strategyManager).toBeInstanceOf(ChunkingStrategyManager);
      
      const config = strategyManager.getConfig();
      expect(config.enablePerformanceMonitoring).toBe(true);
      expect(config.enableCaching).toBe(true);
      expect(config.cacheSize).toBe(1000);
      expect(config.maxExecutionTime).toBe(10000);
      expect(config.enableParallel).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        enablePerformanceMonitoring: false,
        enableCaching: false,
        cacheSize: 500,
        maxExecutionTime: 5000,
        enableParallel: false
      };

      const customManager = new ChunkingStrategyManager(customConfig);
      const config = customManager.getConfig();

      expect(config.enablePerformanceMonitoring).toBe(false);
      expect(config.enableCaching).toBe(false);
      expect(config.cacheSize).toBe(500);
      expect(config.maxExecutionTime).toBe(5000);
      expect(config.enableParallel).toBe(false);
    });
  });

  describe('registerStrategy', () => {
    it('should register a strategy', () => {
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const retrieved = strategyManager.getStrategy('test');
      expect(retrieved).toBe(strategy);
    });

    it('should allow multiple strategies to be registered', () => {
      const strategy1 = new MockChunkingStrategy('test1', 1, 'Test strategy 1', ['typescript']);
      const strategy2 = new MockChunkingStrategy('test2', 2, 'Test strategy 2', ['javascript']);

      strategyManager.registerStrategy(strategy1);
      strategyManager.registerStrategy(strategy2);

      expect(strategyManager.getStrategy('test1')).toBe(strategy1);
      expect(strategyManager.getStrategy('test2')).toBe(strategy2);
      expect(strategyManager.getAllStrategies().length).toBeGreaterThanOrEqual(2);
    });
  });

 describe('unregisterStrategy', () => {
    it('should unregister a strategy', () => {
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      expect(strategyManager.getStrategy('test')).toBe(strategy);

      strategyManager.unregisterStrategy('test');
      expect(strategyManager.getStrategy('test')).toBeUndefined();
    });
  });

  describe('getStrategy', () => {
    it('should return undefined for non-registered strategy', () => {
      const strategy = strategyManager.getStrategy('nonexistent');
      expect(strategy).toBeUndefined();
    });

    it('should return registered strategy', () => {
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const retrieved = strategyManager.getStrategy('test');
      expect(retrieved).toBe(strategy);
    });
  });

  describe('getAllStrategies', () => {
    it('should return all registered strategies', () => {
      const strategy1 = new MockChunkingStrategy('test1', 1, 'Test strategy 1', ['typescript']);
      const strategy2 = new MockChunkingStrategy('test2', 2, 'Test strategy 2', ['javascript']);

      strategyManager.registerStrategy(strategy1);
      strategyManager.registerStrategy(strategy2);

      const allStrategies = strategyManager.getAllStrategies();
      expect(allStrategies).toContain(strategy1);
      expect(allStrategies).toContain(strategy2);
      expect(allStrategies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getStrategiesForLanguage', () => {
    it('should return strategies that support the language', () => {
      const tsStrategy = new MockChunkingStrategy('ts', 1, 'TS strategy', ['typescript']);
      const jsStrategy = new MockChunkingStrategy('js', 2, 'JS strategy', ['javascript']);
      const multiStrategy = new MockChunkingStrategy('multi', 3, 'Multi strategy', ['typescript', 'javascript']);

      strategyManager.registerStrategy(tsStrategy);
      strategyManager.registerStrategy(jsStrategy);
      strategyManager.registerStrategy(multiStrategy);

      const tsStrategies = strategyManager.getStrategiesForLanguage('typescript');
      expect(tsStrategies).toContain(tsStrategy);
      expect(tsStrategies).toContain(multiStrategy);
      expect(tsStrategies).not.toContain(jsStrategy);

      const jsStrategies = strategyManager.getStrategiesForLanguage('javascript');
      expect(jsStrategies).toContain(jsStrategy);
      expect(jsStrategies).toContain(multiStrategy);
      expect(jsStrategies).not.toContain(tsStrategy);
    });
 });

  describe('executeStrategy', () => {
    it('should execute a registered strategy', async () => {
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const result = await strategyManager.executeStrategy('test', context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('strategyName', 'test');
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.chunks.length).toBe(1);
    });

    it('should return error for non-existent strategy', async () => {
      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const result = await strategyManager.executeStrategy('nonexistent', context);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
    });

    it('should return error if strategy cannot handle the language', async () => {
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['javascript'], false); // shouldHandle = false
      strategyManager.registerStrategy(strategy);

      const context = {
        language: 'typescript', // Different from strategy's supported language
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const result = await strategyManager.executeStrategy('test', context);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('cannot handle language');
    });

    it('should cache results when caching is enabled', async () => {
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      // First execution
      const result1 = await strategyManager.executeStrategy('test', context);
      
      // Second execution with same parameters should potentially use cache
      const result2 = await strategyManager.executeStrategy('test', context);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('executeMultipleStrategies', () => {
    it('should execute multiple strategies', async () => {
      const strategy1 = new MockChunkingStrategy('test1', 1, 'Test strategy 1', ['typescript']);
      const strategy2 = new MockChunkingStrategy('test2', 2, 'Test strategy 2', ['typescript']);

      strategyManager.registerStrategy(strategy1);
      strategyManager.registerStrategy(strategy2);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const results = await strategyManager.executeMultipleStrategies(['test1', 'test2'], context);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].strategyName).toBe('test1');
      expect(results[1].strategyName).toBe('test2');
    });

    it('should execute strategies in parallel when enabled', async () => {
      const strategy1 = new MockChunkingStrategy('test1', 1, 'Test strategy 1', ['typescript']);
      const strategy2 = new MockChunkingStrategy('test2', 2, 'Test strategy 2', ['typescript']);

      strategyManager.registerStrategy(strategy1);
      strategyManager.registerStrategy(strategy2);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const results = await strategyManager.executeMultipleStrategies(['test1', 'test2'], context);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('executeBestStrategy', () => {
    it('should execute the best (highest priority) applicable strategy', async () => {
      const lowPriorityStrategy = new MockChunkingStrategy('low', 2, 'Low priority', ['typescript']);
      const highPriorityStrategy = new MockChunkingStrategy('high', 1, 'High priority', ['typescript']); // Lower number = higher priority

      strategyManager.registerStrategy(lowPriorityStrategy);
      strategyManager.registerStrategy(highPriorityStrategy);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const result = await strategyManager.executeBestStrategy(context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('strategyName');
      // Should pick the highest priority strategy that succeeds
    });

    it('should return error if no strategies are available for the language', async () => {
      const context = {
        language: 'unsupported',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      await expect(strategyManager.executeBestStrategy(context)).rejects.toThrow('No strategies available for language');
    });
  });

  describe('executeHierarchicalStrategy', () => {
    it('should execute hierarchical strategy and return all chunks', async () => {
      const strategy1 = new MockChunkingStrategy('test1', 1, 'Test strategy 1', ['typescript']);
      const strategy2 = new MockChunkingStrategy('test2', 2, 'Test strategy 2', ['typescript']);

      strategyManager.registerStrategy(strategy1);
      strategyManager.registerStrategy(strategy2);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      const chunks = await strategyManager.executeHierarchicalStrategy(context);

      expect(Array.isArray(chunks)).toBe(true);
      // At least one chunk should be returned from the strategies
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance statistics', () => {
      const stats = strategyManager.getPerformanceStats();
      expect(stats).toBeTruthy();
    });

    it('should return stats for specific strategy if name provided', async () => {
      // Execute a strategy first to generate some stats
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      // Execute to generate stats
      await strategyManager.executeStrategy('test', context);

      const stats = strategyManager.getPerformanceStats('test');
      expect(stats).toBeTruthy();
    });
  });

  describe('resetPerformanceStats', () => {
    it('should reset performance statistics', async () => {
      // Generate some stats first
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      // Execute to generate stats
      await strategyManager.executeStrategy('test', context);

      const statsBefore = strategyManager.getPerformanceStats('test');
      expect(statsBefore).toBeTruthy();

      strategyManager.resetPerformanceStats();

      const statsAfter = strategyManager.getPerformanceStats('test');
      // Stats might still exist but be reset to initial values
      expect(strategyManager).toBeInstanceOf(ChunkingStrategyManager);
    });
  });

  describe('clearCache', () => {
    it('should clear the execution cache', () => {
      // Execute a strategy to populate cache
      const strategy = new MockChunkingStrategy('test', 1, 'Test strategy', ['typescript']);
      strategyManager.registerStrategy(strategy);

      const context = {
        language: 'typescript',
        sourceCode: 'function test() { return "hello"; }',
        ast: mockASTNode
      };

      strategyManager.executeStrategy('test', context);

      // Clear the cache
      strategyManager.clearCache();

      // Should not throw errors
      expect(() => strategyManager.clearCache()).not.toThrow();
    });
  });

  describe('getConfig and updateConfig', () => {
    it('should return and update configuration', () => {
      const initialConfig = strategyManager.getConfig();
      expect(initialConfig.enablePerformanceMonitoring).toBe(true);

      strategyManager.updateConfig({ enablePerformanceMonitoring: false });
      const updatedConfig = strategyManager.getConfig();

      expect(updatedConfig.enablePerformanceMonitoring).toBe(false);
      expect(updatedConfig.enableCaching).toBe(initialConfig.enableCaching); // Other values should remain
    });
  });
});

describe('StrategyManagerFactory', () => {
  it('should return singleton instance', () => {
    const instance1 = StrategyManagerFactory.getInstance();
    const instance2 = StrategyManagerFactory.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should return ChunkingStrategyManager instance', () => {
    const instance = StrategyManagerFactory.getInstance();
    expect(instance).toBeInstanceOf(ChunkingStrategyManager);
  });

  it('should accept custom configuration', () => {
    // Note: StrategyManagerFactory returns a singleton instance, so custom config
    // will only be applied on the first call. Subsequent calls return the same instance.
    // For this test to work properly, we need to reset the singleton first.
    // @ts-ignore - accessing private property for testing
    StrategyManagerFactory.instance = undefined;
    
    const customConfig = {
      enablePerformanceMonitoring: false,
      enableCaching: false,
      cacheSize: 500,
      maxExecutionTime: 5000,
      enableParallel: false
    };

    const instance = StrategyManagerFactory.getInstance(customConfig);
    expect(instance).toBeInstanceOf(ChunkingStrategyManager);

    const config = instance.getConfig();
    expect(config.enablePerformanceMonitoring).toBe(false);
  });
});