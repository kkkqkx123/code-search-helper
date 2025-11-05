# Normalization 与 Mapping 模块重构实施计划

## 📋 概述

本文档是 `normalization` 和 `graph/mapping` 模块重构的具体实施计划。计划优先重构缓存模块，并以C语言作为试点，为后续其他语言的迁移提供可复制的经验。

## 🎯 核心架构决策

1.  **混合模式**：`normalization` 模块产出标准化的“顶点”列表 (`StandardizedQueryResult[]`)，`graph/mapping` 模块同时接收此列表和原始AST，分别用于创建顶点和边。
2.  **确定性节点ID**：通过共享的 `generateDeterministicNodeId` 函数，确保AST节点与标准化节点能够精确对应。
3.  **缓存复用**：扩展现有的 `QueryCache` 来缓存AST对象，与热更新机制无缝集成。

## 📝 详细实施步骤

### 阶段零：核心基础设施准备

#### 步骤 0.1: 创建“确定性节点ID”生成器

*   **目标**：提供一个可共享的、无状态的函数，为任意AST节点生成唯一且可预测的ID。
*   **操作**：
    1.  在 `src/utils/` 目录下创建新文件 `deterministic-node-id.ts`。
    2.  实现并导出函数 `generateDeterministicNodeId(node: Parser.SyntaxNode): string`。
    3.  ID生成策略为 `node.type:node.startPosition.row:node.startPosition.column`。
*   **风险处理**：确保ID的唯一性。通过单元测试覆盖不同类型、不同位置的节点，验证生成的ID不冲突。

#### 步骤 0.2: 扩展现有缓存以支持AST

*   **目标**：利用现有缓存基础设施，为AST对象提供高效的LRU缓存和持久化。
*   **操作**：
    1.  打开 `src/service/parser/core/query/QueryCache.ts`。
    2.  新增一个静态私有成员 `astCache`，使用 `createCache<string, Parser.SyntaxNode>` 创建。
    3.  新增静态方法 `getAst(key: string): Parser.SyntaxNode | undefined` 和 `setAst(key: string, ast: Parser.SyntaxNode): void`。
    4.  打开 `src/service/parser/core/query/CacheKeyGenerator.ts`。
    5.  新增静态方法 `forAst(filePath: string, contentHash: string): string`，返回格式为 `ast:${filePath}:${contentHash}` 的键。
*   **风险处理**：避免缓存键冲突。通过前缀 `ast:` 将AST缓存键与其他缓存键区分开。

### 阶段一：接口定义与C语言适配器分析

#### 步骤 1.1: 更新“标准化节点”接口

*   **目标**：使 `StandardizedQueryResult` 接口包含确定性ID，并移除关系字段。
*   **操作**：
    1.  打开 `src/service/parser/core/normalization/types.ts`。
    2.  修改 `StandardizedQueryResult` 接口：
        *   **新增** `nodeId: string` 字段。
        *   **移除** 任何与关系相关的字段（如果存在）。
        *   **保留** `type`, `name`, `startLine`, `endLine`, `content`, `metadata` 等节点自身属性。

#### 步骤 1.2: 分析C语言适配器与提取器

*   **目标**：明确C语言相关的 `LanguageAdapter` 和 `Extractor`，作为迁移的试点。
*   **操作**：
    1.  定位 `src/service/parser/core/normalization/adapters/CLanguageAdapter.ts`。
    2.  检查其是否包含 `extract...Relationships` 等关系提取方法。
    3.  定位 `src/service/graph/mapping/extractors/CRelationshipExtractor/` 目录。
    4.  列出其下所有 `Extractor` 文件，确认它们的功能和完整性。

### 阶段二：迁移C语言关系提取逻辑

#### 步骤 2.1: 迁移C语言适配器中的关系提取逻辑

*   **目标**：将 `CLanguageAdapter` 中的关系提取逻辑迁移到 `CRelationshipExtractor` 中。
*   **操作**：
    1.  打开 `CLanguageAdapter.ts`，找到所有关系提取方法（如 `extractDataFlowRelationships`）。
    2.  逐个分析这些方法的逻辑。
    3.  打开 `CRelationshipExtractor/` 目录下对应的 `Extractor`（如 `DataFlowExtractor.ts`）。
    4.  将 `Adapter` 中的逻辑合并到 `Extractor` 中。如果 `Extractor` 已有逻辑，进行比较和优化，保留更完善的实现。
*   **风险处理**：逻辑丢失。在迁移前，为 `Adapter` 中的每个关系提取方法编写单元测试，捕获其输入和输出。迁移后，用同样的测试用例验证 `Extractor` 的行为是否一致。

#### 步骤 2.2: 简化C语言适配器

*   **目标**：从 `CLanguageAdapter` 中移除所有关系提取相关的代码。
*   **操作**：
    1.  从 `CLanguageAdapter.ts` 中删除所有 `extract...Relationships` 方法。
    2.  检查 `BaseLanguageAdapter` 和 `ILanguageAdapter` 接口，如果其中定义了这些方法，也一并删除。
    3.  修改 `CLanguageAdapter` 的核心遍历逻辑，在创建 `StandardizedQueryResult` 对象时，调用 `generateDeterministicNodeId` 并将结果赋值给 `nodeId` 字段。

### 阶段三：调整 `graph/mapping` 模块

#### 步骤 3.1: 更新 `GraphDataMappingService`

*   **目标**：使 `GraphDataMappingService` 能够处理双输入（AST + 标准化节点列表）。
*   **操作**：
    1.  定位并打开 `src/service/graph/mapping/GraphDataMappingService.ts`。
    2.  找到其核心的映射方法（例如 `mapData` 或类似名称）。
    3.  修改该方法的签名，使其同时接收 `Parser.SyntaxNode` (原始AST) 和 `StandardizedQueryResult[]` (标准化节点列表)。
    4.  **重构顶点创建逻辑**：遍历 `StandardizedQueryResult[]` 列表，使用每个结果的 `nodeId` 作为图顶点的主键，批量创建所有顶点。
    5.  **重构关系提取逻辑**：将 `Parser.SyntaxNode` (原始AST) 传递给 `CRelationshipExtractor`，调用其提取方法来创建图中的边。

#### 步骤 3.2: 在C语言提取器中集成ID生成

*   **目标**：确保 `CRelationshipExtractor` 在提取关系时，能正确生成节点ID。
*   **操作**：
    1.  打开 `CRelationshipExtractor/` 目录下的所有 `Extractor` 文件。
    2.  在每个 `Extractor` 中，当提取到一个关系（例如从 `sourceNode` 到 `targetNode`）时：
        *   调用 `generateDeterministicNodeId(sourceNode)` 获取 `sourceId`。
        *   调用 `generateDeterministicNodeId(targetNode)` 获取 `targetId`。
        *   使用 `sourceId` 和 `targetId` 创建关系边。

### 阶段四：集成与验证

#### 步骤 4.1: 验证C语言端到端流程

*   **目标**：验证从C代码文件输入到图数据库输出的整个链路是否正确。
*   **操作**：
    1.  选择一个简单的C代码文件作为测试用例。
    2.  手动或通过脚本触发对该文件的索引流程。
    3.  检查 `normalization` 模块的输出，确认 `StandardizedQueryResult[]` 包含正确的 `nodeId`。
    4.  检查图数据库，确认顶点是否使用 `nodeId` 作为主键创建。
    5.  检查图数据库，确认边是否正确连接了对应的顶点。
*   **风险处理**：数据不一致。如果发现顶点和边无法正确连接，检查 `generateDeterministicNodeId` 函数在 `normalization` 和 `Extractor` 中的调用是否一致，确保传入的节点对象是同一个。

#### 步骤 4.2: 验证缓存与热更新

*   **目标**：验证缓存和热更新机制是否按预期工作。
*   **操作**：
    1.  首次索引C代码文件，确认AST被成功缓存（可通过日志或调试器验证 `QueryCache.setAst` 被调用）。
    2.  再次索引同一文件，确认从缓存中获取AST（验证 `QueryCache.getAst` 命中）。
    3.  修改C代码文件并保存，触发热更新。
    4.  确认缓存失效（因为文件哈希改变，导致缓存未命中），并重新解析、缓存新的AST。
    5.  确认图数据库中的数据也相应更新。

### 阶段五：总结与推广准备

#### 步骤 5.1: 总结C语言迁移经验

*   **目标**：为其他语言的迁移提供一份清晰的指南和检查清单。
*   **操作**：
    1.  创建新文档 `docs/architecture/parser/language-migration-guide.md`。
    2.  在文档中记录：
        *   迁移C语言时遇到的具体问题和解决方案。
        *   哪些代码模式是常见的，可以批量处理。
        *   `Adapter` 和 `Extractor` 之间逻辑合并的最佳实践。
        *   一个针对新语言的迁移检查清单（Checklist），包括：
            *   [ ] 分析 `LanguageAdapter` 和 `Extractor`。
            *   [ ] 迁移关系提取逻辑。
            *   [ ] 简化 `LanguageAdapter` 并集成 `nodeId` 生成。
            *   [ ] 更新 `GraphDataMappingService` (通常无需修改，因为它是通用的)。
            *   [ ] 在 `Extractor` 中集成 `nodeId` 生成。
            *   [ ] 进行端到端和热更新验证。

## 🚀 下一步

完成C语言的试点迁移后，即可按照 `language-migration-guide.md` 中的指南，逐步对 JavaScript, TypeScript, Python 等其他语言进行相同的重构。