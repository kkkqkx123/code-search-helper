/*
C Control Flow and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
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

; Parenthesized expressions - important for grouping
(parenthesized_expression) @definition.parenthesized_expression

; Comma expressions - important for multiple expressions
(comma_expression) @definition.comma_expression

; Conditional expressions - important for ternary operations
(conditional_expression) @definition.conditional_expression

; Generic expressions (C11) - important for type-generic programming
(generic_expression) @definition.generic_expression

; Alignas and alignof (C11) - important for alignment
(alignas_qualifier) @definition.alignas_qualifier
(alignof_expression) @definition.alignof_expression

; Extension expressions (GCC) - important for compiler extensions
(extension_expression) @definition.extension_expression

; Comments - important for documentation
(comment) @definition.comment

; Literals - important for constant values
(number_literal) @definition.number_literal
(string_literal) @definition.string_literal
(char_literal) @definition.char_literal
(true) @definition.boolean_literal
(false) @definition.boolean_literal
(null) @definition.null_literal

; Type qualifiers - important for type modifiers
(type_qualifier) @definition.type_qualifier

; Storage class specifiers - important for storage duration
(storage_class_specifier) @definition.storage_class

; Primitive types - important for basic types
(primitive_type) @definition.primitive_type
`;