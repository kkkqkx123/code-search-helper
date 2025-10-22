/*
Python Control Flow and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; With statements
(with_statement) @name.definition.with_statement

; Try statements
(try_statement) @name.definition.try_statement

; Except clauses
(except_clause) @name.definition.except_clause

; Finally clause
(finally_clause) @name.definition.finally_clause

; Match case statements (Python 3.10+)
(match_statement) @name.definition.match
(case_clause) @name.definition.case

; Control flow statements
(if_statement) @name.definition.if
(for_statement) @name.definition.for
(while_statement) @name.definition.while

; Loop control
(break_statement) @name.definition.break
(continue_statement) @name.definition.continue

; Return statements
(return_statement) @name.definition.return

; Yield statements
(yield) @name.definition.yield

; Raise statements
(raise_statement) @name.definition.raise

; Assert statements
(assert_statement) @name.definition.assert

; Pass statements
(pass_statement) @name.definition.pass

; Del statements
(del_statement) @name.definition.del

; Expression statements
(expression_statement) @name.definition.expression

; Binary operations
(binary_operator) @name.definition.binary_operator

; Unary operations
(unary_operator) @name.definition.unary_operator

; Comparison operations
(comparison_operator) @name.definition.comparison_operator

; Boolean operations
(boolean_operator) @name.definition.boolean_operator

; Conditional expressions
(conditional_expression) @name.definition.conditional

; List splat operations
(list_splat) @name.definition.list_splat
(dictionary_splat) @name.definition.dictionary_splat

; Function calls
(call) @name.definition.call

; Attribute access
(attribute) @name.definition.attribute

; Subscript expressions
(subscript) @name.definition.subscript
`;