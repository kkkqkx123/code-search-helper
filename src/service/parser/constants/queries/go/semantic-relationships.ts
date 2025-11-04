/*
Go Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 接口实现关系
(type_declaration
  (type_spec
    name: (type_identifier) @implementing.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @implemented.interface))))) @semantic.relationship.interface.implementation

; 接口定义关系
(type_declaration
  (type_spec
    name: (type_identifier) @interface.name
    type: (interface_type) @interface.type)) @semantic.relationship.interface.definition

; 结构体定义关系
(type_declaration
  (type_spec
    name: (type_identifier) @struct.name
    type: (struct_type) @struct.type)) @semantic.relationship.struct.definition

; 方法定义关系（接收者方法）
(method_declaration
  receiver: (parameter_list
    (parameter_declaration
      name: (identifier) @receiver.name
      type: (type_identifier) @receiver.type))
  name: (field_identifier) @method.name) @semantic.relationship.method.definition

; 函数定义关系
(function_declaration
  name: (identifier) @function.name) @semantic.relationship.function.definition

; 嵌入字段关系（结构体嵌入）
(struct_type
  (field_declaration_list
    (field_declaration
      (type_identifier) @embedded.type))) @semantic.relationship.struct.embedding

; 匿名字段关系
(struct_type
  (field_declaration_list
    (field_declaration
      (type_identifier) @anonymous.field.type))) @semantic.relationship.anonymous.field

; 组合模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @composite.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @component.type))))) @semantic.relationship.composition

; 装饰器模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @decorator.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @decorated.type))))) @semantic.relationship.decorator.pattern

; 观察者模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @observer.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @subject.type))))) @semantic.relationship.observer.pattern

; 策略模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @strategy.context
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @strategy.field))))) @semantic.relationship.strategy.pattern

; 工厂模式关系
(function_declaration
  name: (identifier) @factory.function
  (block
    (return_statement
      (expression_list
        (call_expression
          function: (identifier) @constructor.function))))) @semantic.relationship.factory.pattern

; 单例模式关系
(var_declaration
  (var_spec
    name: (identifier_list
      (identifier) @singleton.instance)
    (expression_list
      (call_expression
        function: (identifier) @singleton.constructor)))) @semantic.relationship.singleton.pattern

; 建造者模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @builder.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @buildable.type))))) @semantic.relationship.builder.pattern

; 适配器模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @adapter.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @adaptee.type))))) @semantic.relationship.adapter.pattern

; 命令模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @command.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @receiver.type))))) @semantic.relationship.command.pattern

; 模板方法模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @template.class
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @abstract.method))))) @semantic.relationship.template.method

; 状态模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @state.context
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @state.field))))) @semantic.relationship.state.pattern

; 访问者模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @visitor.interface
    type: (interface_type
      (method_spec_list
        (method_spec
          name: (field_identifier) @visit.method))))) @semantic.relationship.visitor.pattern

; 责任链模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @chain.handler
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @successor.field))))) @semantic.relationship.chain.of.responsibility

; 代理模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @proxy.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @real.subject.type))))) @semantic.relationship.proxy.pattern

; 备忘录模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @memento.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @state.field))))) @semantic.relationship.memento.pattern

; 迭代器模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @iterator.interface
    type: (interface_type
      (method_spec_list
        (method_spec
          name: (field_identifier) @next.method))))) @semantic.relationship.iterator.pattern

; 中介者模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @mediator.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @colleague.type))))) @semantic.relationship.mediator.pattern

; 原型模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @prototype.interface
    type: (interface_type
      (method_spec_list
        (method_spec
          name: (field_identifier) @clone.method))))) @semantic.relationship.prototype.pattern

; 桥接模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @bridge.abstraction
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @implementor.field))))) @semantic.relationship.bridge.pattern

; 外观模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @facade.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @subsystem.type))))) @semantic.relationship.facade.pattern

; 享元模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @flyweight.factory
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @flyweight.pool))))) @semantic.relationship.flyweight.pattern

; 解释器模式关系
(type_declaration
  (type_spec
    name: (type_identifier) @interpreter.expression
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @context.type))))) @semantic.relationship.interpreter.pattern
`;