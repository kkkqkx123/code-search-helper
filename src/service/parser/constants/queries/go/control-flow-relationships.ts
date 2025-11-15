/*
Go Control Flow Relationships-specific Tree-Sitter Query Patterns
用于识别条件、循环、异常处理等控制流模式
*/
export default `
; 统一的条件控制流查询 - 使用交替模式
[
  (if_statement
    condition: (_) @if.condition
    consequence: (block) @if.body
    alternative: (block)? @if.else)
  (if_statement
    initializer: (short_var_declaration
      left: (expression_list
        (identifier) @init.var))
    condition: (_) @if.condition
    consequence: (block) @if.body)
] @control.flow.conditional

; 循环控制流查询 - 使用交替模式和锚点
[
  (for_statement
    condition: (_) @for.condition
    body: (block) @for.body)
  (for_statement
    range: (range_clause
      left: (expression_list
        (identifier) @range.var)
      right: (_) @range.expr)
    body: (block) @for.body)
  (for_statement
    initializer: (_) @for.init
    condition: (_) @for.condition
    update: (_) @for.update
    body: (block) @for.body)
] @control.flow.loop

; Switch和Select控制流查询 - 使用交替模式
[
  (switch_statement
    value: (_) @switch.value
    body: (block
      (expression_case
        (expression_list
          (identifier) @case.value)*
        (block) @case.body)*))
  (select_statement
    body: (block
      (comm_case
        (send_statement
          channel: (identifier) @channel
          value: (identifier) @value)
        (block) @case.body)*
      (comm_case
        (expression_statement
          (unary_expression
            ["<-"] @receive.op
            operand: (identifier) @channel))
        (block) @case.body)*))
] @control.flow.multi_branch

; 跳转控制流查询 - 使用交替模式
[
  (break_statement
    label: (label_name)? @break.label)
  (continue_statement
    label: (label_name)? @continue.label)
  (return_statement
    (expression_list
      (identifier) @return.value)*)
  (go_to_statement
    label: (label_name) @goto.label)
] @control.flow.jump

; 异常处理控制流查询
(call_expression
  function: (identifier) @panic.func
  (#match? @panic.func "panic")
  arguments: (argument_list
    (identifier) @panic.value)) @control.flow.panic

(call_expression
  function: (identifier) @recover.func
  (#match? @recover.func "recover")) @control.flow.recover

; 延迟执行控制流查询
(defer_statement
    (call_expression
      function: (identifier) @deferred.func
      arguments: (argument_list
        (identifier) @deferred.arg)*)) @control.flow.defer

; 协程控制流查询
(go_statement
  (call_expression
    function: (identifier) @goroutine.func
    arguments: (argument_list
      (identifier) @goroutine.arg)*)) @control.flow.goroutine

; 标签控制流查询
(labeled_statement
  label: (label_name) @label.name
  statement: (_) @labeled.stmt) @control.flow.labeled

; 嵌套控制流查询 - 使用锚点确保精确匹配
(if_statement
  condition: (_) @outer.condition
  consequence: (block
    .
    (if_statement
      condition: (_) @inner.condition
      consequence: (block) @inner.body))) @control.flow.nested.conditional

(for_statement
  condition: (_) @outer.condition
  body: (block
    .
    (for_statement
      condition: (_) @inner.condition
      body: (block) @inner.body))) @control.flow.nested.loop
`;