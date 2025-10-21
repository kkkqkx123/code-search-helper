/*
TypeScript Class-specific Tree-Sitter Query Patterns
*/
export default `
(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Generic class declarations
(class_declaration
  type_parameters: (type_parameters)) @definition.generic_class

; Decorator definitions with decorated class
(export_statement
  decorator: (decorator
    (call_expression
      function: (identifier) @name.definition.decorator))
  declaration: (class_declaration
    name: (type_identifier) @name.definition.decorated_class)) @definition.decorated_class

; Constructor
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Getter/Setter Methods
(method_definition
  name: (property_identifier) @name.definition.accessor) @name.definition.accessor

; Static initialization blocks
(class_static_block) @definition.static_block

; Private identifier patterns
(private_property_identifier) @name.definition.private_identifier
`;