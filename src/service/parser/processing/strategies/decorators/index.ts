// 装饰器类
export { OverlapDecorator } from './OverlapDecorator';
export { PerformanceMonitorDecorator } from './PerformanceMonitorDecorator';
export { CacheDecorator } from './CacheDecorator';

// 装饰器构建器和工厂
export { StrategyDecoratorBuilder, DecoratorFactory } from './StrategyDecoratorBuilder';
export type { DecoratorOptions } from './StrategyDecoratorBuilder';

// 向后兼容性适配器
export { 
  BackwardCompatibilityAdapter,
  LegacyDecoratorBuilder,
  LegacySplitStrategyFactory,
  MigrationHelper
} from './BackwardCompatibilityAdapter';