import { SemanticOptimizedBatchCalculator } from '../SemanticOptimizedBatchCalculator';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock EmbedderFactory
class MockEmbedderFactory {
  async getEmbedder() {
    return {
      embed: jest.fn().mockResolvedValue([
        { vector: [0.1, 0.2, 0.3], dimensions: 3, model: 'test-model', processingTime: 0 },
        { vector: [0.4, 0.5, 0.6], dimensions: 3, model: 'test-model', processingTime: 0 },
        { vector: [0.7, 0.8, 0.9], dimensions: 3, model: 'test-model', processingTime: 0 }
      ]),
      getModelName: () => 'test-model',
      getDimensions: () => 3
    };
  }
}

// Mock EmbeddingCacheService
class MockEmbeddingCacheService {
  private cache = new Map();
  
  async get(text: string, model: string) {
    return this.cache.get(`${model}:${text}`) || null;
  }
  
  async set(text: string, model: string, result: any) {
    this.cache.set(`${model}:${text}`, result);
  }
}

// Mock 策略类
class MockSemanticStrategy {
  readonly type = 'semantic';
  readonly name = 'Mock Semantic Strategy';
  
  async calculate(content1: string, content2: string): Promise<number> {
    return 0.8;
  }
  
  isSupported(): boolean {
    return true;
  }
  
  getDefaultThreshold(): number {
    return 0.8;
  }
}

describe('SemanticOptimizedBatchCalculator', () => {
  let calculator: SemanticOptimizedBatchCalculator;
  let mockStrategy: MockSemanticStrategy;
  let mockEmbedderFactory: MockEmbedderFactory;
  let mockEmbeddingCache: MockEmbeddingCacheService;

  beforeEach(() => {
    mockStrategy = new MockSemanticStrategy();
    mockEmbedderFactory = new MockEmbedderFactory();
    mockEmbeddingCache = new MockEmbeddingCacheService();
    
    calculator = new SemanticOptimizedBatchCalculator(
      new LoggerService(),
      mockEmbedderFactory,
      mockEmbeddingCache
    );
  });

  describe('calculateBatch', () => {
    it('should calculate batch similarity using semantic optimization', async () => {
      const contents = ['content1', 'content2', 'content3'];
      
      const result = await calculator.calculateBatch(contents, mockStrategy);
      
      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(3);
      expect(result.pairs).toHaveLength(3); // 3 pairs: (0,1), (0,2), (1,2)
      expect(result.executionTime).toBeDefined();
      expect(result.cacheHits).toBeDefined();
    });

    it('should handle empty contents array', async () => {
      await expect(calculator.calculateBatch([], mockStrategy))
        .rejects.toThrow('At least 2 contents are required for batch similarity calculation');
    });

    it('should handle single content', async () => {
      await expect(calculator.calculateBatch(['content'], mockStrategy))
        .rejects.toThrow('At least 2 contents are required for batch similarity calculation');
    });

    it('should validate strategy support', async () => {
      const mockNonSemanticStrategy = { type: 'levenshtein' } as any;
      
      await expect(calculator.calculateBatch(['content1', 'content2'], mockNonSemanticStrategy))
        .rejects.toThrow('Strategy levenshtein is not supported by semantic optimized batch calculator');
    });
  });

  describe('batchGenerateEmbeddings', () => {
    it('should generate embeddings in batch', async () => {
      const contents = ['content1', 'content2'];
      
      // @ts-ignore - accessing private method for testing
      const { embeddings, cacheHits, apiCalls } = await calculator.batchGenerateEmbeddings(contents);
      
      expect(embeddings).toHaveLength(2);
      expect(apiCalls).toBe(1); // Should make only 1 API call for batch
      expect(cacheHits).toBe(0);
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      
      // @ts-ignore - accessing private method for testing
      const similarity = calculator.calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeCloseTo(0, 5); // Orthogonal vectors have 0 similarity
    });

    it('should handle identical vectors', () => {
      const vec1 = [1, 1, 1];
      const vec2 = [1, 1, 1];
      
      // @ts-ignore - accessing private method for testing
      const similarity = calculator.calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeCloseTo(1, 5); // Identical vectors have 1 similarity
    });

    it('should throw error for mismatched dimensions', () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1, 0];
      
      // @ts-ignore - accessing private method for testing
      expect(() => calculator.calculateCosineSimilarity(vec1, vec2))
        .toThrow('Vector dimensions must match');
    });
  });

  describe('isSupported', () => {
    it('should return true for semantic strategy', () => {
      expect(calculator.isSupported(mockStrategy)).toBe(true);
    });

    it('should return false for non-semantic strategy', () => {
      const mockNonSemanticStrategy = { type: 'levenshtein' } as any;
      expect(calculator.isSupported(mockNonSemanticStrategy)).toBe(false);
    });
  });
});