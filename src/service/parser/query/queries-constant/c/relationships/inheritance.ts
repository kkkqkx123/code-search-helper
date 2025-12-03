/*
C Inheritance Relationships-specific Tree-Sitter Query Patterns
用于识别和分析C语言中模拟继承关系的模式（通过结构体嵌套和函数指针模拟）
*/
export default `
; 结构体嵌套关系 - C语言中模拟继承的常用模式
(struct_specifier
  name: (type_identifier) @relationship.composition.derived
  body: (field_declaration_list
    (field_declaration
      declarator: (field_identifier) @relationship.composition.base.field
      type: (type_identifier) @relationship.composition.base.type)
    )
  ) @relationship.composition.nested

; 函数指针表关系 - C语言中模拟面向对象的模式
(struct_specifier
  name: (type_identifier) @relationship.vtable.struct
  body: (field_declaration_list
    (field_declaration
      declarator: (field_identifier) @relationship.vtable.method
      type: (pointer_declarator
        type: (function_declarator
          declarator: (field_identifier) @relationship.vtable.function
          parameters: (parameter_list))))
    )
  ) @relationship.vtable.definition

; 结构体中包含函数指针的模式
(field_declaration
  type: (pointer_declarator
    type: (function_declarator
      declarator: (field_identifier) @relationship.function.pointer.name))
  declarator: (field_identifier) @relationship.function.pointer.field
) @relationship.function.pointer

; 结构体继承模式（通过嵌套第一个字段实现）
(struct_specifier
  name: (type_identifier) @relationship.inheritance.derived
  body: (field_declaration_list
    (field_declaration
      type: (type_identifier) @relationship.inheritance.base
      declarator: (field_identifier) @relationship.inheritance.base.field)
    )
  ) @relationship.inheritance.pattern

; 通过函数指针实现多态的模式
(assignment_expression
  left: (field_expression
    argument: (identifier) @relationship.polymorphism.object
    field: (field_identifier) @relationship.polymorphism.method)
  right: (identifier) @relationship.polymorphism.function
) @relationship.polymorphism.assignment
`;