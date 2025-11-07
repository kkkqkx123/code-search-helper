# 统一策略迁移指南

## 概述

本文档提供了从旧的 `ISplitStrategy` 和 `ISegmentationStrategy` 接口迁移到新的 `IUnifiedSplitStrategy` 接口的完整指南。

## 迁移状态

### ✅ 已完成的工作

1. **统一接口创建**
   - [`IUnifiedSplitStrategy`](src/service/parser/processing/interfaces/IUnifiedSplitStrategy.ts) - 统一策略接口
   - [`UnifiedContext`](src/service/parser/processing/types/UnifiedContext.ts) - 统一上下文
   - [`UnifiedChunkingOptions`](src/service/parser/processing/config/UnifiedChunkingOptions.ts) - 统一配置

2. **适配器实现**
   - [`LegacyStrategyAdapter`](src/service/parser/processing/adapters/LegacyStrategyAdapter.ts) - 旧策略适配器
   - [`UnifiedOverlapDecorator`](src/service/parser/processing/strategies/decorators/UnifiedOverlapDecorator.ts) - 统一装饰器

3. **基础策略实现**
   - [`BaseUnifiedStrategy`](src/service/parser/processing/strategies/impl/BaseUnifiedStrategy.ts) - 基础策略类
   - [`UnifiedLineStrategy`](src/service/parser/processing/strategies/impl/UnifiedLineStrategy.ts) - 行数分段策略
   - [`UnifiedSemanticStrategy`](src/service/parser/processing/strategies/impl/UnifiedSemanticStrategy.ts) - 语义分段策略

4. **策略工厂**
   - [`UnifiedStrategyFactory`](src/service/parser/processing/strategies/factory/UnifiedStrategyFactory.ts) - 统一策略工厂

5. **协调器重构**
   - [`UnifiedProcessingCoordinator`](src/service/parser/processing/coordination/UnifiedProcessingCoordinator.ts) - 已重构使用新接口

### 🔄 进行中的工作

1. **策略迁移**
   - 大部分旧策略已通过适配器自动迁移
   - 新策略正在逐步实现

2. **测试更新**
   - 需要更新现有测试以使用新接口

### 📋 待完成的工作

1. **清理旧接口**
   - 删除不再使用的旧接口文件
   - 移除旧的适配器代码

2. **文档更新**
   - 更新 API 文档
   - 更新开发者指南

## 清理旧接口和适配器

### 第 1 步：验证迁移完成度

在清理之前，请确保：

```bash
# 运行测试确保功能正常
npm test -- --testPathPattern="unified"

# 检查策略覆盖率
npm run test:coverage
```

### 第 2 步：删除旧接口文件

以下文件可以安全删除：

```bash
# 旧接口文件
rm src/service/parser/processing/interfaces/ISplitStrategy.ts
rm src/service/parser/processing/strategies/types/SegmentationTypes.ts

# 旧适配器（如果存在）
rm src/service/parser/processing/adapters/OverlapCalculatorAdapter.ts

# 旧装饰器
rm src/service/parser/processing/strategies/factory/OverlapDecorator.ts
rm src/service/parser/processing/strategies/decorators/OverlapDecorator.ts
rm src/service/parser/processing/strategies/decorators/CacheDecorator.ts
rm src/service/parser/processing/strategies/decorators/PerformanceMonitorDecorator.ts
```

### 第 3 步：更新导入语句

搜索并替换以下导入：

```typescript
// 旧导入
import { ISplitStrategy } from '../../interfaces/ISplitStrategy';
import { ISegmentationStrategy } from '../strategies/types/SegmentationTypes';

// 新导入
import { IUnifiedSplitStrategy } from '../../interfaces/IUnifiedSplitStrategy';
```

### 第 4 步：更新类型定义

更新使用旧接口的类型定义：

```typescript
// 旧类型
interface MyService {
  strategy: ISplitStrategy;
}

// 新类型
interface MyService {
  strategy: IUnifiedSplitStrategy;
}
```

### 第 5 步：移除适配器依赖

在 `UnifiedProcessingCoordinator` 中，可以移除对适配器的依赖：

```typescript
// 移除这些导入
import { StrategyAdapterFactory } from '../adapters/LegacyStrategyAdapter';

// 移除适配器相关代码
const adaptedStrategy = StrategyAdapterFactory.createAdapter(legacyStrategy);
```

### 第 6 步：清理配置转换

移除旧的配置转换函数：

```typescript
// 移除这些导入
import { convertFromLegacyOptions, convertToLegacyOptions } from '../config/UnifiedChunkingOptions';

// 直接使用新配置
const config: UnifiedChunkingOptions = { /* ... */ };
```

## 迁移检查清单

### 代码检查

- [ ] 所有 `ISplitStrategy` 引用已替换为 `IUnifiedSplitStrategy`
- [ ] 所有 `ISegmentationStrategy` 引用已替换为 `IUnifiedSplitStrategy`
- [ ] 所有 `ChunkingOptions` 已替换为 `UnifiedChunkingOptions`
- [ ] 所有 `SegmentationContext` 已替换为 `UnifiedContext`
- [ ] 适配器代码已移除
- [ ] 旧接口文件已删除

### 测试检查

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 代码覆盖率保持或提高
- [ ] 性能测试通过

### 文档检查

- [ ] API 文档已更新
- [ ] 开发者指南已更新
- [ ] 迁移指南已更新
- [ ] 示例代码已更新

## 回滚计划

如果清理过程中出现问题，可以使用以下回滚步骤：

1. **恢复旧接口文件**
   ```bash
   git checkout HEAD~1 -- src/service/parser/processing/interfaces/ISplitStrategy.ts
   git checkout HEAD~1 -- src/service/parser/processing/strategies/types/SegmentationTypes.ts
   ```

2. **恢复适配器**
   ```bash
   git checkout HEAD~1 -- src/service/parser/processing/adapters/LegacyStrategyAdapter.ts
   ```

3. **恢复协调器**
   ```bash
   git checkout HEAD~1 -- src/service/parser/processing/coordination/UnifiedProcessingCoordinator.ts
   ```

## 最佳实践

### 1. 渐进式清理

建议分阶段清理，而不是一次性删除所有旧代码：

1. 第一阶段：删除不常用的旧接口
2. 第二阶段：删除核心旧接口
3. 第三阶段：清理适配器和转换代码

### 2. 测试驱动

在每次删除后立即运行测试，确保功能正常：

```bash
npm test && npm run build
```

### 3. 文档同步

确保代码和文档同步更新，避免文档过时。

### 4. 监控部署

在生产环境中部署时，密切监控系统性能和错误率。

## 常见问题

### Q: 删除旧接口后，现有代码报错怎么办？

A: 使用适配器模式提供向后兼容性，或者分阶段迁移。

### Q: 如何确保迁移不影响性能？

A: 进行性能基准测试，对比迁移前后的性能指标。

### Q: 旧策略如何迁移到新接口？

A: 继承 `BaseUnifiedStrategy` 类，实现 `split` 方法。

### Q: 测试如何更新？

A: 更新测试以使用 `UnifiedContext` 和 `UnifiedChunkingOptions`。

## 总结

通过遵循本指南，您可以安全地清理旧接口和适配器，完成向统一策略系统的完整迁移。这个过程需要谨慎进行，确保每一步都经过充分测试。