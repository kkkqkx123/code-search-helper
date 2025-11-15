/*
Java Method and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的方法声明查询 - 使用交替模式
[
  (method_declaration
    name: (identifier) @method.name)
  (constructor_declaration
    name: (identifier) @constructor.name)
] @definition.method

; 带参数的方法查询 - 使用量词操作符
(method_declaration
  name: (identifier) @method.name
  parameters: (formal_parameters
    (formal_parameter
      name: (identifier) @param.name
      type: (_) @param.type)*)
  body: (block) @method.body) @definition.method.with_params

; Lambda表达式查询 - 使用锚点确保精确匹配
(lambda_expression
  parameters: (lambda_parameters
    (identifier) @lambda.param)*
  body: (_) @lambda.body) @definition.lambda

; 变量声明查询 - 使用交替模式
[
  (local_variable_declaration
    declarator: (variable_declarator
      name: (identifier) @local.var.name)
    type: (_) @local.var.type)
  (field_declaration
    declarator: (variable_declarator
      name: (identifier) @field.name)
    type: (_) @field.type)
] @definition.variable

; 带初始化的变量声明
(local_variable_declaration
  declarator: (variable_declarator
    name: (identifier) @var.name
    value: (_) @var.value)
  type: (_) @var.type) @definition.variable.with.initializer

; 导入声明查询 - 使用交替模式
[
  (import_declaration
    (scoped_identifier) @import.name)
  (import_declaration
    (identifier) @import.static
    (asterisk) @import.wildcard)
] @definition.import

; 类型参数查询 - 使用量词操作符
(type_parameters
  (type_parameter
    name: (identifier) @type.param)*) @definition.type.parameters

; 注解查询 - 使用交替模式
[
  (annotation
    name: (identifier) @annotation.name)
  (marker_annotation
    name: (identifier) @marker.annotation)
] @definition.annotation

; 方法调用查询 - 使用参数化模式
(method_invocation
  name: [
    (identifier) @method.name
    (field_access
      field: (identifier) @method.field)
  ]
  arguments: (argument_list
    (identifier) @method.arg)*
  type_arguments: (type_arguments
    (type_identifier) @type.arg)*) @definition.method.call

; 对象创建查询 - 使用参数化模式
(object_creation_expression
  type: (type_identifier) @created.type
  arguments: (argument_list
    (identifier) @constructor.arg)*
  type_arguments: (type_arguments
    (type_identifier) @type.arg)*) @definition.object.creation

; 泛型类型查询 - 使用量词操作符
(generic_type
  (type_arguments
    (type_identifier) @generic.arg)+) @definition.generic.type

; 数组类型查询 - 使用量词操作符
(array_type
  (type_identifier) @array.element
  (dimensions) @array.dims) @definition.array.type

; 形式参数查询 - 使用量词操作符
(formal_parameters
  (formal_parameter
    name: (identifier) @param.name
    type: (_) @param.type)*) @definition.parameters

; 变量声明器查询
(variable_declarator
  name: (identifier) @var.name
  value: (_) @var.value?) @definition.variable.declarator

; 类型标识符查询 - 使用交替模式
[
  (type_identifier) @type.simple
  (scoped_type_identifier) @type.qualified
  (integral_type) @type.integral
  (floating_point_type) @type.float
  (boolean_type) @type.boolean
  (void_type) @type.void
] @definition.type.identifier

; 表达式查询 - 使用交替模式
[
  (assignment_expression
    left: (identifier) @assign.target
    right: (identifier) @assign.source)
  (binary_expression
    left: (_) @binary.left
    operator: (_) @binary.op
    right: (_) @binary.right)
  (unary_expression
    operator: (_) @unary.op
    operand: (_) @unary.operand)
  (instanceof_expression
    expression: (identifier) @instanceof.expr
    type: (type_identifier) @instanceof.type)
] @definition.expression

; 字面量查询 - 使用交替模式
[
  (string_literal) @literal.string
  (character_literal) @literal.char
  (decimal_integer_literal) @literal.int
  (hex_integer_literal) @literal.hex
  (decimal_floating_point_literal) @literal.float
  (hex_floating_point_literal) @literal.hex.float
  (true) @literal.true
  (false) @literal.false
  (null_literal) @literal.null
] @definition.literal

; 特殊表达式查询 - 使用交替模式
[
  (this) @expr.this
  (super) @expr.super
  (class_literal
    type: (type_identifier) @class.literal.type)
] @definition.special.expression
`;