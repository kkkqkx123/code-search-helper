# 后处理配置系统统一方案

## 问题描述

当前的后处理系统存在配置不统一的问题：

1. **配置类型不一致**: 存在多个配置接口 (`GlobalChunkingConfig`, `ProcessingConfig`, `PostProcessingContext`)
2. **访问方式不统一**: 后处理器通过不同的路径访问高级配置
3. **测试文件过时**: 多个测试文件仍使用旧的配置结构

## 当前配置流

```
UnifiedConfigManager (GlobalChunkingConfig)
    ↓
ProcessingCoordinator (ProcessingConfig.advanced)
    ↓
PostProcessingContext (advancedOptions)
    ↓
各个后处理器 (context.advancedOptions.*)
```

## 具体修改方案

### 1. 统一配置接口

#### 已完成的修改
- ✅ `PostProcessingContext` 添加 `advancedOptions` 字段
- ✅ `ProcessingConfig` 添加 `advanced` 字段
- ✅ 同步 `core/types/ConfigTypes.ts` 和 `types/Config.ts` 中的 `ProcessingConfig`

#### 待完成的修改
- ❌ 移除 `GlobalChunkingConfig` 中的冗余定义（已在 `SegmentationTypes.ts` 中定义）

### 2. 统一后处理器实现

#### 已完成的修改
- ✅ `SymbolBalancePostProcessor`: `context.options.advanced` → `context.advancedOptions`
- ✅ `AdvancedMergingPostProcessor`: `context.options.advanced` → `context.advancedOptions`
- ✅ `SmartRebalancingPostProcessor`: 更新所有高级配置访问

#### 待完成的修改
- ❌ `IntelligentFilterPostProcessor`
- ❌ `BoundaryOptimizationPostProcessor`
- ❌ `OverlapPostProcessor`

### 3. 修复测试文件

#### 待完成的修改
更新以下测试文件的 `PostProcessingContext` 构造：

- ❌ `SymbolBalancePostProcessor.test.ts`
- ❌ `AdvancedMergingPostProcessor.test.ts`
- ❌ `SmartRebalancingPostProcessor.test.ts`
- ❌ `IntelligentFilterPostProcessor.test.ts`
- ❌ `BoundaryOptimizationPostProcessor.test.ts`
- ❌ `OverlapPostProcessor.test.ts`
- ❌ `ChunkPostProcessorIntegration.test.ts`

#### 具体修改内容
```typescript
// 修改前
const context: PostProcessingContext = {
  originalContent: 'content',
  language: 'typescript',
  filePath: 'test.ts',
  config: mockProcessingConfig,  // 需要添加
  options: mockOptions,
  advancedOptions: {             // 需要添加
    enableEnhancedBalancing: true
  }
};

// 修改后
const context: PostProcessingContext = {
  originalContent: 'content',
  language: 'typescript',
  filePath: 'test.ts',
  config: mockProcessingConfig,
  options: mockOptions,
  advancedOptions: mockAdvancedOptions
};
```

### 4. 修复配置传递

#### 待完成的修改
- ❌ 更新 `ProcessingCoordinator` 中的配置传递逻辑
- ❌ 确保 `UnifiedConfigManager` 的配置正确流向 `ProcessingCoordinator`

### 5. 代码示例

#### 后处理器访问配置的统一方式
```typescript
export class ExamplePostProcessor implements IChunkPostProcessor {
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 统一的配置访问方式
    return context.advancedOptions?.enableExampleFeature === true;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    const threshold = context.advancedOptions?.exampleThreshold || 100;
    // 处理逻辑...
  }
}
```

#### 测试文件配置构造
```typescript
const mockProcessingConfig: ProcessingConfig = {
  chunking: { /* ... */ },
  features: { /* ... */ },
  performance: { /* ... */ },
  languages: {},
  postProcessing: { /* ... */ },
  advanced: mockAdvancedOptions  // 高级配置
};

const context: PostProcessingContext = {
  originalContent: 'test content',
  language: 'typescript',
  filePath: 'test.ts',
  config: mockProcessingConfig,
  options: mockChunkingOptions,
  advancedOptions: mockAdvancedOptions
};
```

## 实施优先级

1. **高优先级** (立即修复)
   - 修复所有后处理器的配置访问
   - 更新核心测试文件

2. **中优先级** (后续修复)
   - 修复剩余的测试文件
   - 清理冗余的配置定义

3. **低优先级** (优化)
   - 重构配置传递逻辑
   - 添加配置验证

## 验证标准

✅ **编译通过**: 所有文件 TypeScript 编译无错误
✅ **测试通过**: 所有后处理相关测试通过
✅ **配置一致**: 所有后处理器使用统一的配置访问方式
✅ **向后兼容**: 不破坏现有功能

## 风险评估

- **低风险**: 类型定义修改
- **中风险**: 配置传递逻辑修改
- **高风险**: 广泛的测试文件修改

建议分批实施，先修复核心后处理器，再逐步修复测试文件。
