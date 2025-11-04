/*
C# Control Flow-specific Tree-Sitter Query Patterns
用于追踪控制流关系和条件分支
*/
export default `
; if语句控制流
(if_statement
  condition: (identifier) @source.condition
  consequence: (block) @target.consequence
  alternative: (block) @target.alternative) @control.flow.conditional

; else if语句控制流
(elseif_clause
  condition: (identifier) @source.condition
  consequence: (block) @target.consequence) @control.flow.elseif

; switch语句控制流
(switch_statement
  value: (identifier) @source.switch.value
  (switch_body
    (switch_section
      (case_switch_label
        (identifier) @case.value)
      (block) @target.case.block))) @control.flow.switch

; switch表达式控制流
(switch_expression
  (identifier) @source.switch.value
  (switch_expression_arm
    (identifier) @case.pattern
    (identifier) @target.result)) @control.flow.switch.expression

; while循环控制流
(while_statement
  condition: (identifier) @source.loop.condition
  body: (block) @target.loop.body) @control.flow.while

; do-while循环控制流
(do_statement
  body: (block) @source.loop.body
  condition: (identifier) @target.loop.condition) @control.flow.do.while

; for循环控制流
(for_statement
  initializer: (local_declaration_statement
    (variable_declaration
      (variable_declarator
        name: (identifier) @source.loop.initializer)))
  condition: (identifier) @source.loop.condition
  update: (identifier) @source.loop.update
  body: (block) @target.loop.body) @control.flow.for

; foreach循环控制流
(foreach_statement
  type: (identifier) @loop.variable.type
  left: (identifier) @source.loop.variable
  right: (identifier) @source.loop.collection
  body: (block) @target.loop.body) @control.flow.foreach

; continue语句控制流
(continue_statement) @control.flow.continue

; break语句控制流
(break_statement) @control.flow.break

; goto语句控制流
(goto_statement
  label: (identifier) @target.label) @control.flow.goto

; 标签语句控制流
(labeled_statement
  label: (identifier) @source.label) @control.flow.label

; try-catch控制流
(try_statement
  body: (block) @source.try.body
  (catch_clause
    (catch_declaration
      type: (identifier) @exception.type
      name: (identifier) @exception.name)
    body: (block) @target.catch.body)) @control.flow.try.catch

; try-catch-finally控制流
(try_statement
  body: (block) @source.try.body
  (catch_clause
    (catch_declaration
      type: (identifier) @exception.type
      name: (identifier) @exception.name)
    body: (block) @target.catch.body)
  (finally_clause
    body: (block) @target.finally.body)) @control.flow.try.catch.finally

; 多个catch子句控制流
(try_statement
  body: (block) @source.try.body
  (catch_clause
    (catch_declaration
      type: (identifier) @exception.type1
      name: (identifier) @exception.name1)
    body: (block) @target.catch.body1)
  (catch_clause
    (catch_declaration
      type: (identifier) @exception.type2
      name: (identifier) @exception.name2)
    body: (block) @target.catch.body2)) @control.flow.multiple.catch

; throw语句控制流
(throw_statement
  (identifier) @source.throw.exception)) @control.flow.throw

; throw表达式控制流
(throw_expression
  (identifier) @source.throw.exception)) @control.flow.throw.expression

; lock语句控制流
(lock_statement
  (identifier) @source.lock.object
  body: (block) @target.lock.body) @control.flow.lock

; using语句控制流
(using_statement
  body: (block) @target.using.body
  (identifier) @source.using.resource)) @control.flow.using.statement

; using声明控制流
(local_declaration_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @source.using.declaration
      value: (identifier) @source.resource))) @control.flow.using.declaration

; 异步await控制流
(await_expression
  (identifier) @source.await.expression)) @control.flow.await

; 异步方法控制流
(method_declaration
  (modifier) @async.modifier
  name: (identifier) @async.method.name
  body: (block) @target.async.body) @control.flow.async.method

; Lambda表达式控制流
(lambda_expression
  parameters: (parameter_list
    (parameter
      name: (identifier) @source.lambda.parameter))
  body: (block) @target.lambda.body) @control.flow.lambda

; 匿名方法控制流
(anonymous_method_expression
  parameters: (parameter_list
    (parameter
      name: (identifier) @source.anonymous.parameter))
  body: (block) @target.anonymous.body) @control.flow.anonymous.method

; 委托控制流
(assignment_expression
  left: (identifier) @target.delegate
  right: (lambda_expression
    parameters: (parameter_list
      (parameter
        name: (identifier) @source.delegate.parameter))
    body: (block) @target.delegate.body))) @control.flow.delegate

; 事件控制流
(assignment_expression
  left: (member_access_expression
    expression: (identifier) @target.event.object
    name: (identifier) @target.event.name)
  right: (lambda_expression
    parameters: (parameter_list
      (parameter
        name: (identifier) @source.event.parameter))
    body: (block) @target.event.handler))) @control.flow.event

; yield return控制流
(yield_statement
  (identifier) @source.yield.value)) @control.flow.yield.return

; yield break控制流
(yield_statement) @control.flow.yield.break

; 异常过滤器控制流
(catch_clause
  (catch_filter_clause
    (binary_expression
      left: (identifier) @source.filter.variable
      right: (identifier) @target.filter.expression))) @control.flow.exception.filter

; when条件开关控制流
(switch_statement
  (switch_body
    (switch_section
      (case_switch_label
        (identifier) @case.value))
      (when_clause
        (binary_expression
          left: (identifier) @source.when.condition
          right: (identifier) @target.when.expression))
      (block) @target.when.body))) @control.flow.when.switch

; LINQ查询控制流
(query_expression
  (from_clause
    type: (identifier) @source.linq.type
    left: (identifier) @source.linq.variable
    source: (identifier) @source.linq.collection))
  (select_clause
    (identifier) @target.linq.result))) @control.flow.linq

; 模式匹配is控制流
(is_pattern_expression
  expression: (identifier) @source.is.expression
  pattern: (type_pattern
    type: (identifier) @target.is.type)) @control.flow.pattern.matching

; 模式匹配switch控制流
(switch_statement
  value: (identifier) @source.pattern.switch
  (switch_body
    (switch_section
      (case_switch_label
        (declaration_pattern
          type: (identifier) @pattern.type
          name: (identifier) @pattern.name))
      (block) @target.pattern.body))) @control.flow.pattern.switch
`;