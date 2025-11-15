/*
Kotlin Constructor and Property-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的构造函数查询 - 使用交替模式
[
  (primary_constructor
    (class_parameters
      (class_parameter
        name: (simple_identifier) @param.name
        type: (_) @param.type)*)?)
  (secondary_constructor
    (function_value_parameters
      (function_value_parameter
        name: (simple_identifier) @param.name
        type: (_) @param.type)*)*)
] @definition.constructor

; 构造函数参数查询 - 使用谓词过滤
(class_parameter
  name: (simple_identifier) @param.name
  (modifiers
    (parameter_modifier) @param.modifier)?
  type: (_) @param.type
  value: (_) @param.value?) @definition.constructor.parameter

; 属性声明查询 - 使用参数化模式
(property_declaration
  (variable_declaration
    name: (simple_identifier) @property.name)
  type: (_) @property.type?
  (expression) @property.initializer?
  (getter) @property.getter?
  (setter) @property.setter?
  (property_delegate) @property.delegate?) @definition.property

; 属性修饰符查询 - 使用谓词过滤
(property_declaration
  (modifiers
    (property_modifier) @property.modifier)
  (variable_declaration
    name: (simple_identifier) @property.name))
  (#match? @property.modifier "^(val|var|lateinit|const)$")) @definition.property.with.modifier

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

; Lambda参数查询
(lambda_parameter
  name: (simple_identifier) @lambda.param) @definition.lambda.parameter

; 函数值参数查询 - 使用量词操作符
(function_value_parameters
  (function_value_parameter
    name: (simple_identifier) @param.name
    type: (_) @param.type
    value: (_) @param.value?)*) @definition.function.parameters

; Getter和Setter查询 - 使用交替模式
[
  (getter
    (function_body) @getter.body)
  (setter
    (function_body) @setter.body)
] @definition.property.accessor

; 属性委托查询
(property_delegate
  (expression) @delegate.expression) @definition.property.delegate

; 修饰符查询 - 使用量词操作符
(modifiers
  [
    (property_modifier) @property.modifier
    (parameter_modifier) @parameter.modifier
    (visibility_modifier) @visibility.modifier
    (inheritance_modifier) @inheritance.modifier
  ]+) @definition.modifiers

; 注解查询
(annotation
  (user_type
    (simple_identifier) @annotation.name)
  (arguments
    (argument
      (simple_identifier) @annotation.arg
      (_)? @annotation.value)*)?) @definition.annotation

; 类型查询 - 使用交替模式
[
  (type) @type.simple
  (nullable_type) @type.nullable
  (function_type) @type.function
  (user_type) @type.user
] @definition.type

; 表达式查询 - 使用交替模式
[
  (expression) @expression.general
  (call_expression) @expression.call
  (lambda_literal) @expression.lambda
] @definition.expression

; 块和语句查询 - 使用交替模式
[
  (block) @structure.block
  (function_body) @structure.function.body
  (class_body) @structure.class.body
] @definition.structure

; 标识符查询
(simple_identifier) @definition.identifier
`;