/*
C Annotation Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的注解关系
*/
export default `
; C11属性说明符
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.annotation.function.from)
  body: (compound_statement
    (_
      (attribute_declaration
        (attribute
          name: (identifier) @relationship.annotation.attribute.to)
      ) @relationship.annotation.attribute
    )
  )
)

; 类型注解
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.annotation.function.from)
  body: (compound_statement
    (_
      (type_definition
        (attribute
          name: (identifier) @relationship.annotation.type.to)
      ) @relationship.annotation.type
    )
  )
)

; 变量注解
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.annotation.function.from)
  body: (compound_statement
    (_
      (declaration
        (attribute
          name: (identifier) @relationship.annotation.variable.to)
      ) @relationship.annotation.variable
    )
  )
)

; 结构体字段注解
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.annotation.function.from)
  body: (compound_statement
    (_
      (field_declaration
        (attribute
          name: (identifier) @relationship.annotation.field.to)
      ) @relationship.annotation.field
    )
  )
)
`;