/**
 * 策略工厂接口
 * 定义了策略创建和管理的基本契约
 */
export interface IStrategyFactory {
  /**
   * 创建指定类型的策略实例
   * @param strategyType 策略类型
   * @param config 可选的处理配置
   * @returns 策略实例
   */
  createStrategy(strategyType: string, config?: ProcessingConfig): IProcessingStrategy;
  
  /**
   * 获取所有可用的策略类型列表
   * @returns 策略类型数组
   */
  getAvailableStrategies(): string[];
  
  /**
   * 检查是否支持指定的策略类型
   * @param strategyType 策略类型
   * @returns 是否支持
   */
  supportsStrategy(strategyType: string): boolean;
  
  /**
   * 注册新的策略类型
   * @param strategyType 策略类型
   * @param strategyClass 策略构造函数
   */
  registerStrategy(strategyType: string, strategyClass: StrategyConstructor): void;
  
  /**
   * 注销策略类型
   * @param strategyType 策略类型
   */
  unregisterStrategy(strategyType: string): void;
  
  /**
   * 获取策略实例（如果已缓存）
   * @param strategyType 策略类型
   * @returns 策略实例或undefined
   */
  getCachedStrategy?(strategyType: string): IProcessingStrategy | undefined;
  
  /**
   * 清除所有缓存的策略实例
   */
  clearCache?(): void;
}

/**
 * 策略构造函数类型
 */
export interface StrategyConstructor {
  new(config: ProcessingConfig): IProcessingStrategy;
}

// 导入相关类型，避免循环依赖
import type { IProcessingStrategy } from './IProcessingStrategy';
import type { ProcessingConfig } from '../types/ConfigTypes';