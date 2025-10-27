import { ISplitStrategy, IOverlapCalculator } from '../../../interfaces/ISplitStrategy';
import { OverlapDecorator } from './OverlapDecorator';
import { PerformanceMonitorDecorator } from './PerformanceMonitorDecorator';
import { CacheDecorator } from './CacheDecorator';

/**
 * 装饰器配置选项
 */
export interface DecoratorOptions {
  overlap?: {
    enabled: boolean;
    calculator: IOverlapCalculator;
  };
  cache?: {
    enabled: boolean;
    maxSize?: number;
    ttl?: number;
  };
  performance?: {
    enabled: boolean;
    logger?: any;
  };
}

/**
 * 策略装饰器构建器
 * 提供流畅的API来构建装饰器链
 */
export class StrategyDecoratorBuilder {
  private strategy: ISplitStrategy;
  private options: DecoratorOptions;

  constructor(strategy: ISplitStrategy, options: DecoratorOptions = {}) {
    this.strategy = strategy;
    this.options = {
      overlap: { enabled: false, calculator: null as any },
      cache: { enabled: false, maxSize: 100, ttl: 300000 },
      performance: { enabled: false },
      ...options
    };
  }

  /**
   * 添加重叠装饰器
   */
  withOverlap(overlapCalculator: IOverlapCalculator): StrategyDecoratorBuilder {
    this.options.overlap = {
      enabled: true,
      calculator: overlapCalculator
    };
    return this;
  }

  /**
   * 添加性能监控装饰器
   */
  withPerformanceMonitor(logger?: any): StrategyDecoratorBuilder {
    this.options.performance = {
      enabled: true,
      logger
    };
    return this;
  }

  /**
   * 添加缓存装饰器
   */
  withCache(maxCacheSize?: number, ttl?: number): StrategyDecoratorBuilder {
    this.options.cache = {
      enabled: true,
      maxSize: maxCacheSize || 100,
      ttl: ttl || 300000
    };
    return this;
  }

  /**
   * 启用所有装饰器
   */
  withAllDecorators(overlapCalculator: IOverlapCalculator, logger?: any): StrategyDecoratorBuilder {
    return this
      .withOverlap(overlapCalculator)
      .withPerformanceMonitor(logger)
      .withCache();
  }

  /**
   * 构建最终策略
   * 按照优化顺序应用装饰器：缓存 -> 重叠 -> 性能监控
   */
  build(): ISplitStrategy {
    let result = this.strategy;

    // 1. 首先应用缓存装饰器（最外层，避免重复计算）
    if (this.options.cache?.enabled) {
      result = new CacheDecorator(
        result,
        this.options.cache.maxSize,
        this.options.cache.ttl
      );
    }

    // 2. 然后应用重叠装饰器（中间层，处理内容重叠）
    if (this.options.overlap?.enabled) {
      result = new OverlapDecorator(result, this.options.overlap.calculator);
    }

    // 3. 最后应用性能监控装饰器（最内层，监控实际执行）
    if (this.options.performance?.enabled) {
      result = new PerformanceMonitorDecorator(result, this.options.performance.logger);
    }

    return result;
  }

  /**
   * 获取当前配置
   */
  getOptions(): DecoratorOptions {
    return { ...this.options };
  }

  /**
   * 重置配置
   */
  reset(): StrategyDecoratorBuilder {
    this.options = {
      overlap: { enabled: false, calculator: null as any },
      cache: { enabled: false, maxSize: 100, ttl: 300000 },
      performance: { enabled: false }
    };
    return this;
  }
}

/**
 * 装饰器工厂
 * 提供便捷的装饰器创建方法
 */
export class DecoratorFactory {
  /**
   * 创建带有所有装饰器的策略
   */
  static createFullyDecoratedStrategy(
    strategy: ISplitStrategy,
    overlapCalculator: IOverlapCalculator,
    logger?: any,
    cacheOptions?: { maxSize?: number; ttl?: number }
  ): ISplitStrategy {
    return new StrategyDecoratorBuilder(strategy)
      .withAllDecorators(overlapCalculator, logger)
      .withCache(cacheOptions?.maxSize, cacheOptions?.ttl)
      .build();
  }

  /**
   * 创建带有缓存的策略
   */
  static createCachedStrategy(
    strategy: ISplitStrategy,
    maxSize?: number,
    ttl?: number
  ): ISplitStrategy {
    return new StrategyDecoratorBuilder(strategy)
      .withCache(maxSize, ttl)
      .build();
  }

  /**
   * 创建带有重叠的策略
   */
  static createOverlapStrategy(
    strategy: ISplitStrategy,
    overlapCalculator: IOverlapCalculator
  ): ISplitStrategy {
    return new StrategyDecoratorBuilder(strategy)
      .withOverlap(overlapCalculator)
      .build();
  }

  /**
   * 创建带有性能监控的策略
   */
  static createMonitoredStrategy(
    strategy: ISplitStrategy,
    logger?: any
  ): ISplitStrategy {
    return new StrategyDecoratorBuilder(strategy)
      .withPerformanceMonitor(logger)
      .build();
  }
}