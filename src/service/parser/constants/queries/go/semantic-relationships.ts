/*
Go Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 接口实现关系 - 使用锚点和谓词过滤
(type_declaration
  (type_spec
    name: (type_identifier) @implementing.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          type: (type_identifier) @implemented.interface)))))
  (#not-eq? @implementing.type @implemented.interface)) @semantic.interface.implementation

; 结构体嵌入关系 - 使用量词操作符
(type_declaration
  (type_spec
    name: (type_identifier) @embedding.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          type: (type_identifier) @embedded.type)+)))) @semantic.struct.embedding

; 方法定义关系 - 使用交替模式
[
  (method_declaration
    receiver: (parameter_list
      (parameter_declaration
        name: (identifier) @receiver.name
        type: (type_identifier) @receiver.type))
    name: (field_identifier) @method.name)
  (function_declaration
    name: (identifier) @function.name)
] @semantic.method.definition

; 设计模式查询 - 使用参数化模式
(type_declaration
  (type_spec
    name: (type_identifier) @pattern.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @pattern.field
          type: (type_identifier) @pattern.type)*))))
  (#match? @pattern.type "^(Observer|Subject|Strategy|Factory|Singleton|Builder|Proxy|Command|Adapter|Decorator|Composite|Flyweight|Bridge|Facade|Mediator|Prototype|Chain|State|Visitor|Interpreter|Memento|Iterator)$")) @semantic.design.pattern

; 继承关系查询（通过接口）
(type_declaration
  (type_spec
    name: (type_identifier) @derived.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          type: (type_identifier) @base.type)))))
  (#match? @base.type "^(.*Interface|.*Handler|.*Manager)$")) @semantic.inheritance.relationship

; 组合关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @composite.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @component.field
          type: (slice_type
            element: (type_identifier) @component.type)))))) @semantic.composition.relationship

; 委托关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @delegator.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @delegate.field
          type: (type_identifier) @delegate.type))))) @semantic.delegation.relationship

; 工厂方法关系查询 - 使用谓词过滤
(function_declaration
  name: (identifier) @factory.method
  parameters: (parameter_list
    (parameter_declaration
      type: (_) @param.type)*)
  return_type: (type_identifier) @product.type
  (#match? @factory.method "^(New|Create|Make|Build|From|Parse)$")) @semantic.factory.relationship

; 单例模式关系查询
(var_declaration
  (var_spec
    name: (identifier_list
      (identifier) @singleton.instance)
    type: (pointer_type
      element: (type_identifier) @singleton.type)
    (expression_list
      (call_expression
        function: (identifier) @constructor.call)))) @semantic.singleton.relationship

; 观察者模式关系查询 - 使用谓词过滤
(function_declaration
  name: (identifier) @observer.method
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @event.param))
  (#match? @observer.method "^(Notify|Update|Subscribe|Unsubscribe|Watch|Observe)$")) @semantic.observer.relationship

; 策略模式关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @strategy.interface
    type: (interface_type
      (method_spec_list
        (method_spec
          name: (field_identifier) @strategy.method)+)))) @semantic.strategy.relationship

; 命令模式关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @command.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @receiver.field
          type: (type_identifier) @receiver.type))))) @semantic.command.relationship

; 适配器模式关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @adapter.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @adaptee.field
          type: (type_identifier) @adaptee.type))))) @semantic.adapter.relationship

; 装饰器模式关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @decorator.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @component.field
          type: (type_identifier) @component.type))))) @semantic.decorator.relationship

; 代理模式关系查询
(type_declaration
  (type_spec
    name: (type_identifier) @proxy.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @real.subject.field
          type: (type_identifier) @real.subject.type))))) @semantic.proxy.relationship
`;