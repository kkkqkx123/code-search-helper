# MemoryMonitorService 模块分析

## 模块概述

MemoryMonitorService 是一个内存监控和保护服务，用于监控应用程序的内存使用情况，并在内存压力时执行相应的保护措施。

## 主要功能

### 1. 内存监控
- 定期检查应用程序的内存使用情况
- 通过 `setInterval` 定期调用 `process.memoryUsage()` 检查内存使用
- 计算堆内存使用百分比，并与预设阈值比较

### 2. 阈值管理
- **警告级别 (默认70%)**: 当内存使用达到此阈值时，执行轻量级清理
- **严重级别 (默认85%)**: 当内存使用达到此阈值时，执行深度清理
- **紧急级别 (默认95%)**: 当内存使用达到此阈值时，执行紧急清理

### 3. 自动清理机制
- 根据不同内存压力级别自动执行相应级别的内存清理
- 实现了内存清理的冷却机制，防止频繁清理

### 4. 三级内存保护机制
- **轻量级清理**: 清理嵌入缓存
- **深度清理**: 清理嵌入缓存 + 触发垃圾回收
- **紧急清理**: 强制清理嵌入缓存 + 多次垃圾回收

### 5. 手动控制接口
- 提供手动触发内存清理的接口
- 支持动态更新监控配置

## 依赖关系

### 依赖的模块
- `LoggerService`: 用于记录内存使用情况和清理操作的日志
- `ErrorHandlerService`: 用于处理紧急内存情况下的错误
- `EmbeddingCacheService`: 用于清理嵌入缓存以释放内存
- `ConfigService`: 用于获取配置信息

### 设计模式
- 使用依赖注入模式，便于测试和维护
- 通过 inversify 注册为单例服务

## 当前使用情况

### 注册情况
- 在 `src/core/registrars/BusinessServiceRegistrar.ts` 中被注册到依赖注入容器中
- 注册为单例服务 (`inSingletonScope()`)

### 实际使用情况
- 目前没有任何组件实际注入或使用 MemoryMonitorService
- 项目中存在另一个内存监控相关的服务 `MemoryGuard`，在 `ProcessingGuard` 中被使用

## 与其他内存监控组件的关系

项目中存在多个内存管理相关的组件：

1. **MemoryGuard**: 位于 `src/service/parser/universal/MemoryGuard.ts`，用于通用文件处理的内存保护
2. **MemoryMonitorService**: 当前分析的模块，更全面的内存监控和保护服务
3. **PerformanceOptimizerService**: 包含内存监控功能，但主要关注性能优化

## 潜在用途

MemoryMonitorService 设计为一个全面的内存监控解决方案，可能的用途包括：
- 在应用程序启动时自动启动内存监控
- 作为系统健康监控的一部分
- 与其他服务集成以提供统一的内存管理功能

## 总结

MemoryMonitorService 是一个功能完备的内存监控服务，实现了多级内存保护机制。虽然目前没有组件实际使用它，但它已被正确注册到依赖注入容器中，等待其他组件集成使用。与项目中已有的 MemoryGuard 相比，MemoryMonitorService 提供了更全面的内存监控和保护功能。