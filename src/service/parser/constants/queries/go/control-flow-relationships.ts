/*
Go Control Flow Relationships-specific Tree-Sitter Query Patterns
用于识别条件、循环、异常处理等控制流模式
*/
export default `
; If语句控制流关系
(if_statement
  condition: (identifier) @source.condition
  consequence: (block) @target.then.block) @control.flow.if

; If-Else语句控制流关系
(if_statement
  condition: (identifier) @source.condition
  consequence: (block) @target.then.block
  alternative: (block) @target.else.block) @control.flow.if.else

; For循环控制流关系
(for_statement
  condition: (identifier) @source.condition
  body: (block) @target.loop.body) @control.flow.for

; 范围For循环控制流关系
(for_statement
  range: (range_clause
    right: (expression_list
      (identifier) @source.range))
  body: (block) @target.range.body) @control.flow.range.for

; Select语句控制流关系
(select_statement
  body: (block
    (expression_statement
      (call_expression
        function: (identifier) @target.case.function))
    (expression_statement
      (identifier) @source.case.variable))) @control.flow.select

; Switch语句控制流关系
(switch_statement
  value: (identifier) @source.switch.variable
  body: (block
    (expression_case
      (expression_list
        (identifier) @case.value)
      (block) @target.case.block))) @control.flow.switch

; Defer语句控制流关系
(defer_statement
  (call_expression
    function: (identifier) @target.deferred.function
    arguments: (argument_list
      (identifier) @source.deferred.parameter))) @control.flow.defer

; Go协程控制流关系
(go_statement
  (call_expression
    function: (identifier) @target.goroutine.function
    arguments: (argument_list
      (identifier) @source.goroutine.parameter))) @control.flow.goroutine

; Panic语句控制流关系
(call_expression
  function: (identifier) @panic.function
  (#match? @panic.function "panic")
  arguments: (argument_list
    (identifier) @source.panic.value)) @control.flow.panic

; Recover语句控制流关系
(call_expression
  function: (identifier) @recover.function
  (#match? @recover.function "recover")
  arguments: (argument_list)) @control.flow.recover

; 嵌套If语句控制流关系
(if_statement
  condition: (identifier) @source.outer.condition
  consequence: (block
    (if_statement
      condition: (identifier) @source.inner.condition
      consequence: (block) @target.nested.block))) @control.flow.nested.if

; 嵌套For循环控制流关系
(for_statement
  condition: (identifier) @source.outer.condition
  body: (block
    (for_statement
      condition: (identifier) @source.inner.condition
      body: (block) @target.nested.block))) @control.flow.nested.for

; Break语句控制流关系
(for_statement
  body: (block
    (break_statement) @control.flow.break)) @control.flow.loop.break

; Continue语句控制流关系
(for_statement
  body: (block
    (continue_statement) @control.flow.continue)) @control.flow.loop.continue

; Fallthrough语句控制流关系
(switch_statement
  body: (block
    (fallthrough_statement) @control.flow.fallthrough)) @control.flow.switch.fallthrough

; Label标签控制流关系
(labeled_statement
  label: (label_name) @control.label
  statement: (for_statement) @target.labeled.loop) @control.flow.labeled.statement

; Goto语句控制流关系
(go_to_statement
  label: (label_name) @target.goto.label) @control.flow.goto

; 带初始化的If语句控制流关系
(if_statement
  initializer: (short_var_declaration
    left: (expression_list
      (identifier) @source.initializer.variable))
  condition: (identifier) @source.condition.variable
  consequence: (block) @target.then.block) @control.flow.if.with.initializer

; 带初始化的For语句控制流关系
(for_statement
  initializer: (short_var_declaration
    left: (expression_list
      (identifier) @source.initializer.variable))
  condition: (identifier) @source.condition.variable
  update: (inc_statement
    operand: (identifier) @source.update.variable)
  body: (block) @target.loop.body) @control.flow.for.with.initializer

; 带Case条件的Select语句控制流关系
(select_statement
  body: (block
    (comm_case
      (send_statement
        channel: (identifier) @target.channel
        value: (identifier) @source.value)
      (block) @target.case.block))) @control.flow.select.send.case

; 带Case条件的Select接收控制流关系
(select_statement
  body: (block
    (comm_case
      (expression_statement
        (unary_expression
          ["<-"] @receive.operator
          operand: (identifier) @source.channel))
      (block) @target.case.block))) @control.flow.select.receive.case

; 默认Case的Select语句控制流关系
(select_statement
  body: (block
    (default_case
      (block) @target.default.block))) @control.flow.select.default.case

; 默认Case的Switch语句控制流关系
(switch_statement
  body: (block
    (default_case
      (block) @target.default.block))) @control.flow.switch.default.case

; Type Switch语句控制流关系
(type_switch_statement
  initializer: (short_var_declaration
    left: (expression_list
      (identifier) @source.type.variable))
  body: (block
    (type_case
      (type_identifier) @case.type
      (block) @target.case.block))) @control.flow.type.switch
`;