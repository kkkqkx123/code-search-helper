## 架构设计

### 1. Normalization 模块（正确职责）

**只包含**：
- 类型定义（EntityTypes、RelationshipTypes、QueryResults）
- 代码转文本转换器（接口 + 语言实现）

**不包含**：
- 服务实现（EntityNormalizer、RelationshipNormalizer）
- 适配器（应在 core 的各个处理阶段中使用）
- VectorTypes 和 GraphTypes（属于各自的 service）
- 嵌入处理（属于 post-processing）

```
src/service/parser/core/normalization/
├── types/
│   ├── EntityTypes.ts          # ✅ 实体类型
│   ├── RelationshipTypes.ts    # ✅ 关系类型
│   ├── EntityQueryBuilder.ts   # ✅ 构建器
│   └── RelationshipQueryBuilder.ts
├── converters/                 # ✅ 代码转文本转换器
│   ├── ICodeToTextConverter.ts
│   ├── CCodeToTextConverter.ts
│   └── index.ts
└── index.ts
```

### 2. Processing 模块（服务实现）

后续将规范化的服务实现放在这里：

```
src/service/parser/processing/
├── embedding/                  # ✅ 嵌入处理流程
│   ├── EmbeddingPipeline.ts
│   └── index.ts
├── normalization/              # ✅ 规范化服务实现
│   ├── EntityNormalizer.ts
│   ├── RelationshipNormalizer.ts
│   └── index.ts
├── coordinator/                # 现有的处理协调器
│   └── ProcessingCoordinator.ts
└── ...
```

### 3. Vector Service 模块（向量存储）

```
src/service/vector/
├── types/
│   ├── VectorTypes.ts          # ✅ 向量类型（新增代码转文本和嵌入类型）
│   └── index.ts
├── embedding/
│   ├── VectorEmbeddingService.ts
│   └── index.ts
├── conversion/
│   ├── VectorConversionService.ts
│   └── index.ts
└── ...
```

---

## 修改清单

### ✅ 已完成

1. **VectorTypes 重构** (`src/service/vector/types/VectorTypes.ts`)
   - 添加 `CodeToTextConfig` / `CodeToTextResult`
   - 添加 `EmbeddingConfig` / `EmbeddingResult` / `EmbeddingMetadata`
   - 增强 `VectorMetadata` 包含嵌入和转换信息
   - 添加 `VectorTypeConverter` enrichment 方法

2. **Normalization 简化** (`src/service/parser/core/normalization/`)
   - 创建 `converters/` 目录
   - 实现 `ICodeToTextConverter` 接口
   - 实现 `CCodeToTextConverter` 具体类
   - 更新 `index.ts` 明确职责范围

3. **VectorEmbeddingService 更新**
   - 导出 `EmbeddingOptions` 接口
   - 更新所有方法签名使用统一的选项接口

4. **VectorConversionService 增强**
   - 使用 `VectorTypeConverter` 统一转换方法
   - 添加 `enrichVectorWithCodeToText()` 方法

### 🔄 需要后续完成

1. **Post-Processing 层添加**
   - 在 `src/service/parser/post-processing/` 中创建 `embedding/` 模块
   - 实现 `EmbeddingPipeline` 处理流程

2. **Processing 层规范化服务**
   - 如果需要，在 `processing/` 中添加具体的规范化服务
   - 但目前代码转文本在 normalization 中已足够

3. **配置和注册**
   - 在 IoC 容器中注册新的服务
   - 更新相关的依赖注入配置

---

## 关键改进

### 1. 清晰的模块边界

```
Core Layer (解析和规范化)
├── parser/core/
│   ├── parse/           → AST 获取
│   ├── query/           → AST 查询
│   ├── structure/       → 代码结构提取
│   └── normalization/   → 规范化（类型 + 转换器）
│
Service Layer (处理和存储)
├── parser/processing/
│   ├── embedding/       → 向量嵌入处理
│   ├── normalization/   → 规范化服务实现（如需）
│   └── coordinator/     → 处理流程协调
│
├── vector/              → 向量存储和索引
├── graph/               → 图存储和查询
└── ...
```

### 2. 避免循环依赖

**Before (问题)**：
```
normalization → vector (定义VectorTypes)
vector → normalization (使用类型)
           ↑ 循环依赖！
```

**After (修正)**：
```
normalization → (仅定义自己的类型)
                ↓
vector → normalization (使用CodeToTextConverter)
         → 向下依赖，无循环
```

### 3. 单一职责原则

| 模块 | 职责 | 包含 | 不包含 |
|------|------|------|--------|
| normalization | 规范化类型和转换 | EntityTypes、CodeToTextConverter | 服务实现、向量/图类型 |
| post-processing | 后处理和嵌入 | EmbeddingPipeline、批量处理 | 规范化定义 |
| vector | 向量存储索引 | VectorTypes、VectorService、搜索 | 代码转文本 |
| graph | 图存储查询 | GraphTypes、GraphService | 向量操作 |

---

## 类型依赖关系

```
normalization/types/
  ├── EntityTypes.ts
  ├── RelationshipTypes.ts
  └── EntityQueryBuilder.ts

normalization/converters/
  ├── ICodeToTextConverter.ts ← 依赖 CodeToTextConfig (来自 vector/types)
  └── CCodeToTextConverter.ts

post-processing/embedding/
  ├── EmbeddingPipeline.ts ← 依赖：
  │                          - ICodeToTextConverter (来自 normalization)
  │                          - CodeToTextConfig/Result (来自 vector/types)
  │                          - EmbeddingConfig/Result (来自 vector/types)
  │                          - VectorEmbeddingService (来自 vector/embedding)

vector/types/
  ├── VectorTypes.ts ← 包含：
  │                    - Vector/VectorPoint/VectorPayload
  │                    - CodeToTextConfig/Result
  │                    - EmbeddingConfig/Result/Metadata
  │                    - VectorTypeConverter (enrichment 方法)
  └── VectorTypeConverter (统一转换工具)

vector/embedding/
  └── VectorEmbeddingService.ts ← 依赖 EmbeddingOptions (在 types 中定义)

vector/conversion/
  └── VectorConversionService.ts ← 依赖：
                                    - VectorTypeConverter
                                    - Vector/VectorPoint 类型
                                    - enrichment 方法
```

---

## 向后兼容和迁移

### 现有代码的影响

**最小改动**：
- 引入路径不变：`import { EntityQueryResult } from '@parser/core/normalization'`
- 向量 API 保持兼容：`VectorService.createVectors()` 接口不变
- 新类型逐步采用，不强制更新

**使用新特性的步骤**：
1. 在 post-processing 中实现 EmbeddingPipeline
2. 在处理流程中调用代码转文本转换器
3. 逐步迁移现有的向量创建流程

---

## 总结

| 方面 | 改进 |
|------|------|
| **职责分离** | normalization 聚焦于类型和转换器 |
| **循环依赖** | 消除 core 和 service 层的逆向依赖 |
| **可维护性** | 类型定义集中在各自的模块 |
| **扩展性** | 新增语言转换器只需在 normalization 中扩展 |
| **类型安全** | VectorTypeConverter 提供统一的转换和 enrichment |
| **清晰流程** | parse → normalize → process → vector → store |
