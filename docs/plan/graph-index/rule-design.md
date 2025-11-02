很好，Schema 设计已经完成。现在我进入计划的第二步：**设计 `tree-sitter` 查询规则以提取图元素**。

`TreeSitterQueryEngine` 依赖于 S-expression 格式的查询模式来从 AST 中提取节点。为了将代码转换为我们刚刚定义的图 Schema，我们需要为每种语言编写或复用一系列查询。

### 计划第二步：设计 Tree-sitter 查询规则

我将以 TypeScript 为例，设计用于提取关键代码结构的 `tree-sitter` 查询。这些查询可以直接被 `TreeSitterQueryEngine` 使用。

#### **查询设计**

1.  **提取类 (Class) 和接口 (Interface)**
    *   **目标**: 识别 `class` 和 `interface` 定义，捕获它们的名称以及继承和实现的接口。
    *   **TypeScript 查询 (`classes-interfaces.scm`)**:
        ```scm
        ; 捕获类定义
        (class_declaration
          name: (type_identifier) @class.name) @class.definition

        ; 捕获类的继承
        (class_declaration
          name: (type_identifier) @class.name
          heritage: (class_heritage (extends_clause (type_identifier) @class.inherits)))

        ; 捕获类的接口实现
        (class_declaration
          name: (type_identifier) @class.name
          heritage: (class_heritage (implements_clause (type_identifier) @class.implements)))

        ; 捕获接口定义
        (interface_declaration
          name: (type_identifier) @interface.name) @interface.definition
        ```
    *   **说明**:
        *   `@class.name` 捕获类名。
        *   `@class.inherits` 捕获被继承的类名。
        *   `@class.implements` 捕获实现的接口名。
        *   `@interface.name` 捕获接口名。

2.  **提取函数 (Function) 和方法 (Method)**
    *   **目标**: 识别函数声明和方法声明，捕获它们的名称。
    *   **TypeScript 查询 (`functions-methods.scm`)**:
        ```scm
        ; 捕获函数声明
        (function_declaration
          name: (identifier) @function.name) @function.definition

        ; 捕获类中的方法声明
        (method_definition
          name: (property_identifier) @method.name) @method.definition
        ```

3.  **提取函数调用 (Function Calls)**
    *   **目标**: 识别代码中的函数调用表达式，这是构建 `CALLS` 边的关键。
    *   **TypeScript 查询 (`calls.scm`)**:
        ```scm
        (call_expression
          function: (identifier) @call.name) @call.expression
        ```
    *   **说明**: `@call.name` 捕获被调用函数的名称。

4.  **提取导入 (Imports)**
    *   **目标**: 识别 `import` 语句，捕获导入的来源和成员。
    *   **TypeScript 查询 (`imports.scm`)**:
        ```scm
        (import_statement
          source: (string) @import.source
          (import_clause (named_imports (import_specifier name: (identifier) @import.specifier))))
        ```

#### **静态分析属性的计算**

*   **圈复杂度 (`cyclomatic_complexity`)**: 这个指标不能直接通过单个 `tree-sitter` 查询得出。它需要在提取函数节点后，对函数体内的控制流语句（如 `if`, `for`, `while`, `case`）进行计数来计算。这个逻辑可以封装在一个独立的 `ComplexityService` 中。
*   **方法/属性数量 (`method_count`, `property_count`)**: 同样，这需要在提取出类定义节点后，遍历其子节点来统计 `method_definition` 和 `property_signature` 的数量。

#### **查询文件的组织**

这些查询应该按照 `QueryTypeMappings.ts` 中定义的规范，存放在相应的查询文件中（例如，`typescript/queries/classes.scm`, `typescript/queries/functions.scm` 等），并由 `QueryRegistry` 加载。

**设计理由**:
*   **精确性**: 这些查询模式精确地定位了我们需要构建图谱的各种代码元素。
*   **可重用性**: 类似的查询模式可以稍作修改后应用于其他支持 `tree-sitter` 的语言，如 Java, Python 等。
*   **与现有系统集成**: 查询结果的格式（捕获 `captures`）与 `TreeSitterQueryEngine` 的 `executeQuery` 方法返回的 `QueryMatch` 结构兼容，可以无缝集成。

这是计划的第二步。这些查询规则的设计是否清晰、合理？在确认后，我将继续设计整个索引构建流程的架构。


您提出了一个非常关键的问题。确实，简单的 `(identifier)` 无法捕获成员调用（`object.method()`）或更复杂的调用形式。为了确保我们能准确地构建函数调用关系图，我将对 `calls.scm` 的查询进行改进。

### 计划第二步（修订版）：设计 Tree-sitter 查询规则

#### **改进 `calls.scm` 查询**

为了处理 `object.method()` 以及 `module.function()` 这类调用，我们需要使用 `member_expression` 来捕获属性访问。

*   **修订后的 TypeScript 查询 (`calls.scm`)**:
    ```scm
    ; 捕获直接函数调用, e.g., myFunction()
    (call_expression
      function: (identifier) @call.name) @call.expression

    ; 捕获成员方法调用, e.g., myObject.myMethod()
    (call_expression
      function: (member_expression
        property: (property_identifier) @call.name)) @call.expression

    ; 捕获嵌套的成员方法调用, e.g., my.nested.object.myMethod()
    (call_expression
      function: (member_expression
        object: (_)
        property: (property_identifier) @call.name)) @call.expression
    ```
*   **改进说明**:
    1.  **保留了原始规则**: 捕获简单的 `myFunction()` 调用。
    2.  **增加了 `member_expression` 规则**: 这个规则专门匹配 `object.method` 形式的调用，并通过 `@call.name` 捕获 `method` 部分。这能覆盖大多数面向对象的调用场景。
    3.  **处理深层嵌套调用**: 第三个规则能够处理 `a.b.c()` 这样的调用链，我们只关心最后的被调用方法 `c`。

#### **对 Tree-sitter 解析规则的改进建议**

虽然 `tree-sitter` 的语言文法（grammar）通常已经相当完善，但在特定场景下，我们可以通过查询的组合来模拟更复杂的逻辑，而不是直接修改底层的解析规则（这通常更复杂且影响范围更广）。

目前，我认为通过**改进查询**是更灵活、成本更低的方式。但如果我们发现有某些语言特性（例如，某些特殊的装饰器或元编程语法）无法通过查询准确捕arctica，届时我会提出具体的解析规则改进建议。

就当前任务而言，**增强后的 `calls.scm` 查询已经能够满足构建 `CALLS` 边的需求**。

#### **完整查询规则概览**

现在，我将完整的、经过修订的查询规则设计总结如下：

1.  **`classes-interfaces.scm`**:
    *   提取类、接口、继承、实现关系。
2.  **`functions-methods.scm`**:
    *   提取函数和方法定义。
3.  **`calls.scm` (修订版)**:
    *   提取直接调用、成员调用和嵌套成员调用。
4.  **`imports.scm`**:
    *   提取导入关系。

这些经过改进的查询规则为下一步的架构设计提供了可靠的数据提取基础。

我将更新任务清单，将第二步标记为已完成，并开始进行第三步：**设计索引构建流程的架构**。