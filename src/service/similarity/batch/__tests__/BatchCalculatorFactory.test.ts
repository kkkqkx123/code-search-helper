import { Container } from 'inversify';
import { BatchCalculatorFactory } from '../BatchCalculatorFactory';
import { GenericBatchCalculator } from '../calculators/GenericBatchCalculator';
import { SemanticOptimizedBatchCalculator } from '../calculators/SemanticOptimizedBatchCalculator';
import { HybridOptimizedBatchCalculator } from '../calculators/HybridOptimizedBatchCalculator';
import { AdaptiveBatchCalculator } from '../calculators/AdaptiveBatchCalculator';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock 策略类
class MockStrategy {
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

describe('BatchCalculatorFactory', () => {
  let container: Container;
  let factory: BatchCalculatorFactory;
  let mockStrategy: MockStrategy;

  beforeEach(() => {
    container = new Container();
    mockStrategy = new MockStrategy();

    // 注册依赖
    container.bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind(TYPES.GenericBatchCalculator).to(GenericBatchCalculator).inSingletonScope();
    container.bind(TYPES.SemanticOptimizedBatchCalculator).to(SemanticOptimizedBatchCalculator).inSingletonScope();
    container.bind(TYPES.HybridOptimizedBatchCalculator).to(HybridOptimizedBatchCalculator).inSingletonScope();
    container.bind(TYPES.AdaptiveBatchCalculator).to(AdaptiveBatchCalculator).inSingletonScope();

    // 创建工厂
    factory = new BatchCalculatorFactory(
      container.get(TYPES.LoggerService),
      container.get(TYPES.GenericBatchCalculator),
      container.get(TYPES.SemanticOptimizedBatchCalculator),
      container.get(TYPES.HybridOptimizedBatchCalculator),
      container.get(TYPES.AdaptiveBatchCalculator)
    );
  });

  describe('createCalculator', () => {
    it('should create a generic batch calculator', () => {
      const calculator = factory.createCalculator('generic');
      expect(calculator).toBeDefined();
      expect(calculator.type).toBe('generic');
    });

    it('should create a semantic optimized batch calculator', () => {
      const calculator = factory.createCalculator('semantic-optimized');
      expect(calculator).toBeDefined();
      expect(calculator.type).toBe('semantic-optimized');
    });

    it('should create a hybrid optimized batch calculator', () => {
      const calculator = factory.createCalculator('hybrid-optimized');
      expect(calculator).toBeDefined();
      expect(calculator.type).toBe('hybrid-optimized');
    });

    it('should create an adaptive batch calculator', () => {
      const calculator = factory.createCalculator('adaptive');
      expect(calculator).toBeDefined();
      expect(calculator.type).toBe('adaptive');
    });

    it('should throw an error for unknown calculator type', () => {
      expect(() => {
        factory.createCalculator('unknown' as any);
      }).toThrow();
    });
  });

  describe('getAvailableCalculators', () => {
    it('should return all available calculator types', () => {
      const available = factory.getAvailableCalculators();
      expect(available).toContain('generic');
      expect(available).toContain('semantic-optimized');
      expect(available).toContain('hybrid-optimized');
      expect(available).toContain('adaptive');
    });
  });

  describe('selectOptimalCalculator', () => {
    it('should select semantic-optimized for semantic strategy with more than 3 contents', () => {
      const contents = ['content1', 'content2', 'content3', 'content4'];
      const type = factory.selectOptimalCalculator(mockStrategy, contents);
      expect(type).toBe('semantic-optimized');
    });

    it('should select generic for semantic strategy with less than 3 contents', () => {
      const contents = ['content1', 'content2'];
      const type = factory.selectOptimalCalculator(mockStrategy, contents);
      expect(type).toBe('generic');
    });

    it('should select adaptive for unknown strategy', () => {
      const unknownStrategy = { type: 'unknown' } as any;
      const contents = ['content1', 'content2', 'content3'];
      const type = factory.selectOptimalCalculator(unknownStrategy, contents);
      expect(type).toBe('adaptive');
    });
  });

  describe('isCalculatorAvailable', () => {
    it('should return true for available calculators', () => {
      expect(factory.isCalculatorAvailable('generic')).toBe(true);
      expect(factory.isCalculatorAvailable('semantic-optimized')).toBe(true);
      expect(factory.isCalculatorAvailable('hybrid-optimized')).toBe(true);
      expect(factory.isCalculatorAvailable('adaptive')).toBe(true);
    });

    it('should return false for unavailable calculators', () => {
      expect(factory.isCalculatorAvailable('unknown' as any)).toBe(false);
    });
  });
});