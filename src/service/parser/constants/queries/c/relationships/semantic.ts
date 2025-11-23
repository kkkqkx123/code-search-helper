/*
C Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的高级语义关系
从 ref/semantic-relationships.ts 迁移而来，排除已在其他文件中的功能
*/
export default `
; 指针关系 - 使用谓词过滤
[
  (field_declaration
    (struct_specifier
      (type_identifier) @pointed.type)
    (pointer_declarator
      (field_identifier) @pointer.field)) @semantic.relationship.pointer.struct
  (field_declaration
    (primitive_type) @pointed.type
    (pointer_declarator
      (field_identifier) @pointer.field)) @semantic.relationship.pointer.primitive
] @semantic.relationship.pointer.field

; 函数指针关系 - 使用锚点操作符
(type_definition
  (function_declarator
    (parenthesized_declarator
      (pointer_declarator
        (type_identifier) @function.pointer.type)))) @semantic.relationship.function.pointer.type

; 设计模式查询 - 参数化模式
(class_specifier
  name: (type_identifier) @pattern.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declaration
        declarator: (field_identifier) @pattern.field)
      type: (type_identifier) @pattern.type)*
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @pattern.method))*)) @semantic.design.pattern
  (#match? @pattern.class "^(Observer|Subject|Strategy|Factory|Singleton)$")

; 内存管理关系 - 使用谓词过滤
(call_expression
  function: (identifier) @memory.function
  (#match? @memory.function "^(malloc|calloc|realloc|free)$")
  arguments: (argument_list)) @semantic.relationship.memory.management

; 错误处理模式 - 使用交替模式
[
  (return_statement
    (identifier) @error.code
    (#match? @error.code "^(ERROR|FAIL|INVALID|NULL)$")) @semantic.relationship.error.return
  (if_statement
    (condition_clause
      (binary_expression
        (identifier) @checked.variable
        ["==" "!="]
        (identifier) @error.value))
    (compound_statement) @error.handling.block) @semantic.relationship.error.checking
] @semantic.relationship.error.handling

; 资源管理模式 - 使用锚点确保精确匹配
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.constructor)
  body: (compound_statement
    (declaration
      type: (type_identifier) @resource.type
      declarator: (init_declarator
        declarator: (identifier) @resource.variable
        value: (call_expression
          function: (identifier) @allocation.function))))) @semantic.relationship.resource.initialization

; 清理函数模式 - 简化模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @cleanup.function)
  parameters: (parameter_list
    (parameter_declaration
      type: (primitive_type)
      declarator: (identifier) @resource.parameter))) @semantic.relationship.cleanup.pattern

; 回调函数模式 - 使用锚点确保精确匹配
[
  (declaration
    type: (type_identifier) @callback.type
    declarator: (init_declarator
      declarator: (identifier) @callback.variable
      value: (identifier) @callback.function)) @semantic.relationship.callback.assignment
  (init_declarator
    declarator: (identifier) @callback.variable
    value: (identifier) @callback.function) @semantic.relationship.callback.assignment
  (type_definition
    (function_declarator
      (parenthesized_declarator
        (pointer_declarator
          (type_identifier) @callback.type)))) @semantic.relationship.callback.type
] @semantic.relationship.callback.pattern
`;