/*
Java Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 方法重写关系 - 使用谓词过滤
(method_declaration
  name: (identifier) @overridden.method
  (annotation
    name: (identifier) @override.annotation
    (#match? @override.annotation "Override$"))) @semantic.method.override

; 类继承关系 - 使用锚点确保精确匹配
(class_declaration
  name: (identifier) @subclass.class
  superclass: (superclass
    (type_identifier) @superclass.class)
  (#not-eq? @subclass.class @superclass.class)) @semantic.class.inheritance

; 接口实现关系 - 使用量词操作符
(class_declaration
  name: (identifier) @implementing.class
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @implemented.interface)+)) @semantic.interface.implementation

; 接口继承关系
(interface_declaration
  name: (identifier) @subinterface.interface
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @superinterface.interface)+)) @semantic.interface.inheritance

; 泛型类型参数关系 - 使用量词操作符
(class_declaration
  name: (identifier) @generic.class
  type_parameters: (type_parameters
    (type_parameter
      name: (identifier) @type.parameter)+)) @semantic.generic.parameter

; 设计模式关系 - 使用参数化查询
(class_declaration
  name: (identifier) @pattern.class
  (annotation
    name: (identifier) @pattern.annotation)
  (#match? @pattern.annotation "^(Component|Service|Repository|Controller|Entity|Configuration)$"))) @semantic.design.pattern

; 观察者模式关系 - 使用谓词过滤
(method_declaration
  name: (identifier) @observer.method
  (annotation
    name: (identifier) @observer.annotation
    (#match? @observer.annotation "^(EventHandler|Subscribe|Listen|Observe)$"))) @semantic.observer.pattern

; 依赖注入关系 - 使用谓词过滤
(method_declaration
  parameters: (formal_parameters
    (formal_parameter
      name: (identifier) @injected.param
      (annotation
        name: (identifier) @inject.annotation
        (#match? @inject.annotation "^(Inject|Autowired|Value)$")))+)) @semantic.dependency.injection

; 配置属性关系 - 使用谓词过滤
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @config.property)
  (annotation
    name: (identifier) @config.annotation
    (#match? @config.annotation "^(Value|Property|Configuration)$"))) @semantic.configuration.property

; 工厂方法关系 - 使用谓词过滤
(method_declaration
  name: (identifier) @factory.method
  (annotation
    name: (identifier) @factory.annotation
    (#match? @factory.annotation "^(Bean|Factory|Producer|Builder)$"))
  return_type: (type_identifier) @product.type) @semantic.factory.method

; 单例模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @singleton.class
  (annotation
    name: (identifier) @singleton.annotation
    (#match? @singleton.annotation "^(Singleton)$"))) @semantic.singleton.pattern

; 策略模式关系 - 使用谓词过滤
(interface_declaration
  name: (identifier) @strategy.interface
  (annotation
    name: (identifier) @strategy.annotation
    (#match? @strategy.annotation "^(Strategy)$"))) @semantic.strategy.interface

; 模板方法模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @template.class
  (annotation
    name: (identifier) @template.annotation
    (#match? @template.annotation "^(Template)$"))) @semantic.template.pattern

; 建造者模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @builder.class
  (annotation
    name: (identifier) @builder.annotation
    (#match? @builder.annotation "^(Builder)$"))) @semantic.builder.pattern

; 命令模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @command.class
  (annotation
    name: (identifier) @command.annotation
    (#match? @command.annotation "^(Command)$"))) @semantic.command.pattern

; 适配器模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @adapter.class
  (annotation
    name: (identifier) @adapter.annotation
    (#match? @adapter.annotation "^(Adapter)$"))) @semantic.adapter.pattern

; 装饰器模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @decorator.class
  (annotation
    name: (identifier) @decorator.annotation
    (#match? @decorator.annotation "^(Decorator)$"))) @semantic.decorator.pattern

; 代理模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @proxy.class
  (annotation
    name: (identifier) @proxy.annotation
    (#match? @proxy.annotation "^(Proxy)$"))) @semantic.proxy.pattern

; 组合模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @composite.class
  (annotation
    name: (identifier) @composite.annotation
    (#match? @composite.annotation "^(Composite)$"))) @semantic.composite.pattern

; 迭代器模式关系 - 使用谓词过滤
(interface_declaration
  name: (identifier) @iterator.interface
  (annotation
    name: (identifier) @iterator.annotation
    (#match? @iterator.annotation "^(Iterator)$"))) @semantic.iterator.pattern

; 访问者模式关系 - 使用谓词过滤
(interface_declaration
  name: (identifier) @visitor.interface
  (annotation
    name: (identifier) @visitor.annotation
    (#match? @visitor.annotation "^(Visitor)$"))) @semantic.visitor.pattern

; 状态模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @state.class
  (annotation
    name: (identifier) @state.annotation
    (#match? @state.annotation "^(State)$"))) @semantic.state.pattern

; 责任链模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @chain.class
  (annotation
    name: (identifier) @chain.annotation
    (#match? @chain.annotation "^(ChainOfResponsibility|Handler)$"))) @semantic.chain.pattern

; 桥接模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @bridge.class
  (annotation
    name: (identifier) @bridge.annotation
    (#match? @bridge.annotation "^(Bridge)$"))) @semantic.bridge.pattern

; 外观模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @facade.class
  (annotation
    name: (identifier) @facade.annotation
    (#match? @facade.annotation "^(Facade)$"))) @semantic.facade.pattern

; 享元模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @flyweight.class
  (annotation
    name: (identifier) @flyweight.annotation
    (#match? @flyweight.annotation "^(Flyweight)$"))) @semantic.flyweight.pattern

; 备忘录模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @memento.class
  (annotation
    name: (identifier) @memento.annotation
    (#match? @memento.annotation "^(Memento)$"))) @semantic.memento.pattern

; 解释器模式关系 - 使用谓词过滤
(class_declaration
  name: (identifier) @interpreter.class
  (annotation
    name: (identifier) @interpreter.annotation
    (#match? @interpreter.annotation "^(Interpreter)$"))) @semantic.interpreter.pattern
`;