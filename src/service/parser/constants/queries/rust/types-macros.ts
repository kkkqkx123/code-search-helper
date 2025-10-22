/*
Rust Type and Macro-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Type aliases
(type_item
  name: (type_identifier) @name.definition.type_alias) @definition.type_alias

; Macro definitions
(macro_definition
  name: (identifier) @name.definition.macro) @definition.macro

; Attribute macros (for #[derive(...)] etc.)
(attribute_item
  (attribute) @name.definition.attribute) @definition.attribute

; Lifetime definitions
(lifetime
  "'" @punctuation.lifetime
  (identifier) @name.definition.lifetime) @definition.lifetime

; Where clauses
(where_clause
  (where_predicate)*) @definition.where_clause

; Generic type parameters
(type_parameter
  (identifier) @name.definition.type_parameter) @definition.type_parameter

; Associated types in traits
(associated_type
  name: (type_identifier) @name.definition.associated_type) @definition.associated_type

; Associated constants in traits
(associated_constant
  name: (identifier) @name.definition.associated_constant) @definition.associated_constant

; Visibility modifiers
(visibility_modifier) @definition.visibility

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
`;