/*
Kotlin Control Flow Relationships-specific Tree-Sitter Query Patterns
用于扩展控制流关系分析，包括异常处理、嵌套控制流等
*/
export default `
; 异常处理流关系 - try表达式
(try_expression) @control.flow.try

; try块流关系
(try_expression
  body: (block) @source.try.block) @control.flow.try.block

; catch块流关系
(catch_block) @control.flow.catch

; catch块异常处理
(catch_block
  (simple_identifier) @exception.parameter
  body: (block) @target.catch.block) @control.flow.exception.catch

; finally块流关系
(finally_block) @control.flow.finally

; finally块处理
(finally_block
  body: (block) @target.finally.block) @control.flow.finally.block

; 多个catch块的异常流
(try_expression
  body: (block) @source.try.block
  (catch_block
    (simple_identifier) @exception.parameter1
    body: (block) @target.catch.block1)
  (catch_block
    (simple_identifier) @exception.parameter2
    body: (block) @target.catch.block2)) @control.flow.multiple.exception

; throw表达式流关系
(throw_expression
  (simple_identifier) @source.exception.variable) @control.flow.throw

; when表达式流关系
(when_expression) @control.flow.when

; when条目流关系
(when_entry) @control.flow.when.entry

; when表达式条件流
(when_expression
  left: (simple_identifier) @source.when.value
  (when_entry
    (simple_identifier) @case.condition
    body: (_) @target.case.block)) @control.flow.when.case

; 条件表达式嵌套流
(if_expression
  condition: (simple_identifier) @source.condition.variable
  body: (block
    (if_expression
      condition: (simple_identifier) @source.nested.condition
      body: (_) @target.nested.block))) @control.flow.nested.conditional

; 循环嵌套流
(for_statement
  body: (block
    (while_statement
      condition: (simple_identifier) @source.while.condition
      body: (_) @target.while.block))) @control.flow.nested.loop

; for循环流关系
(for_statement
  left: (simple_identifier) @source.for.variable
  body: (block) @target.for.block) @control.flow.for

; while循环流关系
(while_statement
  condition: (simple_identifier) @source.while.condition
  body: (block) @target.while.block) @control.flow.while

; do-while循环流关系
(do_while_statement
  body: (block) @target.do.while.block
  condition: (simple_identifier) @source.do.while.condition) @control.flow.do.while

; break表达式流关系
(break_expression
  (simple_identifier) @source.break.label) @control.flow.break

; continue表达式流关系
(continue_expression
  (simple_identifier) @source.continue.label) @control.flow.continue

; 标签表达式流关系
(labeled_expression
  label: (simple_identifier) @source.label
  value: (block
    (break_expression
      (simple_identifier) @target.break.label))) @control.flow.labeled.break

; 返回表达式流关系
(return_expression
  (simple_identifier) @source.return.value) @control.flow.return

; Lambda表达式控制流
(lambda_literal
  parameters: (lambda_parameters
    (simple_identifier) @source.lambda.param)
  body: (block
    (return_expression
      (simple_identifier) @target.return.value))) @control.flow.lambda.return

; 安全调用控制流
(safe_call_expression
  left: (navigation_expression
    left: (simple_identifier) @source.safe.object
    right: (simple_identifier) @source.safe.method)
  right: (value_arguments
    (simple_identifier) @source.safe.param)) @control.flow.safe.call

; Elvis表达式控制流
(elvis_expression
  left: (simple_identifier) @source.elvis.condition
  right: (simple_identifier) @target.elvis.value) @control.flow.elvis

; 智能转换控制流
(as_expression
  left: (simple_identifier) @source.smart.cast
  right: (user_type) @target.cast.type) @control.flow.smart.cast

; 异常传播
(try_expression
  body: (block
    (throw_expression
      (simple_identifier) @source.propagated.exception))) @control.flow.exception.propagation

; 协程控制流
(call_expression
  left: (simple_identifier) @coroutine.function
  (#match? @coroutine.function "^(launch|async|runBlocking)$")
  right: (value_arguments
    (lambda_literal) @coroutine.handler)) @control.flow.coroutine

; 协程取消
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @coroutine.job
    right: (simple_identifier) @cancel.method)
  (#match? @cancel.method "^cancel$")) @control.flow.coroutine.cancel

; 流控制（Flow）
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @flow.object
    right: (simple_identifier) @flow.method)
  (#match? @flow.method "^(collect|emit|transform|filter|map)$")
  right: (value_arguments
    (lambda_literal) @flow.handler)) @control.flow.flow.operation

; 选择表达式控制流
(when_expression
  left: (simple_identifier) @source.select.value
  body: (when_block
    (when_entry
      (simple_identifier) @select.condition
      body: (_) @target.select.block))) @control.flow.select.case
`;