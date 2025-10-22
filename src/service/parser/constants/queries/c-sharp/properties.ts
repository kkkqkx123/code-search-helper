/*
C# Property and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Property declarations - important for encapsulation
(property_declaration
  name: (identifier) @name) @definition.property

; Indexer declarations - important for indexed access
(indexer_declaration
  name: (identifier) @name) @definition.indexer

; Event declarations - important for event handling
(event_declaration
  name: (identifier) @name) @definition.event

; Delegate declarations - important for function pointers
(delegate_declaration
  name: (identifier) @name) @definition.delegate

; Variable declarations - important for local variables
(local_declaration_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @name))) @definition.local_variable

; Loop variables - important for iteration
(for_each_statement
  left: (identifier) @name) @definition.loop_variable

; Catch variables - important for exception handling
(catch_declaration
  name: (identifier) @name) @definition.catch_variable

; Declaration expressions - important for pattern matching
(declaration_expression
  name: (identifier) @name) @definition.declaration_expression
`;