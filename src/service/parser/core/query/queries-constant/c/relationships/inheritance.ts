/*
C Inheritance Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的继承关系（在C中通过结构体嵌套和函数指针模拟）
*/
export default `
; 结构体嵌套继承关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (struct_specifier
        name: (type_identifier) @relationship.inheritance.nested.to
        body: (field_declaration_list
          (field_declaration
            type: (struct_specifier
              name: (type_identifier) _))
        )
      ) @relationship.inheritance.nested
    )
  )
)

; 结构体组合关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (struct_specifier
        name: (type_identifier) @relationship.inheritance.composition.to
        body: (field_declaration_list
          (field_declaration
            type: (type_identifier) _))
        )
      ) @relationship.inheritance.composition
    )
  )
)

; 函数指针接口实现关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (field_declaration
        type: (function_declarator
          declarator: (pointer_declarator
            declarator: (field_identifier) @relationship.inheritance.interface.to))
      ) @relationship.inheritance.interface
    )
  )
)

; 结构体前向声明关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (struct_specifier
        name: (type_identifier) @relationship.inheritance.forward.to
      ) @relationship.inheritance.forward
    )
  )
)

; 联合体嵌套关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (union_specifier
        name: (type_identifier) @relationship.inheritance.union.to
        body: (field_declaration_list
          (field_declaration
            type: (union_specifier
              name: (type_identifier) _))
        )
      ) @relationship.inheritance.union.nested
    )
  )
)

; 枚举继承关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (enum_specifier
        name: (type_identifier) @relationship.inheritance.enum.to
        body: (enumerator_list
          (enumerator
            name: (identifier) _))
      ) @relationship.inheritance.enum
    )
  )
)

; 类型别名继承关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (type_definition
        type: (struct_specifier
          name: (type_identifier) _)
        declarator: (type_identifier) @relationship.inheritance.alias.to
      ) @relationship.inheritance.type.alias
    )
  )
)

; 函数指针数组实现多态关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (field_declaration
        type: (array_declarator
          type: (pointer_declarator
            type: (function_declarator
              declarator: (field_identifier) @relationship.inheritance.polymorphic.to))
        )
      ) @relationship.inheritance.polymorphic
    )
  )
)

; 结构体包含函数指针表关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (struct_specifier
        name: (type_identifier) @relationship.inheritance.vtable.to
        body: (field_declaration_list
          (field_declaration
            type: (pointer_declarator
              type: (type_identifier) _))
        )
      ) @relationship.inheritance.vtable
    )
  )
)

; 回调函数实现关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (field_declaration
        type: (function_declarator
          declarator: (pointer_declarator
            declarator: (field_identifier) @relationship.inheritance.callback.to))
      ) @relationship.inheritance.callback
    )
  )
)

; 结构体指针继承关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (field_declaration
        type: (pointer_declarator
          type: (type_identifier) @relationship.inheritance.pointer.to)
      ) @relationship.inheritance.pointer
    )
  )
)

; 嵌套结构体访问关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.inheritance.function.from)
  body: (compound_statement
    (_
      (field_expression
        argument: (identifier) _
        field: (field_identifier) @relationship.inheritance.access.to
      ) @relationship.inheritance.access
    )
  )
)
`;