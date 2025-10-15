# SplitStrategyFactory 策略注册机制分析与改进方案

建议采用方案2：策略提供者模式

## 问题概述

在 [`src/service/parser/splitting/core/SplitStrategyFactory.ts`](src/service/parser/splitting/core/SplitStrategyFactory.ts:135-141) 中，`registerDefaultStrategies()` 方法被注释为需要解决循环依赖问题，导致策略注册被延迟到应用初始化时动态进行。这种设计存在多个潜在问题，需要深入分析和改进。

## 当前架构分析

### 1. 策略工厂架构

```typescript
// SplitStrategyFactory 核心结构
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private strategies: Map<string, new (options?: ChunkingOptions) => ISplitStrategy> = new Map();

  constructor() {
    // 注册默认策略
    this.registerDefaultStrategies(); // 第14行
  }

  private registerDefaultStrategies(): void {
    // 注意：这里需要导入具体的策略类，但由于循环依赖问题，
    // 我们将在应用初始化时动态注册这些策略
    // 第139-141行
  }
}
```

### 2. 策略注册机制

策略注册通过独立的 [`StrategyRegistration.ts`](src/service/parser/splitting/core/StrategyRegistration.ts) 模块进行：

```typescript
export function registerDefaultStrategies(logger?: any): void {
  strategyFactory.registerStrategy('FunctionSplitter', FunctionSplitter);
  strategyFactory.registerStrategy('ClassSplitter', ClassSplitter);
  strategyFactory.registerStrategy('ImportSplitter', ImportSplitter);
  strategyFactory.registerStrategy('SyntaxAwareSplitter', SyntaxAwareSplitter);
  strategyFactory.registerStrategy('IntelligentSplitter', IntelligentSplitter);
}
```

### 3. 策略使用方式

在 [`ASTCodeSplitter.ts`](src/service/parser/splitting/ASTCodeSplitter.ts:45) 中：
```typescript
this.strategyFactory = new SplitStrategyFactory(); // 创建新实例
```

## 循环依赖分析

### 1. 依赖关系图

```
SplitStrategyFactory
├── 需要导入具体策略类进行注册
├── FunctionSplitter extends BaseSplitStrategy
├── ClassSplitter extends BaseSplitStrategy
├── SyntaxAwareSplitter 
│   ├── 导入 FunctionSplitter
│   ├── 导入 ClassSplitter
│   └── 导入 ImportSplitter
└── IntelligentSplitter
```

### 2. 循环依赖的具体表现

1. **工厂依赖策略类**：`SplitStrategyFactory` 需要导入具体的策略类进行注册
2. **策略类相互依赖**：`SyntaxAwareSplitter` 导入了 `FunctionSplitter`、`ClassSplitter`、`ImportSplitter`
3. **运行时实例依赖**：策略类在运行时需要相互协作

### 3. 循环依赖的影响

- **编译时问题**：TypeScript 编译器可能无法正确解析循环依赖
- **运行时问题**：模块加载顺序不确定，可能导致 `undefined` 错误
- **初始化问题**：策略工厂无法预先注册所有策略
- **维护困难**：添加新策略时需要手动维护注册逻辑

## 现有解决方案分析

### 1. 延迟注册策略

**实现方式**：
- 将策略注册逻辑移至独立的 `StrategyRegistration.ts` 模块
- 在应用初始化时调用 `registerDefaultStrategies()`

**优点**：
- 避免了编译时的循环依赖
- 策略注册集中管理
- 支持运行时动态注册

**缺点**：
- 增加了使用复杂性
- 需要确保注册时机正确
- 可能导致策略未注册就使用的问题
- 全局状态管理困难

### 2. 动态导入策略

**潜在方案**：
- 使用动态 `import()` 在运行时加载策略类
- 将策略类作为插件系统实现

**优点**：
- 完全避免编译时依赖
- 支持热插拔策略

**缺点**：
- 增加了运行时复杂性
- 类型安全性降低
- 性能开销较大

## 改进方案设计

### 方案一：依赖注入容器模式

```typescript
// 1. 创建策略配置接口
interface StrategyConfig {
  name: string;
  class: new (options?: ChunkingOptions) => ISplitStrategy;
  dependencies?: string[];
}

// 2. 修改工厂实现
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private strategies: Map<string, StrategyConfig> = new Map();
  private container: DIContainer;

  constructor(container: DIContainer) {
    this.container = container;
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    this.registerStrategy({
      name: 'FunctionSplitter',
      class: FunctionSplitter,
      dependencies: ['TreeSitterService', 'LoggerService']
    });
    
    this.registerStrategy({
      name: 'SyntaxAwareSplitter',
      class: SyntaxAwareSplitter,
      dependencies: ['FunctionSplitter', 'ClassSplitter', 'ImportSplitter']
    });
  }

  create(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    const config = this.strategies.get(strategyType);
    if (!config) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }

    // 使用依赖注入容器创建实例
    return this.container.resolve(config.class, options);
  }
}
```

### 方案二：策略提供者模式【推荐】

```typescript
// 1. 创建策略提供者接口
interface IStrategyProvider {
  getName(): string;
  createStrategy(options?: ChunkingOptions): ISplitStrategy;
  getDependencies(): string[];
}

// 2. 具体策略提供者
class FunctionSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'FunctionSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new FunctionSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}

// 3. 修改工厂实现
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private providers: Map<string, IStrategyProvider> = new Map();

  constructor() {
    this.registerProviders();
  }

  private registerProviders(): void {
    this.registerProvider(new FunctionSplitterProvider());
    this.registerProvider(new SyntaxAwareSplitterProvider());
    // ... 其他提供者
  }

  create(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    const provider = this.providers.get(strategyType);
    if (!provider) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }
    return provider.createStrategy(options);
  }
}
```

### 方案三：懒加载策略模式

```typescript
// 1. 策略加载器接口
interface IStrategyLoader {
  loadStrategy(strategyType: string): Promise<new (options?: ChunkingOptions) => ISplitStrategy>;
}

// 2. 默认策略加载器
export class DefaultStrategyLoader implements IStrategyLoader {
  private strategyMap: Map<string, () => Promise<any>> = new Map();

  constructor() {
    this.initializeStrategyMap();
  }

  private initializeStrategyMap(): void {
    this.strategyMap.set('FunctionSplitter', () => import('./strategies/FunctionSplitter').then(m => m.FunctionSplitter));
    this.strategyMap.set('ClassSplitter', () => import('./strategies/ClassSplitter').then(m => m.ClassSplitter));
    this.strategyMap.set('SyntaxAwareSplitter', () => import('./strategies/SyntaxAwareSplitter').then(m => m.SyntaxAwareSplitter));
    // ... 其他策略
  }

  async loadStrategy(strategyType: string): Promise<new (options?: ChunkingOptions) => ISplitStrategy> {
    const loader = this.strategyMap.get(strategyType);
    if (!loader) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }
    return loader();
  }
}

// 3. 修改工厂实现
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private strategies: Map<string, new (options?: ChunkingOptions) => ISplitStrategy> = new Map();
  private loader: IStrategyLoader;

  constructor(loader: IStrategyLoader = new DefaultStrategyLoader()) {
    this.loader = loader;
  }

  async create(strategyType: string, options?: ChunkingOptions): Promise<ISplitStrategy> {
    let StrategyClass = this.strategies.get(strategyType);
    
    if (!StrategyClass) {
      // 懒加载策略类
      StrategyClass = await this.loader.loadStrategy(strategyType);
      this.strategies.set(strategyType, StrategyClass);
    }

    return new StrategyClass(options);
  }
}
```

## 推荐方案：策略提供者模式

### 选择理由

1. **解决循环依赖**：通过提供者模式，策略类不再直接相互导入
2. **保持类型安全**：编译时类型检查仍然有效
3. **简化使用**：无需手动注册策略
4. **支持扩展**：易于添加新策略
5. **测试友好**：便于mock和单元测试

### 实施步骤

1. **第一阶段**：创建策略提供者接口和基础实现
2. **第二阶段**：重构现有策略类，移除相互导入
3. **第三阶段**：修改工厂类，使用提供者模式
4. **第四阶段**：更新所有使用策略工厂的地方
5. **第五阶段**：移除 `StrategyRegistration.ts` 模块

### 代码示例

```typescript
// 1. 策略提供者接口
export interface IStrategyProvider {
  readonly name: string;
  createStrategy(options?: ChunkingOptions): ISplitStrategy;
  getDependencies?(): string[];
}

// 2. 基础提供者实现
export abstract class BaseStrategyProvider implements IStrategyProvider {
  abstract readonly name: string;
  abstract createStrategy(options?: ChunkingOptions): ISplitStrategy;
  
  getDependencies?(): string[] {
    return [];
  }
}

// 3. 具体提供者实现
export class FunctionSplitterProvider extends BaseStrategyProvider {
  readonly name = 'FunctionSplitter';
  
  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new FunctionSplitter(options);
  }
  
  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}

// 4. 重构后的工厂
export class SplitStrategyFactory implements ISplitStrategyFactory {
  private providers: Map<string, IStrategyProvider> = new Map();

  constructor(providers: IStrategyProvider[] = []) {
    this.registerDefaultProviders();
    providers.forEach(provider => this.registerProvider(provider));
  }

  private registerDefaultProviders(): void {
    this.registerProvider(new FunctionSplitterProvider());
    this.registerProvider(new ClassSplitterProvider());
    this.registerProvider(new ImportSplitterProvider());
    this.registerProvider(new SyntaxAwareSplitterProvider());
    this.registerProvider(new IntelligentSplitterProvider());
  }

  create(strategyType: string, options?: ChunkingOptions): ISplitStrategy {
    const provider = this.providers.get(strategyType);
    if (!provider) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }
    return provider.createStrategy(options);
  }
}
```

## 预期收益

1. **消除循环依赖**：策略类之间不再直接相互依赖
2. **简化架构**：移除复杂的注册机制
3. **提高可维护性**：新策略添加更加简单
4. **增强测试性**：便于单元测试和集成测试
5. **保持性能**：无运行时动态加载开销

## 风险评估

1. **重构工作量**：需要修改多个文件和测试
2. **兼容性风险**：需要确保现有功能不受影响
3. **学习成本**：开发团队需要理解新的架构模式

## 结论

当前的策略注册机制确实存在循环依赖问题，通过采用策略提供者模式可以有效解决这一问题，同时保持系统的可扩展性和可维护性。建议优先实施策略提供者模式，逐步替换现有的延迟注册机制。