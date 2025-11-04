/*
Java Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 方法重写关系（@Override注解）
(method_declaration
  name: (identifier) @overridden.method
  (annotation
    name: (identifier) @override.annotation
    (#match? @override.annotation "Override$"))) @semantic.relationship.method.override

; 类继承关系
(class_declaration
  name: (identifier) @subclass.class
  superclass: (superclass
    (type_identifier) @superclass.class)) @semantic.relationship.class.inheritance

; 接口实现关系
(class_declaration
  name: (identifier) @implementing.class
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @implemented.interface))) @semantic.relationship.interface.implementation

; 接口继承关系
(interface_declaration
  name: (identifier) @subinterface.interface
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @superinterface.interface))) @semantic.relationship.interface.inheritance

; 泛型类型参数关系
(class_declaration
  name: (identifier) @generic.class
  type_parameters: (type_parameters
    (type_parameter
      name: (identifier) @type.parameter))) @semantic.relationship.generic.parameter

; 观察者模式（@Observer注解）
(method_declaration
  name: (identifier) @observer.method
  (annotation
    name: (identifier) @observer.annotation
    (#match? @observer.annotation "Observer$"))) @semantic.relationship.observer.pattern

; 可观察对象（@Observable注解）
(class_declaration
  name: (identifier) @observable.class
  (annotation
    name: (identifier) @observable.annotation
    (#match? @observable.annotation "Observable$"))) @semantic.relationship.observable.pattern

; 事件处理器模式
(method_declaration
  name: (identifier) @event.handler
  (annotation
    name: (identifier) @event.annotation
    (#match? @event.annotation "^(EventHandler|Subscribe|Listen)$"))) @semantic.relationship.event.handler

; 依赖注入模式
(method_declaration
  parameters: (formal_parameters
    (formal_parameter
      name: (identifier) @injected.parameter
      (annotation
        name: (identifier) @inject.annotation
        (#match? @inject.annotation "^(Inject|Autowired)$"))))) @semantic.relationship.dependency.injection

; 配置属性模式
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @config.property)
  (annotation
    name: (identifier) @config.annotation
    (#match? @config.annotation "^(Value|Property|Configuration)$"))) @semantic.relationship.configuration.property

; 组件扫描模式
(class_declaration
  name: (identifier) @component.class
  (annotation
    name: (identifier) @component.annotation
    (#match? @component.annotation "^(Component|Service|Repository|Controller)$"))) @semantic.relationship.component.pattern

; 单例模式
(class_declaration
  name: (identifier) @singleton.class
  (annotation
    name: (identifier) @singleton.annotation
    (#match? @singleton.annotation "Singleton$"))) @semantic.relationship.singleton.pattern

; 工厂方法模式
(method_declaration
  name: (identifier) @factory.method
  (annotation
    name: (identifier) @factory.annotation
    (#match? @factory.annotation "^(Bean|Factory|Producer)$"))) @semantic.relationship.factory.method

; 建造者模式
(class_declaration
  name: (identifier) @builder.class
  (annotation
    name: (identifier) @builder.annotation
    (#match? @builder.annotation "Builder$"))) @semantic.relationship.builder.pattern

; 策略模式
(interface_declaration
  name: (identifier) @strategy.interface
  (annotation
    name: (identifier) @strategy.annotation
    (#match? @strategy.annotation "Strategy$"))) @semantic.relationship.strategy.interface

; 模板方法模式
(class_declaration
  name: (identifier) @template.class
  (annotation
    name: (identifier) @template.annotation
    (#match? @template.annotation "Template$"))) @semantic.relationship.template.pattern
`;