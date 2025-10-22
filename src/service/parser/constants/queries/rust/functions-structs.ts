/*
Rust Function and Struct-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
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

; Methods inside impl blocks
(impl_item
    body: (declaration_list
        (function_item
            name: (identifier) @name.definition.method))) @definition.method_container

; Union definitions
(union_item
    name: (type_identifier) @name.definition.union) @definition.union

; Async functions and blocks
(async_block) @definition.async_block
(function_item
  (async_modifier) @name.definition.async_function) @definition.async_function

; Closure expressions
(closure_expression) @definition.closure
`;