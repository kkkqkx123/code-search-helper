# InversifyJS 依赖注入绑定指南

## 概述

本文档总结了在项目中正确使用 InversifyJS v6 进行依赖注入绑定的最佳实践和解决方案。通过解决一系列绑定问题，我们总结出了以下关键要点。

## 主要问题及解决方案

### 1. ContainerModule 回调函数参数问题

**问题**：InversifyJS v6 中 ContainerModule 回调函数的参数结构发生了变化。

**错误代码**：
```typescript
export const GraphModule = new ContainerModule((bind: any) => {
  bind(TYPES.GraphAnalysisService).to(GraphAnalysisService).inSingletonScope();
});
```

**正确代码**：
```typescript
export const GraphModule = new ContainerModule((bindObj: any) => {
  const { bind } = bindObj;
  bind(TYPES.GraphAnalysisService).to(GraphAnalysisService).inSingletonScope();
});
```

**说明**：在 v6 中，回调函数接收的是一个包含 bind 方法的对象，而不是直接的 bind 函数。

### 2. 服务接口和实现的绑定

**问题**：缺少接口类型的绑定，导致依赖注入失败。

**解决方案**：
```typescript
// 同时绑定接口和实现类
bind(TYPES.IGraphSearchService).to(GraphSearchServiceNew).inSingletonScope();
bind(TYPES.GraphSearchServiceNew).to(GraphSearchServiceNew).inSingletonScope();

// 为了向后兼容，也绑定旧的类型
bind(TYPES.GraphSearchService).to(GraphSearchServiceNew).inSingletonScope();
```

**最佳实践**：
- 总是同时绑定接口和实现类
- 为向后兼容考虑，保留旧类型的绑定
- 在 types.ts 中定义所有需要的类型标识符

### 3. 避免重复绑定

**问题**：在不同模块中重复绑定相同的服务导致冲突。

**解决方案**：
- 将基础设施服务（如 LoggerService、ConfigService 等）在 DIContainer.ts 中绑定
- 在模块化容器中只绑定特定于该模块的服务
- 避免在多个模块中绑定相同的服务

**示例**：
```typescript
// NebulaModule.ts - 不再绑定基础设施服务
// bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();  // 删除
// bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();  // 删除
// bind(TYPES.ConfigService).to(ConfigService).inSingletonScope();  // 删除

// 只绑定 Nebula 特定的服务
bind(TYPES.INebulaService).to(NebulaService).inSingletonScope();
bind(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
```

### 4. 模块化绑定策略

**最佳实践**：
- 按功能领域组织模块（如 NebulaModule、GraphModule）
- 在 DIContainer.ts 中集中绑定通用的基础设施服务
- 使用模块化容器绑定特定领域的服务
- 确保模块加载顺序正确

## 完整绑定示例

### 1. types.ts 定义

```typescript
// 确保导入所有需要的接口和实现
import { NebulaService, INebulaService } from './database/NebulaService';
import { GraphQueryBuilder, IGraphQueryBuilder } from './database/query/GraphQueryBuilder';
import { IGraphSearchService } from './service/graph/core/IGraphSearchService';

export const TYPES = {
  // Nebula 服务
  NebulaService: Symbol.for('NebulaService'),
  INebulaService: Symbol.for('INebulaService'),
  
  // 图查询服务
  GraphQueryBuilder: Symbol.for('GraphQueryBuilder'),
  IGraphQueryBuilder: Symbol.for('IGraphQueryBuilder'),
  
  // 图搜索服务
  GraphSearchService: Symbol.for('GraphSearchService'),
  IGraphSearchService: Symbol.for('IGraphSearchService'),
  GraphSearchServiceNew: Symbol.for('GraphSearchServiceNew'),
  
  // 基础设施服务
  LoggerService: Symbol.for('LoggerService'),
  ConfigService: Symbol.for('ConfigService'),
  // ... 其他类型
};
```

### 2. DIContainer.ts 绑定

```typescript
// 基础设施服务绑定
diContainer.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
diContainer.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();

// 图数据库相关服务绑定
diContainer.bind<GraphDatabaseService>(TYPES.GraphDatabaseService).to(GraphDatabaseService).inSingletonScope();
diContainer.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
diContainer.bind<IGraphQueryBuilder>(TYPES.IGraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();

// 事务管理器绑定
diContainer.bind<TransactionManager>(TYPES.TransactionManager).to(TransactionManager).inSingletonScope();

// 加载模块化容器
diContainer.load(NebulaModule);
diContainer.load(GraphModule);
```

### 3. NebulaModule.ts 绑定

```typescript
export const NebulaModule = new ContainerModule((bindObj: any) => {
  const { bind } = bindObj;
  
  // 绑定 Nebula 服务接口和实现
  bind(TYPES.INebulaService).to(NebulaService).inSingletonScope();
  bind(TYPES.NebulaService).to(NebulaService).inSingletonScope();
  
  // 绑定 Nebula 特定服务
  bind(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  bind(TYPES.INebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  
  // 不再绑定基础设施服务，避免重复
});
```

### 4. GraphModule.ts 绑定

```typescript
export const GraphModule = new ContainerModule((bindObj: any) => {
  const { bind } = bindObj;
  
  // 绑定图分析服务
  bind(TYPES.GraphAnalysisService).to(GraphAnalysisService).inSingletonScope();
  
  // 绑定图搜索服务（接口和实现）
  bind(TYPES.IGraphSearchService).to(GraphSearchServiceNew).inSingletonScope();
  bind(TYPES.GraphSearchServiceNew).to(GraphSearchServiceNew).inSingletonScope();
  bind(TYPES.GraphSearchService).to(GraphSearchServiceNew).inSingletonScope();
  
  // 绑定图特定基础设施服务
  bind(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
  bind(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
  bind(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
  bind(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();
});
```

## 调试技巧

### 1. 识别绑定问题

当遇到 "No bindings found for service" 错误时：
1. 检查 types.ts 中是否定义了对应的类型标识符
2. 确认在适当的模块中绑定了该服务
3. 验证绑定顺序是否正确

### 2. 识别重复绑定问题

当遇到 "Ambiguous bindings found for service" 错误时：
1. 检查是否在多个模块中绑定了相同的服务
2. 确保基础设施服务只在 DIContainer.ts 中绑定
3. 使用接口和实现分离的绑定策略

### 3. 模块加载顺序

确保模块加载顺序正确：
1. 先加载基础设施服务（在 DIContainer.ts 中）
2. 再加载特定功能模块（如 NebulaModule、GraphModule）
3. 确保依赖服务的模块先于依赖它们的模块加载

## 总结

通过遵循以上指南，可以避免大多数 InversifyJS v6 中的绑定问题：

1. **正确使用 ContainerModule 回调函数参数**
2. **同时绑定接口和实现类**
3. **避免重复绑定**
4. **采用模块化绑定策略**
5. **确保正确的模块加载顺序**

这些实践不仅解决了当前的绑定问题，还为项目的长期维护和扩展提供了良好的基础。