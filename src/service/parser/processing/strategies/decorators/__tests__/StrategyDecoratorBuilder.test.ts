import { 
  StrategyDecoratorBuilder, 
  DecoratorFactory,
  DecoratorOptions 
} from '../StrategyDecoratorBuilder';
import { OverlapDecorator } from '../OverlapDecorator';
import { PerformanceMonitorDecorator } from '../PerformanceMonitorDecorator';
import { CacheDecorator } from '../CacheDecorator';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../types';

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

describe('StrategyDecoratorBuilder', () => {
  let mockStrategy: MockStrategy;
  let mockCalculator: MockOverlapCalculator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    mockCalculator = new MockOverlapCalculator();
  });
  
  describe('builder pattern', () => {
    it('should build strategy without decorators', () => {
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const result = builder.build();
      
      expect(result).toBe(mockStrategy);
    });
    
    it('should build strategy with overlap decorator', () => {
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const result = builder.withOverlap(mockCalculator).build();
      
      expect(result).toBeInstanceOf(OverlapDecorator);
      expect(result.getName()).toBe('test_strategy_with_overlap');
    });
    
    it('should build strategy with performance monitor decorator', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const result = builder.withPerformanceMonitor(mockLogger).build();
      
      expect(result).toBeInstanceOf(PerformanceMonitorDecorator);
      expect(result.getName()).toBe('test_strategy_monitored');
    });
    
    it('should build strategy with cache decorator', () => {
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const result = builder.withCache(50, 60000).build();
      
      expect(result).toBeInstanceOf(CacheDecorator);
      expect(result.getName()).toBe('test_strategy_cached');
    });
    
    it('should build strategy with all decorators', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const result = builder
        .withOverlap(mockCalculator)
        .withPerformanceMonitor(mockLogger)
        .withCache(50, 60000)
        .build();
      
      // Should be wrapped in the correct order: Cache -> Overlap -> Performance
      expect(result.getName()).toBe('test_strategy_with_overlap_monitored_cached');
    });
    
    it('should build strategy with all decorators using convenience method', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const result = builder.withAllDecorators(mockCalculator, mockLogger).build();
      
      expect(result.getName()).toBe('test_strategy_with_overlap_monitored_cached');
    });
  });
  
  describe('decorator options', () => {
    it('should use default options when not specified', () => {
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      const options = builder.getOptions();
      
      expect(options.overlap?.enabled).toBe(false);
      expect(options.cache?.enabled).toBe(false);
      expect(options.performance?.enabled).toBe(false);
    });
    
    it('should use custom options when provided', () => {
      const customOptions: DecoratorOptions = {
        overlap: { enabled: true, calculator: mockCalculator },
        cache: { enabled: true, maxSize: 200, ttl: 600000 },
        performance: { enabled: true, logger: { debug: jest.fn() } }
      };
      
      const builder = new StrategyDecoratorBuilder(mockStrategy, customOptions);
      const options = builder.getOptions();
      
      expect(options.overlap?.enabled).toBe(true);
      expect(options.cache?.enabled).toBe(true);
      expect(options.performance?.enabled).toBe(true);
      expect(options.cache?.maxSize).toBe(200);
      expect(options.cache?.ttl).toBe(600000);
    });
    
    it('should reset options', () => {
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      builder.withOverlap(mockCalculator).withCache();
      
      let options = builder.getOptions();
      expect(options.overlap?.enabled).toBe(true);
      expect(options.cache?.enabled).toBe(true);
      
      builder.reset();
      options = builder.getOptions();
      expect(options.overlap?.enabled).toBe(false);
      expect(options.cache?.enabled).toBe(false);
    });
  });
  
  describe('decorator execution order', () => {
    it('should apply decorators in the correct order', async () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const builder = new StrategyDecoratorBuilder(mockStrategy);
      
      // Build with all decorators
      const decoratedStrategy = builder
        .withCache(10, 1000)
        .withOverlap(mockCalculator)
        .withPerformanceMonitor(mockLogger)
        .build();
      
      // Execute split
      const result = await decoratedStrategy.split('line1\nline2', 'javascript');
      
      expect(result).toHaveLength(2);
      // The overlap should be applied (content should be prefixed)
      expect(result[0].content).toBe('overlap_line1');
      expect(result[1].content).toBe('overlap_line2');
      
      // Performance stats should be tracked
      const perfStats = (decoratedStrategy as any).getPerformanceStats?.();
      if (perfStats) {
        expect(perfStats.splitCount).toBe(1);
      }
    });
  });
});

describe('DecoratorFactory', () => {
  let mockStrategy: MockStrategy;
  let mockCalculator: MockOverlapCalculator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    mockCalculator = new MockOverlapCalculator();
  });
  
  describe('factory methods', () => {
    it('should create fully decorated strategy', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const result = DecoratorFactory.createFullyDecoratedStrategy(
        mockStrategy,
        mockCalculator,
        mockLogger,
        { maxSize: 50, ttl: 60000 }
      );
      
      expect(result.getName()).toBe('test_strategy_with_overlap_monitored_cached');
    });
    
    it('should create cached strategy', () => {
      const result = DecoratorFactory.createCachedStrategy(
        mockStrategy,
        50,
        60000
      );
      
      expect(result).toBeInstanceOf(CacheDecorator);
      expect(result.getName()).toBe('test_strategy_cached');
    });
    
    it('should create overlap strategy', () => {
      const result = DecoratorFactory.createOverlapStrategy(
        mockStrategy,
        mockCalculator
      );
      
      expect(result).toBeInstanceOf(OverlapDecorator);
      expect(result.getName()).toBe('test_strategy_with_overlap');
    });
    
    it('should create monitored strategy', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const result = DecoratorFactory.createMonitoredStrategy(
        mockStrategy,
        mockLogger
      );
      
      expect(result).toBeInstanceOf(PerformanceMonitorDecorator);
      expect(result.getName()).toBe('test_strategy_monitored');
    });
  });
  
  describe('factory method defaults', () => {
    it('should use default cache options when not provided', () => {
      const result = DecoratorFactory.createFullyDecoratedStrategy(
        mockStrategy,
        mockCalculator
      );
      
      expect(result.getName()).toBe('test_strategy_with_overlap_monitored_cached');
    });
    
    it('should use default logger when not provided', () => {
      const result = DecoratorFactory.createMonitoredStrategy(mockStrategy);
      
      expect(result).toBeInstanceOf(PerformanceMonitorDecorator);
      expect(result.getName()).toBe('test_strategy_monitored');
    });
  });
});