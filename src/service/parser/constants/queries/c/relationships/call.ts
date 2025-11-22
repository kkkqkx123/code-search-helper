/*
C Call Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的函数调用关系
*/
export default `
; 函数调用关系 - 基本模式
(call_expression
  function: (identifier) @call.function.name
  arguments: (argument_list
    (_) @call.argument)*) @call.relationship

; 函数指针调用关系
(call_expression
  function: (pointer_expression
    argument: (identifier) @call.function.pointer)
  arguments: (argument_list
    (_) @call.argument)*) @call.relationship.pointer

; 结构体方法调用关系
(call_expression
  function: (field_expression
    argument: (identifier) @call.object
    field: (field_identifier) @call.method)
  arguments: (argument_list
    (_) @call.argument)*) @call.relationship.method

; 递归调用关系
(call_expression
  function: (identifier) @recursive.function.name
  arguments: (argument_list
    (_) @call.argument)*) @call.relationship.recursive

; 链式调用关系
(call_expression
  function: (field_expression
    argument: (call_expression
      function: (identifier) @chained.call.function
      arguments: (argument_list))
    field: (field_identifier) @chained.call.method)
  arguments: (argument_list
    (_) @call.argument)*) @call.relationship.chained

; 条件调用关系
(call_expression
  function: (identifier) @conditional.call.function
  arguments: (argument_list
    (_) @call.argument)*) 
  (#match? @conditional.call.function "^(if|switch|select)$")) @call.relationship.conditional

; 回调函数调用关系
(call_expression
  function: (identifier) @callback.function
  arguments: (argument_list
    (identifier) @callback.argument)*) 
  (#match? @callback.function "^(callback|handler|invoke)$")) @call.relationship.callback

; 宏函数调用关系
(call_expression
  function: (identifier) @macro.function
  arguments: (argument_list
    (_) @macro.argument)*) 
  (#match? @macro.function "^[A-Z_][A-Z0-9_]*$")) @call.relationship.macro
`;