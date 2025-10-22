/*
JavaScript Control Flow and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Control flow statements
(if_statement) @name.definition.if
(for_statement) @name.definition.for
(while_statement) @name.definition.while
(do_statement) @name.definition.do_while

; Switch statements
(switch_statement) @name.definition.switch
(switch_case) @name.definition.switch_case
(switch_default) @name.definition.switch_default

; Try-catch statements
(try_statement) @name.definition.try
(catch_clause) @name.definition.catch
(finally_clause) @name.definition.finally

; Throw statements
(throw_statement) @name.definition.throw

; Return statements
(return_statement) @name.definition.return

; Break and continue statements
(break_statement) @name.definition.break
(continue_statement) @name.definition.continue

; Labeled statements
(labeled_statement) @name.definition.labeled

; With statements
(with_statement) @name.definition.with

; Debugger statements
(debugger_statement) @name.definition.debugger

; Expression statements
(expression_statement) @name.definition.expression

; Binary expressions
(binary_expression) @name.definition.binary_expression

; Unary expressions
(unary_expression) @name.definition.unary_expression

; Update expressions
(update_expression) @name.definition.update_expression

; Logical expressions
(logical_expression) @name.definition.logical_expression

; Conditional expressions
(conditional_expression) @name.definition.conditional

; Assignment expressions
(assignment_expression) @name.definition.assignment
(augmented_assignment_expression) @name.definition.augmented_assignment

; Sequence expressions
(sequence_expression) @name.definition.sequence

; Yield expressions
(yield_expression) @name.definition.yield

; Await expressions
(await_expression) @name.definition.await
`;