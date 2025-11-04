/*
JavaScript Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
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
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call_expression
  function: (member_expression
    object: (identifier) @target.object
    property: (property_identifier) @target.method)
  arguments: (argument_list
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
`;