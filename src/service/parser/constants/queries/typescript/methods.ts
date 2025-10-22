/*
TypeScript Method-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Method definitions - important for class behavior
(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

; Method signatures - important for interface definitions
(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

; Abstract method signatures - important for abstract classes
(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

; Getter/Setter methods - important for property access
(method_definition
  name: (property_identifier) @name.definition.accessor) @name.definition.accessor
`;