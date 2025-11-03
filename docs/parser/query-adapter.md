## 查询规则加载流程

### 查询规则存储：

src/service/parser/constants/queries/ 目录包含各语言查询规则文件，如 typescript.ts 或 typescript/index.ts。

### 查询规则格式

查询文件导出包含 Tree-sitter 查询模式的字符串，定义捕获名称如：
```
(function_declaration
  name: (identifier) @name.definition.function) @definition.function
```

### 加载机制：
- QueryLoader.loadLanguageQueries() 动态导入查询文件
- QueryLoader.getQuery() 返回特定语言和查询类型的查询字符串
- QueryManager.getQueryString() 调用 QueryLoader 获取查询字符串
- QueryResultNormalizer.executeQueryForType() 使用查询字符串执行 Tree-sitter 查询

### 适配器处理流程：
- 查询执行返回包含 captures 数组的结果，每个 capture 有 name（捕获名称）和 node（AST 节点）
- 适配器如 JavaScriptLanguageAdapter 通过捕获名称提取信息：
```
const capture = result.captures?.find((c: any) => c.name === 'name.definition.function');
if (capture?.node?.text) {
  return capture.node.text;
}
```

## 关键点
- 适配器不直接导入查询规则：适配器不访问查询规则的导出类型，而是处理查询执行结果
- 查询规则定义捕获什么：查询规则定义要捕获的 AST 节点和捕获名称
- 适配器定义如何处理：适配器根据捕获名称从结果中提取标准化信息
- 这种设计实现了查询规则和结果处理的分离，使适配器专注于数据转换，而查询规则专注于 AST 模式匹配。