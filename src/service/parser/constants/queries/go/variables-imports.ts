/*
Go Variable and Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的变量声明查询 - 使用交替模式
[
  (var_declaration
    (var_spec
      name: (identifier) @var.name
      type: (_)? @var.type
      value: (_)? @var.value))
  (short_var_declaration
    left: (expression_list
      (identifier) @short_var.name)
    right: (expression_list
      (identifier) @short_var.value))
] @definition.variable

; 常量声明查询
(const_declaration
  (const_spec
    name: (identifier) @const.name
    type: (_)? @const.type
    value: (_)? @const.value)) @definition.constant

; 包声明查询 - 使用锚点确保精确匹配
(package_clause
  name: (package_identifier) @package.name) @definition.package

; 导入声明查询 - 使用量词操作符
(import_declaration
  (import_spec
    path: (interpreted_string_literal) @import.path
    name: (_)? @import.name)*) @definition.import

; 字段声明查询 - 使用交替模式
[
  (field_declaration
    name: (field_identifier) @field.name
    type: (_) @field.type)
  (field_declaration
    type: (type_identifier) @embedded.field)
] @definition.field

; 参数声明查询 - 使用量词操作符
(parameter_declaration
  name: (identifier) @param.name
  type: (_) @param.type) @definition.parameter

; 可变参数声明查询
(variadic_parameter_declaration
  name: (identifier) @variadic.name
  type: (_) @variadic.type) @definition.variadic

; 类型标识符查询 - 使用交替模式
[
  (type_identifier) @type.identifier
  (package_identifier) @package.identifier
  (field_identifier) @field.identifier
] @definition.identifier

; 表达式查询 - 使用交替模式
[
  (identifier) @expression.identifier
  (selector_expression
    operand: (identifier) @selector.object
    field: (field_identifier) @selector.field)
  (index_expression
    operand: (identifier) @index.array
    index: (identifier) @index.value)
] @definition.expression

; 字面量查询 - 使用交替模式
[
  (interpreted_string_literal) @literal.string
  (int_literal) @literal.int
  (float_literal) @literal.float
  (true) @literal.true
  (false) @literal.false
  (nil) @literal.nil
] @definition.literal

; 注释查询
(comment) @definition.comment

; 特殊标识符查询 - 使用谓词过滤
(identifier) @blank.identifier
  (#eq? @blank.identifier "_")

(identifier) @iota.identifier
  (#eq? @iota.identifier "iota")
`;