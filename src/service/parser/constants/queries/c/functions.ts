/*
C Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Optimized based on tree-sitter best practices
*/
export default `
; 统一的函数查询 - 使用交替模式合并重复查询
[
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @function.name)
    body: (compound_statement) @function.body) @definition.function
  (declaration
    type: (primitive_type)
    declarator: (function_declarator
      declarator: (identifier) @function.name
      parameters: (parameter_list))) @definition.function.prototype
] @definition.function

; 带参数的函数查询 - 使用量词操作符
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @function.name
    parameters: (parameter_list
      (parameter_declaration
        type: (primitive_type)
        declarator: (identifier) @param.name)+))
  body: (compound_statement) @function.body) @definition.function.with_params

; 函数调用查询 - 使用锚点和谓词过滤
(call_expression
  function: (identifier) @call.function
  arguments: (argument_list
    (identifier) @call.argument)+)
  (#match? @call.function "^[a-z_][a-zA-Z0-9_]*$")) @definition.function.call

; 函数指针查询 - 简化模式
(declaration
  type: (pointer_type
    (function_declarator
      parameters: (parameter_list)))
  declarator: (pointer_declarator
    declarator: (identifier) @function.pointer.name)) @definition.function.pointer

; 递归函数查询 - 使用谓词过滤
(call_expression
  function: (identifier) @recursive.call
  arguments: (argument_list)
  (#eq? @recursive.call @function.name)) @definition.recursive.call

; 内联函数查询 - 使用锚点确保精确匹配
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @inline.function)
  body: (compound_statement) @inline.body
  (#match? @inline.function "^(inline|static_inline)$")) @definition.inline.function
`;