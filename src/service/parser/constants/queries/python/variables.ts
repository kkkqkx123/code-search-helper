/*
Python Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Variable assignments
(assignment
  left: (identifier) @name.definition.variable) @definition.variable

; Augmented assignments
(augmented_assignment
  left: (identifier) @name.definition.augmented_assignment) @definition.augmented_assignment

; Named expressions (walrus operator)
(named_expression
  name: (identifier) @name.definition.named_expression) @definition.named_expression

; Module-level assignments that might be constants
(assignment
  left: (identifier) @name.definition.constant
  (#match? @name.definition.constant "^[A-Z_][A-Z0-9_]*$")) @definition.constant
`;