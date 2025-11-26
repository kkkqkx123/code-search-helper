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

; 函数指针查询 - 修复：函数指针声明的正确结构
(declaration
  type: (primitive_type) @return.type
  declarator: (function_declarator
    declarator: (parenthesized_declarator
      (pointer_declarator
        declarator: (identifier) @function.pointer.name))
    parameters: (parameter_list))) @definition.function.pointer
`;