/*
Rust Variable and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Constants
(const_item
  name: (identifier) @name.definition.constant) @definition.constant

; Static items
(static_item
  name: (identifier) @name.definition.static) @definition.static

; Variable declarations (let bindings)
(let_declaration
  pattern: (identifier) @name.definition.variable) @definition.variable

; Assignment expressions
(assignment_expression
  left: (identifier) @name.definition.assignment) @definition.assignment

; Call expressions
(call_expression
  function: (identifier) @name.definition.call) @definition.call

; Field expressions (method calls and field access)
(field_expression
  field: (field_identifier) @name.definition.field) @definition.field

; Binary expressions
(binary_expression) @definition.binary_expression

; Unary expressions
(unary_expression) @definition.unary_expression

; Update expressions
(update_expression) @definition.update_expression

; Cast expressions
(cast_expression) @definition.cast_expression

; Array expressions
(array_expression) @definition.array_expression

; Tuple expressions
(tuple_expression) @definition.tuple_expression

; Index expressions
(index_expression) @definition.index_expression

; Range expressions
(range_expression) @definition.range_expression

; Await expressions
(await_expression) @definition.await_expression

; Type ascription expressions
(type_ascription
  value: (identifier) @name.definition.typed_value) @definition.typed_value

; Literal expressions
(integer_literal) @definition.integer_literal
(float_literal) @definition.float_literal
(string_literal) @definition.string_literal
(char_literal) @definition.char_literal
(boolean_literal) @definition.boolean_literal
(unit_expression) @definition.unit_literal

; References and borrowing
(reference_expression) @definition.reference
(mutable_specifier) @definition.mutable

; Dereference expressions
(unary_expression
  operator: "*") @definition.dereference

; Error propagation (try operator)
(try_operator) @definition.try_operator

; Return, continue, break statements
(return_expression) @definition.return_statement
(continue_expression) @definition.continue_statement
(break_expression) @definition.break_statement

; Self and super keywords
(self) @definition.self_keyword
(super) @definition.super_keyword

; Self parameter in methods
(self_parameter) @definition.self_parameter

; Generic arguments in expressions
(generic_function
  function: (identifier) @name.definition.generic_call) @definition.generic_call
`;