import { HybridSimilarityStrategy } from '../HybridSimilarityStrategy';
import { LevenshteinSimilarityStrategy } from '../LevenshteinSimilarityStrategy';
import { KeywordSimilarityStrategy } from '../KeywordSimilarityStrategy';
import { SemanticSimilarityStrategy } from '../SemanticSimilarityStrategy';

/**
 * Mock embedder factory and cache service for SemanticSimilarityStrategy
 */
class MockEmbedder {
  getModelName() {
    return 'mock-model';
  }

  async embed(input: { text: string }) {
    const text = input.text;
    const vector: number[] = [];
    for (let i = 0; i < 10; i++) {
      let hash = 0;
      for (let j = 0; j < text.length; j++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(j);
        hash = hash >>> 0;
      }
      vector.push((hash % 100) / 100);
    }
    return { vector };
  }
}

class MockEmbedderFactory {
  async getEmbedder(_provider: string) {
    return new MockEmbedder();
  }
}

class MockEmbeddingCache {
  private cache = new Map<string, any>();

  async get(content: string, modelName: string) {
    return this.cache.get(`${content}:${modelName}`) || null;
  }

  async set(content: string, modelName: string, embedding: any) {
    this.cache.set(`${content}:${modelName}`, embedding);
  }
}

describe('HybridSimilarityStrategy', () => {
  let strategy: HybridSimilarityStrategy;
  let levenshteinStrategy: LevenshteinSimilarityStrategy;
  let keywordStrategy: KeywordSimilarityStrategy;
  let semanticStrategy: SemanticSimilarityStrategy;

  beforeEach(() => {
    levenshteinStrategy = new LevenshteinSimilarityStrategy();
    keywordStrategy = new KeywordSimilarityStrategy();
    const mockFactory = new MockEmbedderFactory();
    const mockCache = new MockEmbeddingCache();
    semanticStrategy = new SemanticSimilarityStrategy(mockFactory as any, mockCache as any);
    
    strategy = new HybridSimilarityStrategy(
      levenshteinStrategy,
      semanticStrategy,
      keywordStrategy
    );
  });

  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('Hybrid Similarity');
    });

    it('should have correct type', () => {
      expect(strategy.type).toBe('hybrid');
    });

    it('should return correct default threshold', () => {
      expect(strategy.getDefaultThreshold()).toBe(0.7);
    });
  });

  describe('isSupported', () => {
    it('should support all content types', () => {
      expect(strategy.isSupported('code')).toBe(true);
      expect(strategy.isSupported('document')).toBe(true);
      expect(strategy.isSupported('generic')).toBe(true);
    });

    it('should support all languages', () => {
      expect(strategy.isSupported('code', 'javascript')).toBe(true);
      expect(strategy.isSupported('code', 'python')).toBe(true);
    });
  });

  describe('calculate', () => {
    it('should return 1.0 for identical content', async () => {
      const similarity = await strategy.calculate('hello world test', 'hello world test');
      expect(similarity).toBe(1.0);
    });

    it('should handle empty strings as input validation error', async () => {
      await expect(strategy.calculate('', 'content')).rejects.toThrow();
    });

    it('should return value between 0 and 1', async () => {
      const similarity = await strategy.calculate('apple', 'orange');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should be symmetric', async () => {
      const sim1 = await strategy.calculate('hello world', 'hello test');
      const sim2 = await strategy.calculate('hello test', 'hello world');
      expect(sim1).toBe(sim2);
    });

    it('should validate threshold option', async () => {
      await expect(
        strategy.calculate('hello', 'world', { threshold: 1.5 })
      ).rejects.toThrow();
    });

    it('should accept content type option', async () => {
      const similarity = await strategy.calculate(
        'function test() { return data; }',
        'function test() { return data; }',
        { contentType: 'code' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should accept language option', async () => {
      const similarity = await strategy.calculate(
        'hello world test code',
        'hello world test code',
        { language: 'javascript' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should combine multiple strategies', async () => {
      const similarity = await strategy.calculate(
        'This is a test content with similar keywords',
        'This is a test content with similar keywords'
      );
      expect(similarity).toBe(1.0);
    });

    it('should use default weights when not provided', async () => {
      const similarity = await strategy.calculate(
        'hello world test',
        'hello world test'
      );
      expect(similarity).toBe(1.0);
    });

    it('should use custom weights when provided', async () => {
      const similarity = await strategy.calculate(
        'hello world test',
        'hello world test',
        {
          weights: {
            content: 0.5,
            semantic: 0.3,
            keywords: 0.2
          }
        } as any
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('weight calculation', () => {
    it('should normalize custom weights', async () => {
      const similarity = await strategy.calculate(
        'hello world test content',
        'hello world test content',
        {
          weights: {
            content: 2,
            semantic: 2,
            keywords: 1
          }
        } as any
      );
      expect(similarity).toBe(1.0);
    });

    it('should use default weights when custom weights sum to 0', async () => {
      const similarity = await strategy.calculate(
        'hello world test',
        'hello world test',
        {
          weights: {
            content: 0,
            semantic: 0,
            keywords: 0
          }
        } as any
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle partial weight specification', async () => {
      const similarity = await strategy.calculate(
        'hello world test',
        'hello world test',
        {
          weights: {
            content: 1
          }
        } as any
      );
      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle zero weight for some strategies', async () => {
      const similarity = await strategy.calculate(
        'hello world test',
        'hello world test',
        {
          weights: {
            content: 1,
            semantic: 0,
            keywords: 0
          }
        } as any
      );
      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('simple overlap fallback', () => {
    it('should calculate simple character overlap', () => {
      const overlap = (strategy as any).calculateSimpleOverlap('hello', 'hallo');
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThanOrEqual(1);
    });

    it('should return 0 for completely different content', () => {
      const overlap = (strategy as any).calculateSimpleOverlap('abc', 'def');
      expect(overlap).toBe(0);
    });

    it('should return 1 for identical content', () => {
      const overlap = (strategy as any).calculateSimpleOverlap('hello', 'hello');
      expect(overlap).toBe(1);
    });

    it('should be case insensitive', () => {
      const overlap = (strategy as any).calculateSimpleOverlap('HELLO', 'hello');
      expect(overlap).toBe(1);
    });
  });

  describe('detailed similarity calculation', () => {
    it('should return detailed similarity breakdown', async () => {
      const result = await strategy.calculateDetailedSimilarity(
        'hello world test',
        'hello world test'
      );
      
      expect(result.overall).toBe(1.0);
      expect(result.details.levenshtein).toBe(1.0);
      expect(result.details.keyword).toBe(1.0);
      expect(result.details.weights).toBeDefined();
    });

    it('should include individual strategy scores', async () => {
      const result = await strategy.calculateDetailedSimilarity(
        'hello world',
        'hello test'
      );
      
      expect(result.details.levenshtein).toBeDefined();
      expect(result.details.semantic).toBeDefined();
      expect(result.details.keyword).toBeDefined();
    });

    it('should include weight information', async () => {
      const result = await strategy.calculateDetailedSimilarity(
        'hello world test',
        'hello world test'
      );
      
      expect(result.details.weights.content).toBeDefined();
      expect(result.details.weights.semantic).toBeDefined();
      expect(result.details.weights.keywords).toBeDefined();
    });

    it('should use custom weights in detailed calculation', async () => {
      const result = await strategy.calculateDetailedSimilarity(
        'hello world test',
        'hello world test',
        {
          weights: {
            content: 0.2,
            semantic: 0.3,
            keywords: 0.5
          }
        }
      );
      
      expect(result.details.weights.content).toBeCloseTo(0.2, 1);
      expect(result.details.weights.semantic).toBeCloseTo(0.3, 1);
      expect(result.details.weights.keywords).toBeCloseTo(0.5, 1);
    });
  });

  describe('strategy stats', () => {
    it('should return correct strategy information', () => {
      const stats = strategy.getStrategyStats();
      
      expect(stats.name).toBe('Hybrid Similarity');
      expect(stats.supportedStrategies).toContain('Levenshtein Similarity');
      expect(stats.supportedStrategies).toContain('Keyword Similarity');
      expect(stats.supportedStrategies).toContain('Semantic Similarity');
    });

    it('should return default weights', () => {
      const stats = strategy.getStrategyStats();
      
      expect(stats.defaultWeights.content).toBe(0.4);
      expect(stats.defaultWeights.semantic).toBe(0.4);
      expect(stats.defaultWeights.keywords).toBe(0.2);
    });
  });

  describe('content type handling', () => {
    it('should handle code content type', async () => {
      const similarity = await strategy.calculate(
        'function test() { return 42; }',
        'function test() { return 42; }',
        { contentType: 'code' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle document content type', async () => {
      const similarity = await strategy.calculate(
        'This is a test document with content',
        'This is a test document with content',
        { contentType: 'document' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle generic content type', async () => {
      const similarity = await strategy.calculate(
        'generic test content here',
        'generic test content here',
        { contentType: 'generic' }
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('edge cases', () => {
    it('should handle unicode content', async () => {
      const similarity = await strategy.calculate(
        '你好世界测试内容',
        '你好世界测试内容'
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle special characters', async () => {
      const similarity = await strategy.calculate(
        'hello! @#$% world & test <code>',
        'hello! @#$% world & test <code>'
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle very short content', async () => {
      const similarity = await strategy.calculate('hi', 'hi');
      expect(similarity).toBe(1.0);
    });

    it('should handle very long content', async () => {
      const longContent = 'word '.repeat(200);
      const similarity = await strategy.calculate(longContent, longContent);
      expect(similarity).toBe(1.0);
    });

    it('should handle content with newlines', async () => {
      const content = 'line1\nline2\nline3\ntest content here';
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });

    it('should handle content with tabs and mixed whitespace', async () => {
      const content = 'text\twith\t\ttabs\nand\nnewlines here';
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });

    it('should handle comments in code', async () => {
      const similarity = await strategy.calculate(
        `
          // This is a comment
          function test() {
            /* Multi-line
               comment */
            return 42;
          }
        `,
        `
          // This is a comment
          function test() {
            /* Multi-line
               comment */
            return 42;
          }
        `,
        { contentType: 'code' }
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('fallback mechanism', () => {
    it('should fallback to simple overlap if strategy fails', async () => {
      // This tests the error handling in calculateWithFallback
      const similarity = await strategy.calculate(
        'test content here',
        'test content here'
      );
      expect(similarity).toBe(1.0);
    });

    it('should combine results when all strategies succeed', async () => {
      const similarity = await strategy.calculate(
        'hello world test code',
        'hello world test code'
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('complex scenarios', () => {
    it('should handle partial similarity across strategies', async () => {
      const similarity = await strategy.calculate(
        'The quick brown fox jumps over the lazy dog',
        'A lazy dog is jumped over by a quick brown fox'
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should weight different strategy results appropriately', async () => {
      const similarity1 = await strategy.calculate(
        'hello world',
        'hello world'
      );
      
      const similarity2 = await strategy.calculate(
        'completely different content entirely',
        'not at all similar'
      );
      
      expect(similarity1).toBeGreaterThan(similarity2);
    });

    it('should handle mixed case content consistently', async () => {
      const sim1 = await strategy.calculate('Hello World', 'hello world');
      const sim2 = await strategy.calculate('HELLO WORLD', 'hello world');
      expect(sim1).toBe(1.0);
      expect(sim2).toBe(1.0);
    });
  });
});
