/*
Java Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系
(object_creation_expression
  type: (type_identifier) @instantiated.class
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation

; 构造函数定义
(constructor_declaration
  name: (identifier) @constructor.method
  parameters: (formal_parameters
    (formal_parameter
      name: (identifier) @constructor.parameter))) @lifecycle.relationship.constructor.definition

; 初始化块
(class_declaration
  name: (identifier) @initialized.class
  body: (class_body
    (instance_initializer
      (block) @init.block))) @lifecycle.relationship.initialization.block

; 静态初始化块
(class_declaration
  name: (identifier) @static.initialized.class
  body: (class_body
    (static_initializer
      (block) @static.init.block))) @lifecycle.relationship.static.initialization

; 析构方法（finalize）
(method_declaration
  name: (identifier) @destructor.method
  (#match? @destructor.method "finalize$")
  parameters: (formal_parameters)) @lifecycle.relationship.destructor.definition

; AutoCloseable接口实现
(class_declaration
  name: (identifier) @closeable.class
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @auto.closeable.interface
      (#match? @auto.closeable.interface "AutoCloseable$")))) @lifecycle.relationship.auto.closeable

; Close方法实现
(method_declaration
  name: (identifier) @close.method
  (#match? @close.method "close$")
  parameters: (formal_parameters)) @lifecycle.relationship.close.method

; 生命周期注解方法
(method_declaration
  name: (identifier) @lifecycle.method
  (annotation
    name: (identifier) @lifecycle.annotation
    (#match? @lifecycle.annotation "^(PostConstruct|PreDestroy|Initialized|Destroyed)$"))) @lifecycle.relationship.annotated.method

; Spring生命周期注解
(method_declaration
  name: (identifier) @spring.lifecycle.method
  (annotation
    name: (identifier) @spring.annotation
    (#match? @spring.annotation "^(PostConstruct|PreDestroy|Bean|Component)$"))) @lifecycle.relationship.spring.lifecycle

; 事件监听器方法
(method_declaration
  name: (identifier) @event.listener.method
  (annotation
    name: (identifier) @event.annotation
    (#match? @event.annotation "^(EventListener|Subscribe|Handle)$"))) @lifecycle.relationship.event.listener

; 资源获取方法
(method_declaration
  name: (identifier) @acquire.method
  (#match? @acquire.method "^(acquire|open|start|connect|init)$")
  return_type: (type_identifier) @resource.type) @lifecycle.relationship.resource.acquisition

; 资源释放方法
(method_declaration
  name: (identifier) @release.method
  (#match? @release.method "^(release|close|stop|disconnect|cleanup|destroy)$")) @lifecycle.relationship.resource.release

; 线程生命周期
(method_declaration
  name: (identifier) @thread.lifecycle.method
  (#match? @thread.lifecycle.method "^(start|run|stop|interrupt|join)$")) @lifecycle.relationship.thread.lifecycle

; 事务生命周期
(method_declaration
  name: (identifier) @transaction.method
  (annotation
    name: (identifier) @transaction.annotation
    (#match? @transaction.annotation "^(Transactional|Begin|Commit|Rollback)$"))) @lifecycle.relationship.transaction.lifecycle

; 缓存生命周期
(method_declaration
  name: (identifier) @cache.method
  (annotation
    name: (identifier) @cache.annotation
    (#match? @cache.annotation "^(CacheEvict|CachePut|Cacheable)$"))) @lifecycle.relationship.cache.lifecycle
`;