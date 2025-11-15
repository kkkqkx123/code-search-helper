/*
Kotlin Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系 - 使用参数化查询
(call_expression
  function: (simple_identifier) @instantiated.class
  arguments: (value_arguments
    (simple_identifier) @constructor.param)*) @lifecycle.instantiation

; 构造函数调用关系 - 使用锚点确保精确匹配
(primary_constructor
  (class_parameters
    (class_parameter
      name: (simple_identifier) @constructor.param)*)*) @lifecycle.constructor.call

; 初始化块关系 - 使用交替模式
[
  (init_block
    (block) @init.block)
  (companion_object
    name: (simple_identifier) @companion.name
    body: (class_body
      (init_block
        (block) @companion.init.block)))
] @lifecycle.initialization

; 对象声明（单例）关系
(object_declaration
  name: (simple_identifier) @singleton.object) @lifecycle.singleton.creation

; 延迟初始化关系 - 使用谓词过滤
(property_declaration
  name: (simple_identifier) @lazy.property
  (modifiers
    (annotation
      name: (simple_identifier) @lazy.annotation
      (#match? @lazy.annotation "^lazy$")))
  (property_delegate
    (lambda_literal) @lazy.initializer)) @lifecycle.lazy.initialization

; 延迟初始化委托关系 - 使用谓词过滤
(property_declaration
  name: (simple_identifier) @lateinit.property
  (modifiers
    (annotation
      name: (simple_identifier) @lateinit.annotation
      (#match? @lateinit.annotation "^lateinit$")))) @lifecycle.lateinit

; 资源获取方法关系 - 使用谓词过滤
(function_declaration
  name: (simple_identifier) @acquire.method
  return_type: (user_type
    (simple_identifier) @resource.type)
  (#match? @acquire.method "^(acquire|open|start|connect|lock|borrow|getResource)$")) @lifecycle.resource.acquisition

; 资源释放方法关系 - 使用谓词过滤
(function_declaration
  name: (simple_identifier) @release.method
  (#match? @release.method "^(release|close|stop|disconnect|unlock|returnResource|dispose)$")) @lifecycle.resource.release

; 集合初始化关系 - 使用谓词过滤
(call_expression
  function: (simple_identifier) @collection.constructor
  arguments: (value_arguments
    (simple_identifier) @collection.param)*
  (#match? @collection.constructor "^(listOf|setOf|mapOf|arrayOf|mutableListOf|mutableSetOf|mutableMapOf)$")) @lifecycle.collection.initialization

; 文件操作生命周期 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @file.object
    right: (simple_identifier) @file.method)
  arguments: (value_arguments
    (simple_identifier) @file.param)*
  (#match? @file.method "^(open|create|delete|close|flush)$")) @lifecycle.file.operation

; 数据库连接生命周期 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @database.manager
    right: (simple_identifier) @database.method)
  arguments: (value_arguments
    (simple_identifier) @database.param)*
  (#match? @database.method "^(getConnection|closeConnection|commit|rollback)$")) @lifecycle.database.connection

; 网络连接生命周期 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @network.client
    right: (simple_identifier) @network.method)
  arguments: (value_arguments
    (simple_identifier) @network.param)*
  (#match? @network.method "^(connect|disconnect|close|send|receive)$")) @lifecycle.network.connection

; 协程生命周期 - 使用谓词过滤
(call_expression
  function: (simple_identifier) @coroutine.method
  arguments: (value_arguments
    (lambda_literal) @coroutine.handler)*
  (#match? @coroutine.method "^(launch|async|runBlocking|withContext)$")) @lifecycle.coroutine.creation

; 协程取消关系 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @coroutine.job
    right: (simple_identifier) @cancel.method)
  (#match? @cancel.method "^cancel$")) @lifecycle.coroutine.cancel

; 流生命周期 - 使用谓词过滤
(call_expression
  function: (navigation_expression
    left: (simple_identifier) @flow.object
    right: (simple_identifier) @flow.method)
  arguments: (value_arguments
    (lambda_literal) @flow.handler)*
  (#match? @flow.method "^(flow|channelFlow|callbackFlow)$")) @lifecycle.flow.creation

; 异常处理生命周期 - 使用锚点确保精确匹配
(try_expression
  body: (block) @exception.try.block
  (catch_block
    (simple_identifier) @exception.parameter
    (block) @exception.cleanup.block)*) @lifecycle.exception.handling

; 自动资源管理关系 - 使用谓词过滤
(property_declaration
  name: (simple_identifier) @auto.resource
  (modifiers
    (annotation
      name: (simple_identifier) @use.annotation
      (#match? @use.annotation "^use$")))
  (property_delegate
    (simple_identifier) @resource.delegate)) @lifecycle.auto.resource
`;