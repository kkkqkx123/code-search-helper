/*
C++ and C# Shared Inheritance Relationships Tree-Sitter Query Patterns
用于识别和分析代码中的继承关系
包含C++特有的类继承、虚函数、纯虚函数、多重继承、模板继承等
包含C#特有的类继承、接口实现、泛型继承、显式接口实现等
*/
export default `
; ===== C++ 特定继承关系 =====

; 类继承关系 - 基本模式
(class_specifier
  name: (type_identifier) @inheritance.derived.class
  base_class_clause: (base_class_clause
    (type_identifier) @inheritance.base.class)) @inheritance.relationship.class.inheritance

; 多重继承关系
(class_specifier
  name: (type_identifier) @inheritance.derived.class
  base_class_clause: (base_class_clause
    (type_identifier) @inheritance.base.class.1
    (type_identifier) @inheritance.base.class.2
    (type_identifier) @inheritance.base.class.3)*)) @inheritance.relationship.multiple.inheritance

; 虚函数重写关系
(class_specifier
  name: (type_identifier) @inheritance.derived.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @inheritance.override.method)
      (virtual_specifier) @inheritance.virtual.specifier))) @inheritance.relationship.virtual.override

; 纯虚函数定义
(class_specifier
  name: (type_identifier) @inheritance.abstract.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @inheritance.pure.virtual.method)
      (virtual_specifier) @inheritance.virtual.specifier
      body: (pure_virtual_clause)))) @inheritance.relationship.pure.virtual

; 虚继承关系
(class_specifier
  name: (type_identifier) @inheritance.derived.class
  base_class_clause: (base_class_clause
    (virtual_specifier) @inheritance.virtual.inheritance.specifier
    (type_identifier) @inheritance.virtual.base.class))) @inheritance.relationship.virtual.inheritance

; 模板继承关系
(class_specifier
  name: (type_identifier) @inheritance.template.derived.class
  base_class_clause: (base_class_clause
    (template_type
      name: (type_identifier) @inheritance.template.base.class
      arguments: (template_argument_list
        (type_identifier) @inheritance.template.argument)*))) @inheritance.relationship.template.inheritance

; CRTP (Curiously Recurring Template Pattern) 继承
(class_specifier
  name: (type_identifier) @inheritance.crtp.derived.class
  base_class_clause: (base_class_clause
    (template_type
      name: (type_identifier) @inheritance.crtp.base.class
      template_arguments: (template_argument_list
        (type_identifier) @inheritance.crtp.derived.type)))) @inheritance.relationship.crtp.pattern

; 结构体继承关系
(struct_specifier
  name: (type_identifier) @inheritance.derived.struct
  base_class_clause: (base_class_clause
    (type_identifier) @inheritance.base.struct)) @inheritance.relationship.struct.inheritance

; 友元类继承关系
(friend_declaration
  (class_specifier
    name: (type_identifier) @inheritance.friend.class)) @inheritance.relationship.friend.class

; ===== C# 特定继承关系 =====

; 类继承关系
(class_declaration
  name: (identifier) @inheritance.derived.class
  base_class_clause: (base_class_clause
    (identifier) @inheritance.base.class)) @inheritance.relationship.class.inheritance

; 接口实现关系
(class_declaration
  name: (identifier) @inheritance.implementing.class
  base_class_clause: (base_class_clause
    (identifier) @inheritance.implemented.interface)) @inheritance.relationship.interface.implementation

; 多接口实现关系
(class_declaration
  name: (identifier) @inheritance.implementing.class
  base_class_clause: (base_class_clause
    (identifier) @inheritance.implemented.interface.1
    (identifier) @inheritance.implemented.interface.2
    (identifier) @inheritance.implemented.interface.3)*)) @inheritance.relationship.multiple.interface.implementation

; 接口继承关系
(interface_declaration
  name: (identifier) @inheritance.derived.interface
  base_class_clause: (base_class_clause
    (identifier) @inheritance.base.interface)) @inheritance.relationship.interface.inheritance

; 泛型类继承关系
(class_declaration
  name: (identifier) @inheritance.generic.derived.class
  type_parameters: (type_parameter_list
    (type_parameter
      name: (identifier) @inheritance.generic.type.parameter)*)
  base_class_clause: (base_class_clause
    (generic_type
      name: (identifier) @inheritance.generic.base.class
      type_arguments: (type_argument_list
        (identifier) @inheritance.generic.type.argument)*))) @inheritance.relationship.generic.inheritance

; 泛型接口实现关系
(class_declaration
  name: (identifier) @inheritance.generic.implementing.class
  type_parameters: (type_parameter_list
    (type_parameter
      name: (identifier) @inheritance.generic.type.parameter)*)
  base_class_clause: (base_class_clause
    (generic_type
      name: (identifier) @inheritance.generic.implemented.interface
      type_arguments: (type_argument_list
        (identifier) @inheritance.generic.interface.argument)*))) @inheritance.relationship.generic.interface.implementation

; 显式接口实现
(method_declaration
  (explicit_interface_specifier
    (identifier) @inheritance.explicit.interface.name)
  name: (identifier) @inheritance.explicit.implemented.method) @inheritance.relationship.explicit.interface.implementation

; 显式属性实现
(property_declaration
  (explicit_interface_specifier
    (identifier) @inheritance.explicit.interface.name)
  name: (identifier) @inheritance.explicit.implemented.property) @inheritance.relationship.explicit.interface.property

; 显式事件实现
(event_declaration
  (explicit_interface_specifier
    (identifier) @inheritance.explicit.interface.name)
  name: (identifier) @inheritance.explicit.implemented.event) @inheritance.relationship.explicit.interface.event

; 抽象类继承
(class_declaration
  (modifier) @inheritance.abstract.modifier
  name: (identifier) @inheritance.abstract.class
  base_class_clause: (base_class_clause
    (identifier) @inheritance.derived.from.abstract)
  (#match? @inheritance.abstract.modifier "abstract")) @inheritance.relationship.abstract.inheritance

; 密封类继承限制
(class_declaration
  (modifier) @inheritance.sealed.modifier
  name: (identifier) @inheritance.sealed.class
  base_class_clause: (base_class_clause
    (identifier) @inheritance.sealed.base.class)
  (#match? @inheritance.sealed.modifier "sealed")) @inheritance.relationship.sealed.inheritance

; 记录类型继承
(record_declaration
  name: (identifier) @inheritance.derived.record
  base_class_clause: (base_class_clause
    (identifier) @inheritance.base.record)) @inheritance.relationship.record.inheritance

; ===== 共享继承关系 =====

; 方法重写关系 - 使用谓词过滤
[
  (function_definition
    declarator: (function_declarator
      declarator: (field_identifier) @inheritance.override.method)
    (virtual_specifier) @inheritance.virtual.specifier)
  (method_declaration
    (modifier) @inheritance.override.modifier
    name: (identifier) @inheritance.override.method
    (#match? @inheritance.override.modifier "override"))
] @inheritance.relationship.method.override

; 属性重写关系
(property_declaration
  (modifier) @inheritance.override.modifier
  name: (identifier) @inheritance.override.property
  (#match? @inheritance.override.modifier "override")) @inheritance.relationship.property.override

; 索引器重写关系
(indexer_declaration
  (modifier) @inheritance.override.modifier
  name: (identifier) @inheritance.override.indexer
  (#match? @inheritance.override.modifier "override")) @inheritance.relationship.indexer.override

; 事件重写关系
(event_declaration
  (modifier) @inheritance.override.modifier
  name: (identifier) @inheritance.override.event
  (#match? @inheritance.override.modifier "override")) @inheritance.relationship.event.override

; 抽象方法定义
[
  (function_definition
    declarator: (function_declarator
      declarator: (field_identifier) @inheritance.abstract.method)
    body: (pure_virtual_clause))
  (method_declaration
    (modifier) @inheritance.abstract.modifier
    name: (identifier) @inheritance.abstract.method
    body: (abstract_method_body)
    (#match? @inheritance.abstract.modifier "abstract"))
] @inheritance.relationship.abstract.method

; 虚方法定义
(function_definition
  declarator: (function_declarator
    declarator: (field_identifier) @inheritance.virtual.method)
  (virtual_specifier) @inheritance.virtual.specifier) @inheritance.relationship.virtual.method

; 构造函数链式调用
[
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @inheritance.constructor.method)
    body: (compound_statement
      (constructor_initializer_list
        (constructor_initializer
          name: (identifier) @inheritance.base.constructor))))
  (constructor_declaration
    name: (identifier) @inheritance.constructor.method
    initializer: (constructor_initializer
      argument: (identifier) @inheritance.base.constructor)))
] @inheritance.relationship.constructor.chaining

; 委托继承关系
(delegate_declaration
  name: (identifier) @inheritance.delegate.name) @inheritance.relationship.delegate.definition

; 泛型约束继承
(type_parameter_constraints_clause
  (type_identifier) @inheritance.constrained.type
  (type_parameter_constraint
    type: (type_identifier) @inheritance.constraint.base.type
    (identifier) @inheritance.constraint.keyword)) @inheritance.relationship.generic.constraint.inheritance
`;