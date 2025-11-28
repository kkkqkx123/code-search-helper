/*
C Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
优先级3
*/
export default `
; 赋值数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (assignment_expression
        left: (identifier) @relationship.data_flow.assignment.to
      ) @relationship.data_flow.assignment
    )
  )
)

; 初始化赋值数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (init_declarator
        declarator: (identifier) @relationship.data_flow.init.to
      ) @relationship.data_flow.assignment
    )
  )
)

; 复合赋值数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (assignment_expression
        left: (identifier) @relationship.data_flow.compound.to
        right: (binary_expression
          operator: ["+" "-" "*" "/" "%" "&" "|" "^" "<<" ">>"]
        )
      ) @relationship.data_flow.compound.assignment
    )
  )
)

; 增量数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (update_expression
        argument: (identifier) @relationship.data_flow.increment.to
        operator: "++"
      ) @relationship.data_flow.increment
    )
  )
)

; 减量数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (update_expression
        argument: (identifier) @relationship.data_flow.decrement.to
        operator: "--"
      ) @relationship.data_flow.decrement
    )
  )
)

; 函数调用数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.data_flow.call.to
      ) @relationship.data_flow.parameter.passing
    )
  )
)

; 返回值数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (return_statement
        (identifier) @relationship.data_flow.return.to
      ) @relationship.data_flow.return.value
    )
  )
)

; 指针操作数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (assignment_expression
        left: (identifier) @relationship.data_flow.pointer.to
        right: (pointer_expression
          argument: (identifier) _
        )
      ) @relationship.data_flow.pointer.operation
    )
  )
)

; 类型转换数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (cast_expression
        value: (identifier) @relationship.data_flow.cast.to
      ) @relationship.data_flow.type.conversion
    )
  )
)

; 条件表达式数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (assignment_expression
        left: (identifier) @relationship.data_flow.conditional.to
        right: (conditional_expression
          condition: (identifier) _
        )
      ) @relationship.data_flow.conditional.operation
    )
  )
)

; 内存操作数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.data_flow.memory.to
      ) @relationship.data_flow.memory.operation
    )
  )
)

; 链式访问数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (assignment_expression
        left: (field_expression
          argument: (field_expression
            argument: (identifier) _)
          field: (field_identifier) _)
        right: (identifier) @relationship.data_flow.chained.to
      ) @relationship.data_flow.chained.access
    )
  )
)

; 宏调用数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (init_declarator
        declarator: (identifier) @relationship.data_flow.macro.to
        value: (identifier) _
      ) @relationship.data_flow.macro.assignment
    )
  )
)

; sizeof表达式数据流查询
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.data_flow.function.from)
  body: (compound_statement
    (_
      (sizeof_expression
        (parenthesized_expression
          (identifier) @relationship.data_flow.sizeof.to)
      ) @relationship.data_flow.sizeof.operation
    )
  )
)
`;