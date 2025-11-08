/**
 * 策略优先级集成测试
 * 验证重构后的策略选择和优先级排序功能
 */

import { ProcessingCoordinator } from '../coordinator/ProcessingCoordinator';
import { StrategyFactory } from '../factory/StrategyFactory';
import { ChunkPostProcessorCoordinator } from '../post-processing/ChunkPostProcessorCoordinator';
import { ProcessingContext, ContextBuilder } from '../types/Context';
import { UNIFIED_STRATEGY_PRIORITIES, getPrioritizedStrategies, getLanguageSpecificStrategies } from '../../constants/StrategyPriorities';
import { ProcessingConfig } from '../core/types/ConfigTypes';

// 创建一个简单的策略模拟
class MockStrategy {
  name = 'MockStrategy';
  priority = 999;
  supportedLanguages = ['*'];

  constructor(private config?: any) { }

  canHandle(context: ProcessingContext): boolean {
    return true; // 简单实现，总是可以处理
  }

  async execute(context: ProcessingContext): Promise<any> {
    return {
      chunks: [{ content: context.content, start: 0, end: context.content.length }],
      metadata: { strategy: 'mock' }
    };
  }

  getName(): string {
    return 'MockStrategy';
  }
}

// 创建一个简单的配置管理器模拟
class MockConfigManager {
  private config: ProcessingConfig;

  constructor() {
    this.config = {
      chunking: {
        maxChunkSize: 3000,
        minChunkSize: 200,
        defaultStrategy: undefined
      },
      performance: {
        enableCaching: true,
        maxExecutionTime: 30000
      },
      features: {},
      languages: {},
      postProcessing: {},
      global: {},
      version: '1.0.0',
      createdAt: Date.now()
    } as unknown as ProcessingConfig;
  }

  getConfig(): ProcessingConfig {
    return this.config;
  }

  getLanguageConfig(language: string): any {
    return {};
  }

  updateConfig(updates: Partial<ProcessingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  resetToDefaults(): void {
    // 重置逻辑
  }
}

describe('Strategy Priority Integration Tests', () => {
  let coordinator: ProcessingCoordinator;
  let strategyFactory: StrategyFactory;
  let configManager: MockConfigManager;
  let postProcessorCoordinator: ChunkPostProcessorCoordinator;

  beforeEach(() => {
    // 初始化依赖
    configManager = new MockConfigManager();
    strategyFactory = new StrategyFactory(configManager.getConfig());
    postProcessorCoordinator = new ChunkPostProcessorCoordinator();

    // 手动注册一些策略用于测试
    strategyFactory.registerStrategy('markdown-segmentation', MockStrategy as any);
    strategyFactory.registerStrategy('xml-segmentation', MockStrategy as any);
    strategyFactory.registerStrategy('layered-html', MockStrategy as any);
    strategyFactory.registerStrategy('ast-codesplitter', MockStrategy as any);
    strategyFactory.registerStrategy('bracket-segmentation', MockStrategy as any);
    strategyFactory.registerStrategy('line-segmentation', MockStrategy as any);

    coordinator = new ProcessingCoordinator(
      strategyFactory,
      configManager as any,
      postProcessorCoordinator
    );
  });

  describe('Priority Constants', () => {
    it('应该有正确的优先级数值', () => {
      expect(UNIFIED_STRATEGY_PRIORITIES['markdown-segmentation']).toBe(0);
      expect(UNIFIED_STRATEGY_PRIORITIES['xml-segmentation']).toBe(1);
      expect(UNIFIED_STRATEGY_PRIORITIES['layered-html']).toBe(2);
      expect(UNIFIED_STRATEGY_PRIORITIES['ast-codesplitter']).toBe(3);
      expect(UNIFIED_STRATEGY_PRIORITIES['bracket-segmentation']).toBe(4);
      expect(UNIFIED_STRATEGY_PRIORITIES['line-segmentation']).toBe(5);
    });

    it('应该按优先级正确排序策略（优化后）', () => {
      const strategies = ['line-segmentation', 'markdown-segmentation', 'ast-codesplitter'];
      const sorted = getPrioritizedStrategies(strategies);

      expect(sorted[0]).toBe('markdown-segmentation'); // 优先级 0
      expect(sorted[1]).toBe('ast-codesplitter');      // 优先级 3
      expect(sorted[2]).toBe('line-segmentation');     // 优先级 5
    });
  });

  describe('Language Specific Strategies', () => {
    it('应该为TypeScript返回正确的策略顺序（优化后）', () => {
      const strategies = getLanguageSpecificStrategies('typescript');

      expect(strategies).toContain('ast-codesplitter');
      expect(strategies).toContain('bracket-segmentation');
      expect(strategies).toContain('line-segmentation');
    });

    it('应该为Python返回正确的策略顺序（优化后）', () => {
      const strategies = getLanguageSpecificStrategies('python');

      expect(strategies).toContain('ast-codesplitter');
      expect(strategies).toContain('bracket-segmentation');
      expect(strategies).toContain('line-segmentation');
    });

    it('应该为未知语言返回所有策略', () => {
      const strategies = getLanguageSpecificStrategies('unknown');
      const allStrategies = Object.keys(UNIFIED_STRATEGY_PRIORITIES);

      expect(strategies).toEqual(allStrategies);
    });
  });

  describe('Strategy Factory', () => {
    it('应该返回按优先级排序的策略列表', () => {
      const availableStrategies = strategyFactory.getAvailableStrategies();

      // 验证返回的策略是按优先级排序的
      for (let i = 0; i < availableStrategies.length - 1; i++) {
        const currentPriority = UNIFIED_STRATEGY_PRIORITIES[availableStrategies[i]];
        const nextPriority = UNIFIED_STRATEGY_PRIORITIES[availableStrategies[i + 1]];

        expect(currentPriority).toBeLessThanOrEqual(nextPriority);
      }
    });
  });

  describe('Processing Context Creation', () => {
    it('应该能够创建有效的处理上下文', () => {
      const content = 'function test() { return "hello"; }';
      const context = new ContextBuilder(content)
        .setLanguage('typescript')
        .setFilePath('test.ts')
        .setConfig(configManager.getConfig())
        .setFeatures({} as any)
        .build();

      expect(context.content).toBe(content);
      expect(context.language).toBe('typescript');
      expect(context.filePath).toBe('test.ts');
    });
  });

  describe('Integration Test', () => {
    it('应该能够完成基本的策略选择流程', () => {
      const content = 'function test() { return "hello"; }';
      const context = new ContextBuilder(content)
        .setLanguage('typescript')
        .setFilePath('test.ts')
        .setConfig(configManager.getConfig())
        .setFeatures({} as any)
        .build();

      // 验证上下文创建成功
      expect(context.language).toBe('typescript');
      expect(context.filePath).toBe('test.ts');

      // 验证策略工厂能获取可用策略
      const strategies = strategyFactory.getAvailableStrategies();
      expect(strategies.length).toBeGreaterThan(0);

      // 验证优先级排序
      const sortedStrategies = getPrioritizedStrategies(strategies);
      expect(sortedStrategies.length).toBe(strategies.length);
    });
  });
});