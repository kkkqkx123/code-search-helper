import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { UnifiedConfigManager } from '../../../config/UnifiedConfigManager';
import { 
  StrategyDecoratorBuilder, 
  DecoratorFactory, 
  DecoratorOptions 
} from '../decorators';
import {
  ASTStrategyProvider,
  SemanticStrategyProvider,
  LineStrategyProvider,
  MarkdownStrategyProvider,
  XMLStrategyProvider,
  BracketStrategyProvider,
  FunctionStrategyProvider,
  ClassStrategyProvider,
  ModuleStrategyProvider,
  HierarchicalStrategyProvider
} from '../providers';

/**
 * 统一策略工厂
 * 整合了所有策略创建逻辑，支持多种创建模式
 */
@injectable()
export class UnifiedStrategyFactory {
  private providers: Map<string, IStrategyProvider> = new Map();
  private logger?: LoggerService;
  private configManager: UnifiedConfigManager;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UnifiedConfigManager) configManager?: UnifiedConfigManager,
    @inject(TYPES.TreeSitterService) treeSitterService?: any,
    @inject(TYPES.UniversalTextStrategy) universalTextSplitter?: any,
    @inject(TYPES.MarkdownTextStrategy) markdownSplitter?: any,
    @inject(TYPES.XMLTextStrategy) xmlSplitter?: any
  ) {
    this.logger = logger;
    this.configManager = configManager || new UnifiedConfigManager();
    
    // 自动注册所有策略提供者
    this.registerDefaultProviders(treeSitterService, universalTextSplitter, markdownSplitter, xmlSplitter);
    
    this.logger?.debug('UnifiedStrategyFactory initialized');
  }

  /**
   * 注册策略提供者
   */
  registerProvider(provider: IStrategyProvider): void {
    this.providers.set(provider.getName(), provider);
    this.logger?.debug(`Registered strategy provider: ${provider.getName()}`);
  }

  /**
   * 注册默认策略提供者
   */
  private registerDefaultProviders(
    treeSitterService?: any,
    universalTextSplitter?: any,
    markdownSplitter?: any,
    xmlSplitter?: any
  ): void {
    // 注册AST策略提供者
    this.registerProvider(new ASTStrategyProvider(treeSitterService, this.logger));
    
    // 注册语义策略提供者
    this.registerProvider(new SemanticStrategyProvider(this.logger));
    
    // 注册行级策略提供者
    this.registerProvider(new LineStrategyProvider(universalTextSplitter, this.logger));
    
    // 注册专门格式策略提供者
    this.registerProvider(new MarkdownStrategyProvider(markdownSplitter, this.logger));
    this.registerProvider(new XMLStrategyProvider(xmlSplitter, this.logger));
    
    // 注册括号策略提供者
    this.registerProvider(new BracketStrategyProvider(universalTextSplitter, this.logger));
    
    // 注册AST高级策略提供者
    this.registerProvider(new FunctionStrategyProvider(treeSitterService, this.logger));
    this.registerProvider(new ClassStrategyProvider(treeSitterService, this.logger));
    this.registerProvider(new ModuleStrategyProvider(treeSitterService, this.logger));
    this.registerProvider(new HierarchicalStrategyProvider(treeSitterService, this.logger));
    
    this.logger?.info(`Registered ${this.providers.size} default strategy providers`);
  }

  /**
   * 根据检测结果创建策略（来自universal）
   */
  createStrategyFromDetection(detection: any): ISplitStrategy {
    const strategyType = detection.processingStrategy || 'universal_line';
    return this.createStrategyFromType(strategyType);
  }

  /**
   * 创建带有装饰器的策略
   */
  createDecoratedStrategy(
    strategyType: string,
    decoratorOptions: DecoratorOptions,
    options?: ChunkingOptions
  ): ISplitStrategy {
    const baseStrategy = this.createStrategyFromType(strategyType, options);
    return new StrategyDecoratorBuilder(baseStrategy, decoratorOptions).build();
  }

  /**
   * 创建完全装饰的策略（包含所有装饰器）
   */
  createFullyDecoratedStrategy(
    strategyType: string,
    overlapCalculator: any,
    options?: ChunkingOptions,
    cacheOptions?: { maxSize?: number; ttl?: number }
  ): ISplitStrategy {
    const baseStrategy = this.createStrategyFromType(strategyType, options);
    return DecoratorFactory.createFullyDecoratedStrategy(
      baseStrategy,
      overlapCalculator,
      this.logger,
      cacheOptions
    );
  }

  /**
   * 创建带有缓存的策略
   */
  createCachedStrategy(
    strategyType: string,
    maxSize?: number,
    ttl?: number,
    options?: ChunkingOptions
  ): ISplitStrategy {
    const baseStrategy = this.createStrategyFromType(strategyType, options);
    return DecoratorFactory.createCachedStrategy(baseStrategy, maxSize, ttl);
  }

  /**
   * 创建带有重叠的策略
   */
  createOverlapStrategy(
    strategyType: string,
    overlapCalculator: any,
    options?: ChunkingOptions
  ): ISplitStrategy {
    const baseStrategy = this.createStrategyFromType(strategyType, options);
    return DecoratorFactory.createOverlapStrategy(baseStrategy, overlapCalculator);
  }

  /**
   * 创建带有性能监控的策略
   */
  createMonitoredStrategy(
    strategyType: string,
    logger?: any,
    options?: ChunkingOptions
  ): ISplitStrategy {
    const baseStrategy = this.createStrategyFromType(strategyType, options);
    return DecoratorFactory.createMonitoredStrategy(baseStrategy, logger || this.logger);
  }

  /**
   * 根据策略类型创建策略
   */
  createStrategyFromType(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    const provider = this.providers.get(strategyType);
    if (!provider) {
      this.logger?.warn(`Strategy provider not found: ${strategyType}, falling back to line strategy`);
      return this.createFallbackStrategy(options);
    }

    try {
      const strategy = provider.createStrategy(options);
      this.logger?.debug(`Created strategy: ${strategyType}`);
      return strategy;
    } catch (error) {
      this.logger?.error(`Failed to create strategy ${strategyType}:`, error);
      return this.createFallbackStrategy(options);
    }
  }

  /**
   * 根据提供者名称创建策略（来自splitting）
   */
  createStrategyFromProvider(providerName: string, options?: ChunkingOptions): ISplitStrategy {
    return this.createStrategyFromType(providerName, options);
  }

  /**
   * 基于AST创建策略（来自core/strategy）
   */
  createStrategyFromAST(language: string, ast: any, options?: ChunkingOptions): ISplitStrategy {
    // 优先选择支持AST的策略
    const astProviders = Array.from(this.providers.values()).filter(provider => {
      const strategy = provider.createStrategy(options);
      return strategy.canHandleNode && strategy.canHandleNode(language, ast);
    });

    if (astProviders.length > 0) {
      const provider = astProviders[0];
      const strategy = provider.createStrategy(options);
      this.logger?.debug(`Created AST-based strategy: ${provider.getName()}`);
      return strategy;
    }

    // 如果没有支持AST的策略，回退到语言特定的策略
    return this.createStrategyFromLanguage(language, options);
  }

  /**
   * 根据语言创建策略
   */
  createStrategyFromLanguage(language: string, options?: ChunkingOptions): ISplitStrategy {
    // 查找支持该语言的策略
    const languageProviders = Array.from(this.providers.values()).filter(provider => {
      const strategy = provider.createStrategy(options);
      return strategy.supportsLanguage(language);
    });

    if (languageProviders.length > 0) {
      // 选择优先级最高的策略
      languageProviders.sort((a, b) => {
        const strategyA = a.createStrategy(options);
        const strategyB = b.createStrategy(options);
        return strategyA.getPriority() - strategyB.getPriority();
      });

      const provider = languageProviders[0];
      const strategy = provider.createStrategy(options);
      this.logger?.debug(`Created language-specific strategy: ${provider.getName()} for ${language}`);
      return strategy;
    }

    // 如果没有支持该语言的策略，使用默认策略
    return this.createFallbackStrategy(options);
  }

  /**
   * 创建降级策略
   */
  private createFallbackStrategy(options?: ChunkingOptions): ISplitStrategy {
    const lineProvider = this.providers.get('line_based');
    if (lineProvider) {
      return lineProvider.createStrategy(options);
    }

    // 如果连行策略都没有，创建一个简单的默认策略
    this.logger?.warn('No line strategy available, creating minimal fallback strategy');
    return new MinimalFallbackStrategy();
  }

  /**
   * 获取所有可用的策略提供者
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 获取支持指定语言的策略提供者
   */
  getProvidersForLanguage(language: string): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => {
        const strategy = provider.createStrategy();
        return strategy.supportsLanguage(language);
      })
      .map(([name, _]) => name);
  }

  /**
   * 获取支持AST的策略提供者
   */
  getASTProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => {
        const strategy = provider.createStrategy();
        return strategy.canHandleNode !== undefined;
      })
      .map(([name, _]) => name);
  }

  /**
   * 移除策略提供者
   */
  removeProvider(providerName: string): boolean {
    const removed = this.providers.delete(providerName);
    if (removed) {
      this.logger?.debug(`Removed strategy provider: ${providerName}`);
    }
    return removed;
  }

  /**
   * 清空所有策略提供者
   */
  clearProviders(): void {
    const count = this.providers.size;
    this.providers.clear();
    this.logger?.debug(`Cleared ${count} strategy providers`);
  }

  /**
   * 获取策略提供者的依赖
   */
  getProviderDependencies(providerName: string): string[] {
    const provider = this.providers.get(providerName);
    return provider ? provider.getDependencies() : [];
  }

  /**
   * 验证策略提供者的完整性
   */
  validateProviders(): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const [name, provider] of this.providers) {
      try {
        const strategy = provider.createStrategy();
        
        // 检查基本方法是否存在
        if (!strategy.getName || typeof strategy.getName !== 'function') {
          invalid.push(name);
          continue;
        }
        
        // 检查是否是 ISplitStrategy 接口
        if (strategy.supportsLanguage && typeof strategy.supportsLanguage === 'function' &&
            strategy.getPriority && typeof strategy.getPriority === 'function') {
          // 对于 ISplitStrategy，检查是否支持至少一种语言
          const supportedLanguages = ['javascript', 'typescript', 'python', 'markdown', 'xml'];
          const hasLanguageSupport = supportedLanguages.some(lang => {
            try {
              return strategy.supportsLanguage(lang);
            } catch (e) {
              return false;
            }
          });
          
          if (hasLanguageSupport && strategy.getPriority() >= 0) {
            valid.push(name);
          } else {
            invalid.push(name);
          }
        } else {
          // 对于其他策略类型（如 IProcessingStrategy），只检查基本方法
          if (typeof strategy.getName === 'function' && 
              typeof strategy.getDescription === 'function') {
            valid.push(name);
          } else {
            invalid.push(name);
          }
        }
      } catch (error) {
        this.logger?.error(`Provider ${name} validation failed:`, error);
        invalid.push(name);
      }
    }

    return { valid, invalid };
  }

  /**
   * 获取工厂统计信息
   */
  getStats(): {
    totalProviders: number;
    validProviders: number;
    invalidProviders: number;
    supportedLanguages: string[];
    astProviders: string[];
  } {
    const validation = this.validateProviders();
    const supportedLanguages = new Set<string>();
    const astProviders = this.getASTProviders();

    for (const provider of this.providers.values()) {
      try {
        const strategy = provider.createStrategy();
        // 这里需要一种方式来获取支持的语言列表
        // 暂时跳过这个实现
      } catch (error) {
        // 忽略错误
      }
    }

    return {
      totalProviders: this.providers.size,
      validProviders: validation.valid.length,
      invalidProviders: validation.invalid.length,
      supportedLanguages: Array.from(supportedLanguages),
      astProviders
    };
  }
}

/**
 * 最小降级策略
 * 当没有其他策略可用时的最后保障
 */
class MinimalFallbackStrategy implements ISplitStrategy {
  getName(): string {
    return 'minimal_fallback';
  }

  getDescription(): string {
    return 'Minimal fallback strategy that returns the entire content as a single chunk';
  }

  supportsLanguage(language: string): boolean {
    return true; // 支持所有语言
  }

  getPriority(): number {
    return 999; // 最低优先级
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<any[]> {
    return [{
      id: `fallback_${Date.now()}`,
      content,
      metadata: {
        startLine: 1,
        endLine: content.split('\n').length,
        language,
        filePath,
        type: 'fallback',
        fallback: true
      }
    }];
  }
}