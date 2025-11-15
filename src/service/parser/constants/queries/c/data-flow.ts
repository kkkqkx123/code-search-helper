/*
C Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
Optimized based on tree-sitter best practices
*/
export default `
; 统一的赋值数据流查询 - 使用交替模式
(assignment_expression
  left: [
    (identifier) @target.variable
    (field_expression
      argument: (identifier) @target.object
      field: (field_identifier) @target.field)
    (subscript_expression
      argument: (identifier) @target.array
      index: (identifier) @target.index)
    (pointer_expression
      argument: (identifier) @target.pointer)
  ]
  right: [
    (identifier) @source.variable
    (call_expression
      function: (identifier) @source.function)
    (binary_expression
      left: (_) @binary.left
      right: (_) @binary.right)
    (unary_expression
      argument: (_) @unary.argument)
  ]) @data.flow.assignment

; 复合赋值数据流 - 使用谓词过滤
(assignment_expression
  left: (identifier) @target.variable
  right: (binary_expression
    left: (identifier) @source.variable1
    operator: ["+" "-" "*" "/" "%" "&" "|" "^" "<<" ">>"] @compound.operator
    right: (identifier) @source.variable2)) @data.flow.compound.assignment

; 增量/减量数据流 - 使用交替模式
[
  (update_expression
    argument: (identifier) @variable
    operator: "++") @data.flow.increment
  (update_expression
    argument: (identifier) @variable
    operator: "--") @data.flow.decrement
] @data.flow.update

; 函数调用数据流 - 参数化查询
(call_expression
  function: [
    (identifier) @target.function
    (pointer_expression
      argument: (identifier) @target.function.pointer)
    (field_expression
      argument: (identifier) @target.object
      field: (field_identifier) @target.method)
  ]
  arguments: (argument_list
    (identifier) @source.parameter)+) @data.flow.parameter.passing

; 返回值数据流 - 使用锚点操作符
(return_statement
  .
  [
    (identifier) @source.variable
    (call_expression
      function: (identifier) @source.function)
    (field_expression
      argument: (identifier) @source.object
      field: (field_identifier) @source.field)
    (binary_expression
      left: (_) @binary.left
      right: (_) @binary.right)
  ]) @data.flow.return.value

; 初始化数据流 - 使用交替模式
[
  (init_declarator
    declarator: (identifier) @target.variable
    value: (initializer_list
      (identifier) @source.variable)) @data.flow.struct.initialization
  (init_declarator
    declarator: (array_declarator
      declarator: (identifier) @target.array)
    value: (initializer_list
      (identifier) @source.variable)) @data.flow.array.initialization
] @data.flow.initialization

; 指针操作数据流 - 使用谓词过滤
[
  (assignment_expression
    left: (identifier) @target.pointer
    right: (pointer_expression
      argument: (identifier) @source.variable)) @data.flow.address.assignment
  (assignment_expression
    left: (pointer_expression
      argument: (identifier) @target.pointer)
    right: (identifier) @source.variable) @data.flow.pointer.assignment
] @data.flow.pointer.operation

; 类型转换数据流 - 简化模式
(cast_expression
  type: (type_descriptor) @target.type
  value: (identifier) @source.variable) @data.flow.type.conversion

; 条件表达式数据流 - 使用锚点确保精确匹配
(assignment_expression
  left: (identifier) @target.variable
  right: (conditional_expression
    condition: (identifier) @source.condition
    consequence: (identifier) @source.consequence
    alternative: (identifier) @source.alternative)) @data.flow.conditional.assignment

; 内存操作数据流 - 使用谓词过滤
(call_expression
  function: (identifier) @memory.function
  arguments: (argument_list
    (identifier) @memory.argument)+)
  (#match? @memory.function "^(malloc|calloc|realloc|free|memcpy|memmove|memset)$") @data.flow.memory.operation

; 链式访问数据流 - 使用量词操作符
(assignment_expression
  left: [
    (field_expression
      argument: (field_expression
        argument: (identifier) @source.object
        field: (field_identifier) @source.field1)
      field: (field_identifier) @source.field2))
    (subscript_expression
      argument: (subscript_expression
        argument: (identifier) @source.array
        index: (identifier) @source.index1)
      index: (identifier) @source.index2))
  ]
  right: (identifier) @target.variable) @data.flow.chained.access

; 宏调用数据流 - 使用谓词过滤
(call_expression
  function: (identifier) @macro.function
  arguments: (argument_list
    (identifier) @macro.parameter)+)
  (#not-match? @macro.function "^(malloc|calloc|realloc|free|memcpy|memmove|memset)$") @data.flow.macro.call

; sizeof表达式数据流 - 简化模式
(assignment_expression
  left: (identifier) @target.variable
  right: (sizeof_expression
    argument: (identifier) @source.variable)) @data.flow.sizeof.assignment
`;