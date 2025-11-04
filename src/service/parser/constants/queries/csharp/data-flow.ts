/*
C# Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 对象成员赋值数据流
(assignment_expression
  left: (member_access_expression
    expression: (identifier) @source.object
    name: (identifier) @source.field)
  right: (identifier) @target.variable) @data.flow.member.assignment

; 数组元素赋值数据流
(assignment_expression
  left: (element_access_expression
    expression: (identifier) @source.array
    subscript: (bracketed_argument_list
      (argument
        (identifier) @source.index)))
  right: (identifier) @target.variable) @data.flow.array.assignment

; 元组解构赋值数据流
(assignment_expression
  left: (tuple_pattern
    (identifier) @target.variable1)
  left: (tuple_pattern
    (identifier) @target.variable2)
  right: (tuple_expression
    (argument
      (identifier) @source.value1)
    (argument
      (identifier) @source.value2))) @data.flow.tuple.assignment

; 局部变量声明赋值数据流
(local_declaration_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @target.variable
      value: (identifier) @source.variable))) @data.flow.declaration.assignment

; 带类型的局部变量声明赋值数据流
(local_declaration_statement
  (variable_declaration
    type: (identifier) @variable.type
    (variable_declarator
      name: (identifier) @target.variable
      value: (identifier) @source.variable))) @data.flow.typed.declaration.assignment

; 方法调用参数传递数据流
(invocation_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (argument
      (identifier) @source.parameter))) @data.flow.parameter

; 命名参数传递数据流
(invocation_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (argument
      name: (identifier) @parameter.name
      (identifier) @source.parameter))) @data.flow.named.parameter

; 对象创建参数传递数据流
(object_creation_expression
  type: (identifier) @target.class
  arguments: (argument_list
    (argument
      (identifier) @source.parameter))) @data.flow.constructor.parameter

; 方法调用返回值数据流
(invocation_expression
  function: (member_access_expression
    expression: (identifier) @source.object
    name: (identifier) @source.method)
  arguments: (argument_list
    (argument
      (identifier) @source.argument))) @data.flow.method.call

; 属性设置数据流
(assignment_expression
  left: (member_access_expression
    expression: (identifier) @target.object
    name: (identifier) @target.property)
  right: (identifier) @source.value) @data.flow.property.set

; 属性获取数据流
(member_access_expression
  expression: (identifier) @source.object
  name: (identifier) @source.property) @data.flow.property.get

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 条件表达式数据流
(conditional_expression
  condition: (identifier) @source.condition
  consequence: (identifier) @target.consequence
  alternative: (identifier) @target.alternative) @data.flow.conditional

; 空合并赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (binary_expression
    left: (identifier) @left.operand
    right: (identifier) @right.operand
    operator: "??")) @data.flow.null.coalescing

; Lambda表达式数据流
(lambda_expression
  parameters: (parameter_list
    (parameter
      name: (identifier) @source.parameter))
  body: (identifier) @target.result) @data.flow.lambda

; 委托赋值数据流
(assignment_expression
  left: (identifier) @target.delegate
  right: (identifier) @source.function)) @data.flow.delegate.assignment

; 事件订阅数据流
(assignment_expression
  left: (member_access_expression
    expression: (identifier) @target.object
    name: (identifier) @target.event)
  right: (identifier) @source.handler)) @data.flow.event.subscriber

; 类型转换数据流
(cast_expression
  value: (identifier) @source.variable
  type: (identifier) @target.type)) @data.flow.cast

; 显式类型转换数据流
(invocation_expression
  function: (member_access_expression
    expression: (identifier) @source.object
    name: (identifier) @cast.method)
  arguments: (argument_list
    (argument
      (identifier) @source.argument))) @data.flow.explicit.cast

; 泛型方法调用数据流
(invocation_expression
  function: (generic_name
    (identifier) @target.method
    (type_argument_list
      (identifier) @type.argument)))
  arguments: (argument_list
    (argument
      (identifier) @source.argument))) @data.flow.generic.method

; 索引器访问数据流
(element_access_expression
  expression: (identifier) @source.collection
  subscript: (bracketed_argument_list
    (argument
      (identifier) @source.index))) @data.flow.indexer.access

; 三元运算符数据流
(conditional_expression
  condition: (identifier) @source.condition
  consequence: (identifier) @source.consequence
  alternative: (identifier) @source.alternative)) @data.flow.ternary.operator

; using声明数据流
(local_declaration_statement
  (variable_declaration
    type: (identifier) @variable.type
    (variable_declarator
      name: (identifier) @target.resource
      value: (invocation_expression
        function: (identifier) @source.factory)))) @data.flow.using.declaration

; 可空类型处理数据流
(binary_expression
  left: (member_access_expression
    expression: (identifier) @source.nullable
    name: "HasValue")
  right: (identifier) @target.result
  operator: "==") @data.flow.nullable.check

; null条件运算符数据流
(member_access_expression
  expression: (identifier) @source.object
  name: (identifier) @target.property
  operator: "?") @data.flow.null.conditional
`;