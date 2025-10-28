import { injectable, inject } from 'inversify';
import {
  ISegmentationContextManager,
  ISegmentationStrategy,
  SegmentationContext,
  UniversalChunkingOptions,
  IConfigurationManager
} from '../strategies/types/SegmentationTypes';
import { CodeChunk } from '../types/splitting-types';
import { SegmentationContextFactory } from './SegmentationContextFactory';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { FileFeatureDetector } from '../detection/FileFeatureDetector';
import { PriorityManager } from '../strategies/priority/PriorityManager';

/**
 * 分段策略协调器
 * 职责：协调分段策略，选择和执行分段策略
 * 重构：完全集成新的优先级系统
 */
@injectable()
export class SegmentationStrategyCoordinator implements ISegmentationContextManager {
  private strategies: ISegmentationStrategy[];
  private configManager: IConfigurationManager;
  private logger?: LoggerService;
  private strategyCache: Map<string, ISegmentationStrategy> = new Map();
  private fileFeatureDetector: FileFeatureDetector;
  private priorityManager: PriorityManager;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ConfigurationManager) configManager?: IConfigurationManager,
    @inject(TYPES.PriorityManager) priorityManager?: PriorityManager,
    @inject(TYPES.FileFeatureDetector) fileFeatureDetector?: FileFeatureDetector
  ) {
    this.logger = logger;
    this.configManager = configManager || this.createDefaultConfigManager();
    this.strategies = [];
    this.fileFeatureDetector = fileFeatureDetector || new FileFeatureDetector(logger);
    this.priorityManager = priorityManager || new PriorityManager(logger);
    this.logger?.debug('SegmentationStrategyCoordinator initialized with new priority system');
  }

  /**
   * 选择合适的分段策略
   */
  selectStrategy(
    context: SegmentationContext,
    preferredType?: string
  ): ISegmentationStrategy {
    // 生成缓存键
    const cacheKey = this.generateCacheKey(context, preferredType);

    // 检查缓存
    if (this.strategyCache.has(cacheKey)) {
      const cachedStrategy = this.strategyCache.get(cacheKey)!;
      if (cachedStrategy.canHandle(context)) {
        this.logger?.debug(`Using cached strategy: ${cachedStrategy.getName()}`);
        return cachedStrategy;
      } else {
        // 缓存的策略不再适用，清除缓存
        this.strategyCache.delete(cacheKey);
      }
    }

    // 如果指定了首选类型，优先选择
    if (preferredType) {
      const preferredStrategy = this.strategies.find(s =>
        s.getName() === preferredType && s.canHandle(context)
      );
      if (preferredStrategy) {
        this.strategyCache.set(cacheKey, preferredStrategy);
        this.logger?.debug(`Using preferred strategy: ${preferredType}`);
        return preferredStrategy;
      }
    }

    // 使用新的优先级系统选择策略
    const suitableStrategies = this.strategies.filter(s => s.canHandle(context));
    if (suitableStrategies.length === 0) {
      throw new Error('No suitable segmentation strategy found');
    }

    // 按优先级排序并选择最优策略
    const sortedStrategies = this.sortStrategiesByPriority(suitableStrategies, context);
    const selectedStrategy = sortedStrategies[0];
    
    this.strategyCache.set(cacheKey, selectedStrategy);
    this.logger?.debug(`Selected strategy: ${selectedStrategy.getName()} with priority ${this.priorityManager.getPriority(selectedStrategy.getName(), this.createPriorityContext(context))}`);
    return selectedStrategy;
  }

  /**
   * 执行分段策略
   */
  async executeStrategy(
    strategy: ISegmentationStrategy,
    context: SegmentationContext
  ): Promise<CodeChunk[]> {
    try {
      this.logger?.debug(`Executing strategy: ${strategy.getName()}`);

      // 验证上下文
      if (strategy.validateContext && !strategy.validateContext(context)) {
        throw new Error(`Context validation failed for strategy: ${strategy.getName()}`);
      }

      const startTime = Date.now();
      const chunks = await strategy.segment(context);
      const duration = Date.now() - startTime;

      // 更新性能统计到新的优先级系统
      this.priorityManager.updatePerformance(strategy.getName(), duration, true);

      this.logger?.debug(`Strategy ${strategy.getName()} completed in ${duration}ms, produced ${chunks.length} chunks`);

      return chunks;
    } catch (error) {
      this.logger?.error(`Strategy ${strategy.getName()} failed:`, error);

      // 更新失败统计
      this.priorityManager.updatePerformance(strategy.getName(), 0, false);

      // 尝试降级到行数分段
      const fallbackStrategy = this.strategies.find(s =>
        s.getName() === 'line' && s.canHandle(context)
      );

      if (fallbackStrategy && fallbackStrategy !== strategy) {
        this.logger?.warn('Falling back to line-based segmentation');
        return await fallbackStrategy.segment(context);
      }

      throw error;
    }
  }

  /**
   * 创建分段上下文
   */
  createSegmentationContext(
    content: string,
    filePath?: string,
    language?: string,
    options?: UniversalChunkingOptions
  ): SegmentationContext {
    // 如果没有提供选项，使用默认选项
    const finalOptions = options || this.configManager.getDefaultOptions();

    // 如果提供了语言，应用语言特定配置
    if (language) {
      const languageConfig = this.configManager.getLanguageSpecificConfig(language);
      if (languageConfig && Object.keys(languageConfig).length > 0) {
        const mergedOptions = this.configManager.mergeOptions(finalOptions, languageConfig);
        return SegmentationContextFactory.create(content, filePath, language, mergedOptions);
      }
    }

    return SegmentationContextFactory.create(content, filePath, language, finalOptions);
  }

  /**
   * 添加策略
   */
  addStrategy(strategy: ISegmentationStrategy): void {
    // 检查是否已存在同名策略
    const existingIndex = this.strategies.findIndex(s => s.getName() === strategy.getName());
    if (existingIndex >= 0) {
      this.strategies[existingIndex] = strategy;
      this.logger?.debug(`Replaced existing strategy: ${strategy.getName()}`);
    } else {
      this.strategies.push(strategy);
      this.logger?.debug(`Added new strategy: ${strategy.getName()}`);
    }

    // 清除缓存
    this.strategyCache.clear();
  }

  /**
   * 移除策略
   */
  removeStrategy(strategyName: string): void {
    const initialLength = this.strategies.length;
    this.strategies = this.strategies.filter(s => s.getName() !== strategyName);

    if (this.strategies.length < initialLength) {
      this.logger?.debug(`Removed strategy: ${strategyName}`);
      // 清除缓存
      this.strategyCache.clear();
    } else {
      this.logger?.warn(`Strategy not found for removal: ${strategyName}`);
    }
  }

  /**
   * 获取所有策略
   */
  getStrategies(): ISegmentationStrategy[] {
    return [...this.strategies];
  }

  /**
   * 获取策略信息
   */
  getStrategyInfo(): Array<{ name: string; priority: number; supportedLanguages?: string[] }> {
    return this.strategies.map(strategy => {
      const context = this.createPriorityContext({ language: 'unknown', filePath: undefined });
      const priority = this.priorityManager.getPriority(strategy.getName(), context);
      
      return {
        name: strategy.getName(),
        priority,
        supportedLanguages: strategy.getSupportedLanguages ? strategy.getSupportedLanguages() : undefined
      };
    });
  }

  /**
   * 智能策略选择（基于历史性能）
   */
  selectStrategyWithHeuristics(context: SegmentationContext): ISegmentationStrategy {
    const suitableStrategies = this.strategies.filter(s => s.canHandle(context));

    if (suitableStrategies.length === 0) {
      throw new Error('No suitable segmentation strategy found');
    }

    if (suitableStrategies.length === 1) {
      return suitableStrategies[0];
    }

    // 基于内容特征选择最佳策略
    const bestStrategy = this.selectBestStrategyByContent(context, suitableStrategies);

    this.logger?.debug(`Selected best strategy by content analysis: ${bestStrategy.getName()}`);
    return bestStrategy;
  }

  /**
   * 基于内容特征选择最佳策略
   */
  private selectBestStrategyByContent(
    context: SegmentationContext,
    strategies: ISegmentationStrategy[]
  ): ISegmentationStrategy {
    const content = context.content;
    const language = context.language;

    // 对于Markdown文件，优先选择Markdown策略
    if (context.metadata.isMarkdownFile) {
      const markdownStrategy = strategies.find(s => s.getName() === 'markdown');
      if (markdownStrategy) {
        return markdownStrategy;
      }
    }

    // 对于小文件，选择行数分段
    if (context.metadata.isSmallFile) {
      const lineStrategy = strategies.find(s => s.getName() === 'line');
      if (lineStrategy) {
        return lineStrategy;
      }
    }

    // 对于代码文件，检查是否有复杂的结构
    if (context.metadata.isCodeFile) {
      const hasComplexStructure = this.hasComplexCodeStructure(content, language);

      if (hasComplexStructure) {
        // 优先选择语义分段
        const semanticStrategy = strategies.find(s => s.getName() === 'semantic');
        if (semanticStrategy) {
          return semanticStrategy;
        }

        // 其次选择标准化分段
        const standardizationStrategy = strategies.find(s => s.getName() === 'standardization');
        if (standardizationStrategy) {
          return standardizationStrategy;
        }
      } else {
        // 简单代码，选择括号分段
        const bracketStrategy = strategies.find(s => s.getName() === 'bracket');
        if (bracketStrategy) {
          return bracketStrategy;
        }
      }
    }

    // 默认选择优先级最高的策略
    const sortedStrategies = this.sortStrategiesByPriority(strategies, context);
    return sortedStrategies[0];
  }

  /**
   * 使用新的优先级系统对策略进行排序
   */
  private sortStrategiesByPriority(strategies: ISegmentationStrategy[], context: SegmentationContext): ISegmentationStrategy[] {
    const priorityContext = this.createPriorityContext(context);
    
    // 预先获取所有策略的优先级，避免在排序过程中多次调用getPriority
    const priorities = new Map<string, number>();
    for (const strategy of strategies) {
      priorities.set(strategy.getName(), this.priorityManager.getPriority(strategy.getName(), priorityContext));
    }
    
    // 使用预获取的优先级进行排序
    return [...strategies].sort((a, b) => {
      const priorityA = priorities.get(a.getName()) || Number.MAX_SAFE_INTEGER;
      const priorityB = priorities.get(b.getName()) || Number.MAX_SAFE_INTEGER;
      return priorityA - priorityB;
    });
  }

  /**
   * 创建优先级上下文
   */
  private createPriorityContext(context: { language?: string; filePath?: string }): any {
    return {
      language: context.language || 'unknown',
      filePath: context.filePath,
      content: undefined,
      fileSize: undefined,
      hasAST: false
    };
  }

  /**
   * 检查是否有复杂的代码结构
   */
  private hasComplexCodeStructure(content: string, language?: string): boolean {
    const complexity = this.fileFeatureDetector.calculateComplexity(content);
    return complexity > 20; // 使用复杂度阈值判断
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(context: SegmentationContext, preferredType?: string): string {
    const parts = [
      context.language || 'unknown',
      context.metadata.isCodeFile ? 'code' : 'text',
      context.metadata.isSmallFile ? 'small' : 'large',
      context.metadata.isMarkdownFile ? 'markdown' : 'plain',
      preferredType || 'auto'
    ];

    return parts.join(':');
  }

  /**
   * 创建默认配置管理器
   */
  private createDefaultConfigManager(): IConfigurationManager {
    return {
      getDefaultOptions: () => ({
        maxChunkSize: 2000,
        overlapSize: 200,
        maxLinesPerChunk: 100,
        enableBracketBalance: true,
        enableSemanticDetection: true,
        enableCodeOverlap: false,
        enableStandardization: true,
        standardizationFallback: true,
        maxOverlapRatio: 0.3,
        errorThreshold: 10,
        memoryLimitMB: 512,
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 100,
          maxChunkSize: 4000
        },
        protectionConfig: {
          enableProtection: true,
          protectionLevel: 'medium'
        }
      }),
      validateOptions: () => true,
      mergeOptions: (base, override) => ({ ...base, ...override }),
      getLanguageSpecificConfig: () => ({})
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.strategyCache.clear();
    this.logger?.debug('Strategy cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.strategyCache.size,
      keys: Array.from(this.strategyCache.keys())
    };
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): Map<string, any> {
    return this.priorityManager.getPerformanceStats();
  }

  /**
   * 重新加载优先级配置
   */
  reloadPriorityConfig(): void {
    this.priorityManager.reloadConfig();
    this.logger?.debug('Priority configuration reloaded');
  }
}