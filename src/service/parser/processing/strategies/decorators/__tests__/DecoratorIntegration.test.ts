import { 
  StrategyDecoratorBuilder, 
  DecoratorFactory 
} from '../StrategyDecoratorBuilder';
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
  
  private callCount = 0;
  
  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    this.callCount++;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 5));
    
    const lines = content.split('\n');
    return lines.map((line, index) => ({
      id: `chunk_${index}_${this.callCount}`,
      content: line,
      metadata: {
        startLine: index + 1,
        endLine: index + 1,
        language,
        filePath,
        type: 'line',
        callCount: this.callCount
      }
    }));
  }
  
  getCallCount(): number {
    return this.callCount;
  }
}

// Mock overlap calculator
class MockOverlapCalculator {
  async addOverlap(chunks: CodeChunk[], content: string): Promise<CodeChunk[]> {
    return chunks.map((chunk, index) => ({
      ...chunk,
      content: index > 0 ? `overlap_${chunk.content}` : chunk.content,
      metadata: {
        ...chunk.metadata,
        hasOverlap: index > 0
      }
    }));
  }
}

// Mock logger
class MockLogger {
  public debugMessages: string[] = [];
  public errorMessages: string[] = [];
  
  debug(message: string): void {
    this.debugMessages.push(message);
  }
  
  error(message: string, error?: any): void {
    this.errorMessages.push(message);
  }
}

describe('Decorator Integration Tests', () => {
  let mockStrategy: MockStrategy;
  let mockCalculator: MockOverlapCalculator;
  let mockLogger: MockLogger;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('integration_test_strategy');
    mockCalculator = new MockOverlapCalculator();
    mockLogger = new MockLogger();
  });
  
  describe('full decorator chain', () => {
    it('should work with all decorators applied', async () => {
      const decoratedStrategy = new StrategyDecoratorBuilder(mockStrategy)
        .withCache(10, 1000)
        .withOverlap(mockCalculator)
        .withPerformanceMonitor(mockLogger)
        .build();
      
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      const filePath = 'test.js';
      const options = { basic: { maxChunkSize: 4 } }; // Small size to trigger overlap
      
      // First call
      const result1 = await decoratedStrategy.split(content, language, filePath, options);
      expect(result1).toHaveLength(3);
      expect(result1[0].content).toBe('line1');
      expect(result1[1].content).toBe('overlap_line2');
      expect(result1[2].content).toBe('overlap_line3');
      expect(result1[0].metadata.callCount).toBe(1);
      
      // Second call should use cache
      const result2 = await decoratedStrategy.split(content, language, filePath, options);
      expect(result2).toHaveLength(3);
      expect(result2[0].metadata.callCount).toBe(1); // Should be same as first call
      
      // Strategy should only be called once
      expect(mockStrategy.getCallCount()).toBe(1);
      
      // Performance should be monitored
      const perfStats = (decoratedStrategy as any).getPerformanceStats?.();
      if (perfStats) {
        expect(perfStats.splitCount).toBe(2); // Both calls counted
      }
      
      // Cache should have hits
      const cacheStats = (decoratedStrategy as any).getCacheStats?.();
      if (cacheStats) {
        expect(cacheStats.cacheHits).toBe(1);
        expect(cacheStats.cacheMisses).toBe(1);
      }
    });
    
    it('should handle different content correctly', async () => {
      const decoratedStrategy = DecoratorFactory.createFullyDecoratedStrategy(
        mockStrategy,
        mockCalculator,
        mockLogger
      );
      
      const content1 = 'content1\ncontent2';
      const content2 = 'content3\ncontent4';
      
      const result1 = await decoratedStrategy.split(content1, 'javascript');
      const result2 = await decoratedStrategy.split(content2, 'javascript');
      
      expect(result1[0].content).toBe('content1');
      expect(result2[0].content).toBe('content3');
      
      // Strategy should be called twice for different content
      expect(mockStrategy.getCallCount()).toBe(2);
    });
  });
  
  describe('decorator interaction', () => {
    it('should handle cache miss with overlap correctly', async () => {
      const decoratedStrategy = new StrategyDecoratorBuilder(mockStrategy)
        .withCache(5, 1000)
        .withOverlap(mockCalculator)
        .build();
      
      const content = 'line1\nline2';
      const options = { basic: { maxChunkSize: 4 } }; // Small size to trigger overlap
      
      // First call (cache miss)
      const result1 = await decoratedStrategy.split(content, 'javascript', undefined, options);
      expect(result1[0].content).toBe('line1');
      expect(result1[1].content).toBe('overlap_line2');
      
      // Second call (cache hit)
      const result2 = await decoratedStrategy.split(content, 'javascript', undefined, options);
      expect(result2[0].content).toBe('line1');
      expect(result2[1].content).toBe('overlap_line2');
      
      // Results should be identical
      expect(result1).toEqual(result2);
    });
    
    it('should handle performance monitoring with cache', async () => {
      const decoratedStrategy = new StrategyDecoratorBuilder(mockStrategy)
        .withCache(5, 1000)
        .withPerformanceMonitor(mockLogger)
        .build();
      
      const content = 'line1\nline2';
      
      // First call
      await decoratedStrategy.split(content, 'javascript');
      
      // Second call (cached)
      await decoratedStrategy.split(content, 'javascript');
      
      const perfStats = (decoratedStrategy as any).getPerformanceStats?.();
      if (perfStats) {
        expect(perfStats.splitCount).toBe(2);
        // Both calls should be counted, even cached ones
      }
    });
  });
  
  describe('error handling', () => {
    it('should handle errors in the base strategy', async () => {
      const errorStrategy = {
        getName: () => 'error_strategy',
        supportsLanguage: () => true,
        getPriority: () => 1,
        split: async () => {
          throw new Error('Test error');
        }
      } as ISplitStrategy;
      
      const decoratedStrategy = new StrategyDecoratorBuilder(errorStrategy)
        .withPerformanceMonitor(mockLogger)
        .build();
      
      try {
        await decoratedStrategy.split('content', 'javascript');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Test error');
      }
      
      expect(mockLogger.errorMessages).toHaveLength(1);
      expect(mockLogger.errorMessages[0]).toContain('error_strategy failed after');
    });
    
    it('should handle errors in overlap calculator', async () => {
      const errorCalculator = {
        addOverlap: async () => {
          throw new Error('Overlap error');
        }
      };
      
      const decoratedStrategy = new StrategyDecoratorBuilder(mockStrategy)
        .withOverlap(errorCalculator)
        .build();
      
      const options = { basic: { maxChunkSize: 4 } }; // Small size to trigger overlap
      
      try {
        await decoratedStrategy.split('line1\nline2', 'javascript', undefined, options);
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Overlap error');
      }
    });
  });
  
  describe('configuration', () => {
    it('should respect cache size limits', async () => {
      const decoratedStrategy = new StrategyDecoratorBuilder(mockStrategy)
        .withCache(2, 1000) // Small cache
        .build();
      
      // Fill cache beyond limit
      await decoratedStrategy.split('content1', 'javascript');
      await decoratedStrategy.split('content2', 'javascript');
      await decoratedStrategy.split('content3', 'javascript'); // Should evict content1
      
      // content1 should be evicted
      await decoratedStrategy.split('content2', 'javascript');
      await decoratedStrategy.split('content3', 'javascript');
      
      expect(mockStrategy.getCallCount()).toBe(3); // content1, content2, content3
    });
    
    it('should work with custom decorator options', async () => {
      const customOptions = {
        overlap: { enabled: true, calculator: mockCalculator },
        cache: { enabled: true, maxSize: 5, ttl: 500 },
        performance: { enabled: true, logger: mockLogger }
      };
      
      const decoratedStrategy = new StrategyDecoratorBuilder(mockStrategy, customOptions)
        .build();
      
      const options = { basic: { maxChunkSize: 4 } }; // Small size to trigger overlap
      const result = await decoratedStrategy.split('line1\nline2', 'javascript', undefined, options);
      
      expect(result).toHaveLength(2);
      expect(result[1].content).toBe('overlap_line2');
      expect(mockLogger.debugMessages).toHaveLength(1);
    });
  });
});