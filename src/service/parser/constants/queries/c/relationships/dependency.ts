/*
C Dependency Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的依赖关系
*/
export default `
; 头文件包含依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_include
        path: (string_literal) @relationship.dependency.include.to
      ) @relationship.dependency.include
    )
  )
)

; 系统头文件包含依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_include
        path: (system_lib_string) @relationship.dependency.system.to
      ) @relationship.dependency.system
    )
  )
)

; 宏定义依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_def
        name: (identifier) @relationship.dependency.macro.to
      ) @relationship.dependency.macro
    )
  )
)

; 宏函数定义依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_function_def
        name: (identifier) @relationship.dependency.macro-function.to
      ) @relationship.dependency.macro.function
    )
  )
)

; 条件编译依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_if
        condition: (identifier) @relationship.dependency.conditional.to
      ) @relationship.dependency.conditional
    )
  )
)

; 条件编译ifdef依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_ifdef
        name: (identifier) @relationship.dependency.ifdef.to
      ) @relationship.dependency.ifdef
    )
  )
)

; 条件编译elif依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (preproc_elif
        condition: (identifier) @relationship.dependency.elif.to
      ) @relationship.dependency.elif
    )
  )
)

; 类型引用依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (declaration
        type: (type_identifier) @relationship.dependency.type.to
      ) @relationship.dependency.type
    )
  )
)

; 结构体引用依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (field_declaration
        type: (type_identifier) @relationship.dependency.struct.to
      ) @relationship.dependency.struct
    )
  )
)

; 函数声明依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (declaration
        declarator: (function_declarator
          declarator: (identifier) @relationship.dependency.function.to
        )
      ) @relationship.dependency.function
    )
  )
)

; 枚举引用依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (declaration
        type: (enum_specifier
          name: (type_identifier) @relationship.dependency.enum.to)
      ) @relationship.dependency.enum
    )
  )
)

; 联合体引用依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (declaration
        type: (union_specifier
          name: (type_identifier) @relationship.dependency.union.to)
      ) @relationship.dependency.union
    )
  )
)

; 外部变量依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (declaration
        (storage_class_specifier) _
        declarator: (identifier) @relationship.dependency.extern.to
      ) @relationship.dependency.extern
    )
  )
)

; 静态变量依赖关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.dependency.function.from)
  body: (compound_statement
    (_
      (declaration
        (storage_class_specifier) _
        declarator: (identifier) @relationship.dependency.static.to
      ) @relationship.dependency.static
    )
  )
)
`;