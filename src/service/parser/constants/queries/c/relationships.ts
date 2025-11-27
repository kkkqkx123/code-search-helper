export default `

; 5. 数据流与赋值 - 优先级6
[
  ; 赋值表达式
  (assignment_expression
    left: (identifier) @target.variable
    right: (identifier) @source.variable)
  
  ; 初始化器
  (init_declarator
    declarator: (identifier) @target.variable
    value: (identifier) @source.variable)
  
  ; 复合赋值
  (assignment_expression
    left: (identifier) @target.variable
    right: (binary_expression
      left: (identifier) @source.variable1
      operator: ["+" "-" "*" "/"] @compound.operator
      right: (identifier) @source.variable2))
] @data.flow

; 6. 控制流结构 - 优先级5
[
  ; 分支结构
  (if_statement
    condition: (_) @source.condition
    consequence: (statement) @target.if.block
    alternative: (else_clause
      (statement) @target.else.block))
  (switch_statement
    condition: (_) @source.switch.variable
    body: (compound_statement) @target.switch.block)
  
  ; 循环结构
  (while_statement
    condition: (_) @source.while.condition
    body: (statement) @target.while.block)
  (for_statement
    initializer: (_)? @source.for.init
    condition: (_) @source.for.condition
    update: (_)? @source.for.update
    body: (_) @target.for.block)
  
  ; 跳转语句
  (break_statement)
  (continue_statement)
  (return_statement
    (_)? @source.return.variable)
] @control.flow

; 7. 并发原语操作 - 优先级4
[
  ; 线程操作
  (call_expression
    function: (identifier) @thread.create.function
    (#match? @thread.create.function "^(pthread_create)$")
    arguments: (argument_list
      (identifier) @thread.handle
      (_) @thread.attributes
      (identifier) @thread.function
      (_) @thread.argument))
  (call_expression)
    function: (identifier) @thread.wait.function
    (#match? @thread.wait.function "^(pthread_join)$")
    arguments: (argument_list
      (identifier) @thread.handle)
  
  ; 同步机制
  (call_expression)
    function: (identifier) @mutex.operation.function
    (#match? @mutex.operation.function "^(pthread_mutex_lock|pthread_mutex_unlock)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @mutex.handle))
  (call_expression)
    function: (identifier) @cond.operation.function
    (#match? @cond.operation.function "^(pthread_cond_wait|pthread_cond_signal)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @cond.handle))
] @concurrency.relationship

; 8. 生命周期管理 - 优先级3
[
  ; 内存管理
  (call_expression
    function: (identifier) @allocation.function
    (#match? @allocation.function "^(malloc|calloc)$")
    arguments: (argument_list
      (_) @allocation.size))
  (call_expression
    function: (identifier) @deallocation.function
    (#match? @deallocation.function "^(free)$")
    arguments: (argument_list
      (identifier) @deallocated.pointer))
  
  ; 文件操作
  (call_expression
    function: (identifier) @file.open.function
    (#match? @file.open.function "^(fopen|open)$")
    arguments: (argument_list
      (string_literal) @file.path
      (_) @file.mode))
  (call_expression
    function: (identifier) @file.close.function
    (#match? @file.close.function "^(fclose|close)$")
    arguments: (argument_list
      (identifier) @file.handle))
] @lifecycle.relationship

; 9. 注解与属性 - 优先级2
[
  (attribute_declaration
    (attribute
      name: (identifier) @annotation.name
      arguments: (argument_list
        (_) @annotation.argument)*))
  
  (type_definition
    (attribute
      name: (identifier) @annotation.name
      arguments: (argument_list
        (_) @annotation.argument)*)?)
  
  (declaration
    (attribute
      name: (identifier) @annotation.name
      arguments: (argument_list
        (_) @annotation.argument)*)?)
] @annotation.relationship

; 10. 引用关系 - 优先级1
[
  (identifier) @reference.variable
  (#not-match? @reference.variable "^(if|for|while|do|switch|break|continue|return)$")
  
  (field_expression
    argument: (identifier) @reference.object
    field: (field_identifier) @reference.field)
  
  (call_expression
    function: (identifier) @reference.function)
] @reference.relationship
`;