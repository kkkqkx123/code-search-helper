/*
Kotlin Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 统一的赋值数据流查询 - 使用交替模式
(assignment
  left: [
    (simple_identifier) @target.variable
    (type_annotation
      (simple_identifier) @target.variable)
    (navigation_expression
      left: (simple_identifier) @target.object
      right: (simple_identifier) @target.property)
    (indexing_expression
      left: (simple_identifier) @target.array
      right: (simple_identifier) @target.index)
  ]
  right: [
    (simple_identifier) @source.variable
    (call_expression
      function: (simple_identifier) @source.function)
    (binary_expression
      left: (_) @binary.left
      right: (_) @binary.right)
    (lambda_literal) @source.lambda
  ]) @data.flow.assignment

; 函数调用参数传递数据流 - 使用参数化查询
(call_expression
  function: [
    (simple_identifier) @target.function
    (navigation_expression
      left: (simple_identifier) @target.object
      right: (simple_identifier) @target.method)
  ]
  arguments: (value_arguments
    (simple_identifier) @source.parameter)+) @data.flow.parameter.passing

; 返回值数据流 - 使用锚点操作符
(return_expression
  .
  [
    (simple_identifier) @source.variable
    (navigation_expression
      left: (simple_identifier) @source.object
      right: (simple_identifier) @source.property)
    (call_expression
      function: (simple_identifier) @source.function)
  ]) @data.flow.return.value

; 解构声明数据流 - 使用量词操作符
(destructuring_declaration
  (variable_declaration
    name: (simple_identifier) @target.variable)+
  right: (simple_identifier) @source.variable)) @data.flow.destructuring.declaration

; 多重赋值数据流
(assignment
  left: (collection_literal
    (simple_identifier) @target.variable+)
  right: (simple_identifier) @source.variable)) @data.flow.multiple.assignment

; 安全调用数据流 - 使用锚点确保精确匹配
(safe_call_expression
  receiver: (navigation_expression
    left: (simple_identifier) @source.object
    right: (simple_identifier) @source.method)
  arguments: (value_arguments
    (simple_identifier) @source.parameter)+) @data.flow.safe.call

; Elvis表达式数据流
(elvis_expression
  left: (simple_identifier) @source.variable
  right: (simple_identifier) @target.variable) @data.flow.elvis

; 类型转换数据流
(as_expression
  left: (simple_identifier) @source.variable
  type: (user_type) @target.type) @data.flow.cast

; 集合操作数据流 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @target.collection
    right: (simple_identifier) @collection.method)
  arguments: (value_arguments
    (simple_identifier) @source.parameter)*)
  (#match? @collection.method "^(add|put|set|remove|get|contains|addAll)$")) @data.flow.collection.operation

; 字符串操作数据流 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @target.string
    right: (simple_identifier) @string.method)
  arguments: (value_arguments
    (simple_identifier) @source.parameter)*)
  (#match? @string.method "^(append|plus|replace|substring|format)$")) @data.flow.string.operation

; 流操作数据流 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @target.stream
    right: (simple_identifier) @stream.method)
  arguments: (value_arguments
    (simple_identifier) @source.parameter)*)
  (#match? @stream.method "^(map|filter|flatMap|collect|reduce|forEach)$")) @data.flow.stream.operation

; 伴生对象工厂数据流 - 使用谓词过滤
(companion_object
  name: (simple_identifier) @companion.name
  body: (class_body
    (function_declaration
      name: (simple_identifier) @factory.method
      return_type: (user_type
        (simple_identifier) @created.type)
      (#match? @factory.method "^(create|new|getInstance)$")))) @data.flow.companion.factory

; 扩展函数数据流 - 使用锚点确保精确匹配
(function_declaration
  receiver: (type
    (simple_identifier) @extension.receiver)
  name: (simple_identifier) @extension.method
  parameters: (function_value_parameters
    (function_value_parameter
      name: (simple_identifier) @extension.parameter)+)) @data.flow.extension.function

; 数据类解构数据流 - 使用谓词过滤
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
          name: (simple_identifier) @dataclass.parameter)+)))) @data.flow.dataclass.destructuring

; 属性委托数据流 - 使用谓词过滤
(property_declaration
  name: (simple_identifier) @delegated.property
  (property_delegate
    (simple_identifier) @delegate.provider)) @data.flow.property.delegation

; 范围循环数据流 - 使用锚点确保精确匹配
(for_statement
  (variable_declaration
    name: (simple_identifier) @target.variable)
  (expression) @source.range
  (block) @loop.body) @data.flow.range.for

; Lambda捕获数据流 - 使用锚点确保精确匹配
(lambda_literal
  parameters: (lambda_parameters
    (variable_declaration
      name: (simple_identifier) @lambda.param)*)
  body: (block
    (expression_statement
      (simple_identifier) @captured.variable))) @data.flow.lambda.capture

; 对象字面量数据流
(object_literal
  (delegation_specifiers
    (user_type
      (simple_identifier) @delegated.type))
  (class_body
    (property_declaration
      name: (simple_identifier) @object.property
      value: (simple_identifier) @object.value)*)) @data.flow.object.literal
`;