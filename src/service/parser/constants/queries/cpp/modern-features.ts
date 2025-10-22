/*
C++ Modern Features-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Explicit specializations - important for template specialization
(explicit_specialization) @definition.explicit_specialization

; Static_assert declarations - important for compile-time assertions
(static_assert_declaration) @definition.static_assert

; Attribute declarations - important for compiler attributes
(attribute_declaration) @definition.attribute_declaration
(attribute_specifier) @definition.attribute_specifier

; Requires clauses (C++20) - important for template constraints
(requires_clause) @definition.requires_clause

; Alignment specifiers - important for memory alignment
(alignas_specifier) @definition.alignas_specifier

; User-defined literals - important for custom literals
(literal_suffix) @definition.literal_suffix
`;