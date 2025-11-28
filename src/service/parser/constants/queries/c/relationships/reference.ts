/*
C Reference Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的引用关系
移除了控制流相关的重复查询，控制流查询已统一到control-flow.ts中
*/
export default `
; 结构体字段引用关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.reference.function.from)
  body: (compound_statement
    (_
      (field_expression
        argument: (identifier) _
        field: (field_identifier) @relationship.reference.field.to
      ) @relationship.reference.field
    )
  )
)

; 数组元素引用关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.reference.function.from)
  body: (compound_statement
    (_
      (subscript_expression
        argument: (identifier) @relationship.reference.array.to
      ) @relationship.reference.array
    )
  )
)

; 指针解引用关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.reference.function.from)
  body: (compound_statement
    (_
      (pointer_expression
        argument: (identifier) @relationship.reference.pointer.to
      ) @relationship.reference.pointer
    )
  )
)

; 函数参数引用关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.reference.function.from)
  body: (compound_statement
    (_
      (parameter_declaration
        declarator: (identifier) @relationship.reference.parameter.to
      ) @relationship.reference.parameter
    )
  )
)

; 赋值表达式中的引用关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.reference.function.from)
  body: (compound_statement
    (_
      (assignment_expression
        left: (identifier) _
        right: (identifier) @relationship.reference.assignment.to
      ) @relationship.reference.assignment
    )
  )
)

`;