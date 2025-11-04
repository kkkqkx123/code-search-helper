/*
Python Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 类继承关系（方法重写）
(class_definition
  name: (identifier) @subclass.class
  superclasses: (argument_list
    (identifier) @superclass.class)
  body: (block
    (function_definition
      name: (identifier) @overridden.method))) @semantic.relationship.class.override

; 装饰器模式（观察者）
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @observer.decorator
      (#match? @observer.decorator "^(observer|subscribe|watch)$")))
  definition: (function_definition
    name: (identifier) @observer.method)) @semantic.relationship.observer.decorator

; 属性装饰器（观察者模式）
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @property.name)
      (decorator
        (identifier) @property.decorator
        (#match? @property.decorator "^(property|setter|getter)$"))))) @semantic.relationship.property.decorator

; 类方法装饰器（委托模式）
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @delegated.method)
      (decorator
        (identifier) @delegate.decorator
        (#match? @delegate.decorator "^(delegate|forward)$"))))) @semantic.relationship.delegate.decorator

; 静态方法装饰器
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @static.method)
      (decorator
        (identifier) @staticmethod.decorator)))) @semantic.relationship.static.method

; 抽象基类装饰器
(class_definition
  name: (identifier) @abstract.class
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @abstract.method)
      (decorator
        (identifier) @abstractmethod.decorator)))) @semantic.relationship.abstract.method

; 数据类装饰器（配置模式）
(decorated_definition
  (decorator
    (identifier) @dataclass.decorator
    (#match? @dataclass.decorator "^(dataclass)$"))
  definition: (class_definition
    name: (identifier) @config.class)) @semantic.relationship.dataclass.pattern

; 上下文管理器装饰器
(decorated_definition
  (decorator
    (identifier) @contextmanager.decorator
    (#match? @contextmanager.decorator "^(contextmanager)$"))
  definition: (function_definition
    name: (identifier) @context.manager)) @semantic.relationship.contextmanager.pattern

; 元类模式
(class_definition
  name: (identifier) @metaclass.class
  (argument_list
    (keyword_argument
      key: (identifier) @metakey
      value: (identifier) @metavalue
      (#match? @metakey "metaclass")))) @semantic.relationship.metaclass.pattern

; 描述符协议
(class_definition
  body: (block
    (function_definition
      name: (identifier) @descriptor.method
      (#match? @descriptor.method "^(__get__|__set__|__delete__)$")))) @semantic.relationship.descriptor.pattern

; 迭代器协议
(class_definition
  body: (block
    (function_definition
      name: (identifier) @iterator.method
      (#match? @iterator.method "^(__iter__|__next__)$")))) @semantic.relationship.iterator.pattern

; 异步迭代器协议
(class_definition
  body: (block
    (function_definition
      name: (identifier) @async.iterator.method
      (#match? @async.iterator.method "^(__aiter__|__anext__)$")))) @semantic.relationship.async.iterator.pattern
`;