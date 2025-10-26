## 分析结果：src\service\parser\splitting\strategies 和 src\service\parser\splitting\providers 目录中剩余的策略迁移需求

### 已迁移的策略（在 processing/strategies/providers 中）
我们已经成功迁移了以下基于AST的策略：
- **FunctionStrategyProvider** - 从 core/strategy/FunctionChunkingStrategy 迁移
- **ClassStrategyProvider** - 从 core/strategy/ClassChunkingStrategy 迁移  
- **ModuleStrategyProvider** - 从 core/strategy/ModuleChunkingStrategy 迁移
- **HierarchicalStrategyProvider** - 从 core/strategy/HierarchicalChunkingStrategy 迁移

### 需要迁移的策略分析

#### 1. 基于 splitting/strategies 的策略（需要迁移）
这些策略已经实现了 ISplitStrategy 接口，但需要迁移到 processing/strategies/providers 目录：

**A. ImportSplitter (高优先级)**
- **功能**: 专门处理导入/引入语句的分割
- **特点**: 优先级3，使用 TreeSitterService.extractImportNodes
- **状态**: ✅ 已实现 ISplitStrategy 接口
- **迁移需求**: 需要创建 ImportStrategyProvider

**B. SyntaxAwareSplitter (高优先级)**  
- **功能**: 语法感知分割器，组合多个子分割器
- **特点**: 优先级1，组合 FunctionSplitter、ClassSplitter、ImportSplitter
- **状态**: ✅ 已实现 ISplitStrategy 接口
- **迁移需求**: 需要创建 SyntaxAwareStrategyProvider

**C. IntelligentSplitter (中优先级)**
- **功能**: 智能分割器，使用语义边界评分和复杂度计算
- **特点**: 优先级4，支持所有语言，使用 BalancedChunker
- **状态**: ✅ 已实现 ISplitStrategy 接口  
- **迁移需求**: 需要创建 IntelligentStrategyProvider

**D. StructureAwareSplitter (高优先级)**
- **功能**: 结构感知分割器，基于标准化查询结果
- **特点**: 优先级1，最高优先级，使用查询结果标准化器
- **状态**: ✅ 已实现 ISplitStrategy 接口，继承自 IntelligentSplitter
- **迁移需求**: 需要创建 StructureAwareStrategyProvider

**E. SemanticSplitter (低优先级)**
- **功能**: 语义分割器，作为后备方案
- **特点**: 优先级5，最低优先级，基于语义分数
- **状态**: ✅ 已实现 ISplitStrategy 接口
- **迁移需求**: 需要创建 SemanticStrategyProvider

#### 2. 基于 splitting/providers 的策略提供者（需要迁移）
这些提供者已经存在，但需要迁移到 processing/strategies/providers 目录：

- **FunctionSplitterProvider** → 需要迁移到 FunctionStrategyProvider（已完成）
- **ClassSplitterProvider** → 需要迁移到 ClassStrategyProvider（已完成）  
- **ImportSplitterProvider** → 需要迁移到 ImportStrategyProvider
- **SyntaxAwareSplitterProvider** → 需要迁移到 SyntaxAwareStrategyProvider
- **IntelligentSplitterProvider** → 需要迁移到 IntelligentStrategyProvider
- **StructureAwareSplitterProvider** → 需要迁移到 StructureAwareStrategyProvider

### 迁移策略建议

#### 高优先级迁移（推荐立即执行）
1. **ImportStrategyProvider** - 处理导入语句，是语法感知分割的基础
2. **SyntaxAwareStrategyProvider** - 组合多个子策略的核心策略
3. **StructureAwareStrategyProvider** - 最高优先级的智能分割策略

#### 中优先级迁移
4. **IntelligentStrategyProvider** - 智能分割，使用语义边界评分
5. **SemanticStrategyProvider** - 语义分割后备方案

### 技术实现要点

1. **接口兼容性**: 所有 splitting/strategies 中的策略已经实现了 ISplitStrategy 接口，迁移相对简单
2. **依赖注入**: 需要使用 inversify 框架进行依赖注入配置
3. **优先级设置**: 需要根据原有优先级正确设置新提供者的优先级
4. **服务集成**: 需要正确集成 TreeSitterService、LoggerService 等依赖服务

### 迁移复杂度评估

- **ImportStrategyProvider**: 低复杂度 - 功能单一，依赖明确
- **SyntaxAwareStrategyProvider**: 中复杂度 - 需要组合多个子策略
- **StructureAwareStrategyProvider**: 高复杂度 - 涉及查询结果标准化
- **IntelligentStrategyProvider**: 中复杂度 - 涉及复杂的语义分析
- **SemanticStrategyProvider**: 低复杂度 - 功能相对简单

### 建议执行顺序

1. 首先迁移 ImportStrategyProvider（基础功能）
2. 然后迁移 SyntaxAwareStrategyProvider（核心组合策略）  
3. 接着迁移 StructureAwareStrategyProvider（最高优先级策略）
4. 最后迁移 IntelligentStrategyProvider 和 SemanticStrategyProvider（优化策略）

这个迁移计划将确保系统的核心功能得到优先处理，同时保持策略的层次结构和优先级顺序。