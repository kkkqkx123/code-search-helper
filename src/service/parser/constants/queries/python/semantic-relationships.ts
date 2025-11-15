/*
Python Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; Class inheritance relationships with anchor operator for precise matching
(class_definition
  name: (identifier) @derived.class
  superclasses: .
    (argument_list
      (identifier) @base.class)
  body: (block
    (function_definition
      name: (identifier) @overridden.method))) @semantic.relationship.class.inheritance

; Decorator patterns using alternation to reduce redundancy
[
  (decorated_definition
    (decorator
      (call_expression
        function: (identifier) @observer.decorator
        (#match? @observer.decorator "^(observer|subscribe|watch)$"))
      definition: (function_definition
        name: (identifier) @observer.method))) @semantic.relationship.observer.pattern
  (decorated_definition
    (decorator
      (identifier) @contextmanager.decorator
      (#match? @contextmanager.decorator "^(contextmanager)$"))
    definition: (function_definition
      name: (identifier) @context.manager))) @semantic.relationship.contextmanager.pattern
  (decorated_definition
    (decorator
      (identifier) @dataclass.decorator
      (#match? @dataclass.decorator "^(dataclass)$"))
    definition: (class_definition
      name: (identifier) @config.class))) @semantic.relationship.dataclass.pattern
] @semantic.decorator.pattern

; Class method decorators with anchor for precise matching
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @method.name)
      (decorator
        (identifier) @decorator.name
        (#match? @decorator.name "^(property|setter|getter|staticmethod|classmethod|abstractmethod)$"))))) @semantic.relationship.method.decorator

; Protocol patterns using alternation for similar patterns
[
  (class_definition
    body: (block
      (function_definition
        name: (identifier) @descriptor.method
        (#match? @descriptor.method "^(__get__|__set__|__delete__)$"))))) @semantic.relationship.descriptor.protocol
  (class_definition
    body: (block
      (function_definition
        name: (identifier) @iterator.method
        (#match? @iterator.method "^__(a)?(iter|next)__$"))))) @semantic.relationship.iterator.protocol
  (class_definition
    name: (identifier) @metaclass.class
    (argument_list
      (keyword_argument
        key: (identifier) @metakey
        value: (identifier) @metavalue
        (#match? @metakey "metaclass"))))) @semantic.relationship.metaclass.pattern
] @semantic.protocol.pattern

; Abstract base classes with anchor operator
(class_definition
  name: (identifier) @abstract.class
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @abstract.method)
      (decorator
        (identifier) @abstractmethod.decorator
        (#match? @abstractmethod.decorator "^(abstractmethod)$"))))) @semantic.relationship.abstract.base
`;