/*
Rust Variable and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 常量声明查询
(const_item
  name: (identifier) @const.name
  type: (_) @const.type
  value: (_) @const.value) @definition.constant

; 静态项声明查询
(static_item
  name: (identifier) @static.name
  type: (_) @static.type
  value: (_) @static.value?
  mutability: (mut)? @static.mutability) @definition.static

; 变量绑定查询 - 使用锚点确保精确匹配
(let_statement
  pattern: (identifier) @variable.name
  type: (type)? @variable.type
  value: (_) @variable.value) @definition.variable

; 赋值表达式查询
(assignment_expression
  left: (identifier) @assign.target
  right: (_) @assign.source) @definition.assignment

; 函数调用查询 - 使用参数化模式
(call_expression
  function: [
    (identifier) @call.function
    (field_expression
      value: (identifier) @call.receiver
      field: (field_identifier) @call.method)
  ]
  arguments: (arguments
    (expression) @call.arg)*
  type_arguments: (type_arguments
    (type_identifier) @type.arg)*) @definition.function.call

; 字段表达式查询 - 使用锚点确保精确匹配
(field_expression
  value: (identifier) @field.object
  field: (field_identifier) @field.name) @definition.field.access

; 二元表达式查询 - 使用锚点确保精确匹配
(binary_expression
  left: (_) @binary.left
  operator: (_) @binary.operator
  right: (_) @binary.right) @definition.binary.expression

; 一元表达式查询 - 使用交替模式
[
  (unary_expression
    operator: (_) @unary.operator
    operand: (_) @unary.operand)
  (update_expression
    operand: (_) @update.operand
    operator: (_) @update.operator)
] @definition.unary.expression

; 类型转换表达式查询
(cast_expression
  value: (_) @cast.value
  type: (type) @cast.type) @definition.cast.expression

; 数组表达式查询
(array_expression
  (expression) @array.element*) @definition.array.expression

; 元组表达式查询
(tuple_expression
  (expression) @tuple.element*) @definition.tuple.expression

; 索引表达式查询 - 使用锚点确保精确匹配
(index_expression
  value: (identifier) @index.array
  index: (_) @index.value) @definition.index.expression

; 范围表达式查询
(range_expression
  start: (_) @range.start
  end: (_) @range.end) @definition.range.expression

; Await表达式查询
(await_expression
  (expression) @awaited.expression) @definition.await.expression

; 类型注解表达式查询
(type_ascription
  value: (identifier) @typed.value
  type: (type) @typed.type) @definition.type.ascription

; 字面量查询 - 使用交替模式
[
  (integer_literal) @literal.integer
  (float_literal) @literal.float
  (string_literal) @literal.string
  (character_literal) @literal.char
  (boolean_literal) @literal.boolean
  (unit_expression) @literal.unit
] @definition.literal

; 引用和解引用查询 - 使用交替模式
[
  (reference_expression
    (identifier) @reference.variable)
  (dereference_expression
    (identifier) @dereference.pointer)
] @definition.pointer.operation

; 错误传播操作符查询
(try_operator) @definition.try.operator

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

; Self和Super关键字查询 - 使用交替模式
[
  (self) @keyword.self
  (super) @keyword.super
] @definition.keyword

; Self参数查询
(self_parameter) @definition.self.parameter

; 泛型函数调用查询 - 使用锚点确保精确匹配
(generic_function
  function: (identifier) @generic.function
  type_arguments: (type_arguments
    (type_identifier) @generic.arg)+)) @definition.generic.call

; 路径表达式查询 - 使用锚点确保精确匹配
(scoped_identifier
  path: (identifier) @path.scope
  name: (identifier) @path.name) @definition.scoped.identifier

; 类型标识符查询 - 使用交替模式
[
  (type_identifier) @type.simple
  (scoped_type_identifier) @type.scoped
] @definition.type.identifier

; 模式查询 - 使用交替模式
[
  (identifier_pattern) @pattern.identifier
  (wildcard_pattern) @pattern.wildcard
  (reference_pattern) @pattern.reference
] @definition.pattern

; 修饰符查询 - 使用量词操作符
(modifiers
  [
    (visibility_modifier) @modifier.visibility
    (const_modifier) @modifier.const
    (async_modifier) @modifier.async
    (unsafe_modifier) @modifier.unsafe
    (extern_modifier) @modifier.extern
  ]+) @definition.modifiers

; 属性查询 - 使用量词操作符
(attribute_item
  (attribute) @attribute.name
  arguments: (token_tree
    (identifier) @attribute.arg)*)*) @definition.attribute
`;