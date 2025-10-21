/*
JavaScript Class-specific Tree-Sitter Query Patterns
*/
export default `
(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name)
    (class_declaration
      name: (_) @name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

(class_declaration
  name: (identifier) @name.definition.class) @definition.class

(class
  name: (identifier) @name.definition.class) @definition.class

; Constructor
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Getter/Setter Methods
(method_definition
  name: (property_identifier) @name.definition.accessor) @name.definition.accessor

; Static methods
(method_definition
  name: (property_identifier) @name.definition.static
  (#match? @name.definition.static "^static")) @definition.static

; Private class fields
(private_property_identifier) @name.definition.private_field

; Class expressions
(class_expression
  name: (identifier) @name.definition.class) @definition.class
`;