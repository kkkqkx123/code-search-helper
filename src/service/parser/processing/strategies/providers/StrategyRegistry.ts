import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { IStrategyRegistry } from './IStrategyRegistry';

/**
 * 策略注册表实现
 * 管理策略的注册和创建，支持插件化架构
 */
@injectable()
export class StrategyRegistry implements IStrategyRegistry {
  private strategies = new Map<string, () => IProcessingStrategy>();
  private logger?: LoggerService;

  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
    this.logger?.debug('StrategyRegistry initialized');
  }

  /**
   * 注册策略工厂函数
   * @param type 策略类型
   * @param factory 策略工厂函数
   */
  registerStrategy(type: string, factory: () => IProcessingStrategy): void {
    if (this.strategies.has(type)) {
      this.logger?.warn(`Strategy type '${type}' is already registered, overwriting...`);
    }
    
    this.strategies.set(type, factory);
    this.logger?.debug(`Strategy '${type}' registered successfully`);
  }

  /**
   * 创建策略实例
   * @param type 策略类型
   * @returns 策略实例
   */
  createStrategy(type: string): IProcessingStrategy {
    const factory = this.strategies.get(type);
    if (!factory) {
      const availableTypes = Array.from(this.strategies.keys());
      throw new Error(`Unknown strategy type: '${type}'. Available types: ${availableTypes.join(', ')}`);
    }
    
    try {
      const strategy = factory();
      this.logger?.debug(`Strategy '${type}' created successfully`);
      return strategy;
    } catch (error) {
      this.logger?.error(`Failed to create strategy '${type}': ${error}`);
      throw new Error(`Failed to create strategy '${type}': ${(error as Error).message}`);
    }
  }

  /**
   * 获取支持的策略类型列表
   * @returns 策略类型列表
   */
  getSupportedTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 检查策略类型是否支持
   * @param type 策略类型
   * @returns 是否支持
   */
  isStrategyTypeSupported(type: string): boolean {
    return this.strategies.has(type);
  }

  /**
   * 注销策略
   * @param type 策略类型
   */
  unregisterStrategy(type: string): void {
    if (this.strategies.has(type)) {
      this.strategies.delete(type);
      this.logger?.debug(`Strategy '${type}' unregistered successfully`);
    } else {
      this.logger?.warn(`Attempted to unregister non-existent strategy: '${type}'`);
    }
  }

  /**
   * 清空所有策略
   */
  clearStrategies(): void {
    const count = this.strategies.size;
    this.strategies.clear();
    this.logger?.debug(`All ${count} strategies cleared`);
  }

  /**
   * 获取注册表统计信息
   * @returns 统计信息
   */
  getStats(): { totalStrategies: number; strategyTypes: string[] } {
    return {
      totalStrategies: this.strategies.size,
      strategyTypes: this.getSupportedTypes()
    };
  }
}