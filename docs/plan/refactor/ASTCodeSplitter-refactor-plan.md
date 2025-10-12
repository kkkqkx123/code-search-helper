# ASTCodeSplitter 重构计划

## 📋 概述

当前 `ASTCodeSplitter.ts` 文件规模过大（949行），包含过多职责和复杂逻辑。需要进行模块化重构，提取独立的功能模块，提高代码的可维护性和可测试性。

## 🔍 当前问题分析

### 1. 单一职责原则违反
- 文件包含语法解析、代码分段、复杂度计算、性能监控等多个职责
- 混合了AST解析、语义分析、符号平衡检查等多种功能

### 2. 代码重复和冗余
- 多个地方重复计算复杂度
- 相似的代码结构出现在不同的分段方法中

### 3. 测试困难
- 由于功能耦合度高，难以进行单元测试
- 复杂的依赖关系使得mock困难

### 4. 可扩展性差
- 添加新的分段策略或优化算法需要修改主类
- 缺乏清晰的接口和抽象层

## 🎯 重构目标

1. **模块化**: 将不同功能拆分为独立的模块
2. **可测试性**: 提高单元测试覆盖率
3. **可扩展性**: 支持轻松添加新的分段策略
4. **性能优化**: 优化内存使用和处理效率

## 📁 重构后的文件结构

```
src/service/parser/splitting/
├── ASTCodeSplitter.ts          # 主类 - 协调各个模块
├── Splitter.ts                 # 接口定义（保持不变）
├── BalancedChunker.ts           # 符号平衡检查器（已存在）
├── __tests__/                  # 测试目录
│
├── strategies/                 # 分段策略模块
│   ├── SyntaxAwareSplitter.ts  # 语法感知分段
│   ├── FunctionSplitter.ts     # 函数提取分段
│   ├── ClassSplitter.ts        # 类提取分段  
│   ├── ImportSplitter.ts       # 导入语句分段
│   ├── IntelligentSplitter.ts  # 智能分段
│   └── SemanticSplitter.ts     # 语义分段
│
├── utils/                      # 工具类模块
│   ├── ComplexityCalculator.ts # 复杂度计算
│   ├── SyntaxValidator.ts      # 语法验证
│   ├── ChunkOptimizer.ts       # 块优化器
│   ├── OverlapCalculator.ts    # 重叠计算
│   └── PerformanceMonitor.ts    # 性能监控
│
└── types/                      # 类型定义
    └── index.ts                # 集中导出类型
```

## 🔄 重构步骤

### 阶段一：基础架构准备（1-2天）

1. **创建目录结构**
   ```bash
   mkdir -p src/service/parser/splitting/strategies
   mkdir -p src/service/parser/splitting/utils  
   mkdir -p src/service/parser/splitting/types
   ```

2. **定义类型和接口**
   - 提取 `ChunkingOptions` 接口到类型文件
   - 定义策略接口 `SplitStrategy`

### 阶段二：工具类提取（2-3天）

1. **复杂度计算器** (`ComplexityCalculator.ts`)
   - 提取 `calculateComplexity()` 方法
   - 提取 `estimateComplexity()` 方法
   - 提取 `calculateSemanticScore()` 方法

2. **语法验证器** (`SyntaxValidator.ts`)
   - 提取 `validateChunkSyntax()` 方法
   - 提取 `checkBracketBalance()` 方法  
   - 提取 `checkBraceBalance()` 方法

3. **性能监控器** (`PerformanceMonitor.ts`)
   - 提取 `recordPerformance()` 方法
   - 添加性能统计和报告功能

### 阶段三：分段策略提取（3-4天）

1. **语法感知分段** (`SyntaxAwareSplitter.ts`)
   - 提取 `createEnhancedSyntaxAwareChunks()` 逻辑
   - 实现策略接口

2. **函数提取器** (`FunctionSplitter.ts`)
   - 提取 `extractFunctionChunks()` 方法
   - 支持多种语言的函数提取

3. **类提取器** (`ClassSplitter.ts`)
   - 提取 `extractClassChunks()` 方法
   - 支持类和接口提取

4. **导入语句提取器** (`ImportSplitter.ts`)
   - 提取 `extractImportExportChunks()` 方法

### 阶段四：智能分段优化（2-3天）

1. **智能分段器** (`IntelligentSplitter.ts`)
   - 提取 `createIntelligentChunks()` 方法
   - 优化符号平衡算法

2. **语义分段器** (`SemanticSplitter.ts`)
   - 提取 `createSemanticFallbackChunks()` 方法
   - 改进语义分析算法

3. **块优化器** (`ChunkOptimizer.ts`)
   - 提取 `optimizeChunkSizes()` 方法
   - 提取 `shouldMergeChunks()` 方法
   - 提取 `mergeChunks()` 方法

### 阶段五：重叠计算优化（1-2天）

1. **重叠计算器** (`OverlapCalculator.ts`)
   - 提取 `addOverlapToChunks()` 方法
   - 提取 `extractOverlapContent()` 方法
   - 提取 `calculateSmartOverlap()` 方法
   - 提取 `calculateOverlap()` 方法

### 阶段六：主类重构和集成（2-3天）

1. **简化主类** (`ASTCodeSplitter.ts`)
   - 移除提取的逻辑，只保留协调功能
   - 实现策略模式，动态选择分段策略
   - 添加配置管理和依赖注入

2. **回退机制优化**
   - 重构 `intelligentFallback()` 方法
   - 改进错误处理和降级策略

## 🧪 测试策略

### 单元测试
- 为每个提取的模块编写单元测试
- 测试覆盖率达到80%以上
- 使用jest进行测试框架

### 集成测试
- 确保各个模块协同工作正常
- 测试边界条件和错误情况
- 性能基准测试

### 测试文件结构
```
__tests__/
├── ASTCodeSplitter.test.ts
├── strategies/
│   ├── SyntaxAwareSplitter.test.ts
│   ├── FunctionSplitter.test.ts
│   └── ...
├── utils/
│   ├── ComplexityCalculator.test.ts
│   ├── SyntaxValidator.test.ts
│   └── ...
└── integration/
    └── splitting-integration.test.ts
```

## ⚡ 性能优化点

1. **内存优化**
   - 限制大文件处理的行数（已实现）
   - 优化字符串操作和内存分配

2. **算法优化**
   - 预缓存常见模式（已部分实现）
   - 优化符号平衡检查算法

3. **并行处理**
   - 考虑使用Worker线程处理大文件
   - 异步处理不同分段策略

## 🔧 技术债务清理

1. **类型安全**
   - 完善TypeScript类型定义
   - 移除any类型，使用具体类型

2. **错误处理**
   - 统一错误处理机制
   - 添加详细的错误日志

3. **配置管理**
   - 提取硬编码的配置参数
   - 支持动态配置

## 📅 实施时间表

| 阶段 | 内容 | 预计时间 | 状态 |
|------|------|----------|------|
| 1 | 基础架构准备 | 2天 | 待开始 |
| 2 | 工具类提取 | 3天 | 待开始 |
| 3 | 分段策略提取 | 4天 | 待开始 |
| 4 | 智能分段优化 | 3天 | 待开始 |
| 5 | 重叠计算优化 | 2天 | 待开始 |
| 6 | 主类重构和集成 | 3天 | 待开始 |
| 7 | 测试编写 | 4天 | 待开始 |
| **总计** | | **21天** | |

## 🚀 预期收益

1. **代码可维护性**: 提高300%
2. **测试覆盖率**: 从<30%提升到>80%
3. **性能**: 优化20-30%的内存使用
4. **扩展性**: 支持轻松添加新的分段算法

## 🔍 风险评估

1. **回归风险**: 需要全面的测试覆盖
2. **兼容性**: 确保与现有代码的接口兼容
3. **性能影响**: 监控重构后的性能变化

## 📋 验收标准

1. ✅ 所有提取的模块都有完整的单元测试
2. ✅ 主类行数减少到200行以内
3. ✅ 性能指标不低于原有水平
4. ✅ 所有现有功能正常工作
5. ✅ 代码复杂度降低50%以上

---

**最后更新**: 2025-10-12
**负责人**: [待指定]
**状态**: 计划阶段