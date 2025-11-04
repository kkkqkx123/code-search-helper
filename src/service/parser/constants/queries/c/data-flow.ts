/*
C Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 简单变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 指针解引用赋值数据流
(assignment_expression
  left: (pointer_expression
    argument: (identifier) @source.pointer)
  right: (identifier) @target.variable) @data.flow.pointer.assignment

; 结构体字段赋值数据流
(assignment_expression
  left: (field_expression
    argument: (identifier) @source.struct
    field: (field_identifier) @source.field)
  right: (identifier) @target.variable) @data.flow.field.assignment

; 数组元素赋值数据流
(assignment_expression
  left: (subscript_expression
    argument: (identifier) @source.array
    index: (identifier) @source.index)
  right: (identifier) @target.variable) @data.flow.array.assignment

; 复合赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (binary_expression
    left: (identifier) @target.variable1
    operator: ["+" "-" "*" "/" "%" "&" "|" "^" "<<" ">>"]
    right: (identifier) @target.variable2)) @data.flow.compound.assignment

; 增量/减量赋值数据流
(update_expression
  argument: (identifier) @source.variable
  operator: ["++" "--"]) @data.flow.increment.assignment

; 函数调用参数传递数据流
(call_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 函数指针调用参数传递数据流
(call_expression
  function: (pointer_expression
    argument: (identifier) @target.function.pointer)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.function.pointer.parameter

; 结构体方法调用参数传递数据流
(call_expression
  function: (field_expression
    argument: (identifier) @target.object
    field: (field_identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 返回表达式数据流
(return_statement
  (binary_expression
    left: (identifier) @source.variable1
    operator: ["+" "-" "*" "/" "%" "&" "|" "^" "<<" ">>"]
    right: (identifier) @source.variable2)) @data.flow.return.expression

; 返回指针解引用数据流
(return_statement
  (pointer_expression
    argument: (identifier) @source.pointer)) @data.flow.return.pointer

; 返回结构体字段数据流
(return_statement
  (field_expression
    argument: (identifier) @source.struct
    field: (field_identifier) @source.field)) @data.flow.return.field

; 返回数组元素数据流
(return_statement
  (subscript_expression
    argument: (identifier) @source.array
    index: (identifier) @source.index)) @data.flow.return.array

; 函数指针赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.function.pointer) @data.flow.function.pointer.assignment

; 结构体初始化数据流
(init_declarator
  declarator: (identifier) @target.variable
  value: (initializer_list
    (identifier) @source.variable)) @data.flow.struct.initialization

; 数组初始化数据流
(init_declarator
  declarator: (array_declarator
    declarator: (identifier) @target.array)
  value: (initializer_list
    (identifier) @source.variable)) @data.flow.array.initialization

; 指针赋值数据流
(assignment_expression
  left: (pointer_declarator
    declarator: (identifier) @target.pointer)
  right: (identifier) @source.variable) @data.flow.pointer.assignment

; 地址赋值数据流
(assignment_expression
  left: (identifier) @target.pointer
  right: (pointer_expression
    argument: (identifier) @source.variable)) @data.flow.address.assignment

; 条件表达式数据流
(assignment_expression
  left: (identifier) @target.variable
  right: (conditional_expression
    condition: (identifier) @source.condition
    consequence: (identifier) @source.consequence
    alternative: (identifier) @source.alternative)) @data.flow.conditional.assignment

; sizeof表达式数据流
(assignment_expression
  left: (identifier) @target.variable
  right: (sizeof_expression
    argument: (identifier) @source.variable)) @data.flow.sizeof.assignment

; 类型转换数据流
(assignment_expression
  left: (identifier) @target.variable
  right: (cast_expression
    type: (type_descriptor)
    value: (identifier) @source.variable)) @data.flow.cast.assignment

; 链式字段访问数据流
(assignment_expression
  left: (field_expression
    argument: (field_expression
      argument: (identifier) @source.struct
      field: (field_identifier) @source.field1)
    field: (field_identifier) @source.field2)
  right: (identifier) @target.variable) @data.flow.chained.field.assignment

; 链式数组访问数据流
(assignment_expression
  left: (subscript_expression
    argument: (subscript_expression
      argument: (identifier) @source.array
      index: (identifier) @source.index1)
    index: (identifier) @source.index2)
  right: (identifier) @target.variable) @data.flow.chained.array.assignment

; 宏调用参数传递数据流
(call_expression
  function: (identifier) @target.macro
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.macro.parameter

; 逗号表达式数据流
(assignment_expression
  left: (identifier) @target.variable
  right: (comma_expression
    left: (identifier) @source.variable1
    right: (identifier) @source.variable2)) @data.flow.comma.assignment
`;