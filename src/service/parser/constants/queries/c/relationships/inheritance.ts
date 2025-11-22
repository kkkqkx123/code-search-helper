/*
C Inheritance Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的继承关系（在C中通过结构体嵌套和函数指针模拟）
*/
export default `
; 结构体嵌套继承关系
(struct_specifier
  name: (type_identifier) @inheritance.parent.struct
  body: (field_declaration_list
    (field_declaration
      type: (struct_specifier
        name: (type_identifier) @inheritance.child.struct)
      declarator: (field_identifier) @inheritance.field.name))) @inheritance.relationship.nested

; 结构体组合关系
(struct_specifier
  name: (type_identifier) @inheritance.container.struct
  body: (field_declaration_list
    (field_declaration
      type: (type_identifier) @inheritance.component.type
      declarator: (field_identifier) @inheritance.component.field))) @inheritance.relationship.composition

; 函数指针接口实现关系
(field_declaration
  type: (function_declarator
    declarator: (pointer_declarator
      declarator: (field_identifier) @inheritance.method.pointer)
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier) @inheritance.parameter.type
        declarator: (identifier) @inheritance.parameter.name)*)?)
  declarator: (field_identifier) @inheritance.interface.field) @inheritance.relationship.interface

; 结构体前向声明关系
(struct_specifier
  name: (type_identifier) @inheritance.forward.struct
  body: (field_declaration_list)?) @inheritance.relationship.forward

; 联合体嵌套关系
(union_specifier
  name: (type_identifier) @inheritance.parent.union
  body: (field_declaration_list
    (field_declaration
      type: (union_specifier
        name: (type_identifier) @inheritance.child.union)
      declarator: (field_identifier) @inheritance.field.name))) @inheritance.relationship.union.nested

; 枚举继承关系（通过枚举值引用）
(enum_specifier
  name: (type_identifier) @inheritance.parent.enum
  body: (enumerator_list
    (enumerator
      name: (identifier) @inheritance.enum.value))) @inheritance.relationship.enum

; 类型别名继承关系
(type_definition
  type: (struct_specifier
    name: (type_identifier) @inheritance.base.struct)
  declarator: (type_identifier) @inheritance.derived.type) @inheritance.relationship.type.alias

; 函数指针数组实现多态关系
(field_declaration
  type: (array_declarator
    type: (pointer_declarator
      type: (function_declarator
        declarator: (field_identifier) @inheritance.polymorphic.method))
    size: (_)?)
  declarator: (field_identifier) @inheritance.vtable.field) @inheritance.relationship.polymorphic

; 结构体包含函数指针表关系
(struct_specifier
  name: (type_identifier) @inheritance.class.struct
  body: (field_declaration_list
    (field_declaration
      type: (pointer_declarator
        type: (type_identifier) @inheritance.vtable.type)
      declarator: (field_identifier) @inheritance.vtable.pointer))) @inheritance.relationship.vtable

; 回调函数实现关系
(field_declaration
  type: (function_declarator
    declarator: (pointer_declarator
      declarator: (field_identifier) @inheritance.callback.pointer))
  declarator: (field_identifier) @inheritance.callback.field) @inheritance.relationship.callback

; 结构体指针继承关系
(field_declaration
  type: (pointer_declarator
    type: (type_identifier) @inheritance.base.type)
  declarator: (field_identifier) @inheritance.pointer.field)) @inheritance.relationship.pointer

; 嵌套结构体访问关系
(field_expression
  argument: (identifier) @inheritance.outer.struct
  field: (field_identifier) @inheritance.inner.field)) @inheritance.relationship.access
`;