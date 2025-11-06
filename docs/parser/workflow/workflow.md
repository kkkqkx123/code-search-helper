经过深入分析，我已经明确了 tree-sitter 解析的具体实现和 TreeSitterUtils 的职责问题。

## Tree-sitter 解析的具体实现

### 解析流程
1. **入口点**：`TreeSitterCoreService.parseCode()` 
2. **解析器管理**：`DynamicParserManager.parseCode()` 调用 `getParser()` 动态加载语言特定解析器
3. **实际解析**：使用 `parser.parse(code)` 生成 AST
4. **查询提取**：通过 `TreeSitterQueryFacade` 使用 `QueryRegistry` 中的语言特定查询模式
5. **回退机制**：查询失败时使用 `TreeSitterUtils` 或 `DynamicParserManager` 的 legacy 方法

### 关键文件和方法
- **解析器加载**：`DynamicParserManager.getParser()` 按需动态加载语言解析器
- **查询系统**：`TreeSitterQueryFacade` → `QueryRegistry` → `QueryLoader` 
- **回退处理**：`TreeSitterUtils` 和 `DynamicParserManager.legacyExtract*` 方法

## TreeSitterUtils 的职责问题

### 当前问题
1. **职责不符**：名义上是工具类，实际承担回退策略职责
2. **功能重复**：与 `DynamicParserManager` 中的 legacy 方法重复
3. **架构不一致**：未集成项目现有的查询系统，使用独立硬编码逻辑

### 建议重构
1. **TreeSitterUtils 保留纯工具方法**：
   - `getNodeText()`, `getNodeLocation()`, `generateSnippetId()`, `simpleHash()`

2. **移除回退相关方法**：
   - `findNodeByType()`, `extractImports()`, `extractImportNodes()`, `getNodeName()`

3. **创建专门的 FallbackExtractor 类**：
   - 集成语言感知能力
   - 统一管理所有回退逻辑
   - 优先使用现有查询系统

4. **重构后架构**：
   ```
   TreeSitterQueryFacade → FallbackExtractor → TreeSitterUtils(基础工具)
   ```

这样的重构将使职责更清晰、回退更统一、架构更一致，充分利用项目现有的查询系统基础设施。