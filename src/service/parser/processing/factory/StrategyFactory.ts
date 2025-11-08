/**
 * 策略工厂实现
 * 负责创建和管理策略实例，提供策略的注册、创建和缓存功能
 */

import { IStrategyFactory, StrategyConstructor } from '../core/interfaces/IStrategyFactory';
import { IProcessingStrategy } from '../core/interfaces/IProcessingStrategy';
import { ProcessingConfig } from '../core/types/ConfigTypes';

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

    const instance = new StrategyClass(config || this.config);
    
    // 如果启用了缓存，则缓存实例
    if (this.config.performance.enableCaching) {
      this.instances.set(strategyType, instance);
    }
    
    return instance;
  }

  /**
   * 获取所有可用的策略类型列表
   * @returns 策略类型数组
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
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
   * 注册默认策略
   * 注意：具体的策略类需要在实际实现时导入和注册
   */
  private registerDefaultStrategies(): void {
    // 这里暂时不注册具体的策略，因为需要导入具体的策略类
    // 在实际使用时，可以通过registerStrategy方法注册具体策略
    
    // 示例注册方式（需要导入具体的策略类）：
    // this.registerStrategy('line', LineStrategy);
    // this.registerStrategy('semantic', SemanticStrategy);
    // this.registerStrategy('ast', ASTStrategy);
    // this.registerStrategy('bracket', BracketStrategy);
  }
}