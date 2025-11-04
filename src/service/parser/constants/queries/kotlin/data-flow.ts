/*
Kotlin Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment
  left: (simple_identifier) @source.variable
  right: (simple_identifier) @target.variable) @data.flow.assignment

; 类型注解赋值数据流
(assignment
  left: (type_annotation
    (simple_identifier) @source.variable)
  right: (simple_identifier) @target.variable) @data.flow.annotated.assignment

; 属性赋值数据流
(assignment
  left: (navigation_expression
    left: (simple_identifier) @source.object
    right: (simple_identifier) @source.property)
  right: (simple_identifier) @target.variable) @data.flow.property.assignment

; 数组元素赋值数据流
(assignment
  left: (indexing_expression
    left: (simple_identifier) @source.array
    right: (simple_identifier) @source.index)
  right: (simple_identifier) @target.variable) @data.flow.array.assignment

; 函数调用参数传递数据流
(call_expression
  left: (simple_identifier) @target.function
  right: (value_arguments
    (simple_identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @target.object
    right: (simple_identifier) @target.method)
  right: (value_arguments
    (simple_identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_expression
  (simple_identifier) @source.variable) @data.flow.return

; 属性返回数据流
(return_expression
  (navigation_expression
    left: (simple_identifier) @source.object
    right: (simple_identifier) @source.property)) @data.flow.property.return

; Lambda表达式赋值数据流
(assignment
  left: (simple_identifier) @source.variable
  right: (lambda_literal) @target.lambda) @data.flow.lambda.assignment

; 对象表达式数据流
(object_literal
  (simple_identifier) @target.object
  (simple_identifier) @source.value) @data.flow.object.literal

; 解构声明数据流
(destructuring_declaration
  (simple_identifier) @target.variable
  right: (simple_identifier) @source.variable) @data.flow.destructuring.declaration

; 多重赋值数据流
(assignment
  left: (collection_literal
    (simple_identifier) @target.variable1)
  right: (simple_identifier) @source.variable) @data.flow.multiple.assignment

; 安全调用数据流
(safe_call_expression
  left: (navigation_expression
    left: (simple_identifier) @source.object
    right: (simple_identifier) @source.method)
  right: (value_arguments
    (simple_identifier) @source.parameter)) @data.flow.safe.call

; Elvis表达式数据流
(elvis_expression
  left: (simple_identifier) @source.variable
  right: (simple_identifier) @target.variable) @data.flow.elvis

; 类型转换数据流
(as_expression
  left: (simple_identifier) @source.variable
  right: (user_type) @target.type) @data.flow.cast

; 集合操作数据流
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @target.collection
    right: (simple_identifier) @collection.method)
  (#match? @collection.method "^(add|put|set|remove|get)$")
  right: (value_arguments
    (simple_identifier) @source.parameter)) @data.flow.collection.operation

; 字符串操作数据流
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @target.string
    right: (simple_identifier) @string.method)
  (#match? @string.method "^(append|plus|replace|substring)$")
  right: (value_arguments
    (simple_identifier) @source.parameter)) @data.flow.string.operation

; 伴生对象数据流
(companion_object
  name: (simple_identifier) @companion.name
  body: (class_body
    (function_declaration
      name: (simple_identifier) @factory.method
      (#match? @factory.method "^(create|new|getInstance)$")
      return_type: (user_type
        (simple_identifier) @created.type)))) @data.flow.companion.factory

; 扩展函数数据流
(function_declaration
  receiver: (simple_identifier) @extension.receiver
  name: (simple_identifier) @extension.method
  parameters: (function_value_parameters
    (simple_identifier) @extension.parameter)) @data.flow.extension.function

; 数据类解构数据流
(class_declaration
  (modifiers
    (annotation
      name: (simple_identifier) @dataclass.annotation
      (#match? @dataclass.annotation "^data$")))
  name: (simple_identifier) @dataclass.name
  body: (class_body
    (primary_constructor
      (class_parameters
        (class_parameter
          name: (simple_identifier) @dataclass.parameter))))) @data.flow.dataclass.destructuring
`;