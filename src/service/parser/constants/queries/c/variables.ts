/*
C Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Global variables - primary code structure
(declaration
  type: (_)
  declarator: (identifier) @name.definition.variable) @definition.variable

; Variable declarations with storage class specifiers
(declaration
  (storage_class_specifier)
  type: (_)
  declarator: (identifier) @name.definition.variable) @definition.variable

; Variable declarations with initialization - important for initialization
(declaration
  type: (_)
  declarator: (init_declarator
    declarator: (identifier) @name.definition.variable)) @definition.variable

; Assignment expressions - important for variable assignment
(assignment_expression
  left: (identifier) @name.definition.assignment) @definition.assignment
`;