# 策略装饰器系统

## 概述

策略装饰器系统提供了灵活的方式来增强和组合代码分割策略的功能。通过装饰器模式，可以在不修改原有策略的情况下添加重叠、缓存和性能监控等功能。

## 核心组件

### 装饰器类

#### OverlapDecorator
为策略添加内容重叠功能，确保代码块之间的上下文连续性。

```typescript
import { OverlapDecorator } from './decorators';

const decorator = new OverlapDecorator(baseStrategy, overlapCalculator);
```

#### PerformanceMonitorDecorator
为策略添加性能监控功能，跟踪执行时间和统计信息。

```typescript
import { PerformanceMonitorDecorator } from './decorators';

const decorator = new PerformanceMonitorDecorator(baseStrategy, logger);
```

#### CacheDecorator
为策略添加缓存功能，避免重复计算相同内容的分割结果。

```typescript
import { CacheDecorator } from './decorators';

const decorator = new CacheDecorator(baseStrategy, maxSize, ttl);
```

### 装饰器构建器

#### StrategyDecoratorBuilder
提供流畅的API来构建装饰器链，支持多种装饰器组合。

```typescript
import { StrategyDecoratorBuilder } from './decorators';

const strategy = new StrategyDecoratorBuilder(baseStrategy)
  .withOverlap(overlapCalculator)
  .withPerformanceMonitor(logger)
  .withCache(100, 300000)
  .build();
```

#### DecoratorFactory
提供便捷的工厂方法来快速创建常用的装饰器组合。

```typescript
import { DecoratorFactory } from './decorators';

// 创建完全装饰的策略
const strategy = DecoratorFactory.createFullyDecoratedStrategy(
  baseStrategy,
  overlapCalculator,
  logger,
  { maxSize: 100, ttl: 300000 }
);
```

## 使用指南

### 基本用法

```typescript
import { StrategyDecoratorBuilder } from './decorators';

// 1. 创建基础策略
const baseStrategy = strategyFactory.createStrategyFromType('ast');

// 2. 使用构建器添加装饰器
const decoratedStrategy = new StrategyDecoratorBuilder(baseStrategy)
  .withCache(50, 60000)        // 添加缓存
  .withOverlap(calculator)     // 添加重叠
  .withPerformanceMonitor()    // 添加性能监控
  .build();

// 3. 使用装饰后的策略
const chunks = await decoratedStrategy.split(content, language, filePath);
```

### 高级配置

```typescript
import { DecoratorOptions, StrategyDecoratorBuilder } from './decorators';

// 使用配置对象
const options: DecoratorOptions = {
  overlap: {
    enabled: true,
    calculator: overlapCalculator
  },
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 300000
  },
  performance: {
    enabled: true,
    logger: customLogger
  }
};

const strategy = new StrategyDecoratorBuilder(baseStrategy, options).build();
```

### 工厂方法

```typescript
import { DecoratorFactory } from './decorators';

// 快速创建常用组合
const cachedStrategy = DecoratorFactory.createCachedStrategy(baseStrategy);
const overlapStrategy = DecoratorFactory.createOverlapStrategy(baseStrategy, calculator);
const monitoredStrategy = DecoratorFactory.createMonitoredStrategy(baseStrategy, logger);
```

## 装饰器执行顺序

装饰器按照以下顺序执行（从外到内）：

1. **CacheDecorator** (最外层) - 缓存最终结果
2. **OverlapDecorator** (中间层) - 处理内容重叠
3. **PerformanceMonitorDecorator** (最内层) - 监控实际执行

这个顺序确保了：
- 缓存的是包含重叠的最终结果
- 性能监控的是实际执行时间
- 重叠处理在缓存和监控之间

## 性能考虑

### 缓存策略
- 使用LRU算法管理缓存
- 支持TTL（生存时间）配置
- 自动处理缓存键生成

### 性能监控
- 跟踪执行时间和块数量
- 提供统计信息和平均值
- 支持错误处理和日志记录

### 重叠处理
- 智能检测代码文件类型
- 只在必要时应用重叠
- 支持自定义重叠计算器

## 向后兼容性

为了保持向后兼容性，提供了兼容性适配器：

```typescript
import { BackwardCompatibilityAdapter } from './decorators';

// 使用旧版本API（已弃用但仍可用）
const decorator = BackwardCompatibilityAdapter.createLegacyOverlapDecorator(
  strategy, 
  calculator
);
```

## 迁移指南

### 从旧版本API迁移

```typescript
// 旧版本（已弃用）
const decorated = new OverlapDecorator(strategy, calculator);

// 新版本（推荐）
const decorated = new StrategyDecoratorBuilder(strategy)
  .withOverlap(calculator)
  .build();
```

详细的迁移指南请参考 `BackwardCompatibilityAdapter.ts` 中的 `MigrationHelper.generateMigrationGuide()`。

## 测试

装饰器系统包含全面的测试覆盖：

- 单元测试：每个装饰器的独立功能
- 集成测试：装饰器组合的协同工作
- 兼容性测试：向后兼容性验证
- 性能测试：装饰器对性能的影响

运行测试：

```bash
npm test -- decorators
```

## 扩展性

### 添加新装饰器

1. 实现 `ISplitStrategy` 接口
2. 在构造函数中接收被装饰的策略
3. 委托方法调用到被装饰的策略
4. 在适当的位置添加自定义逻辑

```typescript
export class CustomDecorator implements ISplitStrategy {
  constructor(private strategy: ISplitStrategy) {}
  
  async split(...args): Promise<CodeChunk[]> {
    // 前置处理
    const result = await this.strategy.split(...args);
    // 后置处理
    return result;
  }
  
  // 委托其他方法
  getName() => this.strategy.getName();
  supportsLanguage(lang) => this.strategy.supportsLanguage(lang);
  getPriority() => this.strategy.getPriority();
}
```

### 扩展构建器

```typescript
// 在 StrategyDecoratorBuilder 中添加新方法
withCustomDecorator(config: CustomConfig): StrategyDecoratorBuilder {
  this.options.custom = { enabled: true, ...config };
  return this;
}
```

## 最佳实践

1. **合理使用缓存**：对于重复内容较多的场景启用缓存
2. **选择性重叠**：根据文件类型和内容特征决定是否使用重叠
3. **性能监控**：在生产环境中启用性能监控以识别瓶颈
4. **装饰器顺序**：遵循推荐的装饰器顺序以获得最佳性能
5. **错误处理**：确保装饰器不会掩盖底层策略的错误

## 故障排除

### 常见问题

1. **缓存不生效**：检查缓存键生成和TTL设置
2. **重叠异常**：验证重叠计算器的实现
3. **性能数据异常**：确保日志记录器正确配置
4. **内存泄漏**：定期清理缓存和重置统计信息

### 调试技巧

```typescript
// 启用详细日志
const strategy = new StrategyDecoratorBuilder(baseStrategy)
  .withPerformanceMonitor(verboseLogger)
  .build();

// 检查缓存统计
const cacheStats = (strategy as any).getCacheStats?.();
console.log('Cache stats:', cacheStats);

// 检查性能统计
const perfStats = (strategy as any).getPerformanceStats?.();
console.log('Performance stats:', perfStats);