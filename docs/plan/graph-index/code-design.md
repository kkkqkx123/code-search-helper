# 图索引代码设计

## 概述

本文档描述了图索引功能的具体代码实现设计。完整的实现指南请参考 [实现指南](./implementation-guide.md)。

## 实现计划

我们将实现过程分为三个阶段：**1. 核心服务实现**，**2. 服务扩展**，**3. 集成与协调**。

## 阶段一：核心服务实现

### 创建 `GraphMapperService`

**文件路径**: `src/service/graph/GraphMapperService.ts`

**核心职责**:
- 提供一个 `map(queryResults: Map<string, QueryResult>): { nodes: any[], edges: any[] }` 方法。
- 根据查询结果创建图节点和边。
- 计算静态分析属性（如圈复杂度、方法数量等）。

**关键接口**:

```typescript
export interface GraphNode {
  label: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  type: string;
  sourceId: string;
  targetId: string;
  properties?: Record<string, any>;
}

export interface GraphMappingResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

**核心方法**:

```typescript
@injectable()
export class GraphMapperService {
  /**
   * 将查询结果映射为图元素
   */
  map(queryResults: Map<string, QueryResult>): GraphMappingResult {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 处理类和接口
    const classResults = queryResults.get('graph-classes');
    if (classResults) {
      for (const match of classResults.matches) {
        this.processClassOrInterface(match, nodes, edges);
      }
    }

    // 处理函数和方法
    const functionResults = queryResults.get('graph-functions');
    if (functionResults) {
      for (const match of functionResults.matches) {
        this.processFunctionOrMethod(match, nodes, edges);
      }
    }

    // 处理函数调用
    const callResults = queryResults.get('graph-calls');
    if (callResults) {
      for (const match of callResults.matches) {
        this.processCall(match, nodes, edges);
      }
    }

    // 处理导入和导出
    const importResults = queryResults.get('graph-imports');
    if (importResults) {
      for (const match of importResults.matches) {
        this.processImport(match, nodes, edges);
      }
    }

    const exportResults = queryResults.get('graph-exports');
    if (exportResults) {
      for (const match of exportResults.matches) {
        this.processExport(match, nodes, edges);
      }
    }

    return { nodes, edges };
  }
}
```

## 阶段二：服务扩展

### 1. 扩展 `TreeSitterQueryEngine`

**文件路径**: `src/service/parser/core/query/TreeSitterQueryEngine.ts`

**新增方法**:

```typescript
/**
 * 执行图索引查询
 */
async executeGraphQueries(ast: Parser.SyntaxNode, language: string): Promise<Map<string, QueryResult>> {
  // 获取图索引查询类型
  const graphQueryTypes = this.getGraphQueryTypes(language);
  
  // 执行查询
  const results = new Map<string, QueryResult>();
  for (const queryType of graphQueryTypes) {
    const result = await this.executeQuery(ast, queryType, language);
    results.set(queryType, result);
  }
  
  return results;
}

/**
 * 获取图索引查询类型
 */
private getGraphQueryTypes(language: string): string[] {
  const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
  if (!mapping) {
    return [];
  }
  
  // 返回图索引相关的查询类型
  return Object.keys(mapping).filter(key => key.startsWith('graph-'));
}
```

### 2. 扩展 `IndexingLogicService`

**文件路径**: `src/service/index/IndexingLogicService.ts`

**新增方法**:

```typescript
/**
 * 索引文件到图数据库
 */
async function indexFileToGraph(projectPath: string, filePath: string): Promise<void> {
  try {
    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf8');
    
    // 检测语言
    const language = await this.treeSitterService.detectLanguage(filePath);
    if (!language) {
      this.logger.warn(`Unsupported language for file: ${filePath}`);
      return;
    }

    // 解析为 AST
    const parseResult = await this.treeSitterService.parseCode(content, language);
    
    // 执行图索引查询
    const queryResults = await this.treeSitterQueryEngine.executeGraphQueries(parseResult.ast, language);

    // 映射为图元素
    const graphElements = await this.graphMapperService.map(queryResults);

    // 插入到图数据库
    if (graphElements.nodes.length > 0) {
      await this.nebulaService.insertNodes(graphElements.nodes);
    }

    if (graphElements.edges.length > 0) {
      await this.nebulaService.insertRelationships(graphElements.edges);
    }

    this.logger.info(`Successfully indexed file to graph: ${filePath}`, {
      nodeCount: graphElements.nodes.length,
      edgeCount: graphElements.edges.length
    });

  } catch (error) {
    this.logger.error(`Failed to index file to graph: ${filePath}`, error);
    throw error;
  }
}
```

### 3. 扩展 `NebulaService`

**文件路径**: `src/database/nebula/NebulaService.ts`

**新增方法**:

```typescript
/**
 * 批量插入节点
 */
async function batchInsertNodes(nodes: NebulaNode[]): Promise<void> {
  if (!nodes || nodes.length === 0) {
    return;
  }

  try {
    // 按标签分组节点
    const nodesByLabel = this.groupNodesByLabel(nodes);

    // 为每个标签批量插入
    for (const [label, labelNodes] of Object.entries(nodesByLabel)) {
      const queries = labelNodes.map(node => ({
        query: `INSERT VERTEX ${label} (${Object.keys(node.properties).join(', ')}) VALUES ${node.id}: (${Object.values(node.properties).map(v => this.formatValue(v)).join(', ')})`,
        params: {}
      }));

      await this.executeTransaction(queries);
    }

    this.logger.info(`Successfully batch inserted ${nodes.length} nodes`);
  } catch (error) {
    this.logger.error(`Failed to batch insert nodes`, error);
    throw error;
  }
}

/**
 * 删除文件相关的所有数据
 */
async function deleteDataForFile(filePath: string): Promise<void> {
  try {
    // 删除与文件相关的所有节点和关系
    const deleteQuery = `
      LOOKUP ON File WHERE file_path == "${filePath}" YIELD id AS vid |
      FETCH PROP ON * $-.vid YIELD * |
      GO FROM $-.vid OVER * REVERSELY YIELD dst AS dst |
      DELETE VERTEX $-.vid WITH EDGE
    `;

    await this.executeWriteQuery(deleteQuery);
    this.logger.info(`Successfully deleted data for file: ${filePath}`);
  } catch (error) {
    this.logger.error(`Failed to delete data for file: ${filePath}`, error);
    throw error;
  }
}
```

## 阶段三：集成与协调

### 1. 扩展 `IndexService`

**文件路径**: `src/service/index/IndexService.ts`

**修改方法**:

```typescript
/**
 * 索引单个文件（增强版，带图索引支持）
 */
private async indexFile(projectPath: string, filePath: string): Promise<void> {
  try {
    // 原有的向量索引逻辑
    await this.indexingLogicService.indexFile(projectPath, filePath);
    
    // 新增的图索引逻辑
    if (process.env.NEBULA_ENABLED?.toLowerCase() !== 'false') {
      await this.indexingLogicService.indexFileToGraph(projectPath, filePath);
    }
  } catch (error) {
    this.recordError(filePath, error);
    this.errorHandler.handleError(
      new Error(`Failed to index file: ${error instanceof Error ? error.message : String(error)}`),
      { component: 'IndexService', operation: 'indexFile', projectPath, filePath }
    );
    throw error;
  }
}
```

## 图 Schema 初始化脚本

**文件路径**: `scripts/setup-graph-schema.ts`

**核心职责**:
- 连接到 Nebula Graph。
- 创建图 Schema 的 TAGs 和 EDGEs。
- 创建必要的索引。

**关键代码**:

```typescript
// 创建标签 (Tags)
const tagQueries = [
  'CREATE TAG IF NOT EXISTS File(name string, path string, language string, line_count int)',
  'CREATE TAG IF NOT EXISTS Class(name string, file_path string, start_line int, end_line int, method_count int, property_count int)',
  'CREATE TAG IF NOT EXISTS Function(name string, file_path string, start_line int, end_line int, signature string, cyclomatic_complexity int, is_method bool)',
  'CREATE TAG IF NOT EXISTS Interface(name string, file_path string, start_line int, end_line int)',
  'CREATE TAG IF NOT EXISTS Import(source string, specifiers string, file_path string)',
  'CREATE TAG IF NOT EXISTS Export(name string, file_path string)'
];

// 创建边类型 (Edge Types)
const edgeQueries = [
  'CREATE EDGE IF NOT EXISTS CONTAINS(line_number int)',
  'CREATE EDGE IF NOT EXISTS IMPORTS_FROM(line_number int)',
  'CREATE EDGE IF NOT EXISTS CALLS(line_number int)',
  'CREATE EDGE IF NOT EXISTS INHERITS_FROM(line_number int)',
  'CREATE EDGE IF NOT EXISTS IMPLEMENTS(line_number int)'
];
```

## 实现步骤总结

1. **Schema 初始化**: 运行 `setup-graph-schema.ts` 脚本，在数据库中创建好 TAGs 和 EDGEs。
2. **服务实现**: 实现 `GraphMapperService`。
3. **服务扩展**: 增强 `TreeSitterQueryEngine`、`IndexingLogicService` 和 `NebulaService`。
4. **集成协调**: 扩展 `IndexService` 和 `GraphIndexService`，将所有部分串联起来。
5. **API 集成**: 确保现有的 API 端点能够支持图索引功能。

## 相关文档

- [实现指南](./implementation-guide.md) - 综合性实现指南，包含完整代码示例
- [计划概述](./plan.md) - 高层次实现计划
- [架构设计](./index-design.md) - 详细架构设计
- [查询规则设计](./rule-design.md) - 查询规则详细设计