# Normalization 与 Mapping 模块重构计划

## 📋 概述

本文档详细规划了对 `src/service/parser/core/normalization` 和 `src/service/graph/mapping` 模块的重构。目标是解决两个模块在“关系提取”功能上的严重重叠，明确各自的职责，优化系统架构和性能。

## 🎯 重构目标 (修正版)

1.  **职责分离 (混合模式)**：
    *   `normalization` 模块：**只**负责遍历 AST，将代码结构识别并转换为统一的、不含复杂关系的 **“标准化节点” (StandardizedQueryResult[])**。其输出代表了图数据库中所有的 **顶点 (Vertices)**。
    *   `graph/mapping` 模块：**完全**负责图的构建。它将**同时接收原始 AST 和标准化节点列表**：
        *   使用**标准化节点列表**来高效、统一地创建图中的**顶点**。
        *   使用**原始AST**和强大的 `Extractor` (基于 Tree-sitter 查询) 来提取节点间的**关系**，创建图中的**边 (Edges)**。

2.  **性能优化**：核心的节点识别遍历只在 `normalization` 模块中进行一次。

3.  **架构清晰**：`normalization` 模块是“顶点”的生产者，`graph/mapping` 模块是“图”的构建者，职责分明。

## 📊 当前问题分析

(当前问题分析保持不变)
...

## 🔄 重构后的数据流 (修正版)

```mermaid
graph TD
    A[原始代码文件] --> B{Tree-sitter Parser};
    B --> C[特定语言的 AST];
    C --> D(normalization 模块);
    D -- 产出标准化的节点列表 --> E[StandardizedQueryResult[]];

    subgraph graph/mapping 模块
        direction TB
        subgraph "输入"
            C -- 原始AST --> F1[Relationship Extractors];
            E -- 标准化节点 --> F2[Vertex Creator];
        end
        
        F2 -- 创建顶点 --> G[图数据];
        F1 -- 发现关系/创建边 --> G;
    end
    
    subgraph segmentation 模块
        E --> I[代码分段处理器];
        I --> J[CodeChunk[]];
    end
    
    G --> H{图数据库};
    J --> K[后续处理 (如向量化)];
```

## 📝 详细任务清单

### 阶段零：核心基础设施准备 (1天)

- [ ] **0.1. 创建“确定性节点ID”生成器**
    - [ ] 在 `src/utils/` 或合适的公共目录下，创建一个新的工具模块，如 `deterministic-node-id.ts`。
    - [ ] 实现 `generateDeterministicNodeId(node: Parser.SyntaxNode): string` 函数。ID生成策略为 `node.type:node.startPosition.row:node.startPosition.column`。
    - [ ] 为该函数编写单元测试，确保其对相同节点输入，输出始终一致。

### 阶段一：接口定义与分析 (1天)

- [ ] **1.1. 更新“标准化节点”接口**
    - [ ] 在 `src/service/parser/core/normalization/types.ts` 中，修改 `StandardizedQueryResult` 接口。
    - [ ] **新增** `nodeId: string` 字段，用于存储节点的确定性ID。
    - [ ] **移除**：所有与关系相关的字段（如果存在）。
    - [ ] **保留**：`type`, `name`, `startLine`, `endLine`, `content`, `metadata` 等节点自身属性。

- [ ] **1.2. 确认所有受影响的 `LanguageAdapter` 和 `Extractor`**
    - [ ] 列出 `.../normalization/adapters/` 目录下所有语言适配器。
    - [ ] 列出 `.../graph/mapping/extractors/` 目录下所有关系提取器。

### 阶段二：迁移关系提取逻辑 (3-5天)

- [ ] **2.1. 迁移 JavaScript 关系提取逻辑**
    - [ ] 将 `JavaScriptLanguageAdapter.ts` 中所有 `extract...Relationships` 方法的逻辑，**迁移并合并**到 `src/service/graph/mapping/extractors/JavaScriptRelationshipExtractor/` 目录下对应的 `Extractor` 中。
    - [ ] 例如：将 `extractDataFlowRelationships` 的逻辑合并到 `DataFlowExtractor.ts`。
    - [ ] **注意**：`Extractor` 的输入保持为原始 AST (`Parser.SyntaxNode`)，**无需修改其内部实现**。

- [ ] **2.2. 迁移其他语言的关系提取逻辑**
    - [ ] 对 `TypeScriptLanguageAdapter`, `PythonLanguageAdapter` 等重复 2.1 的步骤。

- [ ] **2.3. 处理逻辑冲突与合并**
    - [ ] 如果 `Extractor` 中已有逻辑，与 `Adapter` 中的逻辑进行比较。
    - [ ] 保留更完善、更高效的实现，或进行合并优化。

### 阶段三：简化 `normalization` 模块 (2-3天)

- [ ] **3.1. 在 `LanguageAdapter` 中集成ID生成**
    - [ ] 修改所有 `LanguageAdapter` 的实现，在创建 `StandardizedQueryResult` 对象时，必须调用 `generateDeterministicNodeId` 为其对应的AST节点生成 `nodeId`。

- [ ] **3.2. 移除 `LanguageAdapter` 中的关系提取方法**
    - [ ] 从所有 `LanguageAdapter` 实现中删除 `extract...Relationships` 等方法。
    - [ ] 从 `BaseLanguageAdapter` 和 `ILanguageAdapter` 接口中删除这些方法的定义。

- [ ] **3.3. 更新 `NormalizationIntegrationService`**
    - [ ] 确保该服务只输出包含了 `nodeId` 的 `StandardizedQueryResult[]`。

### 阶段四：调整 `graph/mapping` 模块 (2-3天)

- [ ] **4.1. 更新 `GraphDataMappingService` 和 `RelationshipMappingStrategy`**
    - [ ] 修改其核心方法，使其**同时接收 `Parser.SyntaxNode` (原始AST) 和 `StandardizedQueryResult[]` (标准化节点列表)**。
    - [ ] **顶点创建逻辑**：遍历 `StandardizedQueryResult[]` 列表，使用 `nodeId` 作为顶点的主键，高效地创建所有图顶点。
    - [ ] **关系提取逻辑**：将 `Parser.SyntaxNode` (原始AST) 传递给 `RelationshipExtractor`。

- [ ] **4.2. 在 `Extractor` 中集成ID生成**
    - [ ] 修改所有 `Extractor` 的实现，当提取到关系（如 `sourceNode` -> `targetNode`）时，**必须**调用 `generateDeterministicNodeId` 来获取 `sourceId` 和 `targetId`，用于创建边。

- [ ] **4.3. (可选) 更新 `RelationshipExtractorFactory`**
    - [ ] 检查工厂类，确保其能正确创建和调用 `Extractor`。

### 阶段五：测试与验证 (3-4天)

- [ ] **5.1. 单元测试**
    - [ ] 为 `generateDeterministicNodeId` 编写单元测试。
    - [ ] 修改 `.../normalization/adapters/__tests__/` 下的测试，验证输出的 `StandardizedQueryResult` 包含正确的 `nodeId`。
    - [ ] 为 `GraphDataMappingService` 编写新的集成测试，验证其能正确处理双输入，并使用 `nodeId` 正确地创建顶点和边。

- [ ] **5.2. 集成测试**
    - [ ] 运行 `NormalizationIntegrationService.test.ts`，确保其输出符合预期。
    - [ ] 运行 `StandardizationSegmentationStrategy.test.ts`，确保分段功能不受影响。
    - [ ] 创建或更新端到端测试，验证从代码到图数据的整个链路的正确性。

- [ ] **5.3. 性能基准测试**
    - [ ] 在重构前后，对同一份大型代码库进行索引，记录并比较处理时间。
    - [ ] 验证重构后性能有所提升。

### 阶段六：文档与清理 (1天)

- [ ] **6.1. 更新文档**
    - [ ] 更新 `src/service/parser/core/normalization/README.md`，阐明其新的、更纯粹的职责。
    - [ ] 更新 `src/service/graph/mapping/` 目录下的相关文档，说明其新的工作流程。
    - [ ] 更新本 `AGENTS.md` 文件中关于模块职责的描述。

- [ ] **6.2. 代码清理**
    - [ ] 移除所有因重构而变得无用的代码、注释和导入。
    - [ ] 运行 linter 和 formatter，确保代码风格一致。

## ⚠️ 风险与应对策略 (修正版)

1.  **风险**：~~`Extractor` 适配新输入结构的工作量可能超出预期。~~
    - **应对**：**(已规避)** 新方案保留了 `Extractor` 对原始AST的依赖，无需进行大规模适配，风险已解除。

2.  **风险**：`GraphDataMappingService` 的双输入逻辑可能引入复杂性。
    - **应对**：在阶段四实施时，优先编写清晰的单元测试和集成测试，确保顶点创建和边创建的逻辑正确分离且协同工作。

3.  **风险**：测试覆盖不全，导致重构后引入回归 Bug。
    - **应对**：在修改任何生产代码之前，先编写或完善对应的测试。采用 TDD（测试驱动开发）的思想进行重构。

## 🚀 预期收益

-   **代码可维护性提升**：模块职责单一，代码更易理解和修改。
-   **系统性能提升**：消除重复的 AST 遍历，降低计算开销。
-   **扩展性增强**：新增语言或关系类型时，只需在对应模块内进行开发，不会相互影响。
-   **架构清晰**：数据流和模块边界更加明确，便于新成员理解系统。

## caching 缓存与热更新策略 (最终版)

为了确保新架构在缓存和热更新场景下的数据一致性和高性能，我们采用**“以AST为中心的缓存策略”**，并与现有基础设施无缝集成。

### 1. 缓存实现 (`src\service\parser\core\query`)

我们将**复用现有的 `QueryCache` 和 `CacheKeyGenerator`** 来缓存AST对象，而不是创建新的缓存系统。

*   **缓存目标**：在 `QueryCache.ts` 中新增方法，直接缓存 **Tree-sitter 解析后的 AST 对象**。
    ```typescript
    // 在 QueryCache.ts 中新增
    private static astCache = createCache<string, Parser.SyntaxNode>('stats-decorated', 200, { enableStats: true });
    
    static getAst(key: string): Parser.SyntaxNode | undefined {
      return this.astCache.get(key);
    }
    
    static setAst(key: string, ast: Parser.SyntaxNode): void {
      this.astCache.set(key, ast);
    }
    ```
*   **缓存键生成**：复用 `CacheKeyGenerator.ts` 的逻辑，或为其增加一个专门的方法 `forAst(filePath: string, contentHash: string)`，生成格式为 `ast:${filePath}:${contentHash}` 的键。

### 2. 热更新集成 (`src\service\filesystem`)

新架构与现有的热更新机制**完美契合**，无需修改 `FileWatcherService` 和 `ChangeDetectionService`。

*   **工作流程**：
    1.  `ChangeDetectionService` 检测到文件变更，并计算出新的 `contentHash`。
    2.  它发出 `fileModified` 事件，事件对象中包含 `path` 和 `currentHash`。
    3.  **上层协调服务**（如 `UnifiedProcessingCoordinator`）监听此事件，并触发对该文件的重新索引。
    4.  在索引流程中，使用 `path` 和 `currentHash` 生成新的缓存键。
    5.  由于哈希已变，查询 `QueryCache.getAst()` 必然是**缓存未命中**，从而触发一次新的解析和缓存更新。
    6.  后续的 `normalization` 和 `graph/mapping` 流程将使用这个全新的、从缓存中获取的AST，保证了数据的一致性。

### 3. 一致性保证与成本效益

*   **一致性保证**：通过复用 `ChangeDetectionService` 的哈希比较机制，我们确保了只有在文件内容真正变化时，缓存才会失效并重建。由于后续所有操作都源自同一个AST实例，通过“确定性节点ID生成策略”，可以完美保证标准化节点与AST节点的一一对应。
*   **成本效益**：此方案的成本为 **“1次解析 + 2次遍历”**，且解析步骤可被高效缓存。相比于“2次解析 + 2次遍历”的替代方案，此方案在性能上具有显著优势，同时维护复杂度极低，因为它完全建立在现有、稳定的基础设施之上。
