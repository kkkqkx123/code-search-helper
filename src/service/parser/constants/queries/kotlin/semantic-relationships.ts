/*
Kotlin Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 类继承关系（方法重写）
(class_declaration
  name: (simple_identifier) @subclass.class
  (delegation_specifiers
    (user_type
      (simple_identifier) @superclass.class))
  body: (class_body
    (function_declaration
      name: (simple_identifier) @overridden.method))) @semantic.relationship.class.override

; 接口实现关系
(class_declaration
  name: (simple_identifier) @implementing.class
  (delegation_specifiers
    (user_type
      (simple_identifier) @implemented.interface))
  body: (class_body
    (function_declaration
      name: (simple_identifier) @implemented.method))) @semantic.relationship.interface.implementation

; 接口继承关系
(interface_declaration
  name: (simple_identifier) @subinterface.interface
  (delegation_specifiers
    (user_type
      (simple_identifier) @superinterface.interface))) @semantic.relationship.interface.inheritance

; 泛型类型参数关系
(class_declaration
  name: (simple_identifier) @generic.class
  (type_parameters
    (type_parameter
      name: (simple_identifier) @type.parameter))) @semantic.relationship.generic.parameter

; 泛型约束关系
(class_declaration
  name: (simple_identifier) @constrained.class
  (type_constraints
    (type_constraint
      (simple_identifier) @constrained.type
      (user_type
        (simple_identifier) @constraint.trait)))) @semantic.relationship.generic.constraint

; 委托模式（by关键字）
(class_declaration
  name: (simple_identifier) @delegating.class
  (delegation_specifiers
    (user_type
      (simple_identifier) @delegate.interface)
    (delegation_specifier
      (simple_identifier) @delegate.object
      (simple_identifier) @by.keyword
      (#match? @by.keyword "^by$")))
  body: (class_body
    (function_declaration
      name: (simple_identifier) @delegated.method))) @semantic.relationship.delegation.pattern

; 观察者模式（属性委托）
(property_declaration
  name: (simple_identifier) @observed.property
  (modifiers
    (annotation
      name: (simple_identifier) @delegate.annotation
      (#match? @delegate.annotation "^delegate$")))
  body: (property_delegate
    (simple_identifier) @observer.delegate)) @semantic.relationship.observer.pattern

; 发布订阅模式
(function_declaration
  name: (simple_identifier) @publisher.method
  (#match? @publisher.method "^(emit|publish|notify|broadcast)$")
  parameters: (function_value_parameters
    (simple_identifier) @event.parameter)) @semantic.relationship.publisher.pattern

; 工厂模式（伴生对象）
(companion_object
  name: (simple_identifier) @companion.name
  body: (class_body
    (function_declaration
      name: (simple_identifier) @factory.method
      (#match? @factory.method "^(create|build|make|new|getInstance)$")
      return_type: (user_type
        (simple_identifier) @created.type)))) @semantic.relationship.factory.pattern

; 单例模式（object声明）
(object_declaration
  name: (simple_identifier) @singleton.object) @semantic.relationship.singleton.pattern

; 策略模式
(interface_declaration
  name: (simple_identifier) @strategy.interface
  body: (interface_body
    (function_declaration
      name: (simple_identifier) @strategy.method))) @semantic.relationship.strategy.pattern

; 命令模式
(class_declaration
  name: (simple_identifier) @command.class
  body: (class_body
    (primary_constructor
      (class_parameters
        (class_parameter
          name: (simple_identifier) @command.parameter))))) @semantic.relationship.command.pattern

; 适配器模式
(class_declaration
  name: (simple_identifier) @adapter.class
  (delegation_specifiers
    (user_type
      (simple_identifier) @adapter.interface))
  body: (class_body
    (function_declaration
      name: (simple_identifier) @adapter.method))) @semantic.relationship.adapter.pattern

; 装饰器模式（扩展函数）
(function_declaration
  receiver: (user_type
    (simple_identifier) @decorated.type)
  name: (simple_identifier) @decorator.method
  parameters: (function_value_parameters
    (simple_identifier) @decorator.parameter)) @semantic.relationship.decorator.pattern

; 代理模式
(class_declaration
  name: (simple_identifier) @proxy.class
  body: (class_body
    (property_declaration
      name: (simple_identifier) @proxy.target))) @semantic.relationship.proxy.pattern

; 组合模式
(class_declaration
  name: (simple_identifier) @composite.class
  body: (class_body
    (property_declaration
      name: (simple_identifier) @composite.children
      type: (user_type
        (simple_identifier) @collection.type)))) @semantic.relationship.composite.pattern

; 模板方法模式
(abstract_class_declaration
  name: (simple_identifier) @template.class
  body: (class_body
    (function_declaration
      name: (simple_identifier) @template.method
      body: (block
        (call_expression
          left: (navigation_expression
            left: (this_expression)
            right: (simple_identifier) @abstract.method)))))) @semantic.relationship.template.pattern

; 迭代器模式
(function_declaration
  name: (simple_identifier) @iterator.method
  (#match? @iterator.method "^(iterator|asIterable|asSequence)$")
  return_type: (user_type
    (simple_identifier) @iterator.type)) @semantic.relationship.iterator.pattern

; 访问者模式
(interface_declaration
  name: (simple_identifier) @visitor.interface
  body: (interface_body
    (function_declaration
      name: (simple_identifier) @visitor.method
      parameters: (function_value_parameters
        (simple_identifier) @visited.type)))) @semantic.relationship.visitor.pattern

; 状态模式
(sealed_class_declaration
  name: (simple_identifier) @state.class
  body: (class_body
    (class_declaration
      name: (simple_identifier) @state.variant))) @semantic.relationship.state.pattern

; 责任链模式
(function_declaration
  name: (simple_identifier) @chain.method
  parameters: (function_value_parameters
    (simple_identifier) @chain.handler)
  return_type: (user_type
    (simple_identifier) @chain.result)) @semantic.relationship.chain.pattern

; 数据类模式
(class_declaration
  (modifiers
    (annotation
      name: (simple_identifier) @dataclass.annotation
      (#match? @dataclass.annotation "^data$")))
  name: (simple_identifier) @dataclass.name
  body: (class_body
    (primary_constructor
      (class_parameters
        (class_parameter
          name: (simple_identifier) @dataclass.parameter))))) @semantic.relationship.dataclass.pattern

; 枚举类模式
(enum_class_declaration
  name: (simple_identifier) @enum.class
  body: (enum_class_body
    (enum_entry
      name: (simple_identifier) @enum.variant))) @semantic.relationship.enum.pattern

; 内联类模式
(inline_class_declaration
  name: (simple_identifier) @inline.class
  primary_constructor: (primary_constructor
    (class_parameters
      (class_parameter
        name: (simple_identifier) @inline.value)))) @semantic.relationship.inline.pattern

; 伴生对象工厂模式
(companion_object
  name: (simple_identifier) @companion.factory
  body: (class_body
    (function_declaration
      name: (simple_identifier) @factory.method
      (#match? @factory.method "^(of|from|valueOf|parse)$")
      return_type: (user_type
        (simple_identifier) @product.type)))) @semantic.relationship.companion.factory
`;