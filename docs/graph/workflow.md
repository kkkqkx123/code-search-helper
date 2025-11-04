AST节点映射到图数据库数据的完整流程如下：

1. **AST节点类型定义**：
   - 在`LanguageNodeTypes.ts`文件中定义了每种编程语言的AST节点类型映射关系
   - 例如，对于JavaScript，`functionDeclaration`映射到`['function_declaration', 'function_expression', 'generator_function', ...]`等多个AST节点类型

2. **查询规则定义**：
   - 在`src/service/parser/constants/queries/`目录下，为每种语言定义了具体的Tree-Sitter查询规则
   - 例如，`typescript/expressions.ts`中定义了`(call_expression function: (_) @name.definition.call) @definition.call`来捕获函数调用

3. **查询类型映射**：
   - 在`QueryTypeMappings.ts`中定义了查询类型与AST节点类型的映射关系
   - 例如，`'graph-calls': ['expressions']`表示图索引中的调用关系来自于表达式查询

4. **查询执行**：
   - `TreeSitterQueryEngine.executeGraphQueries()`方法根据语言和查询类型执行相应的Tree-Sitter查询
   - 查询结果包含了匹配的AST节点及其捕获的信息

5. **数据映射**：
   - `GraphDataMappingService.mapQueryResultsToGraph()`方法处理查询结果：
     - 对于类和接口：处理`graph-classes`查询结果，创建类/接口节点和包含关系
     - 对于函数和方法：处理`graph-functions`查询结果，创建函数/方法节点和包含关系
     - 对于函数调用：处理`graph-calls`查询结果，创建调用关系边
     - 对于导入：处理`graph-imports`查询结果，创建导入关系边
     - 对于导出：处理`graph-exports`查询结果，创建导出节点

6. **数据转换**：
   - 在`IndexingLogicService`中，将图节点和边转换为Nebula数据库格式：
     - 节点转换：`convertToNebulaNodes()`方法将图节点映射为Nebula节点（包含ID、标签和属性）
     - 边转换：`convertToNebulaRelationships()`方法将图边映射为Nebula关系（包含ID、类型、源节点ID、目标节点ID和属性）

7. **数据插入**：
   - 通过`NebulaService.insertNodes()`和`NebulaService.insertRelationships()`方法将转换后的数据批量插入到Nebula图数据库中
   - 使用`NebulaBatchService`进行批量操作以提高性能

整个流程实现了从源代码AST节点到图数据库节点和关系的完整映射，使得可以在图数据库中进行代码结构和关系的查询分析。