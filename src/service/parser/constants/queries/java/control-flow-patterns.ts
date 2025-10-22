/*
Java Control Flow and Pattern-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Switch expressions and statements
(switch_expression
  (parenthesized_expression) @definition.switch_condition
  (switch_block) @definition.switch_body) @definition.switch

; Switch rules and labels
(switch_rule
  (switch_label) @definition.switch_label
  (_) @definition.switch_case_body) @definition.switch_case

; Record patterns (Java 19+)
(record_pattern
  (identifier) @name.definition.record_pattern) @definition.record_pattern

; Instanceof expressions with patterns
(instanceof_expression
  (identifier) @name.definition.instanceof_variable
  (_) @definition.instanceof_pattern) @definition.instanceof

; Pattern variables
(pattern
  (type_pattern
    (type_identifier) @name.definition.pattern_type
    (identifier) @name.definition.pattern_variable))) @definition.pattern

; Try-catch blocks
(try_statement
  (block) @definition.try_block
  (catch_clause
    (catch_formal_parameter
      (identifier) @name.definition.exception_variable))) @definition.try_catch

; For loops
(for_statement
  (local_variable_declaration
    declarator: (variable_declarator
      name: (identifier) @name.definition.for_variable))) @definition.for_loop

; Enhanced for loops
(enhanced_for_statement
  (identifier) @name.definition.enhanced_for_variable
  (expression) @definition.enhanced_for_iterable) @definition.enhanced_for_loop

; Line comments
(line_comment) @definition.comment

; Block comments
(block_comment) @definition.comment

; Literals
(string_literal) @definition.string_literal
(decimal_integer_literal) @definition.integer_literal
(decimal_floating_point_literal) @definition.float_literal
(character_literal) @definition.char_literal
(true) @definition.boolean_literal
(false) @definition.boolean_literal
(null_literal) @definition.null_literal
`;