# Ignore 模块与热更新模块整合方案

## 问题分析

### 当前状况

1. **重复的默认忽略规则**
   - `src/service/ignore/defaultIgnorePatterns.ts` 定义了 `DEFAULT_IGNORE_PATTERNS`
   - `src/service/filesystem/defaultIgnorePatterns.ts` 定义了几乎相同的 `DEFAULT_IGNORE_PATTERNS`
   - 两个文件内容几乎完全相同，存在代码重复

2. **独立的热更新实现**
   - `IgnoreRuleManager` 有自己的文件监听和热更新机制
   - `FileWatcherService` 也有自己的文件监听和热更新机制
   - 两个系统独立运行，可能导致资源浪费和冲突

3. **配置不一致**
   - 热更新配置工厂使用硬编码的忽略规则
   - 文件系统服务使用独立的默认忽略规则
   - ignore 模块使用自己的默认忽略规则

### 架构问题

1. **职责重叠**
   - 多个模块都在处理文件监听和忽略规则
   - 缺乏统一的忽略规则管理机制

2. **资源浪费**
   - 多个文件监听器同时运行
   - 重复的规则解析和缓存

3. **维护困难**
   - 修改忽略规则需要在多个地方同步
   - 代码重复导致维护成本增加

## 解决方案

### 1. 统一忽略规则管理

#### 1.1 创建统一的忽略规则服务
```typescript
// src/service/ignore/UnifiedIgnoreRuleService.ts
export class UnifiedIgnoreRuleService {
  // 统一管理所有忽略规则
  // 提供规则获取、更新和监听功能
}
```

#### 1.2 重构现有模块
- 将 `IgnoreRuleManager` 重构为使用统一服务
- 将 `FileWatcherService` 的忽略规则管理移除，使用统一服务
- 将 `FileSystemTraversal` 的忽略规则管理移除，使用统一服务

### 2. 统一热更新机制

#### 2.1 创建统一的热更新协调器
```typescript
// src/service/filesystem/HotReloadCoordinator.ts
export class HotReloadCoordinator {
  // 协调所有热更新相关操作
  // 管理文件监听器生命周期
  // 避免重复监听和资源冲突
}
```

#### 2.2 重构热更新架构
- `IgnoreRuleManager` 专注于规则解析，不再负责文件监听
- `HotReloadCoordinator` 负责所有文件监听
- 通过事件机制通知相关模块规则变化

### 3. 配置工厂模式优化

#### 3.1 扩展配置工厂
```typescript
// src/config/factories/IgnoreConfigFactory.ts
export class IgnoreConfigFactory {
  static createDefaultIgnorePatterns(): string[] {
    // 从统一位置获取默认忽略规则
  }
}
```

#### 3.2 更新热更新配置工厂
- 修改 `HotReloadConfigFactory` 使用 `IgnoreConfigFactory`
- 确保所有模块使用相同的默认忽略规则

## 实施计划

### 阶段 1: 创建统一忽略规则服务
1. 创建 `UnifiedIgnoreRuleService`
2. 迁移 `IgnoreRuleManager` 的规则解析逻辑
3. 创建统一的默认忽略规则常量

### 阶段 2: 重构现有模块
1. 重构 `FileWatcherService` 使用统一服务
2. 重构 `FileSystemTraversal` 使用统一服务
3. 更新 `HotReloadConfigFactory` 使用统一服务

### 阶段 3: 统一热更新机制
1. 创建 `HotReloadCoordinator`
2. 迁移文件监听逻辑到协调器
3. 建立事件通知机制

### 阶段 4: 清理和优化
1. 删除重复的默认忽略规则文件
2. 清理不再需要的代码
3. 添加测试验证

## 优势

1. **代码复用**
   - 消除重复的默认忽略规则
   - 统一的规则解析逻辑

2. **资源优化**
   - 单一的文件监听机制
   - 减少资源占用

3. **维护性**
   - 集中的规则管理
   - 更容易维护和扩展

4. **一致性**
   - 所有模块使用相同的忽略规则
   - 配置和行为一致

## 风险与缓解

### 风险
1. 重构可能引入新的 bug
2. 性能可能受到影响
3. 现有功能可能被破坏

### 缓解措施
1. 分阶段实施，每个阶段都有测试验证
2. 保留原有接口，确保向后兼容
3. 添加详细的测试覆盖

## 结论

通过统一忽略规则管理和热更新机制，我们可以：
- 消除代码重复
- 优化资源使用
- 提高代码维护性
- 确保配置一致性

这个方案既解决了当前的问题，又为未来的扩展提供了良好的基础。