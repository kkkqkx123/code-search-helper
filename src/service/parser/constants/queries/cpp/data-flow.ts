/*
C++ Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 对象成员赋值数据流
(assignment_expression
  left: (field_expression
    object: (identifier) @source.object
    field: (field_identifier) @source.field)
  right: (identifier) @target.variable) @data.flow.member.assignment

; 指针解引用赋值数据流
(assignment_expression
  left: (dereference_expression
    operand: (identifier) @source.pointer)
  right: (identifier) @target.variable) @data.flow.pointer.assignment

; 数组元素赋值数据流
(assignment_expression
  left: (subscript_expression
    argument: (identifier) @source.array
    index: (identifier) @source.index)
  right: (identifier) @target.variable) @data.flow.array.assignment

; 函数参数传递数据流
(call_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call_expression
  function: (field_expression
    object: (identifier) @target.object
    field: (field_identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 对象成员返回数据流
(return_statement
  (field_expression
    object: (identifier) @source.object
    field: (field_identifier) @source.field)) @data.flow.member.return

; 指针解引用返回数据流
(return_statement
  (dereference_expression
    operand: (identifier) @source.pointer)) @data.flow.pointer.return

; 引用返回数据流
(return_statement
  (reference_expression
    operand: (identifier) @source.variable)) @data.flow.reference.return

; 构造函数调用数据流
(call_expression
  function: (qualified_identifier
    scope: (identifier) @target.class
    name: (identifier) @target.constructor)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.constructor.parameter

; 模板函数调用数据流
(call_expression
  function: (template_function
    function: (identifier) @target.template.function)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.template.parameter

; 链式调用数据流
(call_expression
  function: (field_expression
    object: (call_expression) @source.call
    field: (field_identifier) @target.method)) @data.flow.chained.call

; 移动语义数据流
(call_expression
  function: (identifier) @target.move.function
  arguments: (argument_list
    (identifier) @source.moved.variable))
  (#match? @target.move.function "^(move|forward)$") @data.flow.move

; 智能指针数据流
(assignment_expression
  left: (identifier) @source.smart.pointer
  right: (call_expression
    function: (qualified_identifier
      scope: (identifier) @smart.pointer.type
      name: (identifier) @make.function)
    arguments: (argument_list
      (identifier) @target.parameter)))
  (#match? @smart.pointer.type "^(unique_ptr|shared_ptr|make_unique|make_shared)$") @data.flow.smart.pointer

; 类型转换数据流
(cast_expression
  value: (identifier) @source.variable
  type: (type_identifier) @target.type) @data.flow.cast.flow

; 静态转换数据流
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @static.cast)
  arguments: (argument_list
    (identifier) @source.variable
    (type_identifier) @target.type))
  (#match? @std.scope "std") @data.flow.static.cast

; 动态转换数据流
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @dynamic.cast)
  arguments: (argument_list
    (identifier) @source.variable
    (type_identifier) @target.type))
  (#match? @std.scope "std") @data.flow.dynamic.cast

; 结构化绑定数据流
(declaration
  declarator: (structured_binding_declarator
    (identifier) @target.binding)
  value: (identifier) @source.variable) @data.flow.structured.binding

; 初始化列表数据流
(call_expression
  function: (qualified_identifier
    scope: (identifier) @target.class
    name: (identifier) @target.constructor)
  arguments: (argument_list
    (initializer_list
      (identifier) @source.parameter))) @data.flow.initializer.list

; Lambda捕获数据流
(lambda_expression
  body: (compound_statement
    (expression_statement
      (identifier) @captured.variable))
  capture_list: (capture_list
    (capture_default
      (identifier) @capture.source))) @data.flow.lambda.capture

; 范围for循环数据流
(range_based_for_statement
  declarator: (identifier) @target.variable
  range: (identifier) @source.range) @data.flow.range.for

; STL容器操作数据流
(call_expression
  function: (field_expression
    object: (identifier) @source.container
    field: (field_identifier) @container.method)
  arguments: (argument_list
    (identifier) @target.parameter))
  (#match? @container.method "^(push_back|push_front|insert|emplace|emplace_back|emplace_front)$") @data.flow.container.insert

; STL容器获取数据流
(call_expression
  function: (field_expression
    object: (identifier) @source.container
    field: (field_identifier) @container.method)
  arguments: (argument_list))
  (#match? @container.method "^(front|back|at|operator\\[\\])$") @data.flow.container.access

; 迭代器数据流
(call_expression
  function: (field_expression
    object: (identifier) @source.container
    field: (field_identifier) @iterator.method)
  arguments: (argument_list))
  (#match? @iterator.method "^(begin|end|rbegin|rend|cbegin|cend)$") @data.flow.iterator

; 流操作数据流
(call_expression
  function: (field_expression
    object: (identifier) @source.stream
    field: (field_identifier) @stream.method)
  arguments: (argument_list
    (identifier) @target.parameter))
  (#match? @stream.method "^(operator<<|operator>>)$") @data.flow.stream.operation
`;