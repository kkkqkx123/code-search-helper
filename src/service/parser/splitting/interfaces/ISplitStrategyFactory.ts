import { ISplitStrategy } from './ISplitStrategy';
import { ChunkingOptions } from '../types';

/**
 * 分割策略工厂接口
 */
export interface ISplitStrategyFactory {
  /**
   * 创建分割策略实例
   * @param strategyType 策略类型
   * @param options 配置选项
   */
  create(strategyType: string, options?: ChunkingOptions): ISplitStrategy;
  
  /**
   * 注册新的策略类型
   * @param strategyType 策略类型
   * @param strategyClass 策略类
   */
  registerStrategy(strategyType: string, strategyClass: new (options?: ChunkingOptions) => ISplitStrategy): void;
  
  /**
   * 获取所有可用的策略类型
   */
  getAvailableStrategies(): string[];
  
  /**
   * 检查是否支持指定策略类型
   * @param strategyType 策略类型
   */
  supportsStrategy(strategyType: string): boolean;
}