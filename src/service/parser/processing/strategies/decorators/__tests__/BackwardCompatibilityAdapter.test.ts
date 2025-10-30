import { 
  BackwardCompatibilityAdapter,
  LegacyDecoratorBuilder,
  LegacySplitStrategyFactory,
  MigrationHelper
} from '../BackwardCompatibilityAdapter';
import { OverlapDecorator } from '../OverlapDecorator';
import { PerformanceMonitorDecorator } from '../PerformanceMonitorDecorator';
import { CacheDecorator } from '../CacheDecorator';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../../types/core-types';

// Mock strategy
class MockStrategy implements ISplitStrategy {
  constructor(private name: string, private priority: number = 1) {}
  
  getName(): string {
    return this.name;
  }
  
  supportsLanguage(language: string): boolean {
    return true;
  }
  
  getPriority(): number {
    return this.priority;
  }

  getDescription(): string {
    return `Mock strategy: ${this.name}`;
  }
  
  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
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

// Mock overlap calculator
class MockOverlapCalculator {
  async addOverlap(chunks: CodeChunk[], content: string): Promise<CodeChunk[]> {
    return chunks.map(chunk => ({
      ...chunk,
      content: `overlap_${chunk.content}`
    }));
  }
}

// Mock factory
class MockModernFactory {
  createStrategyFromType(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    return new MockStrategy(strategyType);
  }
}

describe('BackwardCompatibilityAdapter', () => {
  let mockStrategy: MockStrategy;
  let mockCalculator: MockOverlapCalculator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    mockCalculator = new MockOverlapCalculator();
  });
  
  describe('legacy decorator creation', () => {
    it('should create legacy overlap decorator', () => {
      const decorator = BackwardCompatibilityAdapter.createLegacyOverlapDecorator(
        mockStrategy,
        mockCalculator
      );
      
      expect(decorator).toBeInstanceOf(OverlapDecorator);
      expect(decorator.getName()).toBe('test_strategy_with_overlap');
    });
    
    it('should create legacy performance monitor decorator', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const decorator = BackwardCompatibilityAdapter.createLegacyPerformanceMonitorDecorator(
        mockStrategy,
        mockLogger
      );
      
      expect(decorator).toBeInstanceOf(PerformanceMonitorDecorator);
      expect(decorator.getName()).toBe('test_strategy_monitored');
    });
    
    it('should create legacy cache decorator', () => {
      const decorator = BackwardCompatibilityAdapter.createLegacyCacheDecorator(
        mockStrategy,
        50,
        60000
      );
      
      expect(decorator).toBeInstanceOf(CacheDecorator);
      expect(decorator.getName()).toBe('test_strategy_cached');
    });
    
    it('should create legacy decorator builder', () => {
      const builder = BackwardCompatibilityAdapter.createLegacyDecoratorBuilder(mockStrategy);
      
      expect(builder).toBeInstanceOf(LegacyDecoratorBuilder);
    });
  });
});

describe('LegacyDecoratorBuilder', () => {
  let mockStrategy: MockStrategy;
  let mockCalculator: MockOverlapCalculator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    mockCalculator = new MockOverlapCalculator();
  });
  
  describe('builder pattern compatibility', () => {
    it('should build strategy with overlap decorator', () => {
      const builder = new LegacyDecoratorBuilder(mockStrategy);
      const result = builder.withOverlap(mockCalculator).build();
      
      expect(result.getName()).toBe('test_strategy_with_overlap');
    });
    
    it('should build strategy with performance monitor decorator', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const builder = new LegacyDecoratorBuilder(mockStrategy);
      const result = builder.withPerformanceMonitor(mockLogger).build();
      
      expect(result.getName()).toBe('test_strategy_monitored');
    });
    
    it('should build strategy with cache decorator', () => {
      const builder = new LegacyDecoratorBuilder(mockStrategy);
      const result = builder.withCache(50, 60000).build();
      
      expect(result.getName()).toBe('test_strategy_cached');
    });
    
    it('should build strategy with multiple decorators', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const builder = new LegacyDecoratorBuilder(mockStrategy);
      const result = builder
        .withOverlap(mockCalculator)
        .withPerformanceMonitor(mockLogger)
        .withCache(50, 60000)
        .build();
      
      expect(result.getName()).toBe('test_strategy_with_overlap_monitored_cached');
    });
  });
  
  describe('functional compatibility', () => {
    it('should work with actual split operations', async () => {
      const builder = new LegacyDecoratorBuilder(mockStrategy);
      const decoratedStrategy = builder
        .withOverlap(mockCalculator)
        .withCache()
        .build();
      
      const content = 'line1\nline2\nline3';
      const result = await decoratedStrategy.split(content, 'javascript');
      
      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('line1');
      expect(result[1].content).toBe('overlap_line2');
      expect(result[2].content).toBe('overlap_line3');
    });
  });
});

describe('LegacySplitStrategyFactory', () => {
  let mockFactory: MockModernFactory;
  let legacyFactory: LegacySplitStrategyFactory;
  
  beforeEach(() => {
    mockFactory = new MockModernFactory();
    legacyFactory = new LegacySplitStrategyFactory(mockFactory);
  });
  
  describe('strategy creation compatibility', () => {
    it('should create basic strategy', () => {
      const strategy = legacyFactory.createStrategy('test_strategy');
      
      expect(strategy.getName()).toBe('test_strategy');
    });
    
    it('should create strategy with options', () => {
      const options: ChunkingOptions = { basic: { maxChunkSize: 100 } };
      const strategy = legacyFactory.createStrategy('test_strategy', options);
      
      expect(strategy.getName()).toBe('test_strategy');
    });
    
    it('should create decorated strategy', () => {
      const mockCalculator = new MockOverlapCalculator();
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      
      const strategy = legacyFactory.createDecoratedStrategy(
        'test_strategy',
        { basic: { maxChunkSize: 100 } },
        mockCalculator,
        true, // enableCache
        true, // enablePerformance
        mockLogger
      );
      
      expect(strategy.getName()).toBe('test_strategy_with_overlap_monitored_cached');
    });
    
    it('should create strategy with only some decorators', () => {
      const mockCalculator = new MockOverlapCalculator();
      
      const strategy = legacyFactory.createDecoratedStrategy(
        'test_strategy',
        undefined,
        mockCalculator,
        false, // enableCache
        false, // enablePerformance
        undefined
      );
      
      expect(strategy.getName()).toBe('test_strategy_with_overlap');
    });
  });
});

describe('MigrationHelper', () => {
  describe('deprecated usage detection', () => {
    it('should detect deprecated OverlapDecorator usage', () => {
      const usage = 'new OverlapDecorator(strategy, calculator)';
      const result = MigrationHelper.checkDeprecatedUsage(usage);
      
      expect(result.isDeprecated).toBe(true);
      expect(result.suggestion).toContain('StrategyDecoratorBuilder');
    });
    
    it('should detect deprecated PerformanceMonitorDecorator usage', () => {
      const usage = 'new PerformanceMonitorDecorator(strategy, logger)';
      const result = MigrationHelper.checkDeprecatedUsage(usage);
      
      expect(result.isDeprecated).toBe(true);
      expect(result.suggestion).toContain('StrategyDecoratorBuilder');
    });
    
    it('should detect deprecated CacheDecorator usage', () => {
      const usage = 'new CacheDecorator(strategy, maxSize, ttl)';
      const result = MigrationHelper.checkDeprecatedUsage(usage);
      
      expect(result.isDeprecated).toBe(true);
      expect(result.suggestion).toContain('StrategyDecoratorBuilder');
    });
    
    it('should detect deprecated SplitStrategyDecoratorBuilder usage', () => {
      const usage = 'new SplitStrategyDecoratorBuilder(strategy)';
      const result = MigrationHelper.checkDeprecatedUsage(usage);
      
      expect(result.isDeprecated).toBe(true);
      expect(result.suggestion).toContain('StrategyDecoratorBuilder');
    });
    
    it('should not detect non-deprecated usage', () => {
      const usage = 'new StrategyDecoratorBuilder(strategy)';
      const result = MigrationHelper.checkDeprecatedUsage(usage);
      
      expect(result.isDeprecated).toBe(false);
      expect(result.suggestion).toBe('');
    });
  });
  
  describe('migration guide generation', () => {
    it('should generate migration guide', () => {
      const guide = MigrationHelper.generateMigrationGuide();
      
      expect(guide).toContain('# 装饰器API迁移指南');
      expect(guide).toContain('## 已弃用的API');
      expect(guide).toContain('## 新功能');
      expect(guide).toContain('## 迁移步骤');
      expect(guide).toContain('## 兼容性');
    });
  });
});

describe('Integration Tests', () => {
  it('should maintain compatibility with existing code patterns', async () => {
    // Simulate existing code pattern
    const strategy = new MockStrategy('existing_strategy');
    const calculator = new MockOverlapCalculator();
    const logger = { debug: jest.fn(), error: jest.fn() };
    
    // Old pattern (should still work)
    const legacyBuilder = BackwardCompatibilityAdapter.createLegacyDecoratorBuilder(strategy);
    const decoratedStrategy = legacyBuilder
      .withOverlap(calculator)
      .withPerformanceMonitor(logger)
      .withCache()
      .build();
    
    const content = 'line1\nline2';
    const result = await decoratedStrategy.split(content, 'javascript');
    
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe('overlap_line2');
    expect(logger.debug).toHaveBeenCalled();
  });
});