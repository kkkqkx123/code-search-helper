/*
Kotlin Constructor and Property-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Primary constructor declarations
(class_declaration
  (primary_constructor) @definition.primary_constructor
)

; Secondary constructor declarations
(secondary_constructor) @definition.secondary_constructor

; Property declarations
(property_declaration
  (variable_declaration
    (simple_identifier) @name.definition.property)
) @definition.property

; Property declarations with accessors
(property_declaration
  (variable_declaration
    (simple_identifier) @name.definition.property)
  (getter)? @definition.getter
  (setter)? @definition.setter
) @definition.property_with_accessors
`;