/*
TypeScript Property-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Public field definitions - important for class structure
(public_field_definition
  name: (property_identifier) @name.definition.property) @definition.property

; Private field definitions - important for encapsulation understanding
(private_field_definition
  name: (private_property_identifier) @name.definition.private_property) @definition.private_property

; Protected field definitions - important for inheritance understanding
(protected_field_definition
  name: (property_identifier) @name.definition.protected_property) @definition.protected_property

; Parameter properties - important for constructor patterns
(parameter_property
  name: (identifier) @name.definition.parameter_property) @definition.parameter_property
`;