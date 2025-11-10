import { HybridOptimizedBatchCalculator } from '../HybridOptimizedBatchCalculator';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ISimilarityStrategy, SimilarityStrategyType } from '../../../types/SimilarityTypes';

// Mock 策略类
class MockSubStrategy implements ISimilarityStrategy {
  readonly type: SimilarityStrategyType;
  readonly name: string;

  constructor(type: SimilarityStrategyType, name: string = 'Mock Strategy') {
    this.type = type;
    this.name = name;
  }

  async calculate(content1: string, content2: string): Promise<number> {
    // Simple mock: return fixed similarity
    return this.type === 'levenshtein' ? 0.7 : 0.8;
  }

  isSupported(): boolean {
    return true;
  }

  getDefaultThreshold(): number {
    return 0.8;
  }
}

// Mock 混合策略
class MockHybridStrategy implements ISimilarityStrategy {
  readonly type: SimilarityStrategyType = 'hybrid';
  readonly name = 'Mock Hybrid Strategy';
  private subStrategies: MockSubStrategy[];

  constructor(subStrategies: MockSubStrategy[]) {
    this.subStrategies = subStrategies;
  }

  async calculate(content1: string, content2: string): Promise<number> {
    return 0.8;
  }

  isSupported(): boolean {
    return true;
  }

  getDefaultThreshold(): number {
    return 0.8;
  }

  getSubStrategies(): MockSubStrategy[] {
    return this.subStrategies;
  }
}

describe('HybridOptimizedBatchCalculator', () => {
  let calculator: HybridOptimizedBatchCalculator;

  beforeEach(() => {
    calculator = new HybridOptimizedBatchCalculator(new LoggerService());
  });

  describe('calculateBatch', () => {
    it('should calculate batch similarity for hybrid strategy', async () => {
      const contents = ['content1', 'content2', 'content3'];
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(3);
      expect(result.matrix[0]).toHaveLength(3);
      expect(result.pairs).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.cacheHits).toBe(0);
    });

    it('should merge sub-strategy matrices correctly', async () => {
      const contents = ['A', 'B', 'C'];
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      // Check merged matrix properties
      expect(result.matrix).toHaveLength(3);
      for (let i = 0; i < result.matrix.length; i++) {
        expect(result.matrix[i]).toHaveLength(3);
        expect(result.matrix[i][i]).toBe(1.0); // Diagonal should be 1
      }
    });

    it('should handle symmetric matrix in merged results', async () => {
      const contents = ['A', 'B', 'C'];
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      // Check symmetry
      for (let i = 0; i < result.matrix.length; i++) {
        for (let j = 0; j < result.matrix[i].length; j++) {
          expect(result.matrix[i][j]).toBe(result.matrix[j][i]);
        }
      }
    });

    it('should reject non-hybrid strategy', async () => {
      const contents = ['content1', 'content2'];
      const nonHybridStrategy = {
        type: 'levenshtein',
        name: 'Levenshtein',
        calculate: async () => 0.8,
        isSupported: () => true,
        getDefaultThreshold: () => 0.8
      };

      await expect(calculator.calculateBatch(contents, nonHybridStrategy as any))
        .rejects.toThrow('Strategy levenshtein is not supported by hybrid optimized batch calculator');
    });

    it('should throw error when strategy has no sub-strategies', async () => {
      const contents = ['content1', 'content2'];
      const strategyWithoutSubStrategies = {
        type: 'hybrid',
        name: 'Invalid Hybrid',
        calculate: async () => 0.8,
        isSupported: () => true,
        getDefaultThreshold: () => 0.8
      };

      await expect(calculator.calculateBatch(contents, strategyWithoutSubStrategies as any))
        .rejects.toThrow('Hybrid strategy must have sub-strategies');
    });

    it('should handle empty contents', async () => {
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      await expect(calculator.calculateBatch([], strategy))
        .rejects.toThrow('At least 2 contents are required');
    });

    it('should handle single content', async () => {
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      await expect(calculator.calculateBatch(['content'], strategy))
        .rejects.toThrow('At least 2 contents are required');
    });

    it('should handle empty content items', async () => {
      const contents = ['content1', ''];
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      await expect(calculator.calculateBatch(contents, strategy))
        .rejects.toThrow('Content cannot be empty');
    });
  });

  describe('getSubStrategies', () => {
    it('should extract sub-strategies from hybrid strategy', () => {
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      // @ts-ignore - accessing private method for testing
      const extracted = calculator.getSubStrategies(strategy);

      expect(extracted).toHaveLength(2);
      expect(extracted[0].type).toBe('levenshtein');
      expect(extracted[1].type).toBe('keyword');
    });

    it('should return empty array for strategies without getSubStrategies method', () => {
      const strategy = {
        type: 'hybrid',
        name: 'Mock',
        calculate: async () => 0.8,
        isSupported: () => true,
        getDefaultThreshold: () => 0.8
      };

      // @ts-ignore - accessing private method for testing
      const extracted = calculator.getSubStrategies(strategy);

      expect(extracted).toEqual([]);
    });
  });

  describe('calculateStrategyMatrix', () => {
    it('should calculate matrix for a single strategy', async () => {
      const contents = ['A', 'B', 'C'];
      const strategy = new MockSubStrategy('levenshtein');

      // @ts-ignore - accessing private method for testing
      const matrix = await calculator.calculateStrategyMatrix(contents, strategy);

      expect(matrix).toHaveLength(3);
      expect(matrix[0]).toHaveLength(3);
      // Check diagonal
      for (let i = 0; i < matrix.length; i++) {
        expect(matrix[i][i]).toBe(1.0);
      }
    });

    it('should create symmetric matrix', async () => {
      const contents = ['A', 'B', 'C'];
      const strategy = new MockSubStrategy('keyword');

      // @ts-ignore - accessing private method for testing
      const matrix = await calculator.calculateStrategyMatrix(contents, strategy);

      // Check symmetry
      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          expect(matrix[i][j]).toBe(matrix[j][i]);
        }
      }
    });
  });

  describe('getStrategyWeight', () => {
    it('should return default weight for known strategy', () => {
      const strategy = new MockSubStrategy('levenshtein');

      // @ts-ignore - accessing private method for testing
      const weight = calculator.getStrategyWeight(strategy);

      expect(weight).toBe(0.4);
    });

    it('should return correct default weights', () => {
      const strategies = [
        { strategy: new MockSubStrategy('levenshtein'), expectedWeight: 0.4 },
        { strategy: new MockSubStrategy('semantic'), expectedWeight: 0.4 },
        { strategy: new MockSubStrategy('keyword'), expectedWeight: 0.2 }
      ];

      strategies.forEach(({ strategy, expectedWeight }) => {
        // @ts-ignore - accessing private method for testing
        const weight = calculator.getStrategyWeight(strategy);
        expect(weight).toBe(expectedWeight);
      });
    });

    it('should return default weight for unknown strategy', () => {
      const strategy = new MockSubStrategy('structure');

      // @ts-ignore - accessing private method for testing
      const weight = calculator.getStrategyWeight(strategy);

      expect(weight).toBe(0.33);
    });

    it('should return custom weight from options', () => {
      const strategy = new MockSubStrategy('levenshtein');
      const options = {
        weights: {
          levenshtein: 0.6
        }
      };

      // @ts-ignore - accessing private method for testing
      const weight = calculator.getStrategyWeight(strategy, options);

      expect(weight).toBe(0.6);
    });
  });

  describe('mergeStrategyMatrices', () => {
    it('should merge matrices with weights', () => {
      const contents = ['A', 'B'];
      const strategyMatrices = [
        {
          strategy: new MockSubStrategy('levenshtein'),
          matrix: [[1, 0.6], [0.6, 1]],
          weight: 0.4
        },
        {
          strategy: new MockSubStrategy('keyword'),
          matrix: [[1, 0.8], [0.8, 1]],
          weight: 0.6
        }
      ];

      // @ts-ignore - accessing private method for testing
      const { matrix, pairs } = calculator.mergeStrategyMatrices(strategyMatrices, contents);

      expect(matrix).toHaveLength(2);
      // Weighted average: (0.6 * 0.4 + 0.8 * 0.6) / (0.4 + 0.6) = 0.72
      expect(matrix[0][1]).toBeCloseTo(0.72, 2);
    });

    it('should normalize weights correctly', () => {
      const contents = ['A', 'B'];
      const strategyMatrices = [
        {
          strategy: new MockSubStrategy('levenshtein'),
          matrix: [[1, 0.5], [0.5, 1]],
          weight: 1
        },
        {
          strategy: new MockSubStrategy('keyword'),
          matrix: [[1, 0.9], [0.9, 1]],
          weight: 2
        }
      ];

      // @ts-ignore - accessing private method for testing
      const { matrix } = calculator.mergeStrategyMatrices(strategyMatrices, contents);

      // Normalized weights: 1/3 and 2/3
      // Result: 0.5 * (1/3) + 0.9 * (2/3) = 0.167 + 0.6 = 0.767
      expect(matrix[0][1]).toBeCloseTo(0.7667, 2);
    });

    it('should apply threshold to pairs', () => {
      const contents = ['A', 'B', 'C'];
      const strategyMatrices = [
        {
          strategy: new MockSubStrategy('levenshtein'),
          matrix: [[1, 0.3, 0.4], [0.3, 1, 0.5], [0.4, 0.5, 1]],
          weight: 0.5
        }
      ];

      // @ts-ignore - accessing private method for testing
      const { pairs } = calculator.mergeStrategyMatrices(strategyMatrices, contents, { threshold: 0.4 });

      pairs.forEach(pair => {
        expect(pair.isSimilar).toBe(pair.similarity >= 0.4);
      });
    });

    it('should throw error when no valid matrices', () => {
      const contents = ['A', 'B'];

      // @ts-ignore - accessing private method for testing
      expect(() => calculator.mergeStrategyMatrices([], contents))
        .toThrow('No valid strategy matrices to merge');
    });
  });

  describe('calculateSubStrategyMatrices', () => {
    it('should calculate matrices for all sub-strategies in parallel', async () => {
      const contents = ['A', 'B', 'C'];
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];

      // @ts-ignore - accessing private method for testing
      const matrices = await calculator.calculateSubStrategyMatrices(contents, subStrategies);

      expect(matrices).toHaveLength(2);
      matrices.forEach(({ strategy, matrix, weight }) => {
        expect(strategy).toBeDefined();
        expect(matrix).toHaveLength(3);
        expect(weight).toBeGreaterThan(0);
      });
    });

    it('should handle failed sub-strategies gracefully', async () => {
      const contents = ['A', 'B'];
      const failingStrategy = new MockSubStrategy('keyword');
      failingStrategy.calculate = jest.fn().mockRejectedValue(new Error('Calculation failed'));

      // @ts-ignore - accessing private method for testing
      const matrices = await calculator.calculateSubStrategyMatrices(contents, [failingStrategy]);

      // Should return empty array (filtering out failed results)
      expect(matrices).toHaveLength(0);
    });
  });

  describe('isSupported', () => {
    it('should support hybrid strategy', () => {
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      expect(calculator.isSupported(strategy)).toBe(true);
    });

    it('should not support non-hybrid strategies', () => {
      const strategies = [
        { type: 'levenshtein', name: 'Lev' } as any,
        { type: 'keyword', name: 'Kw' } as any,
        { type: 'semantic', name: 'Sem' } as any,
        { type: 'structure', name: 'Struct' } as any
      ];

      strategies.forEach(strategy => {
        expect(calculator.isSupported(strategy)).toBe(false);
      });
    });
  });

  describe('getRecommendedBatchSize', () => {
    it('should return content count for small batches', () => {
      const contents = Array(5).fill('content');
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      const batchSize = calculator.getRecommendedBatchSize(contents, strategy);

      expect(batchSize).toBe(5);
    });

    it('should adjust batch size based on sub-strategy count', () => {
      const contents = Array(30).fill('content');
      
      // Single sub-strategy
      const singleSubStrategy = [new MockSubStrategy('levenshtein')];
      const strategyOne = new MockHybridStrategy(singleSubStrategy);
      const batchSizeOne = calculator.getRecommendedBatchSize(contents, strategyOne);

      // Multiple sub-strategies
      const multipleSubStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword'),
        new MockSubStrategy('semantic')
      ];
      const strategyMulti = new MockHybridStrategy(multipleSubStrategies);
      const batchSizeMulti = calculator.getRecommendedBatchSize(contents, strategyMulti);

      // More sub-strategies should result in smaller batch size
      expect(batchSizeMulti).toBeLessThanOrEqual(batchSizeOne);
    });

    it('should return appropriate size for large batches', () => {
      const contents = Array(500).fill('content');
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const batchSize = calculator.getRecommendedBatchSize(contents, strategy);

      expect(batchSize).toBeLessThanOrEqual(50);
      expect(batchSize).toBeGreaterThan(0);
    });
  });

  describe('estimateCalculationTime', () => {
    it('should estimate time for single sub-strategy', () => {
      const contents = Array(5).fill('content');
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      const estimatedTime = calculator.estimateCalculationTime(contents, strategy);

      expect(estimatedTime).toBeGreaterThan(0);
      // Pair count for 5 items: 5*4/2 = 10
      // 10 * 0.5 (time per pair for levenshtein) = 5
      expect(estimatedTime).toBeCloseTo(5, 1);
    });

    it('should estimate time for multiple sub-strategies', () => {
      const contents = Array(5).fill('content');
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const estimatedTime = calculator.estimateCalculationTime(contents, strategy);

      expect(estimatedTime).toBeGreaterThan(0);
      // 10 * (0.5 + 0.2) = 7
      expect(estimatedTime).toBeCloseTo(7, 1);
    });

    it('should include semantic API call time', () => {
      const contents = Array(5).fill('content');
      const subStrategies = [new MockSubStrategy('semantic')];
      const strategy = new MockHybridStrategy(subStrategies);

      const estimatedTime = calculator.estimateCalculationTime(contents, strategy);

      // 10 * 100 (API call time) = 1000
      expect(estimatedTime).toBeCloseTo(1000, 10);
    });
  });

  describe('getCalculatorStats', () => {
    it('should return correct stats', () => {
      const stats = calculator.getCalculatorStats();

      expect(stats.name).toBe('Hybrid Optimized Batch Calculator');
      expect(stats.type).toBe('hybrid-optimized');
      expect(stats.supportedStrategies).toEqual(['hybrid']);
      expect(stats.maxRecommendedBatchSize).toBe(50);
      expect(stats.performanceOptimization).toBe('Parallel sub-strategy calculation');
    });
  });

  describe('pairs calculation', () => {
    it('should include all unique pairs', async () => {
      const contents = ['A', 'B', 'C', 'D'];
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      // For 4 items: 4*3/2 = 6 pairs
      expect(result.pairs).toHaveLength(6);
    });

    it('should mark similar pairs correctly', async () => {
      const contents = ['A', 'B', 'C'];
      const subStrategies = [
        {
          type: 'test',
          name: 'Test',
          calculate: async (c1: string, c2: string) => c1 === c2 ? 1.0 : 0.5,
          isSupported: () => true,
          getDefaultThreshold: () => 0.8
        } as any
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy, { threshold: 0.8 });

      result.pairs.forEach(pair => {
        expect(pair.isSimilar).toBe(pair.similarity >= 0.8);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 2 contents', async () => {
      const contents = ['content1', 'content2'];
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result.matrix).toHaveLength(2);
      expect(result.pairs).toHaveLength(1);
    });

    it('should handle single sub-strategy', async () => {
      const contents = ['A', 'B', 'C'];
      const subStrategies = [new MockSubStrategy('levenshtein')];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(3);
    });

    it('should handle many sub-strategies', async () => {
      const contents = ['A', 'B'];
      const subStrategies = [
        new MockSubStrategy('levenshtein'),
        new MockSubStrategy('keyword'),
        new MockSubStrategy('semantic')
      ];
      const strategy = new MockHybridStrategy(subStrategies);

      const result = await calculator.calculateBatch(contents, strategy);

      expect(result).toBeDefined();
      expect(result.matrix).toHaveLength(2);
    });
  });
});
