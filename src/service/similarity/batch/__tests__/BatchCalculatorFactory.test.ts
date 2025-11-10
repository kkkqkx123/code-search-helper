import { Container } from 'inversify';
import { BatchCalculatorFactory } from '../BatchCalculatorFactory';
import { GenericBatchCalculator } from '../calculators/GenericBatchCalculator';
import { SemanticOptimizedBatchCalculator } from '../calculators/SemanticOptimizedBatchCalculator';
import { HybridOptimizedBatchCalculator } from '../calculators/HybridOptimizedBatchCalculator';
import { AdaptiveBatchCalculator } from '../calculators/AdaptiveBatchCalculator';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { EmbedderFactory } from '../../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../../embedders/EmbeddingCacheService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';

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

// Mock ConfigService
class MockConfigService {
  get(key: string) {
    if (key === 'embeddingBatch') {
      return {
        defaultBatchSize: 50,
        providerBatchLimits: {
          openai: 2048,
          siliconflow: 64,
          ollama: 128,
          gemini: 100,
          mistral: 512,
          custom1: 100,
          custom2: 100,
          custom3: 100
        }
      };
    }
    return {};
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
    container.bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind(TYPES.ConfigService).toConstantValue(new MockConfigService());
    container.bind(TYPES.EmbedderFactory).toDynamicValue(() => {
      // 创建一个简单的Mock EmbedderFactory
      return {
        getEmbedder: jest.fn().mockResolvedValue({
          getModelName: () => 'mock-model',
          getDimensions: () => 1536,
          isAvailable: () => Promise.resolve(true),
          embed: jest.fn().mockResolvedValue([])
        }),
        getAvailableProviders: jest.fn().mockResolvedValue(['mock']),
        getDefaultProvider: () => 'mock'
      } as any;
    }).inSingletonScope();
    container.bind(TYPES.EmbeddingCacheService).toDynamicValue(() => {
      // 创建一个简单的Mock EmbeddingCacheService
      return {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
    }).inSingletonScope();
    container.bind(GenericBatchCalculator).to(GenericBatchCalculator).inSingletonScope();
    container.bind(SemanticOptimizedBatchCalculator).to(SemanticOptimizedBatchCalculator).inSingletonScope();
    container.bind(HybridOptimizedBatchCalculator).to(HybridOptimizedBatchCalculator).inSingletonScope();
    // 创建一个Mock BatchCalculatorFactory来解决循环依赖
    const mockCalculatorFactory = {
      createCalculator: jest.fn(),
      getAvailableCalculators: jest.fn(),
      selectOptimalCalculator: jest.fn()
    } as any;

    // 手动创建AdaptiveBatchCalculator，传入mock工厂
    const logger = container.get(TYPES.LoggerService) as LoggerService;
    const genericCalculator = container.get(GenericBatchCalculator) as GenericBatchCalculator;
    const semanticCalculator = container.get(SemanticOptimizedBatchCalculator) as SemanticOptimizedBatchCalculator;
    const hybridCalculator = container.get(HybridOptimizedBatchCalculator) as HybridOptimizedBatchCalculator;
    
    // 创建AdaptiveBatchCalculator并手动传入依赖
    const adaptiveCalculator = new AdaptiveBatchCalculator(logger, mockCalculatorFactory);
    
    factory = new BatchCalculatorFactory(
      logger,
      genericCalculator,
      semanticCalculator,
      hybridCalculator,
      adaptiveCalculator
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
    it('should select generic for semantic strategy with less than 5 contents', () => {
      const contents = ['content1', 'content2', 'content3', 'content4']; // 4 contents < 5, so returns 'generic'
      const type = factory.selectOptimalCalculator(mockStrategy, contents);
      expect(type).toBe('generic');
    });

    it('should select semantic-optimized for semantic strategy with more than 4 contents', () => {
      const contents = ['content1', 'content2', 'content3', 'content4', 'content5']; // 5 contents >= 5
      const type = factory.selectOptimalCalculator(mockStrategy, contents);
      expect(type).toBe('semantic-optimized');
    });

    it('should select generic for semantic strategy with less than 3 contents', () => {
      const contents = ['content1', 'content2'];
      const type = factory.selectOptimalCalculator(mockStrategy, contents);
      expect(type).toBe('generic');
    });

    it('should select adaptive for unknown strategy with more than 4 contents', () => {
      const unknownStrategy = { type: 'unknown' } as any;
      const contents = ['content1', 'content2', 'content3', 'content4', 'content5']; // 5 contents >= 5
      const type = factory.selectOptimalCalculator(unknownStrategy, contents);
      expect(type).toBe('adaptive');
    });

    it('should select generic for unknown strategy with less than 5 contents', () => {
      const unknownStrategy = { type: 'unknown' } as any;
      const contents = ['content1', 'content2', 'content3']; // Less than 5 contents
      const type = factory.selectOptimalCalculator(unknownStrategy, contents);
      expect(type).toBe('generic');
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