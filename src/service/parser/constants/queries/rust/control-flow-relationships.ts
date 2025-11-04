/*
Rust Control Flow Relationships-specific Tree-Sitter Query Patterns
用于扩展控制流关系分析，包括异常处理、嵌套控制流等
*/
export default `
; 异常处理流关系 - try表达式
(try_expression
  body: (_) @source.try.body) @control.flow.try

; 多个catch块的异常流
(match_expression
  value: (try_expression) @source.try.expression
  body: (match_block
    (match_arm
      pattern: (match_pattern
        (tuple_struct_pattern
          type: (identifier) @exception.type
          (identifier) @exception.variable))
      value: (_) @target.catch.body))) @control.flow.exception.match

; 条件表达式嵌套流
(if_expression
  condition: (identifier) @source.condition
  consequence: (block
    (if_expression
      condition: (identifier) @source.nested.condition
      consequence: (_) @target.nested.block))) @control.flow.nested.conditional

; 循环嵌套流
(loop_expression
  body: (block
    (while_expression
      condition: (identifier) @source.while.condition
      body: (_) @target.while.block))) @control.flow.nested.loop

; match表达式流关系
(match_expression
  value: (identifier) @source.match.value
  body: (match_block
    (match_arm
      pattern: (match_pattern
        (identifier) @case.pattern)
      value: (_) @target.case.block))) @control.flow.match.arm

; 守卫条件流关系
(match_arm
  pattern: (match_pattern
    (identifier) @source.guard.variable)
  guard: (if_expression
    condition: (identifier) @source.guard.condition)
  value: (_) @target.guard.body) @control.flow.guard

; 闭包控制流
(closure_expression
  parameters: (closure_parameters
    (identifier) @source.closure.param)
  body: (block
    (return_expression
      (identifier) @target.return.value))) @control.flow.closure.return

; 异步块控制流
(async_block
  body: (block
    (await_expression
      (call_expression) @source.awaited.call))) @control.flow.async.await

; break表达式流关系
(break_expression
  (identifier) @source.break.label) @control.flow.break

; continue表达式流关系
(continue_expression
  (identifier) @source.continue.label) @control.flow.continue

; 标签块流关系
(labeled_expression
  label: (identifier) @source.block.label
  value: (block
    (break_expression
      (identifier) @target.break.label))) @control.flow.labeled.break

; 宏中的控制流
(macro_invocation
  macro: (identifier) @macro.name
  (#match? @macro.name "^(assert|assert_eq|assert_ne|debug_assert)$")
  arguments: (token_tree
    (identifier) @source.assert.condition)) @control.flow.assert.macro

; 条件编译流关系
(attribute_item
  attribute: (attribute
    name: (identifier) @cfg.name
    (#match? @cfg.name "^cfg$")
    arguments: (token_tree
      (identifier) @source.cfg.condition))) @control.flow.cfg.conditional

; unsafe块控制流
(unsafe_block
  body: (block
    (expression_statement
      (call_expression
        function: (identifier) @target.unsafe.function)))) @control.flow.unsafe.block
`;