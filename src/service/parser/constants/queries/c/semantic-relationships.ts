/*
C Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的高级语义关系
Optimized based on tree-sitter best practices
*/
export default `
; 函数调用关系 - 使用参数化查询
(call_expression
  function: [
    (identifier) @target.function
    (pointer_expression
      argument: (identifier) @function.pointer)
  ]
  arguments: (argument_list
    (identifier)* @source.parameter)) @semantic.relationship.function.call

; 递归调用关系 - 简化模式
(call_expression
  function: (identifier) @recursive.function
  arguments: (argument_list)) @semantic.relationship.recursive.call

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

; 结构体关系 - 使用交替模式
[
  (struct_specifier
    (type_identifier) @struct.name
    (field_declaration_list
      (field_declaration
        (_) @field.type
        (field_identifier) @field.name))) @semantic.relationship.struct.definition
  (struct_specifier
    (type_identifier) @nested.struct
    (field_declaration_list
      (field_declaration
        (struct_specifier
          (type_identifier) @inner.struct)
        (field_identifier) @field.name))) @semantic.relationship.struct.nesting
] @semantic.relationship.struct

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

; 类型别名关系 - 简化模式
[
  (type_definition
    (sized_type_specifier) @original.type
    (type_identifier) @alias.type) @semantic.relationship.type.alias.sized
  (type_definition
    (struct_specifier) @original.type
    (type_identifier) @alias.type) @semantic.relationship.type.alias.struct
  (type_definition
    (primitive_type) @original.type
    (type_identifier) @alias.type) @semantic.relationship.type.alias.primitive
] @semantic.relationship.type.alias

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
      declarator: (field_declarator
        declarator: (field_identifier) @pattern.field)
      type: (type_identifier) @pattern.type)*
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @pattern.method))*)) @semantic.design.pattern
  (#match? @pattern.class "^(Observer|Subject|Strategy|Factory|Singleton)$")

; 预处理关系 - 使用交替模式
[
  (preproc_include
    path: (string_literal
      (string_content) @included.header)) @semantic.relationship.include
  (preproc_def
    name: (identifier) @macro.name
    value: (identifier)? @macro.value) @semantic.relationship.macro.definition
  (preproc_if
    condition: (identifier) @conditional.symbol) @semantic.relationship.conditional.compilation
] @semantic.relationship.preprocessor

; 全局变量关系 - 使用谓词过滤
(declaration
  type: [(type_identifier) (primitive_type)] @global.variable.type
  declarator: (init_declarator
    declarator: (identifier) @global.variable.name)
  (#match? @global.variable.name "^[g_][a-zA-Z0-9_]*$")) @semantic.relationship.global.variable

; 外部变量关系 - 简化模式
(declaration
  (storage_class_specifier) @extern.specifier
  type: [(type_identifier) (primitive_type)] @extern.variable.type
  declarator: (identifier) @extern.variable.name) @semantic.relationship.extern.variable

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
    (parenthesized_expression
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
      type: (pointer_type)
      declarator: (identifier) @resource.parameter))) @semantic.relationship.cleanup.pattern
`;