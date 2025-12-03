# 相似度协调模块 (Similarity Coordination Module)

相似度协调模块是代码搜索助手系统中负责协调多种相似度计算策略的核心组件。该模块通过分析内容特征、生成执行计划和动态调整阈值，实现智能的相似度计算。

## 目录结构

```
src/service/similarity/coordination/
├── ContentAnalyzer.ts      # 内容特征分析器
├── ExecutionPlanGenerator.ts # 执行计划生成器
├── SimilarityCoordinator.ts  # 相似度策略协调器
├── ThresholdManager.ts       # 阈值管理器
├── types/
│   └── CoordinationTypes.ts  # 协调模块类型定义
└── __tests__/               # 测试文件
```

## 核心组件

### 1. ContentAnalyzer.ts

**作用**: 内容特征分析器
- 分析内容特征，为策略选择提供依据
- 检测内容类型（代码、文档、通用文本等）
- 计算内容复杂度（低、中、高三个级别）
- 提取内容特征并赋予权重
- 推荐适合的相似度计算策略
- 提供缓存机制和性能监控

**主要功能**:
- `analyzeContent()`: 分析两个内容的特征
- `detectContentType()`: 检测内容类型
- `calculateComplexity()`: 计算内容复杂度
- `extractFeatures()`: 提取内容特征

### 2. ExecutionPlanGenerator.ts

**作用**: 执行计划生成器
- 根据内容分析结果生成最优的执行计划
- 确定策略执行顺序和条件
- 估算执行时间和成本
- 支持基于内容类型和复杂度的自适应策略选择

**主要功能**:
- `generatePlan()`: 生成执行计划
- `updateStrategyCost()`: 更新策略成本信息
- `getStrategyCosts()`: 获取策略成本信息

**策略成本模型**:
- keyword: 低计算成本 (0.2)
- levenshtein: 中等计算成本 (0.5)
- semantic: 高计算成本 (0.9)
- hybrid: 高计算成本 (0.8)

### 3. SimilarityCoordinator.ts

**作用**: 相似度策略协调器
- 实现逐级降级的相似度计算策略
- 协调 ContentAnalyzer、ExecutionPlanGenerator 和 ThresholdManager
- 管理策略执行序列和早期退出逻辑
- 提供统一的相似度计算接口

**主要功能**:
- `calculateSimilarity()`: 协调计算相似度
- `generateExecutionPlan()`: 生成执行计划
- `registerStrategy()`: 注册相似度策略
- `getCoordinatorStats()`: 获取协调器统计信息

**执行流程**:
1. 快速检查完全相同的内容
2. 使用 ContentAnalyzer 分析内容特征
3. 使用 ExecutionPlanGenerator 生成执行计划
4. 按计划顺序执行相似度策略
5. 根据早期退出条件决定是否继续
6. 使用 ThresholdManager 进行自适应调整

### 4. ThresholdManager.ts

**作用**: 阈值管理器
- 管理早期退出阈值和策略阈值
- 支持基于执行历史的自适应阈值调整
- 根据内容类型和策略类型动态调整阈值

**主要功能**:
- `getEarlyExitThresholds()`: 获取早期退出阈值
- `getStrategyThreshold()`: 获取策略阈值
- `adaptThresholds()`: 自适应调整阈值
- `updateThreshold()`: 更新阈值

**自适应机制**:
- 基于成功率调整阈值
- 基于平均相似度调整阈值
- 基于执行时间调整阈值

## 类型定义

### CoordinationTypes.ts

定义了协调模块所需的所有接口和类型：
- `ISimilarityCoordinator`: 协调器接口
- `IContentAnalyzer`: 内容分析器接口
- `IExecutionPlanGenerator`: 执行计划生成器接口
- `IThresholdManager`: 阈值管理器接口
- 各种结果类型和数据结构定义

## 工作流程

1. **内容分析**: `ContentAnalyzer` 分析输入内容的特征
2. **计划生成**: `ExecutionPlanGenerator` 基于分析结果生成执行计划
3. **策略执行**: `SimilarityCoordinator` 按计划执行相似度策略
4. **阈值管理**: `ThresholdManager` 管理和调整各种阈值
5. **结果返回**: 返回最终相似度结果和执行详情

## 设计模式

- **策略模式**: 支持多种相似度计算策略
- **协调器模式**: 统一管理多个组件的协作
- **缓存模式**: 各组件内置缓存机制
- **自适应模式**: 根据历史执行结果动态调整参数

## 依赖关系

```
SimilarityCoordinator
├── ContentAnalyzer (IContentAnalyzer)
├── ExecutionPlanGenerator (IExecutionPlanGenerator)
└── ThresholdManager (IThresholdManager)
```

该模块是相似度计算系统的核心，通过智能协调多种策略，实现了高效、准确的相似度计算。