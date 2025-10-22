/*
TypeScript Class-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Class declarations - primary code structure
(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Abstract class declarations - important for inheritance structure
(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Generic class declarations - important for type understanding
(class_declaration
  type_parameters: (type_parameters)) @definition.generic_class

; Constructor - important class entry point
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Static initialization blocks - important for class setup
(class_static_block) @definition.static_block
`;