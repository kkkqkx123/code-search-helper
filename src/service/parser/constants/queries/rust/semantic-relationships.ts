/*
Rust Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; Trait实现关系（方法重写）
(impl_item
  trait: (type_identifier) @implemented.trait
  type: (type_identifier) @implementing.type
  body: (declaration_list
    (function_item
      name: (identifier) @overridden.method))) @semantic.relationship.trait.implementation

; 结构体实现关系
(impl_item
  type: (type_identifier) @implemented.struct
  body: (declaration_list
    (function_item
      name: (identifier) @implemented.method))) @semantic.relationship.struct.implementation

; 泛型约束关系
(impl_item
  type_parameters: (type_parameters
    (type_parameter
      name: (type_identifier) @generic.parameter))
  (where_clause
    (where_predicate
      left: (type_identifier) @constrained.type
      bounds: (trait_bounds
        (type_identifier) @constraint.trait))) @semantic.relationship.generic.constraint

; 继承关系（通过Deref）
(impl_item
  trait: (type_identifier) @deref.trait
  (#match? @deref.trait "^Deref$")
  type: (type_identifier) @deref.type
  body: (declaration_list
    (type_identifier) @target.type)) @semantic.relationship.deref.inheritance

; 观察者模式（事件系统）
(function_item
  name: (identifier) @observer.method
  (#match? @observer.method "^(on_|watch_|observe_|subscribe_)$")
  parameters: (parameters
    (parameter
      pattern: (identifier) @event.parameter))) @semantic.relationship.observer.pattern

; 发布订阅模式
(function_item
  name: (identifier) @publisher.method
  (#match? @publisher.method "^(emit_|publish_|notify_|broadcast_)$")
  parameters: (parameters
    (parameter
      pattern: (identifier) @event.parameter))) @semantic.relationship.publisher.pattern

; 工厂模式
(function_item
  name: (identifier) @factory.method
  (#match? @factory.method "^(create_|build_|make_|new_)$")
  return_type: (type_identifier) @created.type) @semantic.relationship.factory.pattern

; 建造者模式
(struct_item
  name: (type_identifier) @builder.struct
  body: (field_declaration_list
    (field_declaration
      name: (field_identifier) @builder.field))) @semantic.relationship.builder.pattern

; 单例模式
(const_item
  name: (identifier) @singleton.instance
  type: (type_identifier) @singleton.type) @semantic.relationship.singleton.pattern

; 策略模式
(trait_item
  name: (type_identifier) @strategy.trait
  body: (declaration_list
    (function_item
      name: (identifier) @strategy.method))) @semantic.relationship.strategy.pattern

; 命令模式
(struct_item
  name: (type_identifier) @command.struct
  body: (field_declaration_list
    (field_declaration
      name: (field_identifier) @command.field))) @semantic.relationship.command.pattern

; 适配器模式
(impl_item
  trait: (type_identifier) @adapter.trait
  type: (type_identifier) @adapter.type
  body: (declaration_list
    (function_item
      name: (identifier) @adapter.method))) @semantic.relationship.adapter.pattern

; 装饰器模式（通过宏）
(attribute_item
  attribute: (attribute
    name: (identifier) @decorator.macro
    (#match? @decorator.macro "^(derive|attribute)$")
    arguments: (token_tree
      (identifier) @decorator.trait))) @semantic.relationship.decorator.pattern

; 代理模式
(struct_item
  name: (type_identifier) @proxy.struct
  body: (field_declaration_list
    (field_declaration
      name: (field_identifier) @proxy.target))) @semantic.relationship.proxy.pattern

; 组合模式
(enum_item
  name: (type_identifier) @composite.enum
  body: (enum_variant_list
    (enum_variant
      name: (identifier) @composite.variant))) @semantic.relationship.composite.pattern

; 模板方法模式
(trait_item
  name: (type_identifier) @template.trait
  body: (declaration_list
    (function_item
      name: (identifier) @template.method
      body: (block
        (call_expression
          function: (field_expression
            value: (self)
            field: (field_identifier) @abstract.method)))))) @semantic.relationship.template.pattern

; 迭代器模式
(impl_item
  trait: (type_identifier) @iterator.trait
  (#match? @iterator.trait "^(Iterator|IntoIterator)$")
  type: (type_identifier) @iterator.type) @semantic.relationship.iterator.pattern

; 访问者模式
(trait_item
  name: (type_identifier) @visitor.trait
  body: (declaration_list
    (function_item
      name: (identifier) @visitor.method
      parameters: (parameters
        (parameter
          pattern: (identifier) @visited.type))))) @semantic.relationship.visitor.pattern

; 状态模式
(enum_item
  name: (type_identifier) @state.enum
  body: (enum_variant_list
    (enum_variant
      name: (identifier) @state.variant))) @semantic.relationship.state.pattern

; 责任链模式
(function_item
  name: (identifier) @chain.method
  parameters: (parameters
    (parameter
      pattern: (identifier) @chain.handler))
  return_type: (type_identifier) @chain.result)) @semantic.relationship.chain.pattern
`;