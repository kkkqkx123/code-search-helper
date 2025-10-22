/*
Rust Control Flow-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Match expressions
(match_expression
  value: (_) @match.value
  body: (match_block)) @definition.match

; Unsafe blocks
(unsafe_block) @definition.unsafe_block

; Loop expressions
(loop_expression) @definition.loop
(while_expression) @definition.while_loop
(for_expression) @definition.for_loop

; Conditional expressions
(if_expression) @definition.if_expression

; Block expressions
(block) @definition.block

; Parenthesized expressions
(parenthesized_expression) @definition.parenthesized_expression

; Try expressions (using ? operator)
(try_expression) @definition.try_expression
`;