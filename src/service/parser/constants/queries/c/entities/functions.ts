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
        declarator: (identifier) @param.name)*))
 body: (compound_statement) @function.body) @definition.function.with_params

; 函数调用查询 - 使用锚点，参数类型更通用
(call_expression
  function: (identifier) @call.function
  arguments: (argument_list
    (_) @call.argument)*) @definition.function.call

; 函数指针查询 - 修复：函数指针声明的正确结构
(declaration
  type: (primitive_type) @return.type
  declarator: (function_declarator
    declarator: (parenthesized_declarator
      (pointer_declarator
        declarator: (identifier) @function.pointer.name))
    parameters: (parameter_list))) @definition.function.pointer

; 递归函数查询 - 简化模式
(call_expression
  function: (identifier) @recursive.call
  arguments: (argument_list)) @definition.recursive.call

; 内联函数查询 - 修复：查找包含inline或static inline的函数定义
(function_definition
  (storage_class_specifier) @func.type
  declarator: (function_declarator
    declarator: (identifier) @inline.function)
  body: (compound_statement) @inline.body
  (#match? @func.type "inline|static")) @definition.inline.function
`;