/*
Go Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment_statement
  left: (expression_list
    (identifier) @source.variable)
  right: (expression_list
    (identifier) @target.variable)) @data.flow.assignment

; 短变量声明数据流
(short_var_declaration
  left: (expression_list
    (identifier) @target.variable)
  right: (expression_list
    (identifier) @source.variable)) @data.flow.short.declaration

; 结构体字段赋值数据流
(assignment_statement
  left: (expression_list
    (selector_expression
      operand: (identifier) @source.struct
      field: (field_identifier) @source.field))
  right: (expression_list
    (identifier) @target.variable)) @data.flow.field.assignment

; 数组/切片元素赋值数据流
(assignment_statement
  left: (expression_list
    (index_expression
      operand: (identifier) @source.array
      index: (identifier) @source.index))
  right: (expression_list
    (identifier) @target.variable)) @data.flow.array.assignment

; 函数调用参数传递数据流
(call_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call_expression
  function: (selector_expression
    operand: (identifier) @target.receiver
    field: (field_identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (expression_list
    (identifier) @source.variable)) @data.flow.return

; 结构体字段返回数据流
(return_statement
  (expression_list
    (selector_expression
      operand: (identifier) @source.struct
      field: (field_identifier) @source.field))) @data.flow.field.return

; 函数字面量赋值数据流
(assignment_statement
  left: (expression_list
    (identifier) @source.variable)
  right: (expression_list
    (func_literal) @target.function)) @data.flow.function.assignment

; 闭包捕获数据流
(func_literal
  body: (block
    (expression_statement
      (identifier) @captured.variable))
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @capture.source))) @data.flow.closure.capture

; 范围for循环数据流
(range_clause
  left: (expression_list
    (identifier) @target.variable)
  right: (expression_list
    (identifier) @source.range)) @data.flow.range.for

; 映射元素插入数据流
(call_expression
  function: (selector_expression
    operand: (identifier) @source.map
    field: (field_identifier) @map.method)
  arguments: (argument_list
    (identifier) @target.key
    (identifier) @target.value)
  (#match? @map.method "^(set|put|insert)$")) @data.flow.map.insert

; 映射元素访问数据流
(index_expression
  operand: (identifier) @source.map
  index: (identifier) @source.key) @data.flow.map.access

; 通道发送数据流
(send_statement
  channel: (identifier) @target.channel
  value: (identifier) @source.value) @data.flow.channel.send

; 通道接收数据流
(unary_expression
  operator: "<-" @receive.operator
  operand: (identifier) @source.channel) @data.flow.channel.receive

; 指针解引用数据流
(unary_expression
  operator: "*" @dereference.operator
  operand: (identifier) @source.pointer) @data.flow.pointer.dereference

; 地址获取数据流
(unary_expression
  operator: "&" @address.operator
  operand: (identifier) @source.variable) @data.flow.address.of

; 类型转换数据流
(type_conversion_expression
  type: (type_identifier) @target.type
  operand: (identifier) @source.variable) @data.flow.type.conversion

; 切片操作数据流
(slice_expression
  operand: (identifier) @source.array) @data.flow.slice.operation

; 复合字面量数据流
(composite_literal
  type: (type_identifier) @target.type
  body: (literal_value
    (literal_element
      (identifier) @source.element))) @data.flow.composite.literal

; 映射字面量数据流
(composite_literal
  type: (map_type) @target.map.type
  body: (literal_value
    (keyed_element
      key: (literal_element
        (identifier) @source.key)
      value: (literal_element
        (identifier) @source.value)))) @data.flow.map.literal

; 切片字面量数据流
(composite_literal
  type: (slice_type) @target.slice.type
  body: (literal_value
    (literal_element
      (identifier) @source.element))) @data.flow.slice.literal
`;