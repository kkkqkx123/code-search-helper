import { strategyFactory } from '../core/SplitStrategyFactory';
import { ensureStrategyProvidersRegistered } from '../core/StrategyProviderRegistration';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';

// 确保在测试开始前注册所有策略提供者
beforeAll(() => {
  ensureStrategyProvidersRegistered();
});

describe('Strategy Pattern Tests', () => {
  describe('Strategy Factory', () => {
    it('should create FunctionSplitter strategy', () => {
      const strategy = strategyFactory.create('FunctionSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('FunctionSplitter');
    });

    it('should create ClassSplitter strategy', () => {
      const strategy = strategyFactory.create('ClassSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('ClassSplitter');
    });

    it('should create ImportSplitter strategy', () => {
      const strategy = strategyFactory.create('ImportSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('ImportSplitter');
    });

    it('should create SyntaxAwareSplitter strategy', () => {
      const strategy = strategyFactory.create('SyntaxAwareSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('SyntaxAwareSplitter');
    });

    it('should create IntelligentSplitter strategy', () => {
      const strategy = strategyFactory.create('IntelligentSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('IntelligentSplitter');
    });

    it('should throw error for unknown strategy', () => {
      expect(() => {
        strategyFactory.create('UnknownStrategy');
      }).toThrow('Unknown strategy type: UnknownStrategy');
    });

    it('should support strategy options', () => {
      const options: ChunkingOptions = {
        maxChunkSize: 2000,
        minChunkSize: 100
      };
      const strategy = strategyFactory.create('FunctionSplitter', options);
      expect(strategy).toBeDefined();
    });
  });

  describe('Strategy Registration', () => {
    it('should have all expected strategies registered', () => {
      const availableStrategies = strategyFactory.getAvailableStrategies();
      expect(availableStrategies).toContain('FunctionSplitter');
      expect(availableStrategies).toContain('ClassSplitter');
      expect(availableStrategies).toContain('ImportSplitter');
      expect(availableStrategies).toContain('SyntaxAwareSplitter');
      expect(availableStrategies).toContain('IntelligentSplitter');
    });

    it('should support strategy checking', () => {
      expect(strategyFactory.supportsStrategy('FunctionSplitter')).toBe(true);
      expect(strategyFactory.supportsStrategy('UnknownStrategy')).toBe(false);
    });

    it('should provide strategy info', () => {
      const info = strategyFactory.getStrategyInfo('FunctionSplitter');
      expect(info).toBeDefined();
      expect(info?.exists).toBe(true);
    });
  });

  describe('Strategy Dependencies', () => {
    it('should correctly identify TreeSitterService dependency', () => {
      const info = strategyFactory.getStrategyInfo('FunctionSplitter');
      expect(info?.requiresTreeSitter).toBe(true);
    });

    it('should correctly identify LoggerService dependency', () => {
      const info = strategyFactory.getStrategyInfo('FunctionSplitter');
      expect(info?.requiresLogger).toBe(true);
    });
  });

  describe('Strategy Functionality', () => {
    it('FunctionSplitter should have correct priority', () => {
      const strategy = strategyFactory.create('FunctionSplitter');
      const priority = strategy.getPriority();
      expect(typeof priority).toBe('number');
      expect(priority).toBeGreaterThan(0);
    });

    it('ClassSplitter should have correct priority', () => {
      const strategy = strategyFactory.create('ClassSplitter');
      const priority = strategy.getPriority();
      expect(typeof priority).toBe('number');
      expect(priority).toBeGreaterThan(0);
    });

    it('ImportSplitter should have correct priority', () => {
      const strategy = strategyFactory.create('ImportSplitter');
      const priority = strategy.getPriority();
      expect(typeof priority).toBe('number');
      expect(priority).toBeGreaterThan(0);
    });

    it('SyntaxAwareSplitter should have correct priority', () => {
      const strategy = strategyFactory.create('SyntaxAwareSplitter');
      const priority = strategy.getPriority();
      expect(typeof priority).toBe('number');
      expect(priority).toBeGreaterThan(0);
    });

    it('IntelligentSplitter should support all languages', () => {
      const strategy = strategyFactory.create('IntelligentSplitter');
      expect(strategy.supportsLanguage('javascript')).toBe(true);
      expect(strategy.supportsLanguage('python')).toBe(true);
      expect(strategy.supportsLanguage('java')).toBe(true);
    });
  });

  describe('Strategy Factory Stats', () => {
    it('should provide factory statistics', () => {
      const stats = strategyFactory.getFactoryStats();
      expect(stats).toBeDefined();
      expect(stats.registeredStrategies).toBeGreaterThan(0);
      expect(stats.availableStrategyTypes).toBeInstanceOf(Array);
      expect(stats.availableStrategyTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Strategy Compatibility', () => {
    it('should support legacy registerStrategy method', () => {
      const initialCount = strategyFactory.getAvailableStrategies().length;
      
      // 创建一个新的策略类
      class TestStrategy {
        getName() { return 'TestStrategy'; }
        supportsLanguage() { return true; }
        getPriority() { return 1; }
        async split() { return []; }
      }
      
      // 使用兼容方法注册
      strategyFactory.registerStrategy('TestStrategy', TestStrategy as any);
      
      const newCount = strategyFactory.getAvailableStrategies().length;
      expect(newCount).toBe(initialCount + 1);
      expect(strategyFactory.supportsStrategy('TestStrategy')).toBe(true);
      
      // 清理
      strategyFactory.unregisterStrategy('TestStrategy');
    });
  });

  describe('Strategy Error Handling', () => {
    it('should handle strategy creation errors gracefully', () => {
      // 创建一个会抛出错误的策略提供者
      const errorProvider = {
        getName: () => 'ErrorStrategy',
        createStrategy: () => {
          throw new Error('Creation failed');
        },
        getDependencies: () => []
      };
      
      strategyFactory.registerProvider(errorProvider);
      
      expect(() => {
        strategyFactory.create('ErrorStrategy');
      }).toThrow('Failed to create strategy ErrorStrategy: Error: Creation failed');
      
      // 清理
      strategyFactory.unregisterStrategy('ErrorStrategy');
    });
  });

  describe('Strategy Service Integration', () => {
    it('should handle strategies with dynamic service setting', () => {
      const strategy = strategyFactory.create('SyntaxAwareSplitter');
      
      // 验证策略可以通过工厂获取其他策略
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('SyntaxAwareSplitter');
      
      // SyntaxAwareSplitter应该能够通过工厂获取其他策略
      // 这验证了我们重构的正确性 - 不再直接导入其他策略
      const functionSplitter = strategyFactory.create('FunctionSplitter');
      const classSplitter = strategyFactory.create('ClassSplitter');
      const importSplitter = strategyFactory.create('ImportSplitter');
      
      expect(functionSplitter).toBeDefined();
      expect(classSplitter).toBeDefined();
      expect(importSplitter).toBeDefined();
    });
  });
});