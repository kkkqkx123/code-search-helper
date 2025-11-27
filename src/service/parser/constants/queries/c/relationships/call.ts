/*
C Call Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的函数调用关系
合并了dependency.ts和reference.ts中的重复函数调用查询
*/
export default `
; 统一的函数调用关系 - 基本模式（合并了dependency.ts和reference.ts中的重复查询）
(call_expression
  function: (identifier) @call.function.name
  arguments: (argument_list
    (_) @call.argument)*) @relationship.call

; 函数指针调用关系
(call_expression
  function: (pointer_expression
    argument: (identifier) @call.function.pointer)
  arguments: (argument_list
    (_) @call.argument)*) @relationship.call.pointer

; 结构体方法调用关系
(call_expression
  function: (field_expression
    argument: (identifier) @call.object
    field: (field_identifier) @call.method)
  arguments: (argument_list
    (_) @call.argument)*) @relationship.call.method

; 递归调用关系
(call_expression
  function: (identifier) @recursive.function.name
  arguments: (argument_list
    (_) @call.argument)*) @relationship.call.recursive

; 链式调用关系
(call_expression
  function: (field_expression
    argument: (call_expression
      function: (identifier) @chained.call.function
      arguments: (argument_list))
    field: (field_identifier) @chained.call.method)
  arguments: (argument_list
    (_) @call.argument)*) @relationship.call.chained

; 条件调用关系
(call_expression
  function: (identifier) @conditional.call.function
  arguments: (argument_list
    (_) @call.argument)*)
  (#match? @conditional.call.function "^(if|switch|select)$")) @relationship.call.conditional

; 回调函数调用关系
(call_expression
  function: (identifier) @callback.function
  arguments: (argument_list
    (identifier) @callback.argument)*)
  (#match? @callback.function "^(callback|handler|invoke)$")) @relationship.call.callback

; 宏函数调用关系
(call_expression
  function: (identifier) @macro.function
  arguments: (argument_list
    (_) @macro.argument)*)
  (#match? @macro.function "^[A-Z_][A-Z0-9_]*$")) @relationship.call.macro
`;