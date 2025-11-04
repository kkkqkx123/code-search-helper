/*
Python Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 类型注解赋值数据流
(annotated_assignment
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.annotated.assignment

; 增强赋值数据流
(augmented_assignment
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.augmented.assignment

; 属性赋值数据流
(assignment
  left: (attribute
    object: (identifier) @source.object
    attribute: (identifier) @source.property)
  right: (identifier) @target.variable) @data.flow.property.assignment

; 下标赋值数据流
(assignment
  left: (subscript
    object: (identifier) @source.object
    index: (identifier) @source.index)
  right: (identifier) @target.variable) @data.flow.subscript.assignment

; 函数调用参数传递数据流
(call
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call
  function: (attribute
    object: (identifier) @target.object
    attribute: (identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 属性返回数据流
(return_statement
  (attribute
    object: (identifier) @source.object
    attribute: (identifier) @source.property)) @data.flow.property.return

; Lambda赋值数据流
(assignment
  left: (identifier) @source.variable
  right: (lambda) @target.lambda) @data.flow.lambda.assignment

; 列表推导式数据流
(assignment
  left: (identifier) @target.variable
  right: (list_comprehension
    (identifier) @source.variable)) @data.flow.list.comprehension

; 字典推导式数据流
(assignment
  left: (identifier) @target.variable
  right: (dictionary_comprehension
    (identifier) @source.variable)) @data.flow.dict.comprehension

; 生成器表达式数据流
(assignment
  left: (identifier) @target.variable
  right: (generator_expression
    (identifier) @source.variable)) @data.flow.generator.expression

; 多重赋值数据流
(assignment
  left: (pattern_list
    (identifier) @target.variable1)
  (pattern_list
    (identifier) @target.variable2)
  right: (identifier) @source.variable) @data.flow.multiple.assignment

; 解包赋值数据流
(assignment
  left: (pattern_list
    (identifier) @target.variable)
  right: (identifier) @source.variable) @data.flow.unpack.assignment
`;