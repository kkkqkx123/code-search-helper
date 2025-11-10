# 相似度策略协调逻辑重构设计文档

## 1. 分析结果

### 1.1 当前架构问题

**协调逻辑分散**：
- [`HybridSimilarityStrategy.calculate()`](src/service/similarity/strategies/HybridSimilarityStrategy.ts:26) 中包含策略协调逻辑
- 违反单一职责原则，策略既负责计算又负责协调

**执行效率低下**：
- [`HybridSimilarityStrategy`](src/service/similarity/strategies/HybridSimilarityStrategy.ts:14) 并行执行所有策略
- 无法实现"逐级降级，嵌入模型放最后"的优化要求

**资源利用不优化**：
- 即使关键词匹配已确定高相似度，仍执行昂贵的语义计算
- 缺乏早期退出机制

### 1.2 外部使用场景

**主要使用模块**：
- [`OverlapPostProcessor`](src/service/parser/post-processing/OverlapPostProcessor.ts:17)：重复块检测和相似块合并
- [`MergingPostProcessor`](src/service/parser/post-processing/MergingPostProcessor.ts:12)：去重处理
- [`ChunkSimilarityUtils`](src/service/parser/processing/utils/chunk-processing/ChunkSimilarityUtils.ts:10)：相似度判断工具

**调用链**：
```
后处理模块 → DeduplicationUtils/OverlapCalculator → ChunkSimilarityUtils → SimilarityUtils → SimilarityService
```

## 2. 重构方案

### 2.1 新架构设计

**核心组件**：
- `SimilarityCoordinator`：统一策略协调器
- `ExecutionPlanGenerator`：执行计划生成器
- `ContentAnalyzer`：内容特征分析器
- `ThresholdManager`：阈值管理器

**架构图**：
```
Client Layer → SimilarityService → SimilarityCoordinator → Strategy Layer
```

### 2.2 逐级降级机制

**执行顺序**：
1. 快速检查完全相同
2. 关键词相似度计算（低成本）
3. Levenshtein相似度计算（中成本）
4. 语义相似度计算（高成本）

**早期退出**：
- 高阈值（0.9+）：快速判断，避免不必要计算
- 中阈值（0.7+）：决定是否继续执行
- 低阈值（0.5+）：最终判断

### 2.3 需要修改的文件

#### 2.3.1 新增文件

**协调层**：
- `src/service/similarity/coordination/SimilarityCoordinator.ts`
  - 实现逐级降级执行逻辑
  - 管理策略协调和早期退出
- `src/service/similarity/coordination/ExecutionPlanGenerator.ts`
  - 根据内容特征生成执行计划
  - 实现智能策略选择
- `src/service/similarity/coordination/ContentAnalyzer.ts`
  - 分析内容特征（类型、长度、复杂度）
  - 支持策略选择决策
- `src/service/similarity/coordination/ThresholdManager.ts`
  - 动态阈值管理
  - 自适应阈值调整

**类型定义**：
- `src/service/similarity/coordination/types/CoordinationTypes.ts`
  - 协调器接口定义
  - 执行计划类型定义

#### 2.3.2 修改现有文件

**SimilarityService**：
- `src/service/similarity/SimilarityService.ts`
  - 注入 `SimilarityCoordinator`
  - 重构 `calculateSimilarity()` 方法，使用协调器
  - 保留向后兼容的 `calculateSimilarityLegacy()` 方法

**策略层**：
- `src/service/similarity/strategies/HybridSimilarityStrategy.ts`
  - 移除协调逻辑，保留纯计算功能
  - 简化为简单的加权平均计算
- `src/service/similarity/strategies/BaseSimilarityStrategy.ts`
  - 添加策略成本信息
  - 添加预估执行时间方法

**工具层**：
- `src/service/similarity/utils/SimilarityUtils.ts`
  - 移除静态方法，改为实例方法
  - 注入 `SimilarityCoordinator`
  - 简化接口设计
- `src/service/parser/processing/utils/chunk-processing/ChunkSimilarityUtils.ts`
  - 直接使用 `SimilarityCoordinator`
  - 移除重复的相似度计算逻辑

**后处理模块**：
- `src/service/parser/post-processing/OverlapPostProcessor.ts`
  - 直接注入 `SimilarityCoordinator`
  - 移除多层封装调用
  - 优化重复检测逻辑
- `src/service/parser/post-processing/MergingPostProcessor.ts`
  - 使用新的相似度计算接口
  - 简化去重逻辑

#### 2.3.3 更新配置文件

**依赖注入**：
- 更新依赖注入容器配置
- 注册新的协调器组件
- 更新组件间的依赖关系

## 3. 实施计划

### 3.1 第一阶段：基础架构（1-2周）
- 创建协调层基础架构
- 实现核心协调组件
- 添加单元测试

### 3.2 第二阶段：策略重构（2-3周）
- 重构策略层，移除协调逻辑
- 实现逐级降级机制
- 更新服务层

### 3.3 第三阶段：外部集成（3-4周）
- 更新外部调用模块
- 优化调用链
- 集成测试

### 3.4 第四阶段：优化测试（4-6周）
- 性能测试和优化
- 功能测试
- 文档更新

## 4. 预期收益

### 4.1 性能提升
- 平均响应时间减少30%以上
- 缓存命中率提升至80%以上
- CPU和内存使用减少20%以上

### 4.2 架构改进
- 职责分离清晰
- 扩展性显著提升
- 维护成本降低

### 4.3 功能增强
- 更准确的相似度计算
- 智能策略选择
- 自适应阈值调整