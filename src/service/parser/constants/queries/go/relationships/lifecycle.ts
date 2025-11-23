/*
Go Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系 - 使用参数化查询
(composite_literal
  type: [
    (type_identifier) @instantiated.type
    (struct_type) @instantiated.struct
    (slice_type) @instantiated.slice
    (map_type) @instantiated.map
    (array_type) @instantiated.array
  ]
  body: (literal_value
    (literal_element
      (identifier) @constructor.param)*)) @lifecycle.instantiation

; 函数调用实例化关系 - 使用谓词过滤
(call_expression
  function: (identifier) @constructor.function
  arguments: (argument_list
    (identifier) @constructor.param)*)
  (#match? @constructor.function "^(New|Create|Make|Open|Connect|Start)$")) @lifecycle.function.instantiation

; 初始化关系查询 - 使用交替模式
[
  (var_declaration
    (var_spec
      name: (identifier) @initialized.var
      value: (identifier) @initial.value))
  (short_var_declaration
    left: (expression_list
      (identifier) @initialized.var)
    right: (expression_list
      (identifier) @initial.value))
] @lifecycle.variable.initialization

; 常量初始化关系
(const_declaration
  (const_spec
    name: (identifier) @initialized.const
    value: (identifier) @initial.value)) @lifecycle.constant.initialization

; 资源获取关系 - 使用谓词过滤
(call_expression
  function: [
    (identifier) @acquire.function
    (selector_expression
      operand: (identifier) @acquire.object
      field: (field_identifier) @acquire.method)
  ]
  arguments: (argument_list
    (identifier) @acquire.param)*)
  (#match? @acquire.function "^(Open|Connect|Start|Acquire|Lock|Dial|Listen)$")) @lifecycle.resource.acquisition

; 资源释放关系 - 使用谓词过滤
(call_expression
  function: [
    (identifier) @release.function
    (selector_expression
      operand: (identifier) @release.object
      field: (field_identifier) @release.method)
  ]
  arguments: (argument_list
    (identifier) @release.param)*)
  (#match? @release.function "^(Close|Stop|Release|Unlock|Disconnect|Shutdown)$")) @lifecycle.resource.release

; 文件操作生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @file.object
    field: (field_identifier) @file.method)
  arguments: (argument_list
    (identifier) @file.param)*)
  (#match? @file.method "^(Open|Close|Read|Write|Seek|Sync)$")) @lifecycle.file.operation

; 网络连接生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @network.object
    field: (field_identifier) @network.method)
  arguments: (argument_list
    (identifier) @network.param)*)
  (#match? @network.method "^(Dial|Listen|Accept|Close|Read|Write)$")) @lifecycle.network.operation

; 数据库连接生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @database.object
    field: (field_identifier) @database.method)
  arguments: (argument_list
    (identifier) @database.param)*)
  (#match? @database.method "^(Open|Close|Exec|Query|Begin|Commit|Rollback)$")) @lifecycle.database.operation

; HTTP服务器生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @http.object
    field: (field_identifier) @http.method)
  arguments: (argument_list
    (identifier) @http.param)*)
  (#match? @http.method "^(ListenAndServe|Serve|Shutdown|Close)$")) @lifecycle.http.operation

; 定时器生命周期 - 使用谓词过滤
(call_expression
  function: [
    (identifier) @timer.function
    (selector_expression
      operand: (identifier) @timer.object
      field: (field_identifier) @timer.method)
  ]
  arguments: (argument_list
    (identifier) @timer.param)*)
  (#match? @timer.function "^(NewTimer|AfterFunc|NewTicker|Stop|Reset)$")) @lifecycle.timer.operation

; 通道生命周期 - 使用谓词过滤
(call_expression
  function: [
    (identifier) @channel.function
    (selector_expression
      operand: (identifier) @channel.object
      field: (field_identifier) @channel.method)
  ]
  arguments: (argument_list
    (identifier) @channel.param)*)
  (#match? @channel.function "^(make|close|send|receive)$")) @lifecycle.channel.operation

; 锁生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @lock.object
    field: (field_identifier) @lock.method)
  arguments: (argument_list
    (identifier) @lock.param)*)
  (#match? @lock.method "^(Lock|Unlock|RLock|RUnlock)$")) @lifecycle.lock.operation

; WaitGroup生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @waitgroup.method)
  arguments: (argument_list
    (identifier) @waitgroup.param)*)
  (#match? @waitgroup.method "^(Add|Done|Wait)$")) @lifecycle.waitgroup.operation

; Context生命周期 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @context.object
    field: (field_identifier) @context.method)
  arguments: (argument_list
    (identifier) @context.param)*)
  (#match? @context.method "^(WithCancel|WithTimeout|WithDeadline|Cancel)$")) @lifecycle.context.operation

; 协程生命周期 - 使用谓词过滤
(go_statement
  (call_expression
    function: (identifier) @goroutine.function
    arguments: (argument_list
      (identifier) @goroutine.param)*)) @lifecycle.goroutine.creation

; 延迟执行生命周期
(defer_statement
  (call_expression
    function: (identifier) @deferred.function
    arguments: (argument_list
      (identifier) @deferred.param)*)) @lifecycle.deferred.operation
`;