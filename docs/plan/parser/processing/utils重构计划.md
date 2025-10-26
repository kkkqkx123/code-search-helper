# src/service/parser/processing/utils 重构计划

## 1. 重构目标

对 `src/service/parser/processing/utils` 目录进行重构，以解决以下问题：

- 消除冗余代码
- 提高模块化程度
- 优化代码结构
- 增强可维护性

## 2. 当前问题分析

### 2.1 冗余文件识别
- **相似度计算功能重复**：`BaseSimilarityCalculator.ts` 和 `ChunkSimilarityUtils.ts` 存在功能重叠
- **重叠计算功能整合**：`UnifiedOverlapCalculator.ts` 已整合多个重叠计算功能，但相关文件仍独立存在
- **块处理功能重复**：`BaseChunkProcessor.ts` 和 `ChunkSimilarityUtils.ts` 存在继承关系但功能重复

### 2.2 需要合并的文件
- 合并相似度相关功能：将 `BaseSimilarityCalculator.ts` 的功能整合到 `ChunkSimilarityUtils.ts` 中
- 优化重叠计算模块：评估 `ContextAwareOverlapOptimizer.ts` 和 `OverlapStrategyUtils.ts` 的整合

### 2.3 需要提取的共用模块
- **常量模块**：`backup-constants.ts` 包含大量常量，应按功能分组
- **哈希生成器**：`ContentHashIDGenerator.ts` 是独立的工具模块
- **性能监控**：`BasePerformanceTracker.ts` 是通用的性能监控基类

## 3. 重构计划

### 3.1 第一阶段：常量模块重构
- 将 `backup-constants.ts` 按功能拆分：
  - `file-constants.ts` - 文件处理相关常量
  - `processing-constants.ts` - 处理参数相关常量
  - `language-constants.ts` - 语言映射相关常量

### 3.2 第二阶段：相似度计算模块重构
- 将 `BaseSimilarityCalculator.ts` 的功能合并到 `ChunkSimilarityUtils.ts`
- 保留 `BaseSimilarityCalculator.ts` 作为抽象基类（如需要）

### 3.3 第三阶段：重叠计算模块重构
- 评估 `ContextAwareOverlapOptimizer.ts` 是否需要作为独立工具保留
- 考虑将 `OverlapStrategyUtils.ts` 的策略选择逻辑整合到 `UnifiedOverlapCalculator.ts`

### 3.4 第四阶段：模块结构优化
- 创建新的模块结构：
  - `constants/` - 常量定义
  - `similarity/` - 相似度计算
  - `overlap/` - 重叠计算
  - `chunk/` - 代码块处理
  - `hash/` - 哈希生成
  - `performance/` - 性能监控

## 4. 执行步骤

1. 创建新的目录结构
2. 逐步迁移代码
3. 更新导入路径
4. 确保测试通过
5. 优化模块间依赖关系

## 5. 预期结果

- 减少冗余代码
- 提高模块化程度
- 增强代码可维护性
- 保持向后兼容性