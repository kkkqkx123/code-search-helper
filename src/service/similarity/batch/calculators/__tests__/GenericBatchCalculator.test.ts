import { GenericBatchCalculator } from '../GenericBatchCalculator';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ISimilarityStrategy, SimilarityStrategyType } from '../../../types/SimilarityTypes';

// Mock 策略类
class MockStrategy implements ISimilarityStrategy {
  readonly type: SimilarityStrategyType;
  readonly name = 'Mock Strategy';

  constructor(type: SimilarityStrategyType) {
    this.type = type;
  }

  async calculate(content1: string, content2: string): Promise<number> {
    // Simple mock: return similarity based on string length similarity
    const len1 = content1.length;
    const len2 = content2.length;
    const minLen = Math.min(len1, len2);
    const maxLen = Math.max(len1, len2);
    return maxLen > 0 ? minLen / maxLen : 1;
  }

  isSupported(): boolean {
    return true;
  }

  getDefaultThreshold(): number {
    return 0.8;
  }
}

describe('GenericBatchCalculator', () => {
  let calculator: GenericBatchCalculator;

  beforeEach(() => {
    calculator = new GenericBatchCalculator(new LoggerService());
  });

  describe('calculateBatch', () => {
    it('should calculate batch similarity for supported strategies', async () => {
      const contents = ['content1', 'content2', 'content3'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(3);
      expect(result.matrix[0]).toHaveLength(3);
      expect(result.pairs).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.cacheHits).toBe(0);
    });

    it('should create symmetric similarity matrix', async () => {
      const contents = ['A', 'B', 'C'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      // Check symmetry
      for (let i = 0; i < result.matrix.length; i++) {
        for (let j = 0; j < result.matrix[i].length; j++) {
          expect(result.matrix[i][j]).toBe(result.matrix[j][i]);
        }
      }
    });

    it('should set diagonal to 1.0', async () => {
      const contents = ['content1', 'content2', 'content3'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      for (let i = 0; i < result.matrix.length; i++) {
        expect(result.matrix[i][i]).toBe(1.0);
      }
    });

    it('should reject unsupported strategy', async () => {
      const contents = ['content1', 'content2'];
      const strategy = new MockStrategy('semantic');

      await expect(calculator.calculateBatch(contents, strategy))
        .rejects.toThrow('Strategy semantic is not supported by generic batch calculator');
    });

    it('should handle empty contents', async () => {
      const strategy = new MockStrategy('levenshtein');

      await expect(calculator.calculateBatch([], strategy))
        .rejects.toThrow('At least 2 contents are required');
    });

    it('should handle single content', async () => {
      const strategy = new MockStrategy('levenshtein');

      await expect(calculator.calculateBatch(['content'], strategy))
        .rejects.toThrow('At least 2 contents are required');
    });

    it('should handle empty content items', async () => {
      const contents = ['content1', ''];
      const strategy = new MockStrategy('levenshtein');

      await expect(calculator.calculateBatch(contents, strategy))
        .rejects.toThrow('Content cannot be empty');
    });

    it('should calculate pairs correctly', async () => {
      const contents = ['A', 'B', 'C'];
      const strategy = new MockStrategy('keyword');

      const result = await calculator.calculateBatch(contents, strategy);

      // For 3 items, there should be 3 pairs: (0,1), (0,2), (1,2)
      expect(result.pairs).toHaveLength(3);
      expect(result.pairs[0]).toEqual({
        index1: 0,
        index2: 1,
        similarity: expect.any(Number),
        isSimilar: expect.any(Boolean)
      });
    });

    it('should apply threshold correctly', async () => {
      const contents = ['ABC', 'DEF', 'ABCXYZ'];
      const strategy = new MockStrategy('keyword');

      const result = await calculator.calculateBatch(contents, strategy, { threshold: 0.5 });

      // Check that isSimilar flag matches threshold
      result.pairs.forEach(pair => {
        expect(pair.isSimilar).toBe(pair.similarity >= 0.5);
      });
    });

    it('should support structure strategy', async () => {
      const contents = ['content1', 'content2'];
      const strategy = new MockStrategy('structure');

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(2);
    });
  });

  describe('isSupported', () => {
    it('should support levenshtein strategy', () => {
      const strategy = new MockStrategy('levenshtein');
      expect(calculator.isSupported(strategy)).toBe(true);
    });

    it('should support keyword strategy', () => {
      const strategy = new MockStrategy('keyword');
      expect(calculator.isSupported(strategy)).toBe(true);
    });

    it('should support structure strategy', () => {
      const strategy = new MockStrategy('structure');
      expect(calculator.isSupported(strategy)).toBe(true);
    });

    it('should not support semantic strategy', () => {
      const strategy = new MockStrategy('semantic');
      expect(calculator.isSupported(strategy)).toBe(false);
    });

    it('should not support hybrid strategy', () => {
      const strategy = new MockStrategy('hybrid');
      expect(calculator.isSupported(strategy)).toBe(false);
    });
  });

  describe('getRecommendedBatchSize', () => {
    it('should return content count for small batches', () => {
      const contents = Array(10).fill('content');
      const strategy = new MockStrategy('levenshtein');

      const batchSize = calculator.getRecommendedBatchSize(contents, strategy);

      expect(batchSize).toBe(10);
    });

    it('should return 50 for medium batches', () => {
      const contents = Array(60).fill('content');
      const strategy = new MockStrategy('levenshtein');

      const batchSize = calculator.getRecommendedBatchSize(contents, strategy);

      expect(batchSize).toBe(50);
    });

    it('should return 100 for large batches', () => {
      const contents = Array(200).fill('content');
      const strategy = new MockStrategy('levenshtein');

      const batchSize = calculator.getRecommendedBatchSize(contents, strategy);

      expect(batchSize).toBe(100);
    });

    it('should return 200 for very large batches', () => {
      const contents = Array(1000).fill('content');
      const strategy = new MockStrategy('levenshtein');

      const batchSize = calculator.getRecommendedBatchSize(contents, strategy);

      expect(batchSize).toBe(200);
    });
  });

  describe('calculateLargeBatch', () => {
    it('should handle large batch by splitting', async () => {
      const contents = Array(300).fill(0).map((_, i) => `content${i}`);
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateLargeBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(300);
      expect(result.matrix[0]).toHaveLength(300);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should merge matrices correctly', async () => {
      const contents = Array(150).fill(0).map((_, i) => `content${i}`);
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateLargeBatch(contents, strategy);

      // Verify merged matrix properties
      expect(result.matrix).toHaveLength(150);
      for (let i = 0; i < result.matrix.length; i++) {
        expect(result.matrix[i]).toHaveLength(150);
        expect(result.matrix[i][i]).toBe(1.0); // Diagonal should be 1
      }
    });

    it('should handle small batches without splitting', async () => {
      const contents = Array(50).fill('content');
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateLargeBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(50);
    });

    it('should merge pairs correctly with index adjustment', async () => {
      const contents = Array(100).fill(0).map((_, i) => `content${i}`);
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateLargeBatch(contents, strategy);

      // Check that all pair indices are within valid range
      result.pairs.forEach(pair => {
        expect(pair.index1).toBeGreaterThanOrEqual(0);
        expect(pair.index1).toBeLessThan(contents.length);
        expect(pair.index2).toBeGreaterThanOrEqual(0);
        expect(pair.index2).toBeLessThan(contents.length);
        expect(pair.index1).toBeLessThan(pair.index2);
      });
    });
  });

  describe('mergeMatrices', () => {
    it('should merge matrices correctly', () => {
      const matrices = [
        [[1, 0.5], [0.5, 1]],
        [[1, 0.7], [0.7, 1]]
      ];

      // @ts-ignore - accessing private method for testing
      const merged = calculator.mergeMatrices(matrices, 4);

      expect(merged).toHaveLength(4);
      expect(merged[0]).toEqual([1, 0.5, 0, 0]);
      expect(merged[1]).toEqual([0.5, 1, 0, 0]);
      expect(merged[2]).toEqual([0, 0, 1, 0.7]);
      expect(merged[3]).toEqual([0, 0, 0.7, 1]);
    });

    it('should create correct sized matrix', () => {
      const matrices = [
        [[1, 0.5], [0.5, 1]],
        [[1, 0.6], [0.6, 1]],
        [[1, 0.8], [0.8, 1]]
      ];

      // @ts-ignore - accessing private method for testing
      const merged = calculator.mergeMatrices(matrices, 6);

      expect(merged).toHaveLength(6);
      expect(merged[0]).toHaveLength(6);
    });
  });

  describe('estimateCalculationTime', () => {
    it('should estimate time for levenshtein', () => {
      const contents = Array(10).fill('content');
      const strategy = new MockStrategy('levenshtein');

      const estimatedTime = calculator.estimateCalculationTime(contents, strategy);

      expect(estimatedTime).toBeGreaterThan(0);
      // Pair count for 10 items: 10*9/2 = 45
      // 45 * 0.5 (time per pair for levenshtein) = 22.5
      // Rounded to 23 due to Math.round() in implementation
      expect(estimatedTime).toBeCloseTo(23, 0);
    });

    it('should estimate time for keyword', () => {
      const contents = Array(10).fill('content');
      const strategy = new MockStrategy('keyword');

      const estimatedTime = calculator.estimateCalculationTime(contents, strategy);

      expect(estimatedTime).toBeGreaterThan(0);
      // 45 * 0.2 = 9
      expect(estimatedTime).toBeCloseTo(9, 1);
    });

    it('should estimate time for structure', () => {
      const contents = Array(10).fill('content');
      const strategy = new MockStrategy('structure');

      const estimatedTime = calculator.estimateCalculationTime(contents, strategy);

      expect(estimatedTime).toBeGreaterThan(0);
      // 45 * 1.0 = 45
      expect(estimatedTime).toBeCloseTo(45, 1);
    });
  });

  describe('getCalculatorStats', () => {
    it('should return correct stats', () => {
      const stats = calculator.getCalculatorStats();

      expect(stats.name).toBe('Generic Batch Calculator');
      expect(stats.type).toBe('generic');
      expect(stats.supportedStrategies).toEqual(['levenshtein', 'keyword', 'structure']);
      expect(stats.maxRecommendedBatchSize).toBe(200);
    });
  });

  describe('symmetry optimization', () => {
    it('should utilize symmetry to reduce calculations', async () => {
      const contents = ['A', 'B', 'C'];
      let calculationCount = 0;

      // Create a strategy that counts calculations
      const countingStrategy = new MockStrategy('levenshtein');
      const originalCalculate = countingStrategy.calculate;
      countingStrategy.calculate = jest.fn(async (c1, c2) => {
        calculationCount++;
        return originalCalculate.call(countingStrategy, c1, c2);
      });

      const result = await calculator.calculateBatch(contents, countingStrategy);

      // For 3 items: should calculate 3 pairs (0,1), (0,2), (1,2)
      // Due to symmetry, it should not calculate (1,0), (2,0), (2,1)
      expect(calculationCount).toBe(3);
    });
  });

  describe('threshold handling', () => {
    it('should use default threshold from strategy', async () => {
      const contents = ['A', 'B', 'C'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      result.pairs.forEach(pair => {
        expect(pair.isSimilar).toBe(pair.similarity >= strategy.getDefaultThreshold());
      });
    });

    it('should use custom threshold', async () => {
      const contents = ['A', 'B', 'C'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy, { threshold: 0.5 });

      result.pairs.forEach(pair => {
        expect(pair.isSimilar).toBe(pair.similarity >= 0.5);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 2 contents', async () => {
      const contents = ['content1', 'content2'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result.matrix).toHaveLength(2);
      expect(result.pairs).toHaveLength(1);
    });

    it('should handle very large content strings', async () => {
      const largeContent = 'A'.repeat(10000);
      const contents = [largeContent, largeContent + 'B'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(2);
    });

    it('should handle identical contents', async () => {
      const contents = ['content', 'content', 'content'];
      const strategy = new MockStrategy('levenshtein');

      const result = await calculator.calculateBatch(contents, strategy);

      // Identical contents should have similarity 1.0
      result.pairs.forEach(pair => {
        expect(pair.similarity).toBe(1.0);
      });
    });
  });
});
