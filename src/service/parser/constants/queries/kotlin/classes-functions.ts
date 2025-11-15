/*
Kotlin Class and Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的类声明查询 - 使用交替模式和谓词过滤
(class_declaration
  name: (simple_identifier) @class.name
  (modifiers
    (class_modifier) @class.modifier)?
  (type_parameters
    (type_parameter
      name: (simple_identifier) @type.param)*)?
  (primary_constructor
    (class_parameters
      (class_parameter
        name: (simple_identifier) @constructor.param)*)?)?
  body: (class_body) @class.body) @definition.class

; 接口和对象声明查询 - 使用交替模式
[
  (class_declaration
    (modifiers
      (class_modifier) @_modifier (#eq? @_modifier "interface"))
    name: (simple_identifier) @interface.name)
  (object_declaration
    name: (simple_identifier) @object.name)
  (companion_object
    name: (simple_identifier)? @companion.name)
] @definition.interface.or.object

; 枚举和注解类查询 - 使用交替模式
[
  (class_declaration
    (modifiers
      (class_modifier) @_modifier (#eq? @_modifier "enum"))
    name: (simple_identifier) @enum.name)
  (class_declaration
    (modifiers
      (class_modifier) @_modifier (#eq? @_modifier "annotation"))
    name: (simple_identifier) @annotation.name)
] @definition.enum.or.annotation

; 统一的函数声明查询 - 使用交替模式
[
  (function_declaration
    name: (simple_identifier) @function.name
    (modifiers
      (function_modifier) @function.modifier)*
    (type_parameters
      (type_parameter
        name: (simple_identifier) @type.param)*)?
    (function_value_parameters
      (function_value_parameter
        name: (simple_identifier) @param.name)*)?
    (type) @return.type?
    (function_body) @function.body?)
  (function_declaration
    (type) @receiver.type
    name: (simple_identifier) @extension.function)
] @definition.function

; 类型别名查询
(type_alias
  name: (simple_identifier) @type.alias.name
  type: (type) @type.alias.type) @definition.type.alias

; 泛型约束查询 - 使用量词操作符
(type_constraints
  (type_constraint
    (simple_identifier) @constrained.type
    (type) @constraint.type)*) @definition.type.constraints

; 委托说明符查询
(delegation_specifiers
  (user_type
    (simple_identifier) @delegate.type)
  (delegation_specifier
    (simple_identifier) @delegate.by)?) @definition.delegation

; 修饰符查询 - 使用量词操作符
(modifiers
  [
    (class_modifier) @class.modifier
    (function_modifier) @function.modifier
    (property_modifier) @property.modifier
    (inheritance_modifier) @inheritance.modifier
    (parameter_modifier) @parameter.modifier
    (type_modifier) @type.modifier
    (visibility_modifier) @visibility.modifier
  ]+) @definition.modifiers

; 注解查询 - 使用量词操作符
(annotation
  (user_type
    (simple_identifier) @annotation.name)
  (arguments
    (argument
      (simple_identifier) @annotation.arg
      (_)? @annotation.value)*)?) @definition.annotation

; 类型标识符查询 - 使用交替模式
[
  (simple_identifier) @identifier.simple
  (type_identifier) @identifier.type
  (user_type) @identifier.user
] @definition.identifier

; 类型查询 - 使用交替模式
[
  (type) @type.simple
  (nullable_type) @type.nullable
  (function_type) @type.function
  (generic_type) @type.generic
] @definition.type

; 块和语句查询 - 使用交替模式
[
  (block) @structure.block
  (statements) @structure.statements
  (statement) @structure.statement
] @definition.structure

; 表达式查询 - 使用交替模式
[
  (expression) @expression.general
  (call_expression) @expression.call
  (lambda_literal) @expression.lambda
] @definition.expression

; 包和导入查询 - 使用交替模式
[
  (package_header
    (identifier) @package.name)
  (import_header
    (identifier) @import.name)
] @definition.namespace

; 文件结构查询 - 使用交替模式
[
  (kotlinFile) @file.kotlin
  (script) @file.script
  (source_file) @file.source
] @definition.file
`;