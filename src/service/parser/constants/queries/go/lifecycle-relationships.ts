/*
Go Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系
(composite_literal
  type: (type_identifier) @instantiated.type) @lifecycle.relationship.instantiation

; 结构体字面量实例化关系
(composite_literal
  type: (struct_type) @instantiated.struct) @lifecycle.relationship.struct.instantiation

; 映射字面量实例化关系
(composite_literal
  type: (map_type) @instantiated.map) @lifecycle.relationship.map.instantiation

; 切片字面量实例化关系
(composite_literal
  type: (slice_type) @instantiated.slice) @lifecycle.relationship.slice.instantiation

; 数组字面量实例化关系
(composite_literal
  type: (array_type) @instantiated.array) @lifecycle.relationship.array.instantiation

; 函数调用实例化关系
(call_expression
  function: (identifier) @constructor.function
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.function.call

; 方法调用实例化关系
(call_expression
  function: (selector_expression
    operand: (identifier) @receiver.object
    field: (field_identifier) @constructor.method)
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.method.call

; New函数实例化关系
(call_expression
  function: (identifier) @new.function
  (#match? @new.function "new")
  arguments: (argument_list
    (type_identifier) @allocated.type)) @lifecycle.relationship.new.allocation

; Make函数实例化关系
(call_expression
  function: (identifier) @make.function
  (#match? @make.function "make")
  arguments: (argument_list
    (type_identifier) @constructed.type)) @lifecycle.relationship.make.construction

; 初始化关系
(var_declaration
  (var_spec
    name: (identifier_list
      (identifier) @initialized.variable)
    (expression_list
      (identifier) @initial.value))) @lifecycle.relationship.variable.initialization

; 常量初始化关系
(const_declaration
  (const_spec
    name: (identifier_list
      (identifier) @initialized.constant)
    (expression_list
      (identifier) @initial.value))) @lifecycle.relationship.constant.initialization

; 短变量声明初始化关系
(short_var_declaration
  left: (expression_list
    (identifier) @initialized.variable)
  right: (expression_list
    (identifier) @initial.value)) @lifecycle.relationship.short.declaration.initialization

; 结构体初始化关系
(composite_literal
  type: (type_identifier) @struct.type
  body: (literal_value
    (keyed_element
      key: (literal_element
        (identifier) @field.name)
      value: (literal_element
        (identifier) @field.value)))) @lifecycle.relationship.struct.initialization

; 映射初始化关系
(composite_literal
  type: (map_type) @map.type
  body: (literal_value
    (keyed_element
      key: (literal_element
        (identifier) @key.value)
      value: (literal_element
        (identifier) @map.value)))) @lifecycle.relationship.map.initialization

; 切片初始化关系
(composite_literal
  type: (slice_type) @slice.type
  body: (literal_value
    (literal_element
      (identifier) @element.value))) @lifecycle.relationship.slice.initialization

; 数组初始化关系
(composite_literal
  type: (array_type) @array.type
  body: (literal_value
    (literal_element
      (identifier) @element.value))) @lifecycle.relationship.array.initialization

; 延迟初始化关系
(defer_statement
  (call_expression
    function: (identifier) @cleanup.function)) @lifecycle.relationship.deferred.initialization

; 资源获取关系
(call_expression
  function: (identifier) @resource.acquire.function
  arguments: (argument_list
    (identifier) @resource.parameter)) @lifecycle.relationship.resource.acquisition

; 资源释放关系
(call_expression
  function: (identifier) @resource.release.function
  arguments: (argument_list
    (identifier) @resource.parameter)) @lifecycle.relationship.resource.release

; 文件打开关系
(call_expression
  function: (selector_expression
    operand: (identifier) @file.package
    field: (field_identifier) @open.function)
  (#match? @open.function "Open")
  arguments: (argument_list
    (identifier) @file.path)) @lifecycle.relationship.file.open

; 文件关闭关系
(call_expression
  function: (selector_expression
    operand: (identifier) @file.object
    field: (field_identifier) @close.function)
  (#match? @close.function "Close")
  arguments: (argument_list)) @lifecycle.relationship.file.close

; 网络连接建立关系
(call_expression
  function: (selector_expression
    operand: (identifier) @network.package
    field: (field_identifier) @connect.function)
  (#match? @connect.function "Connect|Dial")
  arguments: (argument_list
    (identifier) @connection.parameter)) @lifecycle.relationship.network.connect

; 网络连接关闭关系
(call_expression
  function: (selector_expression
    operand: (identifier) @connection.object
    field: (field_identifier) @close.function)
  (#match? @close.function "Close")
  arguments: (argument_list)) @lifecycle.relationship.network.close

; 数据库连接建立关系
(call_expression
  function: (selector_expression
    operand: (identifier) @database.package
    field: (field_identifier) @open.function)
  (#match? @open.function "Open")
  arguments: (argument_list
    (identifier) @database.parameter)) @lifecycle.relationship.database.connect

; 数据库连接关闭关系
(call_expression
  function: (selector_expression
    operand: (identifier) @database.object
    field: (field_identifier) @close.function)
  (#match? @close.function "Close")
  arguments: (argument_list)) @lifecycle.relationship.database.close

; HTTP服务器启动关系
(call_expression
  function: (selector_expression
    operand: (identifier) @http.server
    field: (field_identifier) @listen.function)
  (#match? @listen.function "ListenAndServe")
  arguments: (argument_list)) @lifecycle.relationship.http.server.start

; HTTP服务器关闭关系
(call_expression
  function: (selector_expression
    operand: (identifier) @http.server
    field: (field_identifier) @shutdown.function)
  (#match? @shutdown.function "Shutdown|Close")
  arguments: (argument_list)) @lifecycle.relationship.http.server.shutdown

; 定时器创建关系
(call_expression
  function: (identifier) @timer.function
  (#match? @timer.function "NewTimer|AfterFunc")
  arguments: (argument_list
    (identifier) @timer.duration)) @lifecycle.relationship.timer.creation

; 定时器停止关系
(call_expression
  function: (selector_expression
    operand: (identifier) @timer.object
    field: (field_identifier) @stop.function)
  (#match? @stop.function "Stop")
  arguments: (argument_list)) @lifecycle.relationship.timer.stop

; 上下文创建关系
(call_expression
  function: (selector_expression
    operand: (identifier) @context.package
    field: (field_identifier) @context.function)
  (#match? @context.function "WithCancel|WithTimeout|WithDeadline")
  arguments: (argument_list
    (identifier) @parent.context)) @lifecycle.relationship.context.creation

; 上下文取消关系
(call_expression
  function: (selector_expression
    operand: (identifier) @cancel.function
    field: (field_identifier) @cancel.method)
  (#match? @cancel.method "Cancel")
  arguments: (argument_list)) @lifecycle.relationship.context.cancel

; 通道创建关系
(call_expression
  function: (identifier) @make.function
  (#match? @make.function "make")
  arguments: (argument_list
    (channel_type) @channel.type)) @lifecycle.relationship.channel.creation

; 通道关闭关系
(call_expression
  function: (identifier) @close.function
  (#match? @close.function "close")
  arguments: (argument_list
    (identifier) @channel.object)) @lifecycle.relationship.channel.close

; Mutex锁获取关系
(call_expression
  function: (selector_expression
    operand: (identifier) @mutex.object
    field: (field_identifier) @lock.function)
  (#match? @lock.function "Lock")
  arguments: (argument_list)) @lifecycle.relationship.mutex.lock

; Mutex锁释放关系
(call_expression
  function: (selector_expression
    operand: (identifier) @mutex.object
    field: (field_identifier) @unlock.function)
  (#match? @unlock.function "Unlock")
  arguments: (argument_list)) @lifecycle.relationship.mutex.unlock

; RWMutex读锁获取关系
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @read.lock.function)
  (#match? @read.lock.function "RLock")
  arguments: (argument_list)) @lifecycle.relationship.rwmutex.read.lock

; RWMutex读锁释放关系
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @read.unlock.function)
  (#match? @read.unlock.function "RUnlock")
  arguments: (argument_list)) @lifecycle.relationship.rwmutex.read.unlock

; WaitGroup添加关系
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @add.function)
  (#match? @add.function "Add")
  arguments: (argument_list
    (identifier) @counter.value)) @lifecycle.relationship.waitgroup.add

; WaitGroup完成关系
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @done.function)
  (#match? @done.function "Done")
  arguments: (argument_list)) @lifecycle.relationship.waitgroup.done

; WaitGroup等待关系
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @wait.function)
  (#match? @wait.function "Wait")
  arguments: (argument_list)) @lifecycle.relationship.waitgroup.wait

; Once执行关系
(call_expression
  function: (selector_expression
    operand: (identifier) @once.object
    field: (field_identifier) @do.function)
  (#match? @do.function "Do")
  arguments: (argument_list
    (identifier) @once.function)) @lifecycle.relationship.once.execution

; Pool获取关系
(call_expression
  function: (selector_expression
    operand: (identifier) @pool.object
    field: (field_identifier) @get.function)
  (#match? @get.function "Get")
  arguments: (argument_list)) @lifecycle.relationship.pool.get

; Pool放回关系
(call_expression
  function: (selector_expression
    operand: (identifier) @pool.object
    field: (field_identifier) @put.function)
  (#match? @put.function "Put")
  arguments: (argument_list
    (identifier) @pool.object)) @lifecycle.relationship.pool.put
`;