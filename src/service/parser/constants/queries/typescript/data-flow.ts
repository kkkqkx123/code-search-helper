/*
TypeScript Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
基于JavaScript数据流查询，添加TypeScript特有功能
*/
export default `
; 变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 对象属性赋值数据流
(assignment_expression
  left: (member_expression
    object: (identifier) @source.object
    property: (property_identifier) @source.property)
  right: (identifier) @target.variable) @data.flow.property.assignment

; 数组元素赋值数据流
(assignment_expression
  left: (subscript_expression
    object: (identifier) @source.array
    index: (identifier) @source.index)
  right: (identifier) @target.variable) @data.flow.array.assignment

; 函数参数传递数据流
(call_expression
  function: (identifier) @target.function
  arguments: (arguments
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call_expression
  function: (member_expression
    object: (identifier) @target.object
    property: (property_identifier) @target.method)
  arguments: (arguments
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 对象属性返回数据流
(return_statement
  (member_expression
    object: (identifier) @source.object
    property: (property_identifier) @source.property)) @data.flow.property.return

; 函数表达式赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (function_expression) @target.function) @data.flow.function.assignment

; 箭头函数赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (arrow_function) @target.function) @data.flow.arrow.assignment

; 对象解构赋值数据流
(assignment_expression
  left: (object_pattern
    (pair
      key: (property_identifier) @source.property
      value: (identifier) @target.variable))) @data.flow.destructuring.object

; 数组解构赋值数据流
(assignment_expression
  left: (array_pattern
    (identifier) @target.variable)) @data.flow.destructuring.array

; 链式调用数据流
(call_expression
  function: (member_expression
    object: (call_expression) @source.call
    property: (property_identifier) @target.method)) @data.flow.chained.call

; TypeScript特有的数据流模式

; 类型注解变量赋值数据流
(lexical_declaration
  (variable_declarator
    name: (identifier) @target.variable
    type: (type_annotation) @variable.type
    value: (identifier) @source.variable))) @data.flow.typed.assignment

; 接口属性赋值数据流
(assignment_expression
  left: (member_expression
    object: (identifier) @source.object
    property: (property_identifier) @source.property)
  right: (identifier) @target.variable) @data.flow.interface.property.assignment

; 泛型函数调用参数传递数据流
(call_expression
  function: (generic_type
    name: (identifier) @target.generic.function
    type_arguments: (type_arguments) @type.arguments)
  arguments: (arguments
    (identifier) @source.parameter)) @data.flow.generic.parameter

; 类型断言数据流
(as_expression
  value: (identifier) @source.variable
  type: (type_identifier) @target.type) @data.flow.type.assertion

; 非空断言数据流
(non_null_expression
  value: (identifier) @source.variable) @data.flow.non.null.assertion

; 可选链数据流
(member_expression
  object: (identifier) @source.object
  property: (property_identifier) @target.property
  ?) @data.flow.optional.chain

; 空值合并数据流
(binary_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable
  operator: "??") @data.flow.null.coalescing

; Promise异步数据流
(assignment_expression
  left: (identifier) @target.variable
  right: (await_expression
    value: (identifier) @source.promise))) @data.flow.async.await

; 枚举成员数据流
(member_expression
  object: (identifier) @source.enum
  property: (property_identifier) @source.member)) @data.flow.enum.member

; 命名空间成员数据流
(member_expression
  object: (identifier) @source.namespace
  property: (property_identifier) @target.member)) @data.flow.namespace.member

; 装饰器元数据流
(decorator
  (call_expression
    function: (identifier) @decorator.name
    arguments: (arguments
      (identifier) @decorator.argument))) @data.flow.decorator.metadata

; 类构造函数参数数据流
(class_declaration
  name: (identifier) @target.class
  body: (class_body
    (constructor_definition
      parameters: (formal_parameters
        (required_parameter
          name: (identifier) @source.parameter))))) @data.flow.constructor.parameter

; 类属性初始化数据流
(class_declaration
  name: (identifier) @target.class
  body: (class_body
    (property_definition
      name: (property_identifier) @target.property
      value: (identifier) @source.value)))) @data.flow.property.initialization

; 方法重写数据流
(class_declaration
  name: (identifier) @child.class
  heritage: (heritage_clause
    (type_identifier) @parent.class)
  body: (class_body
    (method_definition
      name: (property_identifier) @overridden.method)))) @data.flow.method.override

; 泛型约束数据流
(type_parameters
  (type_parameter
    name: (type_identifier) @constrained.type
    constraint: (type_identifier) @constraint.type))) @data.flow.generic.constraint
`;