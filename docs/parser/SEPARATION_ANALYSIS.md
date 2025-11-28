# 查询结果标准化 vs 代码转文本转换 - 分离分析

## 当前架构现状

### 存在的耦合关系

```
src/service/parser/core/
├── query/
│   ├── query-config.ts           (导入EntityType, RelationshipType)
│   ├── QueryRegistry.ts
│   ├── TreeSitterQueryExecutor.ts
│   └── TreeSitterQueryFacade.ts
│
└── normalization/
    ├── types/
    │   ├── EntityTypes.ts         (定义EntityType)
    │   ├── RelationshipTypes.ts   (定义RelationshipType)
    │   ├── EntityQueryBuilder.ts
    │   └── RelationshipQueryBuilder.ts
    └── converters/
        ├── ICodeToTextConverter.ts
        └── CCodeToTextConverter.ts
```

**关键导入（query-config.ts 第18行）**：
```typescript
import {
  EntityType,
  RelationshipCategory,
  RelationshipType,
  EntityTypeRegistry,
  RelationshipTypeRegistry,
  EntityQueryBuilderFactory,
  RelationshipQueryBuilderFactory
} from '../normalization/types';
```

这意味着：**query系统依赖normalization中定义的类型**

---

## 问题分析

### 问题陈述
用户指出：processing 模块中的 AST 解析策略需要依赖 tree-sitter 查询类型（EntityType, RelationshipType），但这些类型目前与代码转文本转换器混放在 normalization 模块中。

### 两个不同的关注点

#### 1. 查询结果标准化（Query Result Normalization）
**目的**：将 tree-sitter 查询结果转换为标准的实体和关系数据结构
```
Raw AST Node (来自tree-sitter)
         ↓
QueryResult (EntityQueryResult / RelationshipQueryResult)
         ↓
使用场景：
- AST策略执行后，获取实体和关系
- 图数据库中的顶点和边
- 关系分析和依赖图构建
```

**涉及的类型**：
- `EntityType` 和 `EntityQueryResult`
- `RelationshipType` 和 `RelationshipQueryResult`  
- `EntityTypeRegistry` 和 `RelationshipTypeRegistry`
- `EntityQueryBuilder` 和 `RelationshipQueryBuilder`

**使用场景**：
- `src/service/parser/core/query/query-config.ts` ← 需要
- `src/service/parser/core/query/TreeSitterQueryExecutor.ts` ← 需要
- `src/service/parser/processing/` ← 可能需要

#### 2. 代码转文本转换（Code-to-Text Conversion）
**目的**：将代码实体转换为自然语言描述，用于向量嵌入和搜索

```
EntityQueryResult (已标准化的实体)
         ↓
CodeToTextResult (自然语言描述)
         ↓
使用场景：
- 向量嵌入前的文本处理
- 融合代码结构和自然语言语义
- 改进向量搜索质量
```

**涉及的类型**：
- `ICodeToTextConverter` 接口
- `CCodeToTextConverter` 实现
- `CodeToTextConfig` / `CodeToTextResult` (在VectorTypes中定义)

**使用场景**：
- `src/service/parser/processing/` ← 后期需要
- `src/service/vector/embedding/` ← 需要
- `src/service/vector/conversion/` ← 需要

---

## 分离方案比较

### 方案A：完全分离（推荐）

```
src/service/parser/core/
├── query/
│   └── types/                      ← 新增
│       ├── EntityType.ts
│       ├── EntityQueryResult.ts
│       ├── RelationshipType.ts
│       ├── RelationshipQueryResult.ts
│       ├── EntityTypeRegistry.ts
│       └── RelationshipTypeRegistry.ts
│
├── normalization/
│   ├── types/                      (保留非查询类型)
│   │   └── (如果需要扩展的语言特定类型)
│   │
│   └── converters/                 (独立存在)
│       ├── ICodeToTextConverter.ts
│       └── CCodeToTextConverter.ts
```

**优点**：
- ✅ 清晰的依赖方向：query → converters
- ✅ Processing 层只需依赖 query/types
- ✅ Converters 可选使用，不强制依赖
- ✅ 两个模块独立演进
- ✅ 避免循环依赖风险

**缺点**：
- ⚠️ 需要重构和移动文件
- ⚠️ 更新导入路径

**依赖关系**：
```
core/query/types/
  ├── EntityType.ts
  ├── RelationshipType.ts
  └── (标准化定义)
     ↑
     使用者：
     - core/query/
     - core/normalization/converters/
     - processing/strategies/
     - vector/embedding/
```

---

### 方案B：轻度分离（折中）

```
src/service/parser/core/normalization/
├── types/
│   ├── query-result-types/    ← 新增子目录
│   │   ├── EntityTypes.ts
│   │   ├── RelationshipTypes.ts
│   │   ├── index.ts
│   │   └── (核心查询结果类型)
│   │
│   └── (其他扩展类型)
│
└── converters/
    ├── ICodeToTextConverter.ts
    └── CCodeToTextConverter.ts
```

**优点**：
- ✅ 通过子目录逻辑分离
- ✅ 最小化物理移动
- ✅ 导入路径变化小

**缺点**：
- ⚠️ 概念上仍混淆
- ⚠️ Converters 逻辑上不属于 normalization

---

### 方案C：现状维持

```
src/service/parser/core/normalization/
├── types/
│   ├── EntityTypes.ts
│   ├── RelationshipTypes.ts
│   └── ...
└── converters/
    └── ...
```

**优点**：
- ✅ 无需重构

**缺点**：
- ❌ Processing 层依赖时混淆两个关注点
- ❌ Converters 过早加载（processing 不需要）
- ❌ 未来难以解耦
- ⚠️ normalization 职责不清

---

## 具体实施建议

### 推荐采用：方案A（完全分离）

#### 步骤1：创建 query/types 目录

```bash
mkdir -p src/service/parser/core/query/types
```

#### 步骤2：文件迁移

从 `core/normalization/types/` 迁移到 `core/query/types/`：
- `EntityTypes.ts` → `query/types/EntityTypes.ts`
- `RelationshipTypes.ts` → `query/types/RelationshipTypes.ts`
- `EntityQueryBuilder.ts` → `query/types/EntityQueryBuilder.ts`
- `RelationshipQueryBuilder.ts` → `query/types/RelationshipQueryBuilder.ts`

#### 步骤3：创建导出

`core/query/types/index.ts`:
```typescript
export * from './EntityTypes';
export * from './RelationshipTypes';
export * from './EntityQueryBuilder';
export * from './RelationshipQueryBuilder';
```

#### 步骤4：更新导入

**受影响的文件**：
- `src/service/parser/core/query/query-config.ts`
  - 从：`'../normalization/types'`
  - 改为：`'./types'`

- `src/service/parser/core/normalization/converters/ICodeToTextConverter.ts`
  - 从：`'../types'` 
  - 改为：`'../../../query/types'`

- 所有在 `processing` 中使用查询类型的地方

#### 步骤5：保留 normalization 模块

```
src/service/parser/core/normalization/
├── types/                        ← 空或仅包含语言扩展
│   └── languages/
├── converters/
│   ├── ICodeToTextConverter.ts
│   ├── CCodeToTextConverter.ts
│   └── index.ts
├── index.ts                      (导出 converters)
```

---

## 架构图对比

### 分离前
```
Processing Layer
  ├─→ query/query-config.ts (导入EntityType)
  ├─→ normalization/types/ (定义EntityType)
  ├─→ normalization/converters/ (代码转文本)
         ↑ 混淆的关注点
```

### 分离后
```
Core Layer
├── query/
│   ├── types/ (查询结果标准化)
│   │   ├── EntityType
│   │   ├── EntityQueryResult
│   │   ├── RelationshipType
│   │   └── RelationshipQueryResult
│   └── (查询执行)
│
└── normalization/
    └── converters/ (代码转文本转换)
        ├── ICodeToTextConverter
        └── CCodeToTextConverter

Processing Layer
  ├─→ core/query/types/ (获取标准化类型)
  └─→ core/normalization/converters/ (后期转换)

Vector Service Layer
  ├─→ core/normalization/converters/ (使用转换器)
  └─→ vector/types/ (使用CodeToTextConfig)
```

---

## 总结

| 维度 | 分离前 | 分离后 |
|------|--------|--------|
| **关注点清晰度** | ❌ 混淆 | ✅ 清晰 |
| **依赖关系** | ❌ processing→normalization (includes both) | ✅ processing→query/types; vector→converters |
| **可维护性** | ⚠️ 中等 | ✅ 高 |
| **重构成本** | - | 📝 低（文件移动 + 路径更新） |
| **向后兼容** | - | ⚠️ 需要更新导入 |
| **演进灵活性** | ❌ 低 | ✅ 高 |

**建议**：采用方案A，理由：
1. 两个模块职责完全不同，不应混在一起
2. 重构成本低（仅文件移动 + 导入更新）
3. 长期收益大（清晰架构、易于维护）
4. 避免循环依赖风险
5. Processing 层从不必要的依赖中解放
