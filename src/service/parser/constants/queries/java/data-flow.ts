/*
Java Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 字段赋值数据流
(assignment_expression
  left: (field_access
    object: (identifier) @source.object
    field: (identifier) @source.field)
  right: (identifier) @target.variable) @data.flow.field.assignment

; 方法调用参数传递数据流
(method_invocation
  name: (identifier) @target.method
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 对象方法调用参数传递数据流
(method_invocation
  function: (field_access
    object: (identifier) @target.object
    field: (identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 字段返回数据流
(return_statement
  (field_access
    object: (identifier) @source.object
    field: (identifier) @source.field)) @data.flow.field.return

; 构造函数调用数据流
(object_creation_expression
  type: (type_identifier) @target.class
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.constructor.parameter

; Lambda表达式赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (lambda_expression) @target.lambda) @data.flow.lambda.assignment

; 泛型方法调用数据流
(method_invocation
  name: (identifier) @target.method
  type_arguments: (type_arguments
    (type_identifier) @type.argument)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.generic.parameter

; 静态方法调用数据流
(method_invocation
  function: (scoped_identifier
    scope: (identifier) @target.class
    name: (identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.static.parameter

; 数组访问数据流
(array_access
  array: (identifier) @source.array
  index: (identifier) @source.index) @data.flow.array.access

; 类型转换数据流
(cast_expression
  value: (identifier) @source.variable
  type: (type_identifier) @target.type) @data.flow.cast.flow
`;