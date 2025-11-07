import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';

/**
 * 策略注册表接口
 * 定义策略注册和创建的抽象接口
 */
export interface IStrategyRegistry {
  /**
   * 注册策略工厂函数
   * @param type 策略类型
   * @param factory 策略工厂函数
   */
  registerStrategy(type: string, factory: () => IProcessingStrategy): void;

  /**
   * 创建策略实例
   * @param type 策略类型
   * @returns 策略实例
   */
  createStrategy(type: string): IProcessingStrategy;

  /**
   * 获取支持的策略类型列表
   * @returns 策略类型列表
   */
  getSupportedTypes(): string[];

  /**
   * 检查策略类型是否支持
   * @param type 策略类型
   * @returns 是否支持
   */
  isStrategyTypeSupported(type: string): boolean;

  /**
   * 注销策略
   * @param type 策略类型
   */
  unregisterStrategy(type: string): void;

  /**
   * 清空所有策略
   */
  clearStrategies(): void;
}