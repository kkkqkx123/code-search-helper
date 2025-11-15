/*
Go Expression and Control Flow-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 类型操作查询 - 使用交替模式
[
  (type_assertion_expression) @expression.type_assertion
  (type_conversion_expression) @expression.type_conversion
] @definition.type.operation

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

; 复合字面量查询 - 使用参数化模式
(composite_literal
  type: (_) @literal.type
  body: (literal_value
    (literal_element
      (identifier) @element.value)*)) @definition.composite.literal

; 切片和索引表达式查询 - 使用交替模式
[
  (slice_expression
    operand: (identifier) @slice.array
    low: (_)? @slice.low
    high: (_)? @slice.high)
  (index_expression
    operand: (identifier) @index.array
    index: (identifier) @index.value)
] @definition.collection.access

; 控制流语句查询 - 使用交替模式
[
  (if_statement) @control.if
  (for_statement) @control.for
  (switch_statement) @control.switch
  (select_statement) @control.select
] @definition.control.flow

; 分支语句查询 - 使用交替模式
[
  (expression_case) @branch.case
  (default_case) @branch.default
  (type_case) @branch.type.case
] @definition.control.branch

; 跳转语句查询 - 使用交替模式
[
  (return_statement) @jump.return
  (break_statement) @jump.break
  (continue_statement) @jump.continue
  (go_to_statement) @jump.goto
  (fallthrough_statement) @jump.fallthrough
] @definition.control.jump

; 延迟和协程语句查询 - 使用交替模式
[
  (defer_statement) @async.defer
  (go_statement) @async.go
] @definition.async.operation

; 二元和一元表达式查询 - 使用交替模式
[
  (binary_expression
    left: (_) @binary.left
    operator: (_) @binary.op
    right: (_) @binary.right)
  (unary_expression
    operator: (_) @unary.op
    operand: (_) @unary.operand)
] @definition.expression.operation

; 增减语句查询 - 使用交替模式
[
  (inc_statement
    operand: (identifier) @inc.var)
  (dec_statement
    operand: (identifier) @dec.var)
] @definition.update.operation

; 字面量查询 - 使用交替模式
[
  (interpreted_string_literal) @literal.string
  (raw_string_literal) @literal.raw_string
  (int_literal) @literal.int
  (float_literal) @literal.float
  (imaginary_literal) @literal.imaginary
  (rune_literal) @literal.rune
  (true) @literal.true
  (false) @literal.false
  (nil) @literal.nil
] @definition.literal

; 通道操作查询 - 使用交替模式
[
  (send_statement
    channel: (identifier) @channel.send
    value: (identifier) @channel.value)
  (unary_expression
    ["<-"] @receive.op
    operand: (identifier) @channel.receive)
] @definition.channel.operation

; 块和表达式语句查询 - 使用交替模式
[
  (block) @structure.block
  (expression_statement) @statement.expression
] @definition.structure

; 限定类型查询 - 使用锚点确保精确匹配
(qualified_type
  package: (package_identifier) @qualified.package
  name: (type_identifier) @qualified.name) @definition.qualified.type

; 数组和切片类型查询 - 使用交替模式
[
  (array_type
    length: (_) @array.length
    element: (_) @array.element)
  (slice_type
    element: (_) @slice.element)
] @definition.collection.type

; 映射和函数类型查询 - 使用交替模式
[
  (map_type
    key: (_) @map.key
    value: (_) @map.value)
  (function_type
    parameters: (parameter_list) @func.params
    result: (_)? @func.result)
] @definition.complex.type

; 指针类型查询
(pointer_type
  element: (_) @pointer.element) @definition.pointer.type

; 标签语句查询
(labeled_statement
  label: (label_name) @label.name
  statement: (_) @label.statement) @definition.labeled.statement
`;