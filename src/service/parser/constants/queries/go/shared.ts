/*
Go Shared Query Patterns
Common query patterns reused across different query types
*/

export const SHARED_CALL_EXPRESSIONS = `
; 选择器和调用表达式查询 - 使用交替模式
[
  (selector_expression
    operand: (identifier) @selector.object
    field: (field_identifier) @selector.field)
  (call_expression
    function: (identifier) @call.function
    arguments: (argument_list
      (identifier) @call.arg)*)
] @definition.invocation
`;

export const SHARED_FUNCTION_ANNOTATIONS = `
; 函数注解和文档注释查询
[
  (function_declaration
    name: (identifier) @function.name)
  (method_declaration
    name: (field_identifier) @method.name)
  (comment) @comment
] @definition.function.with_annotation
`;
