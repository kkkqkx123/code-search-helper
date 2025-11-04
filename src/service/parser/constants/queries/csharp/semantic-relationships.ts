/*
C# Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 类继承关系
(class_declaration
  name: (identifier) @subclass.class
  base_class_clause: (base_class_clause
    (identifier) @superclass.class)) @semantic.relationship.class.inheritance

; 接口实现关系
(class_declaration
  name: (identifier) @implementing.class
  base_class_clause: (base_class_clause
    (identifier) @implemented.interface)) @semantic.relationship.interface.implementation

; 多接口实现关系 - captures any interface implementation
(class_declaration
  name: (identifier) @implementing.class
  base_class_clause: (base_class_clause
    (identifier) @implemented.interface)) @semantic.relationship.multiple.interfaces

; 接口继承关系
(interface_declaration
  name: (identifier) @subinterface.interface
  base_class_clause: (base_class_clause
    (identifier) @superinterface.interface)) @semantic.relationship.interface.inheritance

; 方法重写关系
(method_declaration
  (modifier) @override.modifier
  name: (identifier) @overridden.method) @semantic.relationship.method.override

; 抽象方法定义关系
(method_declaration
  (modifier) @abstract.modifier
  name: (identifier) @abstract.method) @semantic.relationship.abstract.method

; 虚方法定义关系
(method_declaration
  (modifier) @virtual.modifier
  name: (identifier) @virtual.method) @semantic.relationship.virtual.method

; 显式接口实现关系
(method_declaration
  (explicit_interface_specifier
    (identifier) @interface.name)
  name: (identifier) @implemented.method) @semantic.relationship.explicit.interface.implementation

; 属性重写关系
(property_declaration
  (modifier) @override.modifier
  name: (identifier) @overridden.property) @semantic.relationship.property.override

; 索引器重写关系
(indexer_declaration
  (modifier) @override.modifier
  type: (identifier) @overridden.indexer.type) @semantic.relationship.indexer.override

; 事件重写关系
(event_declaration
  (modifier) @override.modifier
  name: (identifier) @overridden.event) @semantic.relationship.event.override

; 泛型类型参数关系
(class_declaration
  name: (identifier) @generic.class
  type_parameters: (type_parameter_list
    (type_parameter
      name: (identifier) @type.parameter))) @semantic.relationship.generic.parameter

; 泛型方法关系
(method_declaration
  name: (identifier) @generic.method
  type_parameters: (type_parameter_list
    (type_parameter
      name: (identifier) @method.type.parameter))) @semantic.relationship.generic.method

; 泛型约束关系
(type_parameter_constraints_clause
  (identifier) @constrained.type.parameter)
  (type_parameter_constraint) @semantic.relationship.generic.constraint

; 基类约束关系
(type_parameter_constraints_clause
  (identifier) @constrained.type.parameter)
  (type_parameter_constraint
    (identifier) @base.class.constraint) @semantic.relationship.base.class.constraint

; 接口约束关系
(type_parameter_constraints_clause
  (identifier) @constrained.type.parameter)
  (type_parameter_constraint
    (identifier) @interface.constraint) @semantic.relationship.interface.constraint

; 构造函数约束关系
(type_parameter_constraints_clause
  (identifier) @constrained.type.parameter)
  (type_parameter_constraint
    (constructor_constraint)) @semantic.relationship.constructor.constraint

; 观察者模式 - 事件定义
(event_declaration
  type: (identifier) @event.handler.type
  name: (identifier) @event.name) @semantic.relationship.observer.event

; 观察者模式 - 事件订阅
(assignment_expression
  left: (member_access_expression
    expression: (identifier) @subscriber.object
    name: (identifier) @subscriber.event)
  right: (identifier) @event.handler) @semantic.relationship.observer.subscription

; 观察者模式 - 事件触发
(invocation_expression
  function: (member_access_expression
    expression: (identifier) @publisher.object
    name: (identifier) @publisher.event)) @semantic.relationship.observer.trigger

; 委托关系
(delegate_declaration
  name: (identifier) @delegate.type
  parameters: (parameter_list)) @semantic.relationship.delegate.definition

; 委托赋值关系
(assignment_expression
  left: (identifier) @delegate.instance
  right: (identifier) @delegate.method) @semantic.relationship.delegate.assignment

; 委托组合关系
(invocation_expression
  function: (member_access_expression
    expression: (identifier) @delegate.instance
    name: (identifier) @delegate.combine.method)
  arguments: (argument_list
    (argument
      (identifier) @delegate.to.add))) @semantic.relationship.delegate.composition

; 策略模式 - 策略接口
(interface_declaration
  name: (identifier) @strategy.interface
  (method_declaration
    name: (identifier) @strategy.method)) @semantic.relationship.strategy.interface

; 策略模式 - 策略实现
(class_declaration
  name: (identifier) @concrete.strategy
  base_class_clause: (base_class_clause
    (identifier) @strategy.interface)) @semantic.relationship.strategy.implementation

; 策略模式 - 上下文类
(class_declaration
  name: (identifier) @strategy.context
  body: (declaration_list
    (field_declaration
      (variable_declaration
        (variable_declarator
          name: (identifier) @strategy.field
          value: (identifier) @strategy.instance))))) @semantic.relationship.strategy.context

; 工厂模式 - 工厂方法
(method_declaration
  name: (identifier) @factory.method
  return_type: (identifier) @product.type) @semantic.relationship.factory.method

; 工厂模式 - 产品接口
(interface_declaration
  name: (identifier) @product.interface) @semantic.relationship.product.interface

; 抽象工厂模式 - 抽象工厂接口
(interface_declaration
  name: (identifier) @abstract.factory.interface
  (method_declaration
    name: (identifier) @factory.method
    return_type: (identifier) @product.type)) @semantic.relationship.abstract.factory

; 单例模式 - 静态实例字段
(field_declaration
  (modifier) @static.modifier
  (modifier) @readonly.modifier
  (variable_declaration
    type: (identifier) @singleton.type
    (variable_declarator
      name: (identifier) @singleton.instance))) @semantic.relationship.singleton.instance

; 单例模式 - 获取实例方法
(method_declaration
  (modifier) @static.modifier
  name: (identifier) @singleton.get.method
  return_type: (identifier) @singleton.type) @semantic.relationship.singleton.access

; 适配器模式 - 适配器类
(class_declaration
  name: (identifier) @adapter.class
  base_class_clause: (base_class_clause
    (identifier) @target.interface)) @semantic.relationship.adapter.class

; 适配器模式 - 适配者类
(class_declaration
  name: (identifier) @adaptee.class
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @adaptee.field.type
        (variable_declarator
          name: (identifier) @adaptee.instance))))) @semantic.relationship.adaptee.class

; 装饰器模式 - 装饰器基类
(class_declaration
  name: (identifier) @decorator.base
  base_class_clause: (base_class_clause
    (identifier) @component.interface)) @semantic.relationship.decorator.base

; 装饰器模式 - 具体装饰器
(class_declaration
  name: (identifier) @concrete.decorator
  base_class_clause: (base_class_clause
    (identifier) @decorator.base)) @semantic.relationship.concrete.decorator

; 模板方法模式 - 抽象模板类
(class_declaration
  name: (identifier) @abstract.template.class
  (method_declaration
    (modifier) @virtual.modifier
    name: (identifier) @template.method)) @semantic.relationship.template.method

; 建造者模式 - 建造者接口
(interface_declaration
  name: (identifier) @builder.interface
  (method_declaration
    name: (identifier) @build.method)) @semantic.relationship.builder.interface

; 建造者模式 - 具体建造者
(class_declaration
  name: (identifier) @concrete.builder
  base_class_clause: (base_class_clause
    (identifier) @builder.interface)) @semantic.relationship.concrete.builder

; 原型模式 - 克隆方法
(method_declaration
  name: (identifier) @clone.method
  return_type: (identifier) @cloned.object.type) @semantic.relationship.prototype.clone

; 享元模式 - 享元工厂
(class_declaration
  name: (identifier) @flyweight.factory
  (method_declaration
    name: (identifier) @factory.method
    return_type: (identifier) @flyweight.type)) @semantic.relationship.flyweight.factory

; 代理模式 - 代理类
(class_declaration
  name: (identifier) @proxy.class
  base_class_clause: (base_class_clause
    (identifier) @subject.interface)) @semantic.relationship.proxy.class

; 代理模式 - 真实主题
(class_declaration
  name: (identifier) @real.subject
  base_class_clause: (base_class_clause
    (identifier) @subject.interface)) @semantic.relationship.real.subject

; 命令模式 - 命令接口
(interface_declaration
  name: (identifier) @command.interface
  (method_declaration
    name: (identifier) @execute.method)) @semantic.relationship.command.interface

; 命令模式 - 具体命令
(class_declaration
  name: (identifier) @concrete.command
  base_class_clause: (base_class_clause
    (identifier) @command.interface)) @semantic.relationship.concrete.command

; 命令模式 - 调用者
(class_declaration
  name: (identifier) @invoker
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @command.type
        (variable_declarator
          name: (identifier) @command.field))))) @semantic.relationship.invoker

; 外观模式 - 外观类
(class_declaration
  name: (identifier) @facade.class
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @subsystem.type
        (variable_declarator
          name: (identifier) @subsystem.instance))))) @semantic.relationship.facade

; 桥接模式 - 实现接口
(interface_declaration
  name: (identifier) @implementation.interface) @semantic.relationship.implementation.interface

; 桥接模式 - 抽象类
(class_declaration
  name: (identifier) @abstraction.class
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @implementation.type
        (variable_declarator
          name: (identifier) @implementation.field))))) @semantic.relationship.abstraction.class

; 组合模式 - 组件接口
(interface_declaration
  name: (identifier) @component.interface
  (method_declaration
    name: (identifier) @component.operation)) @semantic.relationship.composite.component

; 组合模式 - 叶子节点
(class_declaration
  name: (identifier) @leaf.class
  base_class_clause: (base_class_clause
    (identifier) @component.interface)) @semantic.relationship.composite.leaf

; 组合模式 - 组合节点
(class_declaration
  name: (identifier) @composite.class
  base_class_clause: (base_class_clause
    (identifier) @component.interface)
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (array_type) @children.type
        (variable_declarator
          name: (identifier) @children.field))))) @semantic.relationship.composite.node

; 备忘录模式 - 备忘录类
(class_declaration
  name: (identifier) @memento.class) @semantic.relationship.memento

; 备忘录模式 - 发起者类
(class_declaration
  name: (identifier) @originator.class
  (method_declaration
    name: (identifier) @create.memento.method
    return_type: (identifier) @memento.type)) @semantic.relationship.originator

; 备忘录模式 - 管理者类
(class_declaration
  name: (identifier) @caretaker.class
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @memento.type
        (variable_declarator
          name: (identifier) @memento.field))))) @semantic.relationship.caretaker

; 访问者模式 - 访问者接口
(interface_declaration
  name: (identifier) @visitor.interface
  (method_declaration
    name: (identifier) @visit.method)) @semantic.relationship.visitor.interface

; 访问者模式 - 元素接口
(interface_declaration
  name: (identifier) @element.interface
  (method_declaration
    name: (identifier) @accept.method)) @semantic.relationship.element.interface

; 访问者模式 - 具体元素
(class_declaration
  name: (identifier) @concrete.element
  base_class_clause: (base_class_clause
    (identifier) @element.interface)) @semantic.relationship.concrete.element

; 责任链模式 - 处理器接口
(interface_declaration
  name: (identifier) @handler.interface
  (method_declaration
    name: (identifier) @handle.method)) @semantic.relationship.handler.interface

; 责任链模式 - 处理器链
(class_declaration
  name: (identifier) @handler.class
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @next.handler.type
        (variable_declarator
          name: (identifier) @next.handler.field))))) @semantic.relationship.handler.chain

; 迭代器模式 - 迭代器接口
(interface_declaration
  name: (identifier) @iterator.interface
  (method_declaration
    name: (identifier) @iterator.method)) @semantic.relationship.iterator.interface

; 迭代器模式 - 可迭代接口
(interface_declaration
  name: (identifier) @iterable.interface
  (method_declaration
    name: (identifier) @get.iterator.method)) @semantic.relationship.iterable.interface

; 中介者模式 - 中介者接口
(interface_declaration
  name: (identifier) @mediator.interface) @semantic.relationship.mediator.interface

; 中介者模式 - 同事类
(class_declaration
  name: (identifier) @colleague.class
  body: (declaration_list
    (field_declaration
      (variable_declaration
        type: (identifier) @mediator.type
        (variable_declarator
          name: (identifier) @mediator.field))))) @semantic.relationship.colleague.class

; 依赖注入关系
(constructor_declaration
  parameters: (parameter_list
    (parameter
      type: (identifier) @injected.dependency.type
      name: (identifier) @injected.dependency.parameter))) @semantic.relationship.dependency.injection

; 属性注入关系
(property_declaration
  name: (identifier) @injectable.property
  type: (identifier) @property.type) @semantic.relationship.property.injection

; 方法注入关系
(method_declaration
  name: (identifier) @inject.method
  parameters: (parameter_list
    (parameter
      type: (identifier) @injected.parameter.type
      name: (identifier) @injected.parameter))) @semantic.relationship.method.injection

; 特性(Attributes)关系
(attribute
  name: (identifier) @attribute.name) @semantic.relationship.attribute

; 特性参数关系
(attribute
  name: (identifier) @attribute.name
  (attribute_argument_list
    (attribute_argument
      (identifier) @attribute.argument))) @semantic.relationship.attribute.argument

; 事件定义关系
(event_declaration
  type: (identifier) @event.delegate.type
  name: (identifier) @event.name) @semantic.relationship.event.definition

; 事件处理关系
(method_declaration
  parameters: (parameter_list
    (parameter
      type: (identifier) @event.sender.type)
    (parameter
      type: (identifier) @event.args.type))) @semantic.relationship.event.handler.method

; 扩展方法关系
(method_declaration
  (modifier) @this.modifier
  parameters: (parameter_list
    (parameter
      (modifier) @this.modifier
      type: (identifier) @extended.type
      name: (identifier) @extended.instance))) @semantic.relationship.extension.method

; 部分类关系
(class_declaration
  (modifier) @partial.modifier
  name: (identifier) @partial.class.name) @semantic.relationship.partial.class

; 部分方法关系
(method_declaration
  (modifier) @partial.modifier
  name: (identifier) @partial.method.name) @semantic.relationship.partial.method
`;