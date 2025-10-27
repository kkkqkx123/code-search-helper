import { UnifiedStrategyFactory } from '../strategies/factory/UnifiedStrategyFactory';
import { UnifiedStrategyManager } from '../strategies/manager/UnifiedStrategyManager';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

describe('UnifiedStrategyFactory', () => {
  let factory: UnifiedStrategyFactory;
  let logger: LoggerService;
  let configManager: UnifiedConfigManager;

  beforeEach(() => {
    logger = new LoggerService();
    configManager = new UnifiedConfigManager();
    factory = new UnifiedStrategyFactory(logger, configManager);
  });

  describe('策略提供者注册', () => {
    it('应该自动注册默认策略提供者', () => {
      const providers = factory.getAvailableProviders();
      
      expect(providers).toContain('treesitter_ast');
      expect(providers).toContain('universal_semantic');
      expect(providers).toContain('universal_semantic_fine');
      expect(providers).toContain('universal_line');
      expect(providers).toContain('markdown_specialized');
      expect(providers).toContain('xml_specialized');
      expect(providers).toContain('universal_bracket');
    });

    it('应该能够获取策略提供者的依赖', () => {
      const astDependencies = factory.getProviderDependencies('treesitter_ast');
      expect(astDependencies).toContain('TreeSitterService');

      const semanticDependencies = factory.getProviderDependencies('universal_semantic');
      expect(semanticDependencies).toContain('UniversalTextStrategy');
    });

    it('应该能够验证策略提供者', () => {
      const validation = factory.validateProviders();
      
      expect(validation.valid.length).toBeGreaterThan(0);
      expect(validation.invalid.length).toBe(0);
    });
  });

  describe('策略创建', () => {
    it('应该能够根据类型创建策略', () => {
      const strategy = factory.createStrategyFromType('universal_line');
      
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('LineStrategy');
      expect(strategy.supportsLanguage('typescript')).toBe(true);
    });

    it('应该能够根据语言创建策略', () => {
      const strategy = factory.createStrategyFromLanguage('typescript');
      
      expect(strategy).toBeDefined();
      expect(strategy.supportsLanguage('typescript')).toBe(true);
    });

    it('应该能够根据检测结果创建策略', () => {
      const detection = {
        language: 'typescript',
        confidence: 0.9,
        processingStrategy: 'treesitter_ast'
      };
      
      const strategy = factory.createStrategyFromDetection(detection);
      
      expect(strategy).toBeDefined();
      expect(strategy.supportsLanguage('typescript')).toBe(true);
    });

    it('应该在策略类型不支持时回退到默认策略', () => {
      const strategy = factory.createStrategyFromType('nonexistent_strategy');
      
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('minimal_fallback');
    });
  });

  describe('策略执行', () => {
    it('应该能够执行行级策略', async () => {
      const strategy = factory.createStrategyFromType('universal_line');
      const content = 'console.log("Hello, World!");';
      
      const chunks = await strategy.split(content, 'javascript', 'test.js');
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('console.log');
      expect(chunks[0].metadata.language).toBe('javascript');
    });

    it('应该能够执行语义策略', async () => {
      const strategy = factory.createStrategyFromType('universal_semantic');
      const content = `
        function hello() {
          console.log("Hello, World!");
        }
        
        function goodbye() {
          console.log("Goodbye!");
        }
      `;
      
      const chunks = await strategy.split(content, 'javascript', 'test.js');
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

describe('UnifiedStrategyManager', () => {
  let manager: UnifiedStrategyManager;
  let factory: UnifiedStrategyFactory;
  let configManager: UnifiedConfigManager;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService();
    configManager = new UnifiedConfigManager();
    factory = new UnifiedStrategyFactory(logger, configManager);
    manager = new UnifiedStrategyManager(factory, configManager, logger);
  });

  describe('策略选择', () => {
    it('应该能够选择最优策略', () => {
      const strategy = manager.selectOptimalStrategy('typescript', 'const x = 1;');
      
      expect(strategy).toBeDefined();
      expect(strategy.supportsLanguage('typescript')).toBe(true);
    });

    it('应该能够使用启发式策略选择', () => {
      const detection = {
        language: 'typescript',
        confidence: 0.8,
        processingStrategy: 'universal_semantic'
      };
      
      const strategy = manager.selectStrategyWithHeuristics(
        'test.ts',
        'const x = 1;',
        detection
      );
      
      expect(strategy).toBeDefined();
      expect(strategy.supportsLanguage('typescript')).toBe(true);
    });

    it('应该能够获取降级路径', () => {
      const fallbackPath = manager.getFallbackPath('treesitter_ast');
      
      expect(fallbackPath).toContain('universal_semantic');
      expect(fallbackPath).toContain('universal_line');
    });

    it('应该能够创建降级策略', () => {
      const detection = {
        language: 'typescript',
        confidence: 0.8,
        processingStrategy: 'treesitter_ast'
      };
      
      const fallbackStrategy = manager.createFallbackStrategy(
        detection,
        'universal_line'
      );
      
      expect(fallbackStrategy).toBeDefined();
      expect(fallbackStrategy.getName()).toBe('LineStrategy');
    });
  });

  describe('策略执行', () => {
    it('应该能够执行策略', async () => {
      const strategy = manager.selectOptimalStrategy('typescript', 'const x = 1;');
      const context = {
        language: 'typescript',
        sourceCode: 'const x = 1;',
        filePath: 'test.ts'
      };
      
      const result = await manager.executeStrategy(strategy, context);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('应该能够批量执行策略', async () => {
      const strategies = [
        manager.selectOptimalStrategy('typescript', 'const x = 1;'),
        manager.selectOptimalStrategy('javascript', 'const y = 2;')
      ];
      const context = {
        language: 'typescript',
        sourceCode: 'const x = 1;\nconst y = 2;',
        filePath: 'test.js'
      };
      
      const results = await manager.executeStrategies(strategies, context);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });
  });

  describe('ChunkingStrategyManager集成', () => {
    it('应该能够注册策略', () => {
      const strategy = manager.selectOptimalStrategy('typescript', 'const x = 1;');
      manager.registerStrategy(strategy);
      
      const retrievedStrategy = manager.getStrategy(strategy.getName());
      expect(retrievedStrategy).toBe(strategy);
    });

    it('应该能够获取适用于特定语言的策略', () => {
      const strategies = manager.getStrategiesForLanguage('typescript');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.every(s => s.supportsLanguage('typescript'))).toBe(true);
    });

    it('应该能够执行分层分段策略', async () => {
      const context = {
        language: 'typescript',
        sourceCode: `
          function test() {
            console.log("test");
          }
          
          class TestClass {
            constructor() {}
          }
        `,
        filePath: 'test.ts'
      };
      
      const chunks = await manager.executeHierarchicalStrategy(context);
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('性能监控', () => {
    it('应该能够收集性能统计', async () => {
      const strategy = manager.selectOptimalStrategy('typescript', 'const x = 1;');
      const context = {
        language: 'typescript',
        sourceCode: 'const x = 1;',
        filePath: 'test.ts'
      };
      
      await manager.executeStrategy(strategy, context);
      
      const stats = manager.getPerformanceStats();
      expect(stats.size).toBeGreaterThan(0);
      
      const strategyStats = stats.get(strategy.getName());
      expect(strategyStats).toBeDefined();
      expect(strategyStats?.count).toBe(1);
    });

    it('应该能够清空性能统计', () => {
      manager.clearPerformanceStats();
      
      const stats = manager.getPerformanceStats();
      expect(stats.size).toBe(0);
    });
  });
});