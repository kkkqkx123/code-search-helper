/*
Java Control Flow and Pattern-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Switch expressions
(switch_expression) @name.definition.switch_expression

; Switch blocks
(switch_block) @name.definition.switch_block

; Switch rules
(switch_rule) @name.definition.switch_rule

; Switch labels
(switch_label) @name.definition.switch_label

; Switch block statement groups
(switch_block_statement_group) @name.definition.switch_block_statement_group

; Guard clauses in switch
(guard) @name.definition.guard

; Record patterns
(record_pattern) @name.definition.record_pattern

; Record pattern bodies
(record_pattern_body) @name.definition.record_pattern_body

; Record pattern components
(record_pattern_component
  (identifier) @name.definition.record_pattern_component) @name.definition.record_pattern_component

; Type patterns
(type_pattern) @name.definition.type_pattern

; Underscore patterns
(underscore_pattern) @name.definition.underscore_pattern

; Pattern variables in type patterns
(type_pattern
  (identifier) @name.definition.pattern_variable) @name.definition.type_pattern_with_variable

; Instanceof expressions with patterns
(instanceof_expression) @name.definition.instanceof_with_pattern

; Try statements
(try_statement) @name.definition.try_statement

; Try blocks
(try_statement
  (block) @name.definition.try_block) @name.definition.try_with_block

; Catch clauses
(catch_clause) @name.definition.catch_clause

; Catch formal parameters
(catch_formal_parameter
  name: (identifier) @name.definition.exception_variable) @name.definition.catch_parameter

; Try with resources
(try_with_resources_statement) @name.definition.try_with_resources

; For statements
(for_statement) @name.definition.for_statement

; Enhanced for statements
(enhanced_for_statement) @name.definition.enhanced_for_statement

; For loop variables
(enhanced_for_statement
  name: (identifier) @name.definition.for_variable) @name.definition.enhanced_for_variable

; For loop iterables
(enhanced_for_statement
  value: (expression) @name.definition.for_iterable) @name.definition.enhanced_for_with_iterable

; While statements
(while_statement) @name.definition.while_statement

; Do statements
(do_statement) @name.definition.do_statement

; If statements
(if_statement) @name.definition.if_statement

; If conditions
(if_statement
  condition: (parenthesized_expression) @name.definition.if_condition) @name.definition.if_with_condition

; Return statements
(return_statement) @name.definition.return_statement

; Yield statements
(yield_statement) @name.definition.yield_statement

; Break statements
(break_statement) @name.definition.break_statement

; Continue statements
(continue_statement) @name.definition.continue_statement

; Throw statements
(throw_statement) @name.definition.throw_statement

; Assert statements
(assert_statement) @name.definition.assert_statement

; Synchronized statements
(synchronized_statement) @name.definition.synchronized_statement

; Labeled statements
(labeled_statement) @name.definition.labeled_statement

; Block statements
(block) @name.definition.block

; Expression statements
(expression_statement) @name.definition.expression_statement

; Line comments
(line_comment) @name.definition.line_comment

; Block comments
(block_comment) @name.definition.block_comment

; String literals
(string_literal) @name.definition.string_literal

; String fragments
(string_fragment) @name.definition.string_fragment

; Escape sequences
(escape_sequence) @name.definition.escape_sequence

; Character literals
(character_literal) @name.definition.character_literal

; Decimal integer literals
(decimal_integer_literal) @name.definition.decimal_integer_literal

; Hex integer literals
(hex_integer_literal) @name.definition.hex_integer_literal

; Octal integer literals
(octal_integer_literal) @name.definition.octal_integer_literal

; Binary integer literals
(binary_integer_literal) @name.definition.binary_integer_literal

; Decimal floating point literals
(decimal_floating_point_literal) @name.definition.decimal_floating_point_literal

; Hex floating point literals
(hex_floating_point_literal) @name.definition.hex_floating_point_literal

; Boolean literals
(true) @name.definition.true_literal
(false) @name.definition.false_literal

; Null literal
(null_literal) @name.definition.null_literal

; Identifiers
(identifier) @name.definition.identifier
`;