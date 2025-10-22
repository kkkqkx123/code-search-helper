/*
Kotlin Constructor and Property-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Primary constructor declarations
(class_declaration
  (primary_constructor) @definition.primary_constructor) @definition.primary_constructor

; Constructor parameters (properties in primary constructor)
(class_parameter
  (simple_identifier) @name.definition.property) @definition.constructor_property

; Property declarations
(property_declaration
  (variable_declaration
    (simple_identifier) @name.definition.property)) @definition.property
`;