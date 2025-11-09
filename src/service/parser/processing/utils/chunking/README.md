## chunking目录中的工具类使用情况：

**BalancedChunker 被以下组件使用：**
SemanticBoundaryAnalyzer.ts - 用于分析语义边界
SyntaxValidator.ts - 用于语法验证
OverlapCalculator.ts - 用于重叠计算
SymbolBalancePostProcessor.ts - 用于后处理符号平衡
通过依赖注入在 BusinessServiceRegistrar.ts 中注册

**ChunkFilter 被以下组件使用：**
FilterPostProcessor.ts - 用于过滤和合并小块
通过依赖注入在 BusinessServiceRegistrar.ts 中注册
chunk-processing目录中的工具类使用情况：

**ChunkMerger 被以下组件使用：**
MergingPostProcessor.ts - 用于智能合并决策
ChunkPostProcessorCoordinator.ts - 用于后处理协调

**ChunkOptimizer 被以下组件使用：**
BoundaryOptimizationPostProcessor.ts - 用于边界优化
ChunkPostProcessorCoordinator.ts - 用于后处理协调

**ChunkSimilarityUtils 被以下组件使用：**
OverlapCalculator.ts - 用于相似性检测和内容合并
DeduplicationUtils.ts - 用于去重操作

这些工具类主要在解析器的后处理阶段被集成，用于优化和处理代码块的质量、边界、相似性和合并逻辑。