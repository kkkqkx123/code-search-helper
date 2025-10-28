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

describe('CacheDecorator', () => {
  let mockStrategy: MockStrategy;
  let decorator: CacheDecorator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    decorator = new CacheDecorator(mockStrategy, 10, 1000); // Small cache for testing
  });
  
  describe('split', () => {
    it('should cache results and return cached results on subsequent calls', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      const filePath = 'test.js';
      
      // First call
      const result1 = await decorator.split(content, language, filePath);
      expect(result1).toHaveLength(3);
      expect(result1[0].metadata.callCount).toBe(1);
      
      // Second call should return cached result
      const result2 = await decorator.split(content, language, filePath);
      expect(result2).toHaveLength(3);
      expect(result2[0].metadata.callCount).toBe(1); // Should be same as first call
      
      // Strategy should only be called once
      expect(mockStrategy.getCallCount()).toBe(1);
    });
    
    it('should treat different content as separate cache entries', async () => {
      const content1 = 'line1\nline2';
      const content2 = 'line3\nline4';
      const language = 'javascript';
      
      await decorator.split(content1, language);
      await decorator.split(content2, language);
      
      expect(mockStrategy.getCallCount()).toBe(2);
    });
    
    it('should treat different options as separate cache entries', async () => {
      const content = 'line1\nline2';
      const language = 'javascript';
      const options1 = { maxChunkSize: 100 };
      const options2 = { maxChunkSize: 200 };
      
      await decorator.split(content, language, undefined, options1);
      await decorator.split(content, language, undefined, options2);
      
      expect(mockStrategy.getCallCount()).toBe(2);
    });
    
    it('should return deep clones of cached results', async () => {
      const content = 'line1\nline2';
      const language = 'javascript';
      
      const result1 = await decorator.split(content, language);
      const result2 = await decorator.split(content, language);
      
      // Modify first result
      result1[0].content = 'modified';
      
      // Second result should not be affected
      expect(result2[0].content).toBe('line1');
    });
    
    it('should evict oldest entries when cache is full', async () => {
      const decorator = new CacheDecorator(mockStrategy, 2, 1000); // Cache size of 2
      
      // Fill cache
      await decorator.split('content1', 'javascript');
      await decorator.split('content2', 'javascript');
      await decorator.split('content3', 'javascript'); // Should evict content1
      
      // content1 should be evicted, content2 and content3 should be cached
      await decorator.split('content2', 'javascript');
      await decorator.split('content3', 'javascript');
      
      expect(mockStrategy.getCallCount()).toBe(3); // content1, content2, content3
    });
  });
  
  describe('cache statistics', () => {
    it('should track cache hits and misses', async () => {
      const content = 'line1\nline2';
      const language = 'javascript';
      
      // First call (miss)
      await decorator.split(content, language);
      let stats = decorator.getCacheStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0);
      
      // Second call (hit)
      await decorator.split(content, language);
      stats = decorator.getCacheStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      
      // Third call (hit)
      await decorator.split(content, language);
      stats = decorator.getCacheStats();
      expect(stats.cacheHits).toBe(2);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(2/3);
    });
    
    it('should track cache size', async () => {
      await decorator.split('content1', 'javascript');
      await decorator.split('content2', 'javascript');
      
      const stats = decorator.getCacheStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.maxCacheSize).toBe(10);
    });
  });
  
  describe('cache management', () => {
    it('should clear cache and reset statistics', async () => {
      await decorator.split('content1', 'javascript');
      await decorator.split('content2', 'javascript');
      
      let stats = decorator.getCacheStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(2);
      
      decorator.clearCache();
      
      stats = decorator.getCacheStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });
  
  describe('interface methods', () => {
    it('should return decorated name', () => {
      expect(decorator.getName()).toBe('test_strategy_cached');
    });
    
    it('should delegate supportsLanguage', () => {
      expect(decorator.supportsLanguage('javascript')).toBe(true);
    });
    
    it('should delegate getPriority', () => {
      
    });
  });
  
  describe('cache key generation', () => {
    it('should generate different keys for different file paths', async () => {
      const content = 'line1\nline2';
      const language = 'javascript';
      
      await decorator.split(content, language, 'file1.js');
      await decorator.split(content, language, 'file2.js');
      
      expect(mockStrategy.getCallCount()).toBe(2);
    });
    
    it('should handle undefined file path', async () => {
      const content = 'line1\nline2';
      const language = 'javascript';
      
      await decorator.split(content, language);
      await decorator.split(content, language, undefined);
      
      expect(mockStrategy.getCallCount()).toBe(1); // Should be same cache entry
    });
  });
});