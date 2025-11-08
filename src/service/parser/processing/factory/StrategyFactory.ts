/**
 * 策略工厂实现
 * 负责创建和管理策略实例，提供策略的注册、创建和缓存功能
 * 优化后版本：支持精简的策略架构，专注于向量嵌入优化
 */

import { IStrategyFactory, StrategyConstructor } from '../core/interfaces/IStrategyFactory';
import { IProcessingStrategy } from '../core/interfaces/IProcessingStrategy';
import { ProcessingConfig } from '../core/types/ConfigTypes';
import { UNIFIED_STRATEGY_PRIORITIES, getPrioritizedStrategies } from '../../constants/StrategyPriorities';

/**
 * 策略工厂类
 * 实现策略的注册、创建和缓存功能
 */
export class StrategyFactory implements IStrategyFactory {
  /** 策略构造函数映射 */
  private strategies: Map<string, StrategyConstructor> = new Map();

  /** 策略实例缓存 */
  private instances: Map<string, IProcessingStrategy> = new Map();

  /** 处理配置 */
  private config: ProcessingConfig;

  /**
   * 构造函数
   * @param config 处理配置
   */
  constructor(config: ProcessingConfig) {
    this.config = config;
    this.registerDefaultStrategies();
  }

  /**
   * 创建指定类型的策略实例
   * @param strategyType 策略类型
   * @param config 可选的处理配置
   * @returns 策略实例
   */
  createStrategy(strategyType: string, config?: ProcessingConfig): IProcessingStrategy {
    // 检查是否有缓存的实例
    if (this.instances.has(strategyType) && !config) {
      return this.instances.get(strategyType)!;
    }

    const StrategyClass = this.strategies.get(strategyType);
    if (!StrategyClass) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }

    // 创建策略实例，优先级现在由 BaseStrategy 从 UNIFIED_STRATEGY_PRIORITIES 中获取
    const instance = new StrategyClass(config || this.config);

    // 如果启用了缓存，则缓存实例
    if (this.config.performance.enableCaching) {
      this.instances.set(strategyType, instance);
    }

    return instance;
  }

  /**
   * 获取所有可用的策略类型列表（按优先级排序）
   * @returns 按优先级排序的策略类型数组
   */
  getAvailableStrategies(): string[] {
    const strategies = Array.from(this.strategies.keys());
    const prioritizedStrategies = getPrioritizedStrategies(strategies);
    const nonPrioritizedStrategies = strategies.filter(s => !UNIFIED_STRATEGY_PRIORITIES.hasOwnProperty(s));
    
    // 将有优先级的策略和无优先级的策略合并，无优先级的放在最后
    return [...prioritizedStrategies, ...nonPrioritizedStrategies];
  }

  /**
   * 检查是否支持指定的策略类型
   * @param strategyType 策略类型
   * @returns 是否支持
   */
  supportsStrategy(strategyType: string): boolean {
    return this.strategies.has(strategyType);
  }

  /**
   * 注册新的策略类型
   * @param strategyType 策略类型
   * @param strategyClass 策略构造函数
   */
  registerStrategy(strategyType: string, strategyClass: StrategyConstructor): void {
    this.strategies.set(strategyType, strategyClass);

    // 如果已经有该类型的缓存实例，清除它
    if (this.instances.has(strategyType)) {
      this.instances.delete(strategyType);
    }
  }

  /**
   * 注销策略类型
   * @param strategyType 策略类型
   */
  unregisterStrategy(strategyType: string): void {
    this.strategies.delete(strategyType);
    this.instances.delete(strategyType);
  }

  /**
   * 获取策略实例（如果已缓存）
   * @param strategyType 策略类型
   * @returns 策略实例或undefined
   */
  getCachedStrategy(strategyType: string): IProcessingStrategy | undefined {
    return this.instances.get(strategyType);
  }

  /**
   * 清除所有缓存的策略实例
   */
  clearCache(): void {
    this.instances.clear();
  }

  /**
   * 获取策略的优先级
   * @param strategyType 策略类型
   * @returns 策略优先级
   */
  getStrategyPriority(strategyType: string): number {
    return UNIFIED_STRATEGY_PRIORITIES[strategyType] || 999;
  }

  /**
   * 按优先级获取可用的策略类型列表
   * @returns 按优先级排序的策略类型数组
   */
  getPrioritizedStrategies(): string[] {
    return getPrioritizedStrategies(this.getAvailableStrategies());
  }

  /**
   * 验证策略是否在优化后的策略列表中
   * @param strategyType 策略类型
   * @returns 是否为有效的优化后策略
   */
  isValidOptimizedStrategy(strategyType: string): boolean {
    return UNIFIED_STRATEGY_PRIORITIES.hasOwnProperty(strategyType);
  }

  /**
   * 获取优化后的策略列表
   * @returns 优化后的策略类型数组
   */
  getOptimizedStrategies(): string[] {
    return Object.keys(UNIFIED_STRATEGY_PRIORITIES);
  }

  /**
   * 创建策略实例（带验证）
   * @param strategyType 策略类型
   * @param config 可选的处理配置
   * @returns 策略实例
   */
  createValidatedStrategy(strategyType: string, config?: ProcessingConfig): IProcessingStrategy {
    if (!this.isValidOptimizedStrategy(strategyType)) {
      throw new Error(`Strategy '${strategyType}' is not in the optimized strategy list. Available strategies: ${this.getOptimizedStrategies().join(', ')}`);
    }
    
    return this.createStrategy(strategyType, config);
  }

  /**
   * 注册默认策略
   * 优化后版本：暂时不注册具体策略，保持原有设计
   * 策略注册通过外部调用registerStrategy方法进行
   */
  private registerDefaultStrategies(): void {
    // 不在工厂中直接注册策略，避免类型不匹配问题
    // 策略应该在应用初始化时通过registerStrategy方法注册
    
    // 优化后的策略列表（供参考）：
    // - line-segmentation: LineSegmentationStrategy
    // - bracket-segmentation: BracketSegmentationStrategy  
    // - ast-codesplitter: ASTCodeSplitter
    // - markdown-segmentation: MarkdownSegmentationStrategy
    // - layered-html: LayeredHTMLStrategy
    // - xml-segmentation: XMLSegmentationStrategy
  }

  /**
   * 为特定策略类型创建配置
   * @param strategyType 策略类型
   * @param config 处理配置
   * @returns 策略特定配置
   */
  private createStrategyConfig(strategyType: string, config: ProcessingConfig): any {
    const baseConfig = {
      name: strategyType,
      supportedLanguages: this.getSupportedLanguagesForStrategy(strategyType),
      enabled: true
    };

    // 根据策略类型添加特定配置
    switch (strategyType) {
      case 'ast-codesplitter':
        return {
          ...baseConfig,
          maxFunctionSize: config.chunking?.maxChunkSize || 3000,
          maxClassSize: config.chunking?.maxChunkSize || 5000,
          minFunctionLines: 3,
          minClassLines: 2,
          maxChunkSize: config.chunking?.maxChunkSize || 1000,
          minChunkSize: config.chunking?.minChunkSize || 50
        };
      default:
        return {
          ...baseConfig,
          maxChunkSize: config.chunking?.maxChunkSize || 1000,
          minChunkSize: config.chunking?.minChunkSize || 50
        };
    }
  }

  /**
   * 获取策略支持的语言列表
   * @param strategyType 策略类型
   * @returns 支持的语言列表
   */
  private getSupportedLanguagesForStrategy(strategyType: string): string[] {
    switch (strategyType) {
      case 'markdown-segmentation':
        return ['markdown', 'md'];
      case 'xml-segmentation':
        return ['xml', 'html', 'htm', 'xhtml', 'svg'];
      case 'layered-html':
        return ['html', 'htm'];
      case 'ast-codesplitter':
        return ['typescript', 'javascript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'];
      case 'bracket-segmentation':
        return ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'xml'];
      case 'line-segmentation':
        return ['*']; // 支持所有语言
      default:
        return ['*'];
    }
  }
}