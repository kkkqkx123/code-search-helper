/*
C++ Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 类继承关系
(class_specifier
  name: (type_identifier) @subclass.class
  base_class_clause: (base_class_clause
    (type_identifier) @superclass.class)) @semantic.relationship.class.inheritance

; 虚函数重写关系
(function_definition
  declarator: (function_declarator
    declarator: (field_identifier) @overridden.method)
  (virtual_specifier) @virtual.specifier) @semantic.relationship.virtual.override

; 显式重写标识符
(function_definition
  declarator: (function_declarator
    declarator: (field_identifier) @overridden.method)
  (virtual_specifier) @override.specifier)
  (#match? @override.specifier "override") @semantic.relationship.explicit.override

; 函数重载关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @overloaded.function)) @semantic.relationship.function.overload

; 运算符重载关系
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @overloaded.operator)) @semantic.relationship.operator.overload

; 模板特化关系
(explicit_specialization
  (template_declaration
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @specialized.function)))) @semantic.relationship.template.specialization

; 友元函数关系
(friend_declaration
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @friend.function))) @semantic.relationship.friend.function

; 友元类关系
(friend_declaration
  (class_specifier
    name: (type_identifier) @friend.class)) @semantic.relationship.friend.class

; 委托模式（组合关系）
(class_specifier
  name: (type_identifier) @delegator.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @delegate.field)
      type: (type_identifier) @delegate.type))) @semantic.relationship.delegation.pattern

; 观察者模式（主题-观察者关系）
(class_specifier
  name: (type_identifier) @subject.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @observers.field)
      type: (type_identifier) @observers.type))) @semantic.relationship.observer.subject

; 观察者模式（观察者接口）
(class_specifier
  name: (type_identifier) @observer.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @update.method)))) @semantic.relationship.observer.interface

; 策略模式（策略接口）
(class_specifier
  name: (type_identifier) @strategy.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @strategy.method)))) @semantic.relationship.strategy.interface

; 策略模式（上下文类）
(class_specifier
  name: (type_identifier) @context.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @strategy.field)
      type: (type_identifier) @strategy.type))) @semantic.relationship.strategy.context

; 工厂模式（工厂类）
(class_specifier
  name: (type_identifier) @factory.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @create.method)
      return_type: (type_identifier) @product.type))) @semantic.relationship.factory.pattern

; 单例模式（单例类）
(class_specifier
  name: (type_identifier) @singleton.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @instance.field)
      type: (type_identifier) @instance.type)
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @get.instance.method)))) @semantic.relationship.singleton.pattern

; 建造者模式（建造者类）
(class_specifier
  name: (type_identifier) @builder.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @build.method)))) @semantic.relationship.builder.pattern

; 原型模式（原型接口）
(class_specifier
  name: (type_identifier) @prototype.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @clone.method)))) @semantic.relationship.prototype.pattern

; 适配器模式（适配器类）
(class_specifier
  name: (type_identifier) @adapter.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @adaptee.field)
      type: (type_identifier) @adaptee.type))) @semantic.relationship.adapter.pattern

; 装饰器模式（装饰器基类）
(class_specifier
  name: (type_identifier) @decorator.base.class
  base_class_clause: (base_class_clause
    (type_identifier) @component.interface)) @semantic.relationship.decorator.base

; 装饰器模式（具体装饰器）
(class_specifier
  name: (type_identifier) @concrete.decorator.class
  base_class_clause: (base_class_clause
    (type_identifier) @decorator.base.class)) @semantic.relationship.decorator.concrete

; 命令模式（命令接口）
(class_specifier
  name: (type_identifier) @command.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @execute.method)))) @semantic.relationship.command.interface

; 命令模式（具体命令）
(class_specifier
  name: (type_identifier) @concrete.command.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @receiver.field)
      type: (type_identifier) @receiver.type))) @semantic.relationship.command.concrete

; 模板方法模式（模板类）
(class_specifier
  name: (type_identifier) @template.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @template.method)))) @semantic.relationship.template.method

; 状态模式（状态接口）
(class_specifier
  name: (type_identifier) @state.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @handle.method)))) @semantic.relationship.state.interface

; 访问者模式（访问者接口）
(class_specifier
  name: (type_identifier) @visitor.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @visit.method)))) @semantic.relationship.visitor.interface

; 组合模式（组件接口）
(class_specifier
  name: (type_identifier) @component.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @operation.method)))) @semantic.relationship.composite.interface

; 组合模式（组合类）
(class_specifier
  name: (type_identifier) @composite.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @children.field)
      type: (type_identifier) @children.type))) @semantic.relationship.composite.class

; 代理模式（代理类）
(class_specifier
  name: (type_identifier) @proxy.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @real.subject.field)
      type: (type_identifier) @real.subject.type))) @semantic.relationship.proxy.pattern

; 责任链模式（处理器基类）
(class_specifier
  name: (type_identifier) @handler.base.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @next.handler.field)
      type: (type_identifier) @next.handler.type)
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @handle.method)))) @semantic.relationship.chain.responsibility

; 迭代器模式（迭代器接口）
(class_specifier
  name: (type_identifier) @iterator.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @next.method)))) @semantic.relationship.iterator.interface

; 中介者模式（中介者类）
(class_specifier
  name: (type_identifier) @mediator.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @mediate.method)))) @semantic.relationship.mediator.pattern

; 备忘录模式（备忘录类）
(class_specifier
  name: (type_identifier) @memento.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @state.field)))) @semantic.relationship.memento.pattern

; 解释器模式（表达式接口）
(class_specifier
  name: (type_identifier) @expression.interface
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @interpret.method)))) @semantic.relationship.interpreter.pattern

; RAII模式（资源管理类）
(class_specifier
  name: (type_identifier) @raii.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @constructor.method))
    (function_definition
      declarator: (function_declarator
        declarator: (destructor_name) @destructor.method)))) @semantic.relationship.raii.pattern

; 概念约束关系（C++20）
(concept_definition
  name: (identifier) @constraint.concept
  parameters: (template_parameter_list)
  (requires_clause) @constraint.requires) @semantic.relationship.constraint.concept

; SFINAE模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @sfinae.function)
  return_type: (enable_if) @sfinae.enable.if) @semantic.relationship.sfinae.pattern

; CRTP模式（奇异递归模板模式）
(class_specifier
  name: (type_identifier) @crtp.derived.class
  base_class_clause: (base_class_clause
    (template_type
      (type_identifier) @crtp.base.class
      template_arguments: (template_argument_list
        (type_identifier) @crtp.derived.type)))) @semantic.relationship.crtp.pattern
`;