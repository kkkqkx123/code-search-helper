我们已经完成了图谱构建的顶层设计，现在需要将其转化为一个具体的、可操作的实现计划。这个计划将明确每个阶段需要创建或修改哪些文件，以及它们的核心职责。

### 计划第四步：提出具体的实现计划

我将把实现过程分为三个阶段：**1. 核心服务实现**，**2. 流程协调**，**3. 数据库交互**。

#### **阶段一：核心服务实现 (在 `src/service/` 目录下)**

1.  **创建 `GraphMapperService`**:
    *   **文件路径**: `src/service/graph/GraphMapperService.ts`
    *   **核心职责**:
        *   提供一个 `map(queryResults: QueryResult[]): { nodes: any[], edges: any[] }` 方法。
        *   该方法内部根据 `queryResults` 中每个匹配的 `name`（例如 `class.name`, `function.name`）来决定创建哪种类型的节点或边。
        *   与 `ComplexityService` (如果需要，可新建) 协作，计算静态分析属性。
    *   **依赖**: `TreeSitterQueryEngine` 的输出类型 `QueryResult`。

2.  **创建 `PreprocessingService`**:
    *   **文件路径**: `src/service/project/PreprocessingService.ts`
    *   **核心职责**:
        *   提供 `filterFiles(files: string[]): string[]` 方法。
        *   实现基于 `.gitignore` 的过滤逻辑（可以复用 `ignore` 服务）。
        *   提供基于正则表达式或 glob 模式的自定义过滤规则。
    *   **依赖**: `src/service/ignore` 服务。

3.  **创建 `FileMetadataService`**:
    *   **文件路径**: `src/service/project/FileMetadataService.ts`
    *   **核心职责**:
        *   提供 `getChangedFiles(projectPath: string): { added: string[], modified: string[], deleted: string[] }` 方法。
        *   内部维护一个简单的持久化存储（例如 JSON 文件），记录每个文件的 hash 或 mtime。
        *   在每次调用时，与文件系统的当前状态进行比较，返回变更列表。

#### **阶段二：流程协调**

1.  **创建 `IndexingOrchestratorService`**:
    *   **文件路径**: `src/service/index/IndexingOrchestratorService.ts`
    *   **核心职责**:
        *   实现 `startIndexing(projectPath: string)` 方法，作为索引流程的入口。
        *   调用 `FileMetadataService` 获取变更文件。
        *   协调 `PreprocessingService`, `FileProcessingService`, `TreeSitterService`, `GraphMapperService`, 和 `GraphDatabaseService`，完成整个索引流程。
        *   实现增量更新逻辑（先删除后新增）。
    *   **依赖**: 所有上述服务。

#### **阶段三：数据库交互 (在 `src/database/` 目录下)**

1.  **扩展 `GraphDatabaseService.ts`**:
    *   **文件路径**: `src/database/graph/GraphDatabaseService.ts`
    *   **需要新增的方法**:
        *   `batchInsert(nodes: any[], edges: any[]): Promise<void>`:
            *   接收节点和边对象列表。
            *   使用 `GraphQueryBuilder` (或直接编写 nGQL) 生成批量的 `INSERT VERTEX` 和 `INSERT EDGE` 语句。
            *   调用 `executeBatch` 执行写入操作。
        *   `deleteDataForFile(filePath: string): Promise<void>`:
            *   接收一个文件路径。
            *   生成并执行 `MATCH (n) WHERE n.File.file_path == "${filePath}" DETACH DELETE n;` 类似的 nGQL 语句，删除与该文件相关的所有数据。

2.  **创建图 Schema 初始化脚本**:
    *   **文件路径**: `scripts/setup-graph-schema.ts`
    *   **核心职责**:
        *   连接到 Nebula Graph。
        *   执行 `CREATE TAG IF NOT EXISTS ...` 和 `CREATE EDGE IF NOT EXISTS ...` 语句，创建我们在第一步中设计的 Schema。
        *   创建必要的索引，例如在 `File` 节点的 `path` 属性上创建索引，以加速查询。 `CREATE TAG INDEX ON File(path(256));`

**实现步骤总结**:

1.  **Schema 初始化**: 首先运行 `setup-graph-schema.ts` 脚本，在数据库中创建好 TAGs 和 EDGEs。
2.  **服务实现**: 依次实现 `GraphMapperService`, `PreprocessingService`, `FileMetadataService`。
3.  **数据库扩展**: 在 `GraphDatabaseService` 中添加批量插入和按文件删除的方法。
4.  **顶层协调**: 实现 `IndexingOrchestratorService`，将所有部分串联起来。
5.  **API 集成**: 最后，在 `src/api/` 目录下创建一个新的 Controller，暴露一个 `/index-project` 的端点，该端点调用 `IndexingOrchestratorService` 来触发整个流程。

这个计划将任务分解到了具体的文件和方法层面，具有很强的可操作性。

现在，我将更新任务清单，将第四步标记为已完成，并开始最后一步：**请求用户审查和批准计划**。