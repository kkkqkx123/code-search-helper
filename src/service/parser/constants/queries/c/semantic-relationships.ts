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

; 递归调用关系 - 使用谓词过滤
(call_expression
  function: (identifier) @recursive.function
  arguments: (argument_list))
  (#eq? @recursive.function @current.function) @semantic.relationship.recursive.call

; 回调函数模式 - 使用锚点确保精确匹配
[
  (assignment_expression
    left: (identifier) @callback.variable
    right: (identifier) @callback.function) @semantic.relationship.callback.assignment
  (field_declaration
    type: (pointer_type
      (function_type))
    declarator: (field_declarator
      declarator: (field_identifier) @callback.field)) @semantic.relationship.callback.field
] @semantic.relationship.callback.pattern

; 结构体关系 - 使用交替模式
[
  (struct_specifier
    name: (type_identifier) @struct.name
    body: (field_declaration_list
      (field_declaration
        type: (type_identifier) @field.type
        declarator: (field_declarator
          declarator: (field_identifier) @field.name))*)) @semantic.relationship.struct.definition
  (struct_specifier
    name: (type_identifier) @nested.struct
    body: (field_declaration_list
      (field_declaration
        type: (struct_specifier
          name: (type_identifier) @inner.struct)
        declarator: (field_declarator
          declarator: (field_identifier) @field.name)))) @semantic.relationship.struct.nesting
] @semantic.relationship.struct

; 指针关系 - 使用谓词过滤
(field_declaration
  type: (pointer_type
    (type_identifier) @pointed.type)
  declarator: (field_declarator
    declarator: (field_identifier) @pointer.field)) @semantic.relationship.pointer.field

; 类型别名关系 - 简化模式
(type_definition
  type: (type_identifier) @original.type
  declarator: (type_identifier) @alias.type) @semantic.relationship.type.alias

; 函数指针关系 - 使用锚点操作符
(type_definition
  type: (pointer_type
    (function_type
      parameters: (parameter_list
        (parameter_declaration
          type: (type_identifier) @param.type
          declarator: (identifier) @param.name))))
  declarator: (type_identifier) @function.pointer.type) @semantic.relationship.function.pointer.type

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
  type: (type_identifier) @global.variable.type
  declarator: (init_declarator
    declarator: (identifier) @global.variable.name)
  (#match? @global.variable.name "^[g_][a-zA-Z0-9_]*$")) @semantic.relationship.global.variable

; 外部变量关系 - 简化模式
(declaration
  storage_class_specifier: (storage_class_specifier) @extern.specifier
  type: (type_identifier) @extern.variable.type
  declarator: (identifier) @extern.variable.name) @semantic.relationship.extern.variable

; 内存管理关系 - 使用谓词过滤
(call_expression
  function: (identifier) @memory.function
  arguments: (argument_list
    (identifier) @memory.argument))
  (#match? @memory.function "^(malloc|calloc|realloc|free)$") @semantic.relationship.memory.management

; 错误处理模式 - 使用交替模式
[
  (return_statement
    (identifier) @error.code
    (#match? @error.code "^(ERROR|FAIL|INVALID|NULL)$")) @semantic.relationship.error.return
  (if_statement
    condition: (binary_expression
      left: (identifier) @checked.variable
      operator: ["==" "!="]
      right: (identifier) @error.value)
    consequence: (statement) @error.handling.block) @semantic.relationship.error.checking
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