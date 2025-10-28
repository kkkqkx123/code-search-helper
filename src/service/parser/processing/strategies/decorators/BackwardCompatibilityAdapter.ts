import { ISplitStrategy } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../types';
import {
  OverlapDecorator,
  PerformanceMonitorDecorator,
  CacheDecorator,
  StrategyDecoratorBuilder,
  DecoratorFactory
} from './index';

/**
 * 向后兼容性适配器
 * 提供与旧版本splitting/core/OverlapDecorator等组件的兼容接口
 */
export class BackwardCompatibilityAdapter {
  /**
   * 创建旧版本的OverlapDecorator兼容实例
   * @deprecated 使用新的 StrategyDecoratorBuilder.withOverlap() 替代
   */
  static createLegacyOverlapDecorator(
    strategy: ISplitStrategy,
    overlapCalculator: any
  ): OverlapDecorator {
    return new OverlapDecorator(strategy, overlapCalculator);
  }

  /**
   * 创建旧版本的PerformanceMonitorDecorator兼容实例
   * @deprecated 使用新的 StrategyDecoratorBuilder.withPerformanceMonitor() 替代
   */
  static createLegacyPerformanceMonitorDecorator(
    strategy: ISplitStrategy,
    logger?: any
  ): PerformanceMonitorDecorator {
    return new PerformanceMonitorDecorator(strategy, logger);
  }

  /**
   * 创建旧版本的CacheDecorator兼容实例
   * @deprecated 使用新的 StrategyDecoratorBuilder.withCache() 替代
   */
  static createLegacyCacheDecorator(
    strategy: ISplitStrategy,
    maxCacheSize?: number,
    ttl?: number
  ): CacheDecorator {
    return new CacheDecorator(strategy, maxCacheSize, ttl);
  }

  /**
   * 创建旧版本的SplitStrategyDecoratorBuilder兼容实例
   * @deprecated 使用新的 StrategyDecoratorBuilder 替代
   */
  static createLegacyDecoratorBuilder(strategy: ISplitStrategy): LegacyDecoratorBuilder {
    return new LegacyDecoratorBuilder(strategy);
  }
}

/**
 * 旧版本装饰器构建器的兼容包装器
 * @deprecated 使用新的 StrategyDecoratorBuilder 替代
 */
export class LegacyDecoratorBuilder {
  private strategy: ISplitStrategy;
  private modernBuilder: StrategyDecoratorBuilder;

  constructor(strategy: ISplitStrategy) {
    this.strategy = strategy;
    this.modernBuilder = new StrategyDecoratorBuilder(strategy);
  }

  /**
   * 添加重叠装饰器（旧版本接口）
   */
  withOverlap(overlapCalculator: any): LegacyDecoratorBuilder {
    this.modernBuilder.withOverlap(overlapCalculator);
    return this;
  }

  /**
   * 添加性能监控装饰器（旧版本接口）
   */
  withPerformanceMonitor(logger?: any): LegacyDecoratorBuilder {
    this.modernBuilder.withPerformanceMonitor(logger);
    return this;
  }

  /**
   * 添加缓存装饰器（旧版本接口）
   */
  withCache(maxCacheSize?: number, ttl?: number): LegacyDecoratorBuilder {
    this.modernBuilder.withCache(maxCacheSize, ttl);
    return this;
  }

  /**
   * 构建最终策略（旧版本接口）
   */
  build(): ISplitStrategy {
    return this.modernBuilder.build();
  }
}

/**
 * 旧版本工厂类的兼容包装器
 * 提供与旧版本splitting/core/SplitStrategyFactory兼容的接口
 */
export class LegacySplitStrategyFactory {
  private modernFactory: any;

  constructor(modernFactory: any) {
    this.modernFactory = modernFactory;
  }

  /**
   * 创建策略（旧版本接口兼容）
   */
  createStrategy(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    return this.modernFactory.createStrategyFromType(strategyType, options);
  }

  /**
   * 创建带装饰器的策略（旧版本接口兼容）
   */
  createDecoratedStrategy(
    strategyType: string,
    options?: ChunkingOptions,
    overlapCalculator?: any,
    enableCache?: boolean,
    enablePerformance?: boolean,
    logger?: any
  ): ISplitStrategy {
    let strategy = this.createStrategy(strategyType, options);

    if (enableCache) {
      strategy = BackwardCompatibilityAdapter.createLegacyCacheDecorator(strategy);
    }

    if (overlapCalculator) {
      strategy = BackwardCompatibilityAdapter.createLegacyOverlapDecorator(strategy, overlapCalculator);
    }

    if (enablePerformance) {
      strategy = BackwardCompatibilityAdapter.createLegacyPerformanceMonitorDecorator(strategy, logger);
    }

    return strategy;
  }
}

/**
 * 迁移助手
 * 提供从旧版本API到新版本API的迁移指导
 */
export class MigrationHelper {
  /**
   * 检查是否使用了已弃用的API
   */
  static checkDeprecatedUsage(usage: string): { isDeprecated: boolean; suggestion: string } {
    const deprecatedPatterns = [
      {
        pattern: /new OverlapDecorator/,
        suggestion: '使用 new StrategyDecoratorBuilder(strategy).withOverlap(calculator).build() 替代'
      },
      {
        pattern: /new PerformanceMonitorDecorator/,
        suggestion: '使用 new StrategyDecoratorBuilder(strategy).withPerformanceMonitor(logger).build() 替代'
      },
      {
        pattern: /new CacheDecorator/,
        suggestion: '使用 new StrategyDecoratorBuilder(strategy).withCache().build() 替代'
      },
      {
        pattern: /new SplitStrategyDecoratorBuilder/,
        suggestion: '使用 new StrategyDecoratorBuilder(strategy) 替代'
      }
    ];

    for (const { pattern, suggestion } of deprecatedPatterns) {
      if (pattern.test(usage)) {
        return { isDeprecated: true, suggestion };
      }
    }

    return { isDeprecated: false, suggestion: '' };
  }

  /**
   * 生成迁移指南
   */
  static generateMigrationGuide(): string {
    return `
# 装饰器API迁移指南

## 已弃用的API

### 1. 直接实例化装饰器
\`\`\`typescript
// 旧版本（已弃用）
const decorated = new OverlapDecorator(strategy, calculator);
const monitored = new PerformanceMonitorDecorator(strategy, logger);
const cached = new CacheDecorator(strategy, maxSize, ttl);

// 新版本（推荐）
const decorated = new StrategyDecoratorBuilder(strategy)
  .withOverlap(calculator)
  .build();
const monitored = new StrategyDecoratorBuilder(strategy)
  .withPerformanceMonitor(logger)
  .build();
const cached = new StrategyDecoratorBuilder(strategy)
  .withCache(maxSize, ttl)
  .build();
\`\`\`

### 2. SplitStrategyDecoratorBuilder
\`\`\`typescript
// 旧版本（已弃用）
const builder = new SplitStrategyDecoratorBuilder(strategy)
  .withOverlap(calculator)
  .withPerformanceMonitor(logger)
  .withCache()
  .build();

// 新版本（推荐）
const builder = new StrategyDecoratorBuilder(strategy)
  .withOverlap(calculator)
  .withPerformanceMonitor(logger)
  .withCache()
  .build();
\`\`\`

### 3. 工厂方法
\`\`\`typescript
// 旧版本（已弃用）
const factory = new SplitStrategyFactory();
const strategy = factory.createDecoratedStrategy('ast', options, calculator, true, true, logger);

// 新版本（推荐）
const factory = new UnifiedStrategyFactory();
const strategy = factory.createFullyDecoratedStrategy('ast', calculator, options, { maxSize: 100, ttl: 300000 });
\`\`\`

## 新功能

### 1. 装饰器工厂
\`\`\`typescript
// 使用工厂方法快速创建装饰策略
const strategy = DecoratorFactory.createFullyDecoratedStrategy(
  baseStrategy,
  overlapCalculator,
  logger,
  { maxSize: 100, ttl: 300000 }
);
\`\`\`

### 2. 配置选项
\`\`\`typescript
// 使用配置选项对象
const options: DecoratorOptions = {
  overlap: { enabled: true, calculator },
  cache: { enabled: true, maxSize: 100, ttl: 300000 },
  performance: { enabled: true, logger }
};

const strategy = new StrategyDecoratorBuilder(baseStrategy, options).build();
\`\`\`

## 迁移步骤

1. 替换直接装饰器实例化为使用StrategyDecoratorBuilder
2. 更新工厂方法调用
3. 利用新的装饰器工厂简化代码
4. 测试确保功能正常

## 兼容性

旧版本API仍然可用但已标记为@deprecated，建议尽快迁移到新API。
`;
  }
}