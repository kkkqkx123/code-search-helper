/*
JavaScript Method-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Method definitions in classes
(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

; Constructor methods
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Getter methods
(method_definition
  name: (property_identifier) @name.definition.getter
  (#match? @name.definition.getter "^get")) @definition.getter

; Setter methods
(method_definition
  name: (property_identifier) @name.definition.setter
  (#match? @name.definition.setter "^set")) @definition.setter

; Static methods
(method_definition
  name: (property_identifier) @name.definition.static
  (#match? @name.definition.static "^static")) @definition.static

; Async methods
(method_definition
  "async"
  name: (property_identifier) @name.definition.async_method) @definition.async_method

; Generator methods
(method_definition
  "*"
  name: (property_identifier) @name.definition.generator_method) @definition.generator_method

; Private methods
(private_property_identifier) @name.definition.private_method

; Computed method names
(method_definition
  name: (computed_property_name) @name.definition.computed_method) @definition.computed_method
`;