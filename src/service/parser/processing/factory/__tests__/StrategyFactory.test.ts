/**
 * 策略工厂测试
 * 测试策略工厂的基本功能
 */

import { StrategyFactory } from '../StrategyFactory';
import { IProcessingStrategy } from '../../core/interfaces/IProcessingStrategy';
import { ProcessingConfig } from '../../core/types/ConfigTypes';

// 创建一个模拟的策略类用于测试
class MockStrategy implements IProcessingStrategy {
  readonly name: string = 'mock-strategy';
  readonly priority: number = 100;
  readonly supportedLanguages: string[] = ['*'];

  constructor(config: ProcessingConfig) {
    // 模拟构造函数
  }

  canHandle(context: any): boolean {
    return true;
  }

  async execute(context: any): Promise<any> {
    return { success: true, chunks: [], executionTime: 0, strategy: this.name };
  }
}

// 创建一个测试配置
const testConfig: ProcessingConfig = {
  chunking: {
    maxChunkSize: 2000,
    minChunkSize: 100,
    overlapSize: 50,
    maxLinesPerChunk: 100,
    minLinesPerChunk: 5,
    maxOverlapRatio: 0.2,
    defaultStrategy: 'line',
    strategyPriorities: {},
    enableIntelligentChunking: true,
    enableSemanticBoundaryDetection: true
  },
  features: {
    enableAST: true,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    enableCodeOverlap: true,
    enableStandardization: true,
    standardizationFallback: true,
    enableComplexityCalculation: true,
    enableLanguageFeatureDetection: true,
    featureDetectionThresholds: {}
  },
  performance: {
    memoryLimitMB: 512,
    maxExecutionTime: 30000,
    enableCaching: true,
    cacheSizeLimit: 1000,
    enablePerformanceMonitoring: true,
    concurrencyLimit: 4,
    queueSizeLimit: 100,
    enableBatchProcessing: false,
    batchSize: 10,
    enableLazyLoading: true
  },
  languages: {},
  postProcessing: {
    enabled: true,
    enabledProcessors: [],
    processorConfigs: {},
    processorOrder: [],
    maxProcessingRounds: 3,
    enableParallelProcessing: false,
    parallelProcessingLimit: 4
  },
  global: {
    debugMode: false,
    logLevel: 'info',
    enableMetrics: true,
    enableStatistics: true,
    configVersion: '1.0.0',
    compatibilityMode: false,
    strictMode: false,
    experimentalFeatures: [],
    customProperties: {}
  },
  version: '1.0.0',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

describe('StrategyFactory', () => {
  let factory: StrategyFactory;

  beforeEach(() => {
    factory = new StrategyFactory(testConfig);
  });

  describe('策略注册和创建', () => {
    it('应该能够注册和创建策略', () => {
      // 注册策略
      factory.registerStrategy('mock', MockStrategy as any);

      // 验证策略是否已注册
      expect(factory.supportsStrategy('mock')).toBe(true);
      expect(factory.getAvailableStrategies()).toContain('mock');

      // 创建策略实例
      const strategy = factory.createStrategy('mock');
      expect(strategy).toBeDefined();
      expect(strategy.name).toBe('mock-strategy');
    });

    it('应该在策略不存在时抛出错误', () => {
      expect(() => {
        factory.createStrategy('nonexistent');
      }).toThrow('Unknown strategy type: nonexistent');
    });
  });

  describe('策略缓存', () => {
    it('应该能够缓存策略实例', () => {
      factory.registerStrategy('mock', MockStrategy as any);

      // 创建第一个实例
      const strategy1 = factory.createStrategy('mock');

      // 创建第二个实例（应该从缓存中获取）
      const strategy2 = factory.createStrategy('mock');

      // 验证是否为同一实例
      expect(strategy1).toBe(strategy2);
    });

    it('应该能够清除缓存', () => {
      factory.registerStrategy('mock', MockStrategy as any);

      // 创建实例
      const strategy1 = factory.createStrategy('mock');

      // 清除缓存
      factory.clearCache();

      // 创建新实例（应该不是同一个实例）
      const strategy2 = factory.createStrategy('mock');

      // 验证是否为不同实例
      expect(strategy1).not.toBe(strategy2);
    });
  });

  describe('策略注销', () => {
    it('应该能够注销策略', () => {
      factory.registerStrategy('mock', MockStrategy as any);
      expect(factory.supportsStrategy('mock')).toBe(true);

      // 注销策略
      factory.unregisterStrategy('mock');
      expect(factory.supportsStrategy('mock')).toBe(false);
    });
  });
});