import { injectable, inject } from 'inversify';
import {
  ISegmentationContextManager,
  ISegmentationStrategy,
  SegmentationContext,
  UniversalChunkingOptions,
  IConfigurationManager
} from '../../processing/strategies/types/SegmentationTypes';
import { CodeChunk } from '../../splitting';
import { SegmentationContextFactory } from './SegmentationContext';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { FileFeatureDetector } from '../utils/FileFeatureDetector';

/**
 * 分段上下文管理器
 * 职责：管理分段上下文，选择和执行分段策略
 */
@injectable()
export class SegmentationContextManager implements ISegmentationContextManager {
  private strategies: ISegmentationStrategy[];
  private configManager: IConfigurationManager;
  private logger?: LoggerService;
  private strategyCache: Map<string, ISegmentationStrategy> = new Map();
  private fileFeatureDetector: FileFeatureDetector;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ConfigurationManager) configManager?: IConfigurationManager
  ) {
    this.logger = logger;
    this.configManager = configManager || this.createDefaultConfigManager();
    this.strategies = [];
    this.fileFeatureDetector = new FileFeatureDetector(logger);
    this.logger?.debug('SegmentationContextManager initialized');
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

    // 按优先级选择第一个可用的策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(context)) {
        this.strategyCache.set(cacheKey, strategy);
        this.logger?.debug(`Selected strategy: ${strategy.getName()}`);
        return strategy;
      }
    }

    throw new Error('No suitable segmentation strategy found');
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

      this.logger?.debug(`Strategy ${strategy.getName()} completed in ${duration}ms, produced ${chunks.length} chunks`);

      return chunks;
    } catch (error) {
      this.logger?.error(`Strategy ${strategy.getName()} failed:`, error);

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

    // 按优先级排序
    this.strategies.sort((a, b) => a.getPriority() - b.getPriority());

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
    return this.strategies.map(strategy => ({
      name: strategy.getName(),
      priority: strategy.getPriority(),
      supportedLanguages: strategy.getSupportedLanguages ? strategy.getSupportedLanguages() : undefined
    }));
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
    return strategies[0];
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
        strategyPriorities: {
          'markdown': 1,
          'standardization': 2,
          'semantic': 3,
          'bracket': 4,
          'line': 5
        },
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
}