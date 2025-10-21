/*
Rust language structures for tree-sitter parsing
Captures all required constructs for tests
*/
export default `
; Function definitions (all types)
(function_item
    name: (identifier) @name.definition.function) @definition.function
(function_signature_item
    name: (identifier) @name.definition.function) @definition.function

; Struct definitions (all types - standard, tuple, unit)
(struct_item
    name: (type_identifier) @name.definition.struct) @definition.struct
(unit_struct_item
    name: (type_identifier) @name.definition.unit_struct) @definition.unit_struct
(tuple_struct_item
    name: (type_identifier) @name.definition.tuple_struct) @definition.tuple_struct

; Enum definitions with variants
(enum_item
    name: (type_identifier) @name.definition.enum) @definition.enum

; Trait definitions
(trait_item
    name: (type_identifier) @name.definition.trait) @definition.trait

; Impl blocks (inherent implementation)
(impl_item
    type: (type_identifier) @name.definition.impl) @definition.impl

; Trait implementations
(impl_item
    trait: (type_identifier) @name.definition.impl_trait
    type: (type_identifier) @name.definition.impl_for) @definition.impl_trait

; Module definitions
(mod_item
    name: (identifier) @name.definition.module) @definition.module

; Macro definitions
(macro_definition
    name: (identifier) @name.definition.macro) @definition.macro

; Attribute macros (for #[derive(...)] etc.)
(attribute_item
    (attribute) @name.definition.attribute) @definition.attribute

; Type aliases
(type_item
    name: (type_identifier) @name.definition.type_alias) @definition.type_alias

; Constants
(const_item
    name: (identifier) @name.definition.constant) @definition.constant

; Static items
(static_item
    name: (identifier) @name.definition.static) @definition.static

; Methods inside impl blocks
(impl_item
    body: (declaration_list
        (function_item
            name: (identifier) @name.definition.method))) @definition.method_container

; Use declarations
(use_declaration) @definition.use_declaration

; Lifetime definitions
(lifetime
    "'" @punctuation.lifetime
    (identifier) @name.definition.lifetime) @definition.lifetime

; Where clauses
(where_clause
    (where_predicate)*) @definition.where_clause

; Match expressions
(match_expression
    value: (_) @match.value
    body: (match_block)) @definition.match

; Unsafe blocks
(unsafe_block) @definition.unsafe_block

; Async functions and blocks
(async_block) @definition.async_block
(function_item
  (async_modifier) @name.definition.async_function) @definition.async_function

; Await expressions
(await_expression) @definition.await_expression

; Closure expressions
(closure_expression) @definition.closure

; Generic type parameters
(type_parameter
  (identifier) @name.definition.type_parameter) @definition.type_parameter

; Associated types in traits
(associated_type
  name: (type_identifier) @name.definition.associated_type) @definition.associated_type

; Associated constants in traits
(associated_constant
  name: (identifier) @name.definition.associated_constant) @definition.associated_constant

; Extern crates
(extern_crate_declaration
  name: (identifier) @name.definition.extern_crate) @definition.extern_crate

; Foreign function interfaces (FFI)
(foreign_item_fn
  name: (identifier) @name.definition.foreign_function) @definition.foreign_function
(foreign_static_item
  name: (identifier) @name.definition.foreign_static) @definition.foreign_static

; Union definitions
(union_item
  name: (type_identifier) @name.definition.union) @definition.union

; Visibility modifiers
(visibility_modifier) @definition.visibility

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

; Path expressions (qualified names)
(scoped_identifier
  path: (identifier) @name.definition.scope
  name: (identifier) @name.definition.scoped_name) @definition.scoped

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

; Pattern matching constructs
(let_condition) @definition.let_condition
(match_arm) @definition.match_arm
(match_pattern) @definition.match_pattern
(or_pattern) @definition.or_pattern
(tuple_struct_pattern) @definition.tuple_struct_pattern
(struct_pattern) @definition.struct_pattern
(range_pattern) @definition.range_pattern
(captured_pattern) @definition.captured_pattern
(remaining_field_pattern) @definition.remaining_field_pattern

; Conditional compilation attributes
(attribute_item
  (attribute
    (identifier) @name.definition.conditional_attribute)) @definition.conditional_attribute

; Documentation comments
(line_comment) @definition.doc_comment
(block_comment) @definition.doc_comment

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

; Loop labels
(loop_label
  (lifetime
    (identifier) @name.definition.loop_label)) @definition.loop_label

; Inline assembly
(asm_expression) @definition.asm_expression

; Const blocks
(const_block) @definition.const_block

; Higher-ranked trait bounds
(higher_ranked_trait_bound) @definition.hrtb

; Removed trait bounds (e.g., ?Sized)
(removed_trait_bound) @definition.removed_trait_bound

; Generic arguments in expressions
(generic_function
  function: (identifier) @name.definition.generic_call) @definition.generic_call

; Self and super keywords
(self) @definition.self_keyword
(super) @definition.super_keyword

; Self parameter in methods
(self_parameter) @definition.self_parameter
`
