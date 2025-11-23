/*
C Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
[
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable)
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable))
] @definition.variable

(assignment_expression
  left: (identifier) @name.definition.assignment) @definition.assignment
`;