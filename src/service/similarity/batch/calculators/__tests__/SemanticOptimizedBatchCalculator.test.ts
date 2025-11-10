import { SemanticOptimizedBatchCalculator } from '../SemanticOptimizedBatchCalculator';
import { LoggerService } from '../../../../../utils/LoggerService';
import { EmbedderFactory } from '../../../../../embedders/EmbedderFactory';
import { Embedder, EmbeddingInput, EmbeddingResult } from '../../../../../embedders/BaseEmbedder';
import { ErrorHandlerService } from '../../../../../utils/ErrorHandlerService';
import { EmbeddingCacheService } from '../../../../../embedders/EmbeddingCacheService';

// Mock Embedder
const mockEmbedder: Embedder = {
  embed: jest.fn().mockResolvedValue([
    { vector: [0.1, 0.2, 0.3], dimensions: 3, model: 'test-model', processingTime: 0 },
    { vector: [0.4, 0.5, 0.6], dimensions: 3, model: 'test-model', processingTime: 0 },
    { vector: [0.7, 0.8, 0.9], dimensions: 3, model: 'test-model', processingTime: 0 }
  ]),
  getModelName: () => 'test-model',
  getDimensions: () => 3,
  isAvailable: () => Promise.resolve(true)
};

// Create a proper mock for EmbedderFactory using jest
const mockEmbedderFactory = {
  getEmbedder: jest.fn().mockResolvedValue(mockEmbedder),
  embed: jest.fn().mockResolvedValue([
    { vector: [0.1, 0.2, 0.3], dimensions: 3, model: 'test-model', processingTime: 0 },
    { vector: [0.4, 0.5, 0.6], dimensions: 3, model: 'test-model', processingTime: 0 },
    { vector: [0.7, 0.8, 0.9], dimensions: 3, model: 'test-model', processingTime: 0 }
  ]),
  getAvailableProviders: jest.fn().mockResolvedValue(['default']),
  getProviderInfo: jest.fn().mockResolvedValue({
    name: 'default',
    model: 'test-model',
    dimensions: 3,
    available: true
  }),
  autoSelectProvider: jest.fn().mockResolvedValue('default'),
  registerProvider: jest.fn(),
  getRegisteredProviders: jest.fn().mockReturnValue(['default']),
  isProviderRegistered: jest.fn().mockReturnValue(true),
  unregisterProvider: jest.fn(),
  getDefaultProvider: jest.fn().mockReturnValue('default'),
  setDefaultProvider: jest.fn(),
  initializeProviderInfoCache: jest.fn().mockResolvedValue(undefined),
  initializeEmbedders: jest.fn(),
  getEmbedderMaxBatchSize: jest.fn().mockReturnValue(50)
} as unknown as EmbedderFactory;

// Mock EmbeddingCacheService using jest
const mockEmbeddingCache = {
  get: jest.fn().mockResolvedValue(null), // Initially return null (not cached)
  set: jest.fn().mockResolvedValue(undefined),
} as unknown as EmbeddingCacheService;

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

  beforeEach(() => {
    mockStrategy = new MockSemanticStrategy();

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