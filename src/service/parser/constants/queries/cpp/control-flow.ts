/*
C++ Control Flow and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Try-catch blocks - important for exception handling
(try_statement) @definition.try_statement
(catch_clause) @definition.catch_clause

; Exception specifications - important for exception guarantees
(throw_specifier) @definition.throw_specifier
(noexcept_specifier) @definition.noexcept_specifier

; Range-based for loops - important for container iteration
(range_based_for_statement) @definition.range_for

; Control statements - important for program flow
(if_statement) @definition.control_statement
(for_statement) @definition.control_statement
(while_statement) @definition.control_statement
(do_statement) @definition.control_statement
(switch_statement) @definition.control_statement
(case_statement) @definition.control_statement
(break_statement) @definition.control_statement
(continue_statement) @definition.control_statement
(return_statement) @definition.control_statement
(goto_statement) @definition.control_statement

; Labeled statements - important for jump targets
(labeled_statement
  label: (statement_identifier) @name.definition.label) @definition.label

; Compound statements - important for block structure
(compound_statement) @definition.compound_statement

; Binary expressions - important for operations
(binary_expression) @definition.binary_expression

; Unary expressions - important for operations
(unary_expression) @definition.unary_expression

; Update expressions - important for increment/decrement
(update_expression) @definition.update_expression

; Cast expressions - important for type conversion
(cast_expression) @definition.cast_expression

; Sizeof expressions - important for size queries
(sizeof_expression) @definition.sizeof_expression

; Typeid expressions - important for type information
(typeid_expression) @definition.typeid_expression

; Parenthesized expressions - important for grouping
(parenthesized_expression) @definition.parenthesized_expression

; Conditional expressions - important for ternary operations
(conditional_expression) @definition.conditional_expression

; New and delete expressions - important for memory management
(new_expression) @definition.new_expression
(delete_expression) @definition.delete_expression

; Comments - important for documentation
(comment) @definition.comment

; Literals - important for constant values
(number_literal) @definition.number_literal
(string_literal) @definition.string_literal
(char_literal) @definition.char_literal
(true) @definition.boolean_literal
(false) @definition.boolean_literal
`;