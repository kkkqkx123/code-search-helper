/*
Python Control Flow and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Control flow statements
(if_statement) @name.definition.if
(for_statement) @name.definition.for
(while_statement) @name.definition.while

; Loop control
(break_statement) @name.definition.break
(continue_statement) @name.definition.continue

; Return statements
(return_statement) @name.definition.return

; Raise statements
(raise_statement) @name.definition.raise

; Assert statements
(assert_statement) @name.definition.assert

; Expression statements
(expression_statement) @name.definition.expression

; Binary operations
(binary_operator) @name.definition.binary_operator

; Function calls
(call) @name.definition.call

; Attribute access
(attribute) @name.definition.attribute

; Subscript expressions
(subscript) @name.definition.subscript
`;