/*
Python Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系
(call
  function: (identifier) @instantiated.class
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation

; 构造函数调用关系
(class_definition
  name: (identifier) @constructed.class
  body: (block
    (function_definition
      name: (identifier) @constructor.method
      (#match? @constructor.method "^__init__$")))) @lifecycle.relationship.constructor.definition

; 初始化方法调用
(call
  function: (member_expression
    object: (identifier) @initialized.object
    attribute: (identifier) @init.method
    (#match? @init.method "^(initialize|setup|configure)$"))
  arguments: (argument_list
    (identifier) @init.parameter)) @lifecycle.relationship.object.initialization

; 析构函数定义
(class_definition
  name: (identifier) @destructed.class
  body: (block
    (function_definition
      name: (identifier) @destructor.method
      (#match? @destructor.method "^__del__$")))) @lifecycle.relationship.destructor.definition

; 上下文管理器入口
(class_definition
  name: (identifier) @context.manager.class
  body: (block
    (function_definition
      name: (identifier) @entry.method
      (#match? @entry.method "^__enter__$")))) @lifecycle.relationship.context.entry

; 上下文管理器出口
(class_definition
  name: (identifier) @context.manager.class
  body: (block
    (function_definition
      name: (identifier) @exit.method
      (#match? @exit.method "^__exit__$")))) @lifecycle.relationship.context.exit

; 异步上下文管理器入口
(class_definition
  name: (identifier) @async.context.manager.class
  body: (block
    (function_definition
      name: (identifier) @async.entry.method
      (#match? @async.entry.method "^__aenter__$")))) @lifecycle.relationship.async.context.entry

; 异步上下文管理器出口
(class_definition
  name: (identifier) @async.context.manager.class
  body: (block
    (function_definition
      name: (identifier) @async.exit.method
      (#match? @async.exit.method "^__aexit__$")))) @lifecycle.relationship.async.context.exit

; 迭代器协议入口
(class_definition
  name: (identifier) @iterator.class
  body: (block
    (function_definition
      name: (identifier) @iterator.method
      (#match? @iterator.method "^__iter__$")))) @lifecycle.relationship.iterator.entry

; 迭代器协议出口
(class_definition
  name: (identifier) @iterator.class
  body: (block
    (function_definition
      name: (identifier) @iterator.method
      (#match? @iterator.method "^__next__$")))) @lifecycle.relationship.iterator.exit

; 异步迭代器协议入口
(class_definition
  name: (identifier) @async.iterator.class
  body: (block
    (function_definition
      name: (identifier) @async.iterator.method
      (#match? @async.iterator.method "^__aiter__$")))) @lifecycle.relationship.async.iterator.entry

; 异步迭代器协议出口
(class_definition
  name: (identifier) @async.iterator.class
  body: (block
    (function_definition
      name: (identifier) @async.iterator.method
      (#match? @async.iterator.method "^__anext__$")))) @lifecycle.relationship.async.iterator.exit

; 资源获取方法
(call
  function: (member_expression
    object: (identifier) @resource.object
    attribute: (identifier) @acquire.method
    (#match? @acquire.method "^(acquire|open|start|connect)$"))) @lifecycle.relationship.resource.acquisition

; 资源释放方法
(call
  function: (member_expression
    object: (identifier) @resource.object
    attribute: (identifier) @release.method
    (#match? @release.method "^(release|close|stop|disconnect|cleanup)$"))) @lifecycle.relationship.resource.release

; 生成器创建
(call
  function: (identifier) @generator.function
  arguments: (argument_list
    (function_definition
      name: (identifier) @generator.definition))) @lifecycle.relationship.generator.creation

; 生成器销毁
(call
  function: (member_expression
    object: (identifier) @generator.object
    attribute: (identifier) @generator.method
    (#match? @generator.method "^(close|throw)$"))) @lifecycle.relationship.generator.destruction
`;