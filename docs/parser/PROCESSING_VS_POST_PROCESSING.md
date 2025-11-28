# Processing 与 Post-Processing 划分指南

## 当前现状分析

### 现有结构
```
processing/
├── strategies/           ← 分割策略实现
│   ├── base/            (基类)
│   └── implementations/ (具体策略：AST、行、括号、Markdown等)
├── post-processing/     ← 块优化处理
│   ├── SymbolBalancePostProcessor
│   ├── FilterPostProcessor
│   ├── RebalancingPostProcessor
│   ├── MergingPostProcessor
│   ├── BoundaryOptimizationPostProcessor
│   └── OverlapPostProcessor
└── coordinator/        ← 流程协调
```

### ProcessingCoordinator 的实际流程（第89-119行）
```
1. 创建上下文
2. 选择策略
3. 执行策略 (strategy.execute) 
       ↓ 输出：CodeChunk[]
4. 后处理 (postProcess)
       ↓ 输出：优化的CodeChunk[]
5. 返回结果
```

---

## 核心职责划分

### Processing（处理/分割）
**目标**：将源代码分割成有意义的代码块

| 维度 | 具体内容 |
|------|--------|
| **输入** | 源代码 + 语言 + 配置 |
| **输出** | 初始 CodeChunk[] |
| **关键决策** | 分割点在哪里？每块多大？ |
| **技术** | 策略模式（AST、行、括号、标记化等） |
| **职责** | 代码理解 → 语义分割 |

**包含内容**：
- 策略工厂和工厂管理
- 各种分割策略（AST、行级、括号平衡、Markdown等）
- 策略选择逻辑
- 上下文创建和配置

**处理逻辑**：
```
源代码
  ↓ [语言检测 + 特征分析]
  ↓ [选择最优策略]
  ↓ [执行分割策略]
  ↓ [获取初始块]
CodeChunk[] (初步分割结果)
```

### Post-Processing（后处理/优化）
**目标**：优化分割结果，改善块的质量和一致性

| 维度 | 具体内容 |
|------|--------|
| **输入** | 初始 CodeChunk[] |
| **输出** | 优化的 CodeChunk[] |
| **关键决策** | 如何改善块的结构和平衡？ |
| **技术** | 块检查、合并、重叠、边界优化 |
| **职责** | 质量保证 → 优化调整 |

**包含内容**：
- 符号平衡检查
- 智能过滤和合并
- 块重新平衡
- 边界优化
- 重叠添加

**处理逻辑**：
```
CodeChunk[] (初步分割结果)
  ↓ [检查符号平衡]
  ↓ [过滤和合并]
  ↓ [智能重新平衡]
  ↓ [优化分割边界]
  ↓ [添加块间重叠]
CodeChunk[] (优化的结果)
```

---

## 在新架构中的位置

### 完整的处理流程

```
INPUT: 源代码 + 语言
  ↓
┌──────────────────────────────────────────────┐
│ PROCESSING LAYER (core/processing)           │
├──────────────────────────────────────────────┤
│ ✓ 特征检测 (Detection)                       │
│ ✓ 上下文创建 (Context)                       │
│ ✓ 策略选择 (Strategy Selection)              │
│ ✓ 代码分割 (Strategy Execution)              │
│   → CodeChunk[]                              │
└──────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────┐
│ POST-PROCESSING LAYER (core/post-processing) │
├──────────────────────────────────────────────┤
│ ✓ 块检查和优化                               │
│ ✓ 质量改善                                   │
│   → 优化的 CodeChunk[]                       │
└──────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────┐
│ NORMALIZATION LAYER (processing/normalization)│
├──────────────────────────────────────────────┤
│ ✓ 实体提取 (AST查询)                         │
│ ✓ 代码转文本 (Converters)                    │
│ ✓ 关系识别                                   │
│   → EntityQueryResult[]                      │
│   → RelationshipQueryResult[]                │
└──────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────┐
│ VECTOR SERVICE LAYER                         │
├──────────────────────────────────────────────┤
│ ✓ 向量嵌入                                   │
│ ✓ 存储索引                                   │
└──────────────────────────────────────────────┘
```

---

## 清晰的边界定义

### 属于 Processing 的特性
- ✅ 语言特定的分割规则
- ✅ AST 节点层次遍历
- ✅ 代码结构识别
- ✅ 初始块范围确定
- ✅ 策略切换和回退
- ✅ 性能监控（分割阶段）

### 不属于 Processing 的特性
- ❌ 块合并逻辑（→ post-processing）
- ❌ 块大小调整（→ post-processing）
- ❌ 符号平衡检查（→ post-processing）
- ❌ 重叠添加（→ post-processing）
- ❌ 实体提取（→ normalization）
- ❌ 向量嵌入（→ vector service）

### 属于 Post-Processing 的特性
- ✅ 块间合并
- ✅ 块大小重新平衡
- ✅ 符号/括号平衡检查
- ✅ 块重叠处理
- ✅ 边界优化
- ✅ 块去重
- ✅ 质量评分

### 不属于 Post-Processing 的特性
- ❌ 初始分割（→ processing）
- ❌ 策略选择（→ processing）
- ❌ 语言特定逻辑（→ processing）
- ❌ 实体转换（→ normalization）
- ❌ 向量生成（→ vector service）

---

## 实际判断标准

### 一个功能应该在 Processing 中，如果：
1. 需要理解代码的语言/语法结构
2. 决策依赖 AST 或代码语义
3. 涉及原始代码的分割点选择
4. 必须在产生第一批块之前执行
5. 不同语言可能有不同的实现

**例**：
- AST 遍历找函数边界 ✅ Processing
- 识别 Python 缩进级别 ✅ Processing
- 找到括号匹配的块 ✅ Processing

### 一个功能应该在 Post-Processing 中，如果：
1. 对块的内容不关心，只关心块的边界和大小
2. 决策基于块的特性（大小、符号、重复等）
3. 目标是改善现有块的质量
4. 可以通用应用于任何语言的块
5. 在所有块都产生后执行

**例**：
- 合并太小的块 ✅ Post-Processing
- 检查括号是否平衡 ✅ Post-Processing
- 为块添加上下文重叠 ✅ Post-Processing
- 块去重 ✅ Post-Processing

---

## 新增的 Normalization 层应该在哪里？

### 答案：在 Processing 层之后，Post-Processing 层之前

```
Processing (分割)
  CodeChunk[] ← 初步块，包含位置和原始代码
  ↓
Post-Processing (优化)
  CodeChunk[] ← 质量优化（合并、平衡等）
  ↓
Normalization (语义提取)  ← 应该是这个顺序
  EntityQueryResult[]
  RelationshipQueryResult[]
  ↓
Vector Service (嵌入)
```

### 为什么 Normalization 应该独立出来？

**不属于 Processing**：
- ❌ 不参与代码分割决策
- ❌ 不需要选择策略
- ❌ 不处理初始块确定

**不属于 Post-Processing**：
- ❌ 不优化块的物理边界
- ❌ 不调整块的大小
- ❌ 不合并或分离块
- ❌ 关心的是块内容的语义含义

**应该独立**：
- ✅ 转换块为实体（需要 AST 查询）
- ✅ 提取关系（需要语义分析）
- ✅ 代码转文本（需要特定的转换器）
- ✅ 为向量化做准备

---

## 建议的目录结构

```
src/service/parser/
│
├── core/                          # 基础层
│   ├── query/                     # Tree-sitter 查询
│   ├── parse/                     # AST 解析
│   ├── structure/                 # 代码结构提取
│   └── language-detection/        # 语言检测
│
├── processing/                    # 处理层（代码分割）
│   ├── strategies/                # 分割策略
│   ├── coordinator/               # 处理协调
│   ├── detection/                 # 文件特征检测
│   ├── utils/                     # 工具函数
│   └── index.ts
│
├── post-processing/               # 后处理层（块优化）
│   ├── SymbolBalancePostProcessor.ts
│   ├── FilterPostProcessor.ts
│   ├── RebalancingPostProcessor.ts
│   ├── MergingPostProcessor.ts
│   ├── BoundaryOptimizationPostProcessor.ts
│   ├── OverlapPostProcessor.ts
│   ├── ChunkPostProcessorCoordinator.ts
│   └── index.ts
│
└── (新增)normalization/           # 规范化层（语义提取）
    ├── entity-extraction/         # 实体提取
    ├── relationship-extraction/   # 关系提取
    ├── converters/                # 代码转文本转换器
    ├── NormalizationCoordinator.ts
    └── index.ts
```

---

## 职责矩阵总结

| 特性 | Processing | Post-Processing | Normalization | Vector |
|------|-----------|-----------------|---------------|--------|
| 代码分割 | ✅ | ❌ | ❌ | ❌ |
| 块合并 | ❌ | ✅ | ❌ | ❌ |
| 块大小调整 | ❌ | ✅ | ❌ | ❌ |
| 块优化 | ❌ | ✅ | ❌ | ❌ |
| 实体提取 | ❌ | ❌ | ✅ | ❌ |
| 关系识别 | ❌ | ❌ | ✅ | ❌ |
| 代码转文本 | ❌ | ❌ | ✅ | ❌ |
| 向量嵌入 | ❌ | ❌ | ❌ | ✅ |
| 存储索引 | ❌ | ❌ | ❌ | ✅ |

---

## 总结

**Processing 专注：分割代码**
- 选择策略 → 执行分割 → 产出初始块

**Post-Processing 专注：优化块**
- 检查质量 → 合并调整 → 改善块结构

**Normalization 专注：提取语义**
- 实体提取 → 关系识别 → 代码转文本

**Vector 专注：向量化存储**
- 嵌入 → 索引 → 查询

四层各司其职，边界清晰。
