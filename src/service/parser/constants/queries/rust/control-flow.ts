/*
Rust Control Flow-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Match表达式查询 - 使用锚点确保精确匹配
(match_expression
  value: (_) @match.value
  body: (match_block
    (match_arm
      pattern: (_) @arm.pattern
      value: (_) @arm.value
      guard: (if_expression)? @arm.guard)*)) @definition.match.expression

; 循环语句查询 - 使用交替模式
[
  (loop_expression
    label: (loop_label)? @loop.label
    body: (block) @loop.body)
  (while_expression
    condition: (_) @while.condition
    body: (block) @while.body)
  (for_expression
    pattern: (_) @for.pattern
    expression: (_) @for.iterable
    body: (block) @for.body)
] @definition.loop.expression

; 条件表达式查询
(if_expression
  condition: (_) @if.condition
  consequence: (_) @if.then
  alternative: (_) @if.else?) @definition.if.expression

; 不安全块查询 - 使用锚点确保精确匹配
(unsafe_block
  body: (block) @unsafe.body) @definition.unsafe.block

; Try表达式查询 - 使用锚点确保精确匹配
(try_expression
  body: (_) @try.body
  (catch_block
    pattern: (_) @catch.pattern
    body: (block) @catch.body)*
  (finally_block
    body: (block) @finally.body)?) @definition.try.expression

; 异步块查询
(async_block
  body: (block) @async.body) @definition.async.block

; 跳转表达式查询 - 使用交替模式
[
  (return_expression
    (expression)? @return.value)
  (break_expression
    (label)? @break.label
    (expression)? @break.value)
  (continue_expression
    (label)? @continue.label)
] @definition.jump.expression

; 块表达式查询
(block
  (statement)*
  (expression)? @block.value) @definition.block.expression

; 括号表达式查询
(parenthesized_expression
  (expression) @parenthesized.value) @definition.parenthesized.expression

; 标签查询 - 使用交替模式
[
  (loop_label
    (lifetime) @loop.label)
  (labeled_expression
      label: (lifetime) @expression.label
      value: (_) @labeled.value)
] @definition.label

; 模式匹配查询 - 使用交替模式
[
  (match_pattern) @pattern.match
  (tuple_pattern) @pattern.tuple
  (struct_pattern) @pattern.struct
  (tuple_struct_pattern) @pattern.tuple_struct
  (slice_pattern) @pattern.slice
  (or_pattern) @pattern.or
  (identifier_pattern) @pattern.identifier
  (wildcard_pattern) @pattern.wildcard
] @definition.pattern

; 守卫条件查询
(match_arm
  guard: (if_expression
    condition: (_) @guard.condition)) @definition.guard

; 生成器表达式查询
(generator_expression
  body: (block) @generator.body) @definition.generator

; 异步生成器表达式查询
(async_generator_expression
  body: (block) @async.generator.body) @definition.async.generator

; 闭包表达式查询
(closure_expression
  parameters: (closure_parameters
    (parameter
      name: (identifier) @closure.param)*)?
  body: (_) @closure.body) @definition.closure

; 异步闭包表达式查询
(async_closure_expression
  parameters: (closure_parameters
    (parameter
      name: (identifier) @async.closure.param)*)?
  body: (_) @async.closure.body) @definition.async.closure

; 范围查询 - 使用交替模式
[
  (range_expression
    start: (_) @range.start
    end: (_) @range.end)
  (range_pattern
    start: (_) @range.start
    end: (_) @range.end)
] @definition.range

; 语句查询 - 使用交替模式
[
  (expression_statement) @statement.expression
  (let_statement) @statement.let
  (const_statement) @statement.const
] @definition.statement
`;