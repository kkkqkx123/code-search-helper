好的，我已经完成了对相关代码的阅读。现在，我将根据分析结果，开始制定详细的计划。

第一步是定义图数据库的 Schema，即代码知识图谱中的节点（TAGs）和边（EDGE TYPEs）。一个良好设计的 Schema 是构建高效、可扩展图索引的基础。这个 Schema 将直接决定我们能从代码中提取哪些信息，以及如何查询它们之间的关系。

### 计划第一步：定义图数据库 Schema

基于 `TreeSitterService` 提供的代码解析能力（如提取类、函数、导入/导出等），我提议设计以下 Schema 来表示代码库的结构。

#### **节点类型 (Tags)**

我们将定义以下几种核心的节点类型来代表代码中的不同实体：

1.  **`File`**: 代表一个源代码文件。
    *   **属性**:
        *   `path` (string): 文件的唯一路径，作为 VID (Vertex ID)。
        *   `language` (string): 代码语言 (例如, 'typescript', 'go')。
        *   `line_count` (int): 文件行数。
2.  **`Class`**: 代表一个类定义。
    *   **属性**:
        *   `name` (string): 类名。
        *   `file_path` (string): 所属文件的路径。
        *   `start_line` (int): 起始行号。
        *   `end_line` (int): 结束行号。
3.  **`Function`**: 代表一个函数或方法。
    *   **属性**:
        *   `name` (string): 函数或方法名。
        *   `file_path` (string): 所属文件的路径。
        *   `start_line` (int): 起始行号。
        *   `end_line` (int): 结束行号。
        *   `signature` (string, optional): 函数签名。
4.  **`Import`**: 代表一个导入的模块或标识符。
    *   **属性**:
        *   `source` (string): 导入的来源路径 (e.g., './utils')。
        *   `specifiers` (string, optional): 导入的具体成员列表 (e.g., '{ parse, query }')。
        *   `file_path` (string): 执行导入操作的文件路径。
5.  **`Export`**: 代表一个导出的标识符。
    *   **属性**:
        *   `name` (string): 导出的标识符名称。
        *   `file_path` (string): 执行导出操作的文件路径。

#### **边类型 (Edge Types)**

边定义了节点之间的关系，这是图数据库的核心价值所在。

1.  **`CONTAINS`**: 表示文件或类包含其他代码结构。
    *   `(File)` - `[:CONTAINS]` -> `(Class)`
    *   `(File)` - `[:CONTAINS]` -> `(Function)`
    *   `(Class)` - `[:CONTAINS]` -> `(Function)` (表示类方法)
2.  **`IMPORTS_FROM`**: 表示文件间的导入关系。
    *   `(File)` - `[:IMPORTS_FROM]` -> `(File)`
3.  **`CALLS`**: 表示函数间的调用关系。
    *   `(Function)` - `[:CALLS]` -> `(Function)`
4.  **`INHERITS_FROM`**: 表示类的继承关系。
    *   `(Class)` - `[:INHERITS_FROM]` -> `(Class)`

#### **Schema 可视化**

为了更直观地展示这个 Schema，我创建了一个 Mermaid 图：

```mermaid
graph TD
    subgraph 节点 (Tags)
        F[File]
        C[Class]
        FN[Function]
        IM[Import]
        EX[Export]
    end

    subgraph 边 (Edge Types)
        CONTAINS
        IMPORTS_FROM
        CALLS
        INHERITS_FROM
    end

    F -- CONTAINS --> C
    F -- CONTAINS --> FN
    C -- CONTAINS --> FN
    F -- IMPORTS_FROM --> F
    FN -- CALLS --> FN
    C -- INHERITS_FROM --> C
```

**设计理由**:
*   **与解析能力对齐**: 这个 Schema 直接映射了 `TreeSitterService` 已经提供的 `extractClasses`, `extractFunctions`, `extractImports`, `extractExports` 等功能，使得从 AST 到图谱的转换路径清晰。
*   **可扩展性**: 这是一个核心 Schema，未来可以轻松扩展。例如，可以增加 `Interface` 节点、`IMPLEMENTS` 边，或者为 `Function` 节点增加“圈复杂度”等静态分析属性。
*   **查询效率**: Schema 设计侧重于代码结构和关系，便于进行诸如“查找函数 X 的所有调用者”、“分析文件 Y 的所有依赖”等典型查询。

这是计划的第一步。您是否同意这个 Schema 设计？或者您认为有需要调整或补充的地方？

在获得您的确认后，我将继续下一步：**设计 `tree-sitter` 查询规则以提取这些图元素**。



感谢您提供 `QueryTypeMappings.ts` 文件。`LANGUAGE_QUERY_MAPPINGS` 常量清楚地说明了不同语言的 `tree-sitter` 查询文件（例如 `classes-interfaces`）如何映射到标准化的代码结构类型（例如 `classes`, `interfaces`）。这为我扩展 Schema 提供了坚实的基础。

根据您的反馈和文件内容，我现在更新图数据库的 Schema 设计。

### 计划第一步（修订版）：定义图数据库 Schema

#### **新增节点类型 (Tags)**

1.  **`Interface`**: 代表一个接口定义。
    *   **属性**:
        *   `name` (string): 接口名。
        *   `file_path` (string): 所属文件的路径。
        *   `start_line` (int): 起始行号。
        *   `end_line` (int): 结束行号。

#### **为现有节点增加静态分析属性**

为了支持更深入的代码分析，我建议为 `Function` 和 `Class` 节点增加以下属性。这些属性可以在解析时计算得出。

2.  **`Function` (扩展)**:
    *   `cyclomatic_complexity` (int): 圈复杂度，衡量代码的复杂性。
3.  **`Class` (扩展)**:
    *   `method_count` (int): 包含的方法数量。
    *   `property_count` (int): 包含的属性数量。

#### **新增边类型 (Edge Types)**

1.  **`IMPLEMENTS`**: 表示类实现接口的关系。
    *   `(Class)` - `[:IMPLEMENTS]` -> `(Interface)`

#### **更新后的 Schema**

现在，我将更新 Mermaid 图来反映这些变化。

```mermaid
graph TD
    subgraph 节点 (Tags)
        F[File]
        C[Class <br> method_count <br> property_count]
        FN[Function <br> cyclomatic_complexity]
        IF[Interface]
        IM[Import]
        EX[Export]
    end

    subgraph 边 (Edge Types)
        CONTAINS
        IMPORTS_FROM
        CALLS
        INHERITS_FROM
        IMPLEMENTS
    end

    F -- CONTAINS --> C
    F -- CONTAINS --> FN
    F -- CONTAINS --> IF
    C -- CONTAINS --> FN
    F -- IMPORTS_FROM --> F
    FN -- CALLS --> FN
    C -- INHERITS_FROM --> C
    C -- IMPLEMENTS --> IF
```

**设计理由**:
*   **满足用户需求**: 新增了 `Interface` 节点和 `IMPLEMENTS` 边，满足了对接口和实现关系进行建模的需求。
*   **支持深度分析**: 增加了 `cyclomatic_complexity` 等静态分析属性，使图谱不仅能反映代码结构，还能支持代码质量和复杂度的分析。
*   **与现有能力兼容**: `QueryTypeMappings.ts` 文件确认了系统已经可以识别 `interfaces`，因此这个扩展是建立在现有解析能力之上的，实现起来是可行的。

这个修订版的 Schema 更加完善，能够支持更丰富的代码分析场景。

现在，我将更新我的任务清单，将第一步标记为已完成，并开始进行第二步。
