/*
C Control Flow-specific Tree-Sitter Query Patterns
用于识别和分析代码中的控制流模式
优先级4
*/
export default `
; if语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (if_statement
        condition: (identifier) @relationship.control_flow.if.to
      ) @relationship.control_flow.if
    )
  )
)

; if-else语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (if_statement
        condition: (identifier) @relationship.control_flow.else.to
        alternative: (else_clause
          (statement) _)
      ) @relationship.control_flow.if.else
    )
  )
)

; 嵌套if语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (if_statement
        condition: (identifier) @relationship.control_flow.nested.to
        consequence: (compound_statement
          (if_statement
            condition: (identifier) _))
      ) @relationship.control_flow.nested.if
    )
  )
)

; else-if语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (if_statement
        condition: (identifier) @relationship.control_flow.elseif.to
        alternative: (else_clause
          (if_statement
            condition: (identifier) _))
      ) @relationship.control_flow.else.if
    )
  )
)

; switch语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (switch_statement
        condition: (identifier) @relationship.control_flow.switch.to
      ) @relationship.control_flow.switch
    )
  )
)

; case语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (case_statement
        value: (identifier) @relationship.control_flow.case.to
      ) @relationship.control_flow.switch.case
    )
  )
)

; while循环控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (while_statement
        condition: (identifier) @relationship.control_flow.while.to
      ) @relationship.control_flow.while
    )
  )
)

; do-while循环控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (do_statement
        condition: (identifier) @relationship.control_flow.dowhile.to
      ) @relationship.control_flow.do.while
    )
  )
)

; for循环控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (for_statement
        condition: (identifier) @relationship.control_flow.for.to
      ) @relationship.control_flow.for
    )
  )
)

; break语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (break_statement) @relationship.control_flow.loop.break
    )
  )
)

; continue语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (continue_statement) @relationship.control_flow.loop.continue
    )
  )
)

; goto语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (goto_statement
        (statement_identifier) @relationship.control_flow.goto.to
      ) @relationship.control_flow.goto
    )
  )
)

; 标签语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (labeled_statement
        label: (statement_identifier) @relationship.control_flow.label.to
      ) @relationship.control_flow.label
    )
  )
)

; return语句控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (return_statement
        (identifier) @relationship.control_flow.return.to
      ) @relationship.control_flow.return
    )
  )
)

; 条件表达式控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (conditional_expression
        condition: (identifier) @relationship.control_flow.conditional.to
      ) @relationship.control_flow.conditional.expression
    )
  )
)

; 逻辑运算符控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (binary_expression
        left: (identifier) @relationship.control_flow.logical.to
        operator: ["&&" "||"]
      ) @relationship.control_flow.logical.operator
    )
  )
)

; 逗号表达式控制流
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.control_flow.function.from)
  body: (compound_statement
    (_
      (comma_expression
        left: (identifier) @relationship.control_flow.comma.to
      ) @relationship.control_flow.comma.expression
    )
  )
)

`;