**`JavaScriptRelationshipExtractor` 的功能分析：**

这个类是一个“总指挥”，它本身不包含具体的提取逻辑，而是**组合**了大量专门的、细粒度的提取器，每种提取器负责一种特定的关系类型。

*   `CallExtractor`: 提取函数调用关系。
*   `InheritanceExtractor`: 提取继承关系。
*   `DependencyExtractor`: 提取依赖关系。
*   `DataFlowExtractor`: 提取数据流关系。
*   `ControlFlowExtractor`: 提取控制流关系。
*   ... 等等。

对比一下 `JavaScriptLanguageAdapter` 中的方法：

| `JavaScriptLanguageAdapter` 方法 | `JavaScriptRelationshipExtractor` 组合的类 | 功能描述 |
| --- | --- | --- |
| `extractDataFlowRelationships` | `DataFlowExtractor` | 提取数据流关系 |
| `extractControlFlowRelationships` | `ControlFlowExtractor` | 提取控制流关系 |
| `extractSemanticRelationships` | `SemanticExtractor` | 提取语义关系 |
| `extractLifecycleRelationships` | `LifecycleExtractor` | 提取生命周期关系 |
| `extractConcurrencyRelationships` | `ConcurrencyExtractor` | 提取并发关系 |
| `extractDependencies` | `DependencyExtractor` | 提取依赖关系 |
| `extractLanguageSpecificMetadata` (提取继承) | `InheritanceExtractor` | 提取继承关系 |

**结论：功能严重重叠**

至此，我们可以明确地说：**`parser/core/normalization` 模块和 `graph/mapping` 模块在“关系提取”这一核心功能上存在严重的功能重叠**。

两边都在对 AST（抽象语法树）进行遍历和分析，以提取出代码中蕴含的各种关系。这种重复导致了几个问题：

1.  **职责不清 (Violation of Single Responsibility Principle)**：`normalization` 模块做了超出“标准化”范畴的工作，侵入了`mapping`模块的核心领域。
2.  **代码重复 (Code Duplication)**：相似的 AST 遍历和分析逻辑可能存在于两个不同的地方，增加了维护成本。
3.  **性能损耗 (Performance Overhead)**：同一份代码的 AST 被两个模块分别进行深度遍历和分析，造成了不必要的计算资源浪费。
4.  **数据流混乱 (Confusing Data Flow)**：`normalization` 模块的输出变得很“重”，它不仅包含了标准化的节点，还附带了它自己提取出的关系信息。下游的`mapping`模块如何处理这些信息？是直接使用，还是忽略掉再自己提取一遍？这使得整个数据处理链路变得复杂和模糊。

---

## 改进计划

为了解决上述问题，我建议进行一次重构，目标是让每个模块的职责更加清晰，实现真正的“关注点分离”。

**核心思想：**

*   **`normalization` 模块回归本职**：它**只**负责将不同语言的 AST 节点，转换为一种统一的、不包含复杂关系的**“标准化节点”（Standardized Node）**。它的输出应该是轻量级的，只包含节点类型、名称、位置、元数据等基本信息。所有关于节点间关系的提取工作都应该被移除。
*   **`graph/mapping` 模块完全负责关系提取**：它接收 `normalization` 模块产出的“标准化节点”流，并以此为基础，运行其强大的关系提取器 (`Extractor`们)，来发现节点之间的调用、继承、依赖等关系，最终将节点（映射为顶点）和关系（映射为边）写入图数据库。

**重构后的数据处理流程：**

```mermaid
graph TD
    A[原始代码文件] --> B{Tree-sitter Parser};
    B --> C[特定语言的 AST];
    C --> D(normalization 模块);
    D --> E[标准化的节点流 (Standardized Nodes)];
    E --> F(graph/mapping 模块);
    F --> G[图数据 (顶点 & 边)];
    G --> H{图数据库};

    subgraph normalization 模块
        direction LR
        D(normalization 模块) -.-> D1[Language Adapters];
        D1 -- 只做节点转换 --> E;
    end

    subgraph graph/mapping 模块
        direction LR
        F(graph/mapping 模块) -.-> F1[Relationship Extractors];
        F1 -- 从标准化节点中提取关系 --> G;
    end
```

**具体步骤：**

1.  **迁移关系提取逻辑**：
    *   将 `JavaScriptLanguageAdapter.ts` (以及其他语言的 Adapter) 中所有 `extract...Relationships` 和 `extractDependencies` 等方法的逻辑，**全部迁移**到 `graph/mapping/extractors` 目录下对应的 `Extractor` 实现中。
    *   如果 `mapping` 模块中已存在功能相似的 `Extractor`，则进行合并和优化，确保逻辑统一。如果不存在，则创建新的 `Extractor`。
    *   例如，将 `JavaScriptLanguageAdapter.extractDataFlowRelationships` 的逻辑，移入并整合到 `JavaScriptRelationshipExtractor/DataFlowExtractor.ts` 中。

2.  **简化 `normalization` 模块**：
    *   移除 `LanguageAdapter` 中的所有关系提取方法。
    *   修改 `NormalizationIntegrationService` 和相关的类型定义，确保其输出不再包含关系信息，只输出 `StandardizedQueryResult` 的一个简化版本。

3.  **调整 `graph/mapping` 模块**：
    *   调整 `GraphDataMappingService` 和 `RelationshipMappingStrategy`，确保它们现在接收的是简化的“标准化节点”，并能正确地调用 `RelationshipExtractor` 来完成关系发现。
    *   输入由原始的 AST 变为了“标准化节点”，因此 `Extractor` 的内部实现也需要做相应调整，以适配新的数据结构。

**重构的优势：**

*   **架构清晰**：每个模块职责单一，`normalization` 管“点”，`mapping` 管“边”。
*   **易于维护和扩展**：当需要支持一种新语言时，只需添加一个新的 `Adapter`（用于节点标准化）和一套新的 `Extractor`（用于关系提取），职责分明。当需要提取一种新的关系时，只需添加一个新的 `Extractor`，而无需改动 `normalization` 模块。
*   **性能提升**：避免了对 AST 的重复遍历和分析。
*   **数据流清晰**：模块间的接口变得干净、简单。
