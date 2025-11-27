/*
C Control Flow-specific Tree-Sitter Query Patterns
用于识别和分析代码中的控制流模式
优先级4
*/
export default `
; if语句控制流
[
  (if_statement
    condition: (_) @source.condition
    consequence: (statement) @target.if.block) @control_flow.if
  (if_statement
    condition: (_) @source.condition
    consequence: (statement) @target.if.block
    alternative: (else_clause
      (statement) @target.else.block)) @control_flow.if.else
  (if_statement
    condition: (_) @source.outer.condition
    consequence: (compound_statement
      (if_statement
        condition: (_) @source.inner.condition
        consequence: (statement) @target.inner.block))) @control_flow.nested.if
  (if_statement
    condition: (_) @source.first.condition
    consequence: (statement) @target.first.block
    alternative: (else_clause
      (if_statement
        condition: (_) @source.second.condition
        consequence: (statement) @target.second.block))) @control_flow.else.if
] @control_flow.if.statement

; switch语句控制流
[
  (switch_statement
    condition: (_) @source.switch.variable
    body: (compound_statement) @target.switch.block) @control_flow.switch
  (case_statement
    value: (_)? @source.case.value
    (statement)? @target.case.block) @control_flow.switch.case
  (case_statement
    value: (_)? @source.case.value
    (statement)? @target.default.block) @control_flow.switch.default
] @control_flow.switch.statement

; while循环控制流
[
  (while_statement
    condition: (_) @source.while.condition
    body: (statement) @target.while.block) @control_flow.while
  (do_statement
    body: (statement) @source.do.block
    condition: (_) @target.while.condition) @control_flow.do.while
] @control_flow.while.statement

; for循环控制流
(for_statement
  initializer: (_)? @source.for.init
  condition: (_) @source.for.condition
  update: (_)? @source.for.update
  body: (_) @target.for.block) @control_flow.for

; 循环控制语句
[
  (break_statement) @control_flow.loop.break
  (continue_statement) @control_flow.loop.continue
] @control_flow.loop.control

; goto语句控制流
(goto_statement
  (statement_identifier) @target.label) @control_flow.goto

; 标签语句控制流
(labeled_statement
  label: (statement_identifier) @source.label
  (statement) @target.labeled.statement) @control_flow.label

; return语句控制流
(return_statement
  (_)? @source.return.variable) @control_flow.return

; 条件表达式控制流
(conditional_expression
  condition: (_)? @source.condition
  consequence: (_)? @source.consequence
  alternative: (_)? @source.alternative) @control_flow.conditional.expression

; 逻辑运算符控制流
(binary_expression
  left: (_)? @source.left.operand
  operator: ["&&" "||"]
  right: (_)? @source.right.operand) @control_flow.logical.operator

; 逗号表达式控制流
(comma_expression
  left: (_)? @source.left.expression
  right: (_)? @source.right.expression) @control_flow.comma.expression

`;