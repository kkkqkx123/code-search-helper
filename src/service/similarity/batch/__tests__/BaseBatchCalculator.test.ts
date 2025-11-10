import { BaseBatchCalculator } from '../BaseBatchCalculator';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult, SimilarityError } from '../../types/SimilarityTypes';
import { BatchCalculatorType, BatchCalculationStats, ExtendedBatchSimilarityResult } from '../types/BatchCalculatorTypes';
import { LoggerService } from '../../../../utils/LoggerService';

// 创建一个具体的实现类用于测试
class TestBatchCalculator extends BaseBatchCalculator {
  readonly name = 'TestBatchCalculator';
  readonly type: BatchCalculatorType = 'generic';

  async calculateBatch(
    contents: string[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    // 简单的实现：返回一个对角线为1的矩阵
    const matrix: number[][] = [];
    for (let i = 0; i < contents.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < contents.length; j++) {
        matrix[i][j] = i === j ? 1 : 0.5; // 对角线为1，其他为0.5
      }
    }

    return {
      matrix,
      pairs: this.buildPairsFromMatrix(matrix, contents, options),
      executionTime: 0,
      cacheHits: 0
    };
  }
  
  // 公开 protected 方法以供测试
  public validateInputForTest(contents: string[], strategy: ISimilarityStrategy, options?: SimilarityOptions): void {
    this.validateInput(contents, strategy, options);
  }
  
  public buildPairsFromMatrixForTest(
    matrix: number[][],
    contents: string[],
    options?: SimilarityOptions
  ): Array<{
    index1: number;
    index2: number;
    similarity: number;
    isSimilar: boolean;
  }> {
    return this.buildPairsFromMatrix(matrix, contents, options);
  }
  
  public createExtendedResultForTest(
    baseResult: BatchSimilarityResult,
    stats: BatchCalculationStats
  ): ExtendedBatchSimilarityResult {
    return this.createExtendedResult(baseResult, stats);
  }
  
  public createStatsForTest(
    startTime: number,
    apiCalls: number = 0,
    cacheHits: number = 0,
    calculatedPairs: number = 0
  ): BatchCalculationStats {
    return this.createStats(startTime, apiCalls, cacheHits, calculatedPairs);
  }
  
  public measureExecutionTimeForTest<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    return this.measureExecutionTime(operation);
  }
  
  public processInBatchesForTest<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[], batchIndex: number) => Promise<R[]>
  ): Promise<R[]> {
    return this.processInBatches(items, batchSize, processor);
  }
  
  public processInParallelForTest<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    maxConcurrency: number = 5
  ): Promise<R[]> {
    return this.processInParallel(items, processor, maxConcurrency);
  }
  
  public estimateMemoryUsageForTest(contents: string[]): number {
    return this.estimateMemoryUsage(contents);
  }
  
  public logPerformanceMetricsForTest(
    contents: string[],
    stats: BatchCalculationStats
  ): void {
    this.logPerformanceMetrics(contents, stats);
  }
}

describe('BaseBatchCalculator', () => {
  let calculator: TestBatchCalculator;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockStrategy: jest.Mocked<ISimilarityStrategy>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      trace: jest.fn().mockResolvedValue(undefined),
      getLogFilePath: jest.fn().mockResolvedValue(''),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockStrategy = {
      name: 'test-strategy',
      type: 'levenshtein',
      calculate: jest.fn().mockResolvedValue(0.8),
      isSupported: jest.fn().mockReturnValue(true),
      getDefaultThreshold: jest.fn().mockReturnValue(0.8),
    } as jest.Mocked<ISimilarityStrategy>;

    calculator = new TestBatchCalculator(mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with logger', () => {
      expect((calculator as any).logger).toBe(mockLogger);
    });
  });

  describe('isSupported', () => {
    it('should return true by default', () => {
      const result = calculator.isSupported(mockStrategy);
      expect(result).toBe(true);
    });
  });

  describe('getRecommendedBatchSize', () => {
    it('should return content length for small content arrays (<= 10)', () => {
      const contents = Array(5).fill('test content');
      const result = calculator.getRecommendedBatchSize(contents, mockStrategy);
      expect(result).toBe(5);
    });

    it('should return 20 for medium content arrays (11-50)', () => {
      const contents = Array(30).fill('test content');
      const result = calculator.getRecommendedBatchSize(contents, mockStrategy);
      expect(result).toBe(20);
    });

    it('should return default batch size (50) for large content arrays (> 50)', () => {
      const contents = Array(100).fill('test content');
      const result = calculator.getRecommendedBatchSize(contents, mockStrategy);
      expect(result).toBe(50);
    });

    it('should return content length if it is less than calculated batch size', () => {
      const contents = Array(15).fill('test content');
      const result = calculator.getRecommendedBatchSize(contents, mockStrategy);
      expect(result).toBe(15);
    });
  });

  describe('validateInput', () => {
    it('should throw error for insufficient content (less than 2)', () => {
      expect(() => {
        calculator.validateInputForTest([], mockStrategy);
      }).toThrow(SimilarityError);
      expect(() => {
        calculator.validateInputForTest(['content'], mockStrategy);
      }).toThrow(SimilarityError);
    });

    it('should throw error for missing strategy', () => {
      expect(() => {
        calculator.validateInputForTest(['content1', 'content2'], null as any);
      }).toThrow(SimilarityError);
    });

    it('should throw error for empty content', () => {
      expect(() => {
        calculator.validateInputForTest(['content1', ''], mockStrategy);
      }).toThrow(SimilarityError);
      expect(() => {
        calculator.validateInputForTest(['content1', '   '], mockStrategy);
      }).toThrow(SimilarityError);
    });

    it('should throw error for invalid threshold', () => {
      expect(() => {
        calculator.validateInputForTest(['content1', 'content2'], mockStrategy, { threshold: -0.1 });
      }).toThrow(SimilarityError);
      expect(() => {
        calculator.validateInputForTest(['content1', 'content2'], mockStrategy, { threshold: 1.1 });
      }).toThrow(SimilarityError);
    });

    it('should not throw error for valid inputs', () => {
      expect(() => {
        calculator.validateInputForTest(['content1', 'content2'], mockStrategy, { threshold: 0.5 });
      }).not.toThrow();
    });
  });

  describe('buildPairsFromMatrix', () => {
    it('should build pairs from similarity matrix', () => {
      const matrix = [
        [1, 0.8, 0.2],
        [0.8, 1, 0.6],
        [0.2, 0.6, 1]
      ];
      const contents = ['content1', 'content2', 'content3'];
      const options = { threshold: 0.5 };

      const pairs = calculator.buildPairsFromMatrixForTest(matrix, contents, options);

      expect(pairs).toHaveLength(3); // (0,1), (0,2), (1,2)
      expect(pairs).toContainEqual({
        index1: 0,
        index2: 1,
        similarity: 0.8,
        isSimilar: true
      });
      expect(pairs).toContainEqual({
        index1: 0,
        index2: 2,
        similarity: 0.2,
        isSimilar: false
      });
      expect(pairs).toContainEqual({
        index1: 1,
        index2: 2,
        similarity: 0.6,
        isSimilar: true
      });
    });

    it('should use default threshold when not provided', () => {
      const matrix = [
        [1, 0.7, 0.3],
        [0.7, 1, 0.4],
        [0.3, 0.4, 1]
      ];
      const contents = ['content1', 'content2', 'content3'];

      const pairs = calculator.buildPairsFromMatrixForTest(matrix, contents);

      expect(pairs).toContainEqual({
        index1: 0,
        index2: 1,
        similarity: 0.7,
        isSimilar: false // 0.7 < 0.8 (default threshold)
      });
      expect(pairs).toContainEqual({
        index1: 0,
        index2: 2,
        similarity: 0.3,
        isSimilar: false
      });
      expect(pairs).toContainEqual({
        index1: 1,
        index2: 2,
        similarity: 0.4,
        isSimilar: false
      });
    });
  });

  describe('createExtendedResult', () => {
    it('should create extended result with stats and calculator info', () => {
      const baseResult: BatchSimilarityResult = {
        matrix: [[1, 0.5], [0.5, 1]],
        pairs: [],
        executionTime: 100,
        cacheHits: 5
      };
      const stats: BatchCalculationStats = {
        totalTime: 200,
        apiCalls: 2,
        cacheHits: 5,
        calculatedPairs: 1,
        calculatorType: 'generic'
      };

      const extendedResult = calculator.createExtendedResultForTest(baseResult, stats);

      expect(extendedResult).toHaveProperty('stats');
      expect(extendedResult).toHaveProperty('calculator');
      expect(extendedResult.stats).toBe(stats);
      expect(extendedResult.calculator.name).toBe('TestBatchCalculator');
      expect(extendedResult.calculator.type).toBe('generic');
    });
  });

  describe('createStats', () => {
    it('should create stats with correct values', () => {
      const startTime = Date.now() - 100; // 100ms ago
      const stats = calculator.createStatsForTest(startTime, 3, 5, 10);

      expect(stats.totalTime).toBeGreaterThanOrEqual(100);
      expect(stats.apiCalls).toBe(3);
      expect(stats.cacheHits).toBe(5);
      expect(stats.calculatedPairs).toBe(10);
      expect(stats.calculatorType).toBe('generic');
    });
  });

  describe('measureExecutionTime', () => {
    it('should measure execution time correctly', async () => {
      const testOperation = async () => {
        // 模拟一些异步操作
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await calculator.measureExecutionTimeForTest(testOperation);

      expect(result.result).toBe('result');
      expect(result.executionTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('processInBatches', () => {
    it('should process items in batches correctly', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const batchSize = 3;

      const processor = jest.fn().mockImplementation(async (batch: number[], batchIndex: number) => {
        return batch.map(item => item * 2);
      });

      const results = await calculator.processInBatchesForTest(items, batchSize, processor);

      expect(processor).toHaveBeenCalledTimes(3); // ceil(7/3) = 3 batches
      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
      expect(processor).toHaveBeenNthCalledWith(1, [1, 2, 3], 0);
      expect(processor).toHaveBeenNthCalledWith(2, [4, 5, 6], 1);
      expect(processor).toHaveBeenNthCalledWith(3, [7], 2);
    });
  });

  describe('processInParallel', () => {
    it('should process items in parallel correctly', async () => {
      const items = [1, 2, 3, 4, 5];

      const processor = jest.fn().mockImplementation(async (item: number, index: number) => {
        // 模拟异步操作
        await new Promise(resolve => setTimeout(resolve, 1));
        return item * 2;
      });

      const results = await calculator.processInParallelForTest(items, processor, 3);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should handle empty items array', async () => {
      const results = await calculator.processInParallelForTest([], async (item, index) => item);
      expect(results).toEqual([]);
    });
  });

  describe('estimateMemoryUsage', () => {
    it('should estimate memory usage correctly', () => {
      const contents = ['short', 'medium content', 'very long content that takes more memory'];
      
      const memoryEstimate = calculator.estimateMemoryUsageForTest(contents);
      
      // 计算预期值：内容长度(UTF-16) + 矩阵大小
      const contentSize = contents.reduce((sum, content) => sum + content.length * 2, 0);
      const matrixSize = contents.length * contents.length * 8;
      const expectedSize = contentSize + matrixSize;
      
      expect(memoryEstimate).toBe(expectedSize);
    });
  });

  describe('logPerformanceMetrics', () => {
    it('should call logger with correct metrics', () => {
      const contents = ['content1', 'content2', 'content3'];
      const stats: BatchCalculationStats = {
        totalTime: 500,
        apiCalls: 2,
        cacheHits: 1,
        calculatedPairs: 3,
        calculatorType: 'generic',
        peakMemoryUsage: 1024
      };

      calculator.logPerformanceMetricsForTest(contents, stats);

      expect(mockLogger.info).toHaveBeenCalledWith('Batch similarity calculation completed', {
        calculator: 'TestBatchCalculator',
        type: 'generic',
        contentCount: 3,
        totalTime: 500,
        apiCalls: 2,
        cacheHits: 1,
        calculatedPairs: 3,
        avgTimePerPair: 500 / 3,
        memoryUsage: 1024
      });
    });
  });
});