/*
TypeScript Control Flow Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter-typescript grammar
*/
export default `
; Control flow statements
(if_statement) @name.definition.if

; For statements
(for_statement
  body: (statement_block) @name.definition.for) @definition.for

; For in statements
(for_in_statement
  body: (statement_block) @name.definition.for_in) @definition.for_in

; For of statements
(for_of_statement
  body: (statement_block) @name.definition.for_of) @definition.for_of

; While statements
(while_statement
  body: (statement_block) @name.definition.while) @definition.while

; Do while statements
(do_statement
  body: (statement_block) @name.definition.do_while) @definition.do_while

; Switch statements
(switch_statement
  body: (switch_body) @name.definition.switch) @definition.switch

; Switch case
(switch_case
  value: (_) @name.definition.switch_case) @definition.switch_case

; Switch default
(switch_default) @name.definition.switch_default

; Try-catch-finally statements
(try_statement
  body: (statement_block) @name.definition.try) @definition.try

(catch_clause
  body: (statement_block) @name.definition.catch) @definition.catch

(finally_clause
  body: (statement_block) @name.definition.finally) @definition.finally

; Throw statements
(throw_statement) @name.definition.throw

; Return statements
(return_statement) @name.definition.return

; Break statements
(break_statement) @name.definition.break

; Continue statements
(continue_statement) @name.definition.continue

; Labeled statements
(labeled_statement
  body: (_) @name.definition.labeled) @definition.labeled

; Debugger statements
(debugger_statement) @name.definition.debugger

; Yield expressions
(yield_expression) @name.definition.yield

; Await expressions
(await_expression) @name.definition.await

; Ternary expressions
(ternary_expression
  condition: (_) @name.definition.ternary_condition
  consequence: (_) @name.definition.ternary_consequence
  alternative: (_) @name.definition.ternary_alternative) @definition.ternary
`;