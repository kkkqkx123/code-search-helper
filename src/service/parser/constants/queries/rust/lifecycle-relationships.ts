/*
Rust Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 结构体实例化关系
(struct_expression
  type: (type_identifier) @instantiated.struct
  (field_initializer_list
    (field_initializer
      value: (identifier) @constructor.parameter))) @lifecycle.relationship.struct.instantiation

; 元组结构体实例化关系
(tuple_expression
  type: (type_identifier) @instantiated.tuple_struct
  (arguments
    (identifier) @constructor.parameter)) @lifecycle.relationship.tuple_struct.instantiation

; 构造函数定义关系
(function_item
  name: (identifier) @constructor.method
  (#match? @constructor.method "^new$")
  parameters: (parameters
    (parameter
      pattern: (identifier) @constructor.parameter))
  return_type: (type_identifier) @constructed.type) @lifecycle.relationship.constructor.definition

; 默认构造函数
(function_item
  name: (identifier) @default.constructor
  (#match? @default.constructor "^default$")
  return_type: (type_identifier) @default.type) @lifecycle.relationship.default.constructor

; 复制构造函数
(function_item
  name: (identifier) @copy.constructor
  (#match? @copy.constructor "^clone$")
  parameters: (parameters
    (parameter
      pattern: (identifier) @source.object))
  return_type: (type_identifier) @copied.type) @lifecycle.relationship.copy.constructor

; Drop trait实现（析构函数）
(impl_item
  trait: (type_identifier) @drop.trait
  (#match? @drop.trait "^Drop$")
  type: (type_identifier) @drop.type
  body: (declaration_list
    (function_item
      name: (identifier) @drop.method
      (#match? @drop.method "^drop$")))) @lifecycle.relationship.drop.implementation

; 资源获取方法
(function_item
  name: (identifier) @acquire.method
  (#match? @acquire.method "^(acquire|open|start|connect|lock|borrow)$")
  return_type: (type_identifier) @resource.type) @lifecycle.relationship.resource.acquisition

; 资源释放方法
(function_item
  name: (identifier) @release.method
  (#match? @release.method "^(release|close|stop|disconnect|unlock|drop)$")) @lifecycle.relationship.resource.release

; 内存分配关系
(call_expression
  function: (identifier) @allocator.function
  (#match? @allocator.function "^(alloc|Box::new|Vec::new|String::new)$")
  arguments: (arguments
    (identifier) @allocation.parameter)) @lifecycle.relationship.memory.allocation

; 内存释放关系
(call_expression
  function: (identifier) @deallocator.function
  (#match? @deallocator.function "^(free|drop|clear|reset)$")
  arguments: (arguments
    (identifier) @deallocation.target)) @lifecycle.relationship.memory.deallocation

; 智能指针创建
(call_expression
  function: (scoped_identifier
    path: (identifier) @smart_ptr.namespace
    name: (identifier) @smart_ptr.constructor)
  (#match? @smart_ptr.constructor "^(Box|Rc|Arc|RefCell|Mutex|RwLock)$")
  arguments: (arguments
    (identifier) @smart_ptr.parameter)) @lifecycle.relationship.smart_ptr.creation

; 智能指针销毁
(call_expression
  function: (field_expression
    value: (identifier) @smart_ptr.object
    field: (field_identifier) @smart_ptr.method)
  (#match? @smart_ptr.method "^(drop|into_raw|into_inner)$")) @lifecycle.relationship.smart_ptr.destruction

; 迭代器生命周期
(function_item
  name: (identifier) @iterator.method
  (#match? @iterator.method "^(iter|into_iter|drain)$")
  return_type: (type_identifier) @iterator.type) @lifecycle.relationship.iterator.creation

; 迭代器消耗
(call_expression
  function: (field_expression
    value: (identifier) @iterator.object
    field: (field_identifier) @iterator.method)
  (#match? @iterator.method "^(next|collect|fold|for_each)$")) @lifecycle.relationship.iterator.consumption

; 异步生命周期
(async_block
  body: (block
    (await_expression
      (call_expression) @async.operation))) @lifecycle.relationship.async.creation

; 异步资源管理
(call_expression
  function: (identifier) @async.method
  (#match? @async.method "^(spawn|join|select|timeout)$")
  arguments: (arguments
    (closure_expression) @async.handler)) @lifecycle.relationship.async.resource

; 线程生命周期
(call_expression
  function: (scoped_identifier
    path: (identifier) @thread.namespace
    name: (identifier) @thread.method)
  (#match? @thread.method "^(spawn|current|sleep|yield_now)$")
  arguments: (arguments
    (closure_expression) @thread.handler)) @lifecycle.relationship.thread.lifecycle

; 通道生命周期
(call_expression
  function: (scoped_identifier
    path: (identifier) @channel.namespace
    name: (identifier) @channel.method)
  (#match? @channel.method "^(channel|Sender|Receiver)$")) @lifecycle.relationship.channel.creation

; 生命周期参数
(lifetime
  (identifier) @lifetime.parameter) @lifecycle.relationship.lifetime.parameter

; 生命周期约束
(where_predicate
  left: (lifetime
    (identifier) @constrained.lifetime)
  bounds: (trait_bounds
    (lifetime
      (identifier) @lifetime.bound))) @lifecycle.relationship.lifetime.constraint

; 静态生命周期
(lifetime
  (identifier) @static.lifetime
  (#match? @static.lifetime "^'static$")) @lifecycle.relationship.static.lifetime
`;