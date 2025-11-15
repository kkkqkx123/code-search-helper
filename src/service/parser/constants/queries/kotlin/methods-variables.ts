/*
Kotlin Method and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的函数声明查询 - 使用交替模式和谓词过滤
(function_declaration
  name: (simple_identifier) @function.name
  (modifiers
    (function_modifier) @function.modifier)*
  (type_parameters
    (type_parameter
      name: (simple_identifier) @type.param)*)?
  (function_value_parameters
    (function_value_parameter
      name: (simple_identifier) @param.name
      type: (_) @param.type)*)?
  (type) @return.type?
  (function_body) @function.body?) @definition.function

; 扩展函数查询 - 使用锚点确保精确匹配
(function_declaration
  (type) @receiver.type
  name: (simple_identifier) @extension.function) @definition.extension.function

; 属性声明查询 - 使用参数化模式
(property_declaration
  (variable_declaration
    name: (simple_identifier) @property.name)
  type: (_) @property.type?
  (expression) @property.initializer?
  (getter) @property.getter?
  (setter) @property.setter?) @definition.property

; 变量声明查询 - 使用交替模式
[
  (variable_declaration
    name: (simple_identifier) @var.name
    type: (_) @var.type?
    value: (_) @var.value?)
  (multi_variable_declaration
    (variable_declaration
      name: (simple_identifier) @multi.var.name)+)
] @definition.variable

; 函数调用查询 - 使用参数化模式
(call_expression
  function: [
    (simple_identifier) @call.function
    (navigation_expression
      left: (_) @call.receiver
      right: (simple_identifier) @call.method)
  ]
  type_arguments: (type_arguments
    (type) @type.arg)*
  value_arguments: (value_arguments
    (expression) @call.arg)*) @definition.function.call

; 安全调用查询
(safe_call_expression
  receiver: (_) @safe.receiver
  (navigation_suffix
    (simple_identifier) @safe.method)
  arguments: (value_arguments
    (expression) @safe.arg)*) @definition.safe.call

; Elvis表达式查询
(elvis_expression
  left: (expression) @elvis.condition
  right: (expression) @elvis.value)) @definition.elvis.expression

; 类型转换查询 - 使用交替模式
[
  (as_expression
    value: (_) @cast.value
    type: (type) @cast.type)
  (is_expression
    value: (_) @is.value
    type: (type) @is.type)
] @definition.type.operation

; 类型参数查询 - 使用量词操作符
(type_parameters
  (type_parameter
    name: (simple_identifier) @type.param)*) @definition.type.parameters

; 类型约束查询 - 使用量词操作符
(type_constraints
  (type_constraint
    (simple_identifier) @constrained.type
    (type) @constraint.type)*) @definition.type.constraints

; 注解查询 - 使用量词操作符
(annotation
  (user_type
    (simple_identifier) @annotation.name)
  (arguments
    (argument
      (simple_identifier) @annotation.arg
      (_)? @annotation.value)*)?) @definition.annotation

; 修饰符查询 - 使用量词操作符
(modifiers
  [
    (function_modifier) @function.modifier
    (property_modifier) @property.modifier
    (visibility_modifier) @visibility.modifier
    (inheritance_modifier) @inheritance.modifier
    (parameter_modifier) @parameter.modifier
    (type_modifier) @type.modifier
  ]+) @definition.modifiers

; 导入查询 - 使用交替模式
[
  (import_header
    (identifier) @import.name)
  (import_header
    (identifier) @import.alias
    (identifier) @import.name)
] @definition.import

; 包声明查询
(package_header
  (identifier) @package.name) @definition.package

; 类型查询 - 使用交替模式
[
  (type) @type.simple
  (nullable_type) @type.nullable
  (function_type) @type.function
  (user_type) @type.user
  (generic_type) @type.generic
] @definition.type

; 表达式查询 - 使用交替模式
[
  (expression) @expression.general
  (binary_expression) @expression.binary
  (unary_expression) @expression.unary
  (parenthesized_expression) @expression.parenthesized
] @definition.expression

; 字面量查询 - 使用交替模式
[
  (string_literal) @literal.string
  (character_literal) @literal.char
  (integer_literal) @literal.int
  (float_literal) @literal.float
  (true) @literal.true
  (false) @literal.false
  (null_literal) @literal.null
] @definition.literal

; 块和语句查询 - 使用交替模式
[
  (block) @structure.block
  (function_body) @structure.function.body
  (class_body) @structure.class.body
  (statements) @structure.statements
  (statement) @structure.statement
] @definition.structure

; 标识符查询
(simple_identifier) @definition.identifier
`;