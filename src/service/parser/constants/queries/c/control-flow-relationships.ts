/*
C Control Flow-specific Tree-Sitter Query Patterns
用于识别和分析代码中的控制流模式
*/
export default `
; if语句控制流
[
  (if_statement
    condition: (_) @source.condition
    consequence: (statement) @target.if.block) @control.flow.if
  (if_statement
    condition: (_) @source.condition
    consequence: (statement) @target.if.block
    alternative: (else_clause
      (statement) @target.else.block)) @control.flow.if.else
  (if_statement
    condition: (_) @source.outer.condition
    consequence: (compound_statement
      (if_statement
        condition: (_) @source.inner.condition
        consequence: (statement) @target.inner.block))) @control.flow.nested.if
  (if_statement
    condition: (_) @source.first.condition
    consequence: (statement) @target.first.block
    alternative: (else_clause
      (if_statement
        condition: (_) @source.second.condition
        consequence: (statement) @target.second.block))) @control.flow.else.if
] @control.flow.if.statement

; switch语句控制流
(switch_statement
  condition: (_) @source.switch.variable
  body: (compound_statement) @target.switch.block) @control.flow.switch

; switch case控制流
(case_statement
  value: (_)? @source.case.value
  (statement)? @target.case.block) @control.flow.switch.case

; switch default控制流（处理default关键字）
(case_statement
  (statement)? @target.default.block) @control.flow.switch.default

; while循环控制流
(while_statement
  condition: (_) @source.while.condition
  body: (statement) @target.while.block) @control.flow.while

; do-while循环控制流
(do_statement
  body: (statement) @source.do.block
  condition: (_) @target.while.condition) @control.flow.do.while

; for循环控制流
(for_statement
  initializer: (_)? @source.for.init
  condition: (_) @source.for.condition
  update: (_)? @source.for.update
  body: (_) @target.for.block) @control.flow.for

; 嵌套循环控制流
(for_statement
  body: (compound_statement
    (for_statement
      condition: (_) @source.inner.condition
      body: (statement) @target.inner.block))) @control.flow.nested.loop

; 循环控制语句
[
  (break_statement) @control.flow.loop.break
  (continue_statement) @control.flow.loop.continue
] @control.flow.loop.control

; goto语句控制流
(goto_statement
  (statement_identifier) @target.label) @control.flow.goto

; 标签语句控制流
(labeled_statement
  label: (statement_identifier) @source.label
  (statement) @target.labeled.statement) @control.flow.label

; return语句控制流
(return_statement
  (_)? @source.return.variable) @control.flow.return

; 函数调用控制流
[
  (expression_statement
    (call_expression
      function: (identifier) @target.function
      arguments: (argument_list
        (_)* @source.parameter))) @control.flow.function.call
  (call_expression
    function: (identifier) @target.recursive.function
    arguments: (argument_list
      (_)* @source.parameter)) @control.flow.recursive.call
] @control.flow.function.invocation

; 条件表达式控制流
(conditional_expression
  condition: (_)? @source.condition
  consequence: (_)? @source.consequence
  alternative: (_)? @source.alternative) @control.flow.conditional.expression

; 逻辑运算符控制流
(binary_expression
  left: (_)? @source.left.operand
  operator: ["&&" "||"]
  right: (_)? @source.right.operand) @control.flow.logical.operator

; 逗号表达式控制流
(comma_expression
  left: (_)? @source.left.expression
  right: (_)? @source.right.expression) @control.flow.comma.expression

; 函数定义控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @source.function.name)
  body: (compound_statement) @target.function.body) @control.flow.function.definition

; 函数指针调用控制流
(call_expression
  function: (pointer_expression
    argument: (identifier) @source.function.pointer)
  arguments: (argument_list
    (_)* @source.parameter)) @control.flow.function.pointer.call

; 短路求值与控制流
[
  (binary_expression
    left: (_)? @source.left.operand
    operator: "&&"
    right: (call_expression
      function: (identifier) @target.short.circuit.function)) @control.flow.short.circuit.and
  (binary_expression
    left: (_)? @source.left.operand
    operator: "||"
    right: (call_expression
      function: (identifier) @target.short.circuit.function)) @control.flow.short.circuit.or
] @control.flow.short.circuit

; 函数声明控制流
(declaration
  (function_declarator
    declarator: (identifier) @source.function.name)) @control.flow.function.declaration

; 递归函数调用控制流
(call_expression
  function: (identifier) @target.recursive.function
  arguments: (argument_list
    (_)* @source.parameter)) @control.flow.recursive.call
`;