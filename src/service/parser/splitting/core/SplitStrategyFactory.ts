import { ISplitStrategyFactory } from '../interfaces/ISplitStrategyFactory';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '../types';
import { BaseSplitStrategy } from '../strategies/base/BaseSplitStrategy';

/**
 * 分割策略工厂实现
 */
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private strategies: Map<string, new (options?: ChunkingOptions) => ISplitStrategy> = new Map();

  constructor() {
    // 注册默认策略
    this.registerDefaultStrategies();
  }

  /**
   * 创建分割策略实例
   */
  create(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    const StrategyClass = this.strategies.get(strategyType);
    
    if (!StrategyClass) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }

    try {
      return new StrategyClass(options);
    } catch (error) {
      throw new Error(`Failed to create strategy ${strategyType}: ${error}`);
    }
  }

  /**
   * 注册新的策略类型
   */
  registerStrategy(
    strategyType: string, 
    strategyClass: new (options?: ChunkingOptions) => ISplitStrategy
  ): void {
    if (!strategyType || strategyType.trim() === '') {
      throw new Error('Strategy type cannot be empty');
    }

    if (!strategyClass) {
      throw new Error('Strategy class cannot be null');
    }

    // 验证策略类是否实现了正确的接口
    if (!this.isValidStrategyClass(strategyClass)) {
      throw new Error('Strategy class must implement ISplitStrategy interface');
    }

    this.strategies.set(strategyType, strategyClass);
  }

  /**
   * 获取所有可用的策略类型
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 检查是否支持指定策略类型
   */
  supportsStrategy(strategyType: string): boolean {
    return this.strategies.has(strategyType);
  }

  /**
   * 移除策略类型
   */
  unregisterStrategy(strategyType: string): boolean {
    return this.strategies.delete(strategyType);
  }

  /**
   * 获取策略信息
   */
  getStrategyInfo(strategyType: string): {
    exists: boolean;
    isBaseStrategy: boolean;
    requiresTreeSitter: boolean;
    requiresLogger: boolean;
  } | null {
    const StrategyClass = this.strategies.get(strategyType);
    if (!StrategyClass) {
      return null;
    }

    // 检查是否是基础策略类的子类
    const isBaseStrategy = this.isBaseStrategyClass(StrategyClass);
    
    // 检查是否需要TreeSitter服务
    const requiresTreeSitter = this.requiresTreeSitterService(StrategyClass);
    
    // 检查是否需要日志服务
    const requiresLogger = this.requiresLoggerService(StrategyClass);

    return {
      exists: true,
      isBaseStrategy,
      requiresTreeSitter,
      requiresLogger
    };
  }

  /**
   * 获取所有策略的信息
   */
  getAllStrategiesInfo(): Map<string, {
    exists: boolean;
    isBaseStrategy: boolean;
    requiresTreeSitter: boolean;
    requiresLogger: boolean;
  }> {
    const infoMap = new Map<string, {
      exists: boolean;
      isBaseStrategy: boolean;
      requiresTreeSitter: boolean;
      requiresLogger: boolean;
    }>();

    for (const [strategyType, StrategyClass] of this.strategies) {
      const info = this.getStrategyInfo(strategyType);
      if (info) {
        infoMap.set(strategyType, info);
      }
    }

    return infoMap;
  }

  /**
   * 注册默认策略
   */
  private registerDefaultStrategies(): void {
    // 注意：这里需要导入具体的策略类，但由于循环依赖问题，
    // 我们将在应用初始化时动态注册这些策略
  }

  /**
   * 验证策略类是否实现了正确的接口
   */
  private isValidStrategyClass(strategyClass: new (options?: ChunkingOptions) => ISplitStrategy): boolean {
    try {
      // 创建临时实例进行验证
      const tempInstance = new strategyClass();
      return (
        typeof tempInstance.split === 'function' &&
        typeof tempInstance.getName === 'function' &&
        typeof tempInstance.supportsLanguage === 'function' &&
        typeof tempInstance.getPriority === 'function'
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查是否是基础策略类的子类
   */
  private isBaseStrategyClass(strategyClass: new (options?: ChunkingOptions) => ISplitStrategy): boolean {
    try {
      const tempInstance = new strategyClass();
      return tempInstance instanceof BaseSplitStrategy;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查是否需要TreeSitter服务
   */
  private requiresTreeSitterService(strategyClass: new (options?: ChunkingOptions) => ISplitStrategy): boolean {
    try {
      const tempInstance = new strategyClass();
      
      // 检查是否有setTreeSitterService方法
      if (typeof (tempInstance as any).setTreeSitterService === 'function') {
        return true;
      }

      // 检查类名是否暗示需要TreeSitter
      const className = strategyClass.name.toLowerCase();
      return className.includes('ast') || className.includes('syntax') || className.includes('semantic');
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查是否需要日志服务
   */
  private requiresLoggerService(strategyClass: new (options?: ChunkingOptions) => ISplitStrategy): boolean {
    try {
      const tempInstance = new strategyClass();
      
      // 检查是否有setLogger方法
      return typeof (tempInstance as any).setLogger === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取工厂统计信息
   */
  getFactoryStats(): {
    registeredStrategies: number;
    availableStrategyTypes: string[];
    baseStrategyCount: number;
    requiresTreeSitterCount: number;
    requiresLoggerCount: number;
  } {
    const allInfo = this.getAllStrategiesInfo();
    let baseStrategyCount = 0;
    let requiresTreeSitterCount = 0;
    let requiresLoggerCount = 0;

    for (const info of allInfo.values()) {
      if (info.isBaseStrategy) baseStrategyCount++;
      if (info.requiresTreeSitter) requiresTreeSitterCount++;
      if (info.requiresLogger) requiresLoggerCount++;
    }

    return {
      registeredStrategies: this.strategies.size,
      availableStrategyTypes: this.getAvailableStrategies(),
      baseStrategyCount,
      requiresTreeSitterCount,
      requiresLoggerCount
    };
  }

  /**
   * 清理工厂状态
   */
  clear(): void {
    this.strategies.clear();
  }
}

/**
 * 全局策略工厂实例
 */
export const strategyFactory = new SplitStrategyFactory();