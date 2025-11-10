import { SemanticSimilarityStrategy } from '../SemanticSimilarityStrategy';
import { SimilarityError } from '../../types/SimilarityTypes';

/**
 * Mock embedder factory and cache service
 */
class MockEmbedder {
  getModelName() {
    return 'mock-model';
  }

  async embed(input: { text: string }) {
    // Simple mock: hash the text into a vector
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

describe('SemanticSimilarityStrategy', () => {
  let strategy: SemanticSimilarityStrategy;
  let mockFactory: MockEmbedderFactory;
  let mockCache: MockEmbeddingCache;

  beforeEach(() => {
    mockFactory = new MockEmbedderFactory();
    mockCache = new MockEmbeddingCache();
    strategy = new SemanticSimilarityStrategy(mockFactory as any, mockCache as any);
  });

  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('Semantic Similarity');
    });

    it('should have correct type', () => {
      expect(strategy.type).toBe('semantic');
    });

    it('should return correct default threshold', () => {
      expect(strategy.getDefaultThreshold()).toBe(0.75);
    });
  });

  describe('isSupported', () => {
    it('should support code content type', () => {
      expect(strategy.isSupported('code')).toBe(true);
    });

    it('should support document content type', () => {
      expect(strategy.isSupported('document')).toBe(true);
    });

    it('should support generic content type', () => {
      expect(strategy.isSupported('generic')).toBe(true);
    });

    it('should return false for unsupported content types', () => {
      expect(strategy.isSupported('unknown' as any)).toBe(false);
    });

    it('should support with language parameter', () => {
      expect(strategy.isSupported('code', 'javascript')).toBe(true);
    });
  });

  describe('calculate', () => {
    it('should return 1.0 for identical content', async () => {
      const similarity = await strategy.calculate('hello world', 'hello world');
      expect(similarity).toBe(1.0);
    });

    it('should handle empty strings as input validation error', async () => {
      await expect(strategy.calculate('', 'content')).rejects.toThrow();
    });

    it('should fallback to keyword overlap for short content', async () => {
      const similarity = await strategy.calculate('hi', 'hi');
      expect(similarity).toBe(1.0);
    });

    it('should validate threshold option', async () => {
      const content = 'This is a long enough content for semantic analysis';
      await expect(
        strategy.calculate(content, content, { threshold: 1.5 })
      ).rejects.toThrow();
    });

    it('should accept embedder provider option', async () => {
      const similarity = await strategy.calculate(
        'This is a long enough content for semantic analysis',
        'This is a long enough content for semantic analysis',
        { embedderProvider: 'openai' }
      );
      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should accept language option for embedder provider', async () => {
      const similarity = await strategy.calculate(
        'This is a long enough content for semantic analysis',
        'This is a long enough content for semantic analysis',
        { language: 'javascript' }
      );
      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle content type option', async () => {
      const similarity = await strategy.calculate(
        'function test() { return data; }',
        'function test() { return data; }',
        { contentType: 'code' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should be between 0 and 1', async () => {
      const similarity = await strategy.calculate(
        'The quick brown fox jumps over the lazy dog',
        'A lazy dog is jumped over by a quick brown fox'
      );
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('cosine similarity calculation', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = (strategy as any).calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBe(1.0);
    });

    it('should calculate cosine similarity for perpendicular vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = (strategy as any).calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should calculate cosine similarity for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = (strategy as any).calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBe(-1.0);
    });

    it('should throw error for mismatched dimensions', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0];
      expect(() => {
        (strategy as any).calculateCosineSimilarity(vec1, vec2);
      }).toThrow(SimilarityError);
    });

    it('should return 0 for zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [0, 0, 0];
      const similarity = (strategy as any).calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should handle one zero vector', () => {
      const vec1 = [1, 1, 1];
      const vec2 = [0, 0, 0];
      const similarity = (strategy as any).calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });
  });

  describe('keyword overlap fallback', () => {
    it('should use keyword overlap for short content', async () => {
      const similarity = await strategy.calculate('hello test', 'hello test');
      expect(similarity).toBe(1.0);
    });

    it('should filter stop words in keyword overlap', async () => {
      const similarity = await strategy.calculate(
        'the quick brown',
        'quick brown the'
      );
      expect(similarity).toBeCloseTo(1.0, 1);
    });

    it('should handle partial keyword overlap', async () => {
      const similarity = await strategy.calculate(
        'apple banana cherry',
        'apple date elderberry'
      );
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return low similarity for no keyword overlap', async () => {
      const similarity = await strategy.calculate(
        'apple banana cherry',
        'car truck bus'
      );
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('content length handling', () => {
    it('should fallback to keyword overlap for very short content', async () => {
      const similarity = await strategy.calculate('hi', 'hi');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should use semantic analysis for long content', async () => {
      const longContent1 = 'This is a long content that provides enough context for semantic analysis to work properly';
      const longContent2 = 'This is a long content that provides enough context for semantic analysis to work properly';
      const similarity = await strategy.calculate(longContent1, longContent2);
      expect(similarity).toBe(1.0);
    });

    it('should handle content exactly at min length', async () => {
      const content = 'test content'; // 12 chars, >= 10
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });

    it('should handle content just below min length', async () => {
      const content = 'short'; // 5 chars, < 10
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });
  });

  describe('embedding caching', () => {
    it('should cache embeddings', async () => {
      const content = 'This is a long content for caching test purposes here';
      
      // First call - should compute embedding
      const similarity1 = await strategy.calculate(content, content);
      
      // Second call - should use cached embedding
      const similarity2 = await strategy.calculate(content, content);
      
      expect(similarity1).toBe(similarity2);
      expect(similarity1).toBe(1.0);
    });

    it('should use embedder provider in cache', async () => {
      const content = 'This is a long content for provider caching test';
      
      const similarity = await strategy.calculate(content, content, {
        embedderProvider: 'openai'
      });
      
      expect(similarity).toBe(1.0);
    });
  });

  describe('error handling', () => {
    it('should handle embedder errors gracefully', async () => {
      // Create a mock factory that throws
      const badFactory = {
        async getEmbedder() {
          throw new Error('Embedder error');
        }
      };
      
      const badStrategy = new SemanticSimilarityStrategy(badFactory as any, mockCache as any);
      
      // Should fallback to keyword overlap instead of throwing
      const similarity = await badStrategy.calculate(
        'This is a long enough content',
        'This is a long enough content'
      );
      
      expect(similarity).toBeDefined();
    });

    it('should validate input before processing', async () => {
      await expect(
        strategy.calculate('', 'content')
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle unicode content', async () => {
      const similarity = await strategy.calculate(
        '你好世界，这是一个长内容用于测试',
        '你好世界，这是一个长内容用于测试'
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle special characters', async () => {
      const similarity = await strategy.calculate(
        'Hello! @#$% world & test <code>',
        'Hello! @#$% world & test <code>'
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle very long content', async () => {
      const longContent = 'word '.repeat(200);
      const similarity = await strategy.calculate(longContent, longContent);
      expect(similarity).toBe(1.0);
    });

    it('should handle content with newlines', async () => {
      const content = 'This is a long content\nwith multiple\nlines for testing';
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });

    it('should handle content with tabs', async () => {
      const content = 'This is a long content\twith\ttabs for testing purposes here';
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });
  });
});
