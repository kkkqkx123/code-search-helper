/*
Kotlin Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 类实例化关系
(call_expression
  left: (simple_identifier) @instantiated.class
  right: (value_arguments
    (simple_identifier) @constructor.parameter)) @lifecycle.relationship.instantiation

; 构造函数调用关系
(primary_constructor
  (function_value_parameters
    (function_value_parameter
      (simple_identifier) @constructor.parameter))) @lifecycle.relationship.constructor.call

; 次级构造函数
(secondary_constructor
  (function_value_parameters
    (function_value_parameter
      (simple_identifier) @constructor.parameter))) @lifecycle.relationship.secondary.constructor

; 初始化块
(init_block
  body: (block) @init.block) @lifecycle.relationship.init.block

; 伴生对象初始化
(companion_object
  name: (simple_identifier) @companion.name
  body: (class_body
    (init_block
      body: (block) @companion.init.block))) @lifecycle.relationship.companion.init

; 对象声明（单例）
(object_declaration
  name: (simple_identifier) @singleton.object) @lifecycle.relationship.singleton.creation

; 延迟初始化
(property_declaration
  name: (simple_identifier) @lazy.property
  (modifiers
    (annotation
      name: (simple_identifier) @lazy.annotation
      (#match? @lazy.annotation "^lazy$")))
  body: (property_delegate
    (lambda_literal) @lazy.initializer)) @lifecycle.relationship.lazy.initialization

; 延迟初始化委托
(property_declaration
  name: (simple_identifier) @lateinit.property
  (modifiers
    (annotation
      name: (simple_identifier) @lateinit.annotation
      (#match? @lateinit.annotation "^lateinit$")))) @lifecycle.relationship.lateinit

; 资源获取方法
(function_declaration
  name: (simple_identifier) @acquire.method
  (#match? @acquire.method "^(acquire|open|start|connect|lock|borrow|getResource)$")
  return_type: (user_type
    (simple_identifier) @resource.type)) @lifecycle.relationship.resource.acquisition

; 资源释放方法
(function_declaration
  name: (simple_identifier) @release.method
  (#match? @release.method "^(release|close|stop|disconnect|unlock|returnResource|dispose)$")) @lifecycle.relationship.resource.release

; 内存管理
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @memory.manager
    right: (simple_identifier) @memory.method)
  (#match? @memory.method "^(gc|finalize|clear|reset)$")
  right: (value_arguments
    (simple_identifier) @memory.target)) @lifecycle.relationship.memory.management

; 集合初始化
(call_expression
  left: (simple_identifier) @collection.constructor
  (#match? @collection.constructor "^(listOf|setOf|mapOf|arrayOf|mutableListOf|mutableSetOf|mutableMapOf)$")
  right: (value_arguments
    (simple_identifier) @collection.parameter)) @lifecycle.relationship.collection.initialization

; 集合清理
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @collection.object
    right: (simple_identifier) @collection.method)
  (#match? @collection.method "^(clear|remove|removeAll|retainAll)$")
  right: (value_arguments
    (simple_identifier) @collection.target)) @lifecycle.relationship.collection.cleanup

; 字符串构建
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @string.builder
    right: (simple_identifier) @string.method)
  (#match? @string.method "^(append|insert|delete|clear|toString)$")
  right: (value_arguments
    (simple_identifier) @string.parameter)) @lifecycle.relationship.string.building

; 文件操作生命周期
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @file.object
    right: (simple_identifier) @file.method)
  (#match? @file.method "^(open|create|delete|close|flush)$")
  right: (value_arguments
    (simple_identifier) @file.parameter)) @lifecycle.relationship.file.operation

; 数据库连接生命周期
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @database.manager
    right: (simple_identifier) @database.method)
  (#match? @database.method "^(getConnection|closeConnection|commit|rollback)$")
  right: (value_arguments
    (simple_identifier) @database.parameter)) @lifecycle.relationship.database.connection

; 网络连接生命周期
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @network.client
    right: (simple_identifier) @network.method)
  (#match? @network.method "^(connect|disconnect|close|send|receive)$")
  right: (value_arguments
    (simple_identifier) @network.parameter)) @lifecycle.relationship.network.connection

; 协程生命周期
(call_expression
  left: (simple_identifier) @coroutine.method
  (#match? @coroutine.method "^(launch|async|runBlocking|withContext)$")
  right: (value_arguments
    (lambda_literal) @coroutine.handler)) @lifecycle.relationship.coroutine.creation

; 协程取消
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @coroutine.job
    right: (simple_identifier) @cancel.method)
  (#match? @cancel.method "^cancel$")) @lifecycle.relationship.coroutine.cancel

; 协程作用域
(call_expression
  left: (simple_identifier) @scope.method
  (#match? @scope.method "^coroutineScope$")
  right: (value_arguments
    (lambda_literal) @scope.handler)) @lifecycle.relationship.coroutine.scope

; 流生命周期
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @flow.object
    right: (simple_identifier) @flow.method)
  (#match? @flow.method "^(flow|channel|produce|consume)$")
  right: (value_arguments
    (lambda_literal) @flow.handler)) @lifecycle.relationship.flow.creation

; 流收集
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @flow.collector
    right: (simple_identifier) @collect.method)
  (#match? @collect.method "^collect$")
  right: (value_arguments
    (lambda_literal) @collect.handler)) @lifecycle.relationship.flow.collection

; 异常处理生命周期
(try_expression
  body: (block) @exception.try.block) @lifecycle.relationship.exception.handling

; 异常清理
(catch_block
  (simple_identifier) @exception.parameter
  body: (block) @exception.cleanup.block) @lifecycle.relationship.exception.cleanup

; 资源管理器
(class_declaration
  name: (simple_identifier) @resource.manager
  body: (class_body
    (function_declaration
      name: (simple_identifier) @resource.method
      (#match? @resource.method "^(use|manage|allocate|deallocate)$")))) @lifecycle.relationship.resource.manager

; 自动资源管理
(property_declaration
  name: (simple_identifier) @auto.resource
  (modifiers
    (annotation
      name: (simple_identifier) @use.annotation
      (#match? @use.annotation "^use$")))
  body: (property_delegate
    (simple_identifier) @resource.delegate)) @lifecycle.relationship.auto.resource
`;