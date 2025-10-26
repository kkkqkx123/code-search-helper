import { ISplitStrategyFactory } from '../interfaces/ISplitStrategyFactory';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ChunkingOptions } from '..';
import { BaseSplitStrategy } from '../../processing/strategies/impl/base/BaseASTStrategy';

/**
 * 分割策略工厂实现 - 使用策略提供者模式
 */
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private providers: Map<string, IStrategyProvider> = new Map();

  constructor() {
    // 注册默认策略提供者
    this.registerDefaultProviders();
  }

  /**
   * 创建分割策略实例
   */
  create(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    const provider = this.providers.get(strategyType);

    if (!provider) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }

    try {
      return provider.createStrategy(options);
    } catch (error) {
      throw new Error(`Failed to create strategy ${strategyType}: ${error}`);
    }
  }

  /**
   * 注册新的策略类型（兼容旧接口）
   */
  registerStrategy(
    strategyType: string,
    strategyClass: new (options?: ChunkingOptions) => ISplitStrategy
  ): void {
    // 创建兼容提供者
    const compatibilityProvider: IStrategyProvider = {
      getName: () => strategyType,
      createStrategy: (options?: ChunkingOptions) => new strategyClass(options),
      getDependencies: () => this.inferDependencies(strategyClass)
    };

    this.registerProvider(compatibilityProvider);
  }

  /**
   * 注册策略提供者
   */
  registerProvider(provider: IStrategyProvider): void {
    const strategyType = provider.getName();

    if (!strategyType || strategyType.trim() === '') {
      throw new Error('Strategy type cannot be empty');
    }

    if (!provider) {
      throw new Error('Strategy provider cannot be null');
    }

    this.providers.set(strategyType, provider);
  }

  /**
   * 获取所有可用的策略类型
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 检查是否支持指定策略类型
   */
  supportsStrategy(strategyType: string): boolean {
    return this.providers.has(strategyType);
  }

  /**
   * 移除策略类型
   */
  unregisterStrategy(strategyType: string): boolean {
    return this.providers.delete(strategyType);
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
    const provider = this.providers.get(strategyType);
    if (!provider) {
      return null;
    }

    // 创建临时实例进行验证
    const tempStrategy = provider.createStrategy();

    // 检查是否是基础策略类的子类
    const isBaseStrategy = tempStrategy instanceof BaseSplitStrategy;

    // 检查是否需要TreeSitter服务
    const requiresTreeSitter = this.requiresTreeSitterService(tempStrategy);

    // 检查是否需要日志服务
    const requiresLogger = this.requiresLoggerService(tempStrategy);

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

    for (const [strategyType, provider] of this.providers) {
      const info = this.getStrategyInfo(strategyType);
      if (info) {
        infoMap.set(strategyType, info);
      }
    }

    return infoMap;
  }

  /**
   * 注册默认策略提供者
   */
  private registerDefaultProviders(): void {
    // 注意：这里需要导入具体的策略提供者，但由于循环依赖问题，
    // 我们将在应用初始化时动态注册这些提供者
  }

  /**
   * 推断策略类的依赖关系
   */
  private inferDependencies(strategyClass: new (options?: ChunkingOptions) => ISplitStrategy): string[] {
    const dependencies: string[] = [];

    try {
      const tempInstance = new strategyClass();

      if (typeof (tempInstance as any).setTreeSitterService === 'function') {
        dependencies.push('TreeSitterService');
      }

      if (typeof (tempInstance as any).setLogger === 'function') {
        dependencies.push('LoggerService');
      }

      // 根据类名推断其他依赖
      const className = strategyClass.name.toLowerCase();
      if (className.includes('syntax') || className.includes('semantic')) {
        if (!dependencies.includes('TreeSitterService')) {
          dependencies.push('TreeSitterService');
        }
      }
    } catch (error) {
      // 如果无法创建实例，返回基本依赖
      dependencies.push('TreeSitterService', 'LoggerService');
    }

    return dependencies;
  }

  /**
   * 检查是否需要TreeSitter服务
   */
  private requiresTreeSitterService(strategy: ISplitStrategy): boolean {
    // 检查是否有setTreeSitterService方法
    if (typeof (strategy as any).setTreeSitterService === 'function') {
      return true;
    }

    // 检查策略提供者声明的依赖
    const provider = Array.from(this.providers.values()).find(p =>
      p.createStrategy() === strategy || p.createStrategy().constructor === strategy.constructor
    );

    if (provider) {
      return provider.getDependencies().includes('TreeSitterService');
    }

    return false;
  }

  /**
   * 检查是否需要日志服务
   */
  private requiresLoggerService(strategy: ISplitStrategy): boolean {
    // 检查是否有setLogger方法
    if (typeof (strategy as any).setLogger === 'function') {
      return true;
    }

    // 检查策略提供者声明的依赖
    const provider = Array.from(this.providers.values()).find(p =>
      p.createStrategy() === strategy || p.createStrategy().constructor === strategy.constructor
    );

    if (provider) {
      return provider.getDependencies().includes('LoggerService');
    }

    return false;
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
      registeredStrategies: this.providers.size,
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
    this.providers.clear();
  }
}

/**
 * 全局策略工厂实例
 */
export const strategyFactory = new SplitStrategyFactory();