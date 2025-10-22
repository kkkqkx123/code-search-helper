/*
TypeScript Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Variable declarations - important for understanding state
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.variable)) @definition.variable

; Const declarations - important for understanding constants
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.constant)) @definition.constant

; Public field definitions - important for class properties
(public_field_definition
  name: (property_identifier) @name.definition.property) @definition.property

; Assignment expressions - important for understanding state changes
(assignment_expression
  left: (identifier) @name.assignment) @definition.assignment
`;