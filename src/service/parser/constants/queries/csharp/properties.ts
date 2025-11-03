/*
C# Property and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Property declarations - important for encapsulation
(property_declaration
  name: (identifier) @name.definition.property) @definition.property

; Indexer declarations - important for indexed access
(indexer_declaration
  name: (identifier) @name.definition.indexer) @definition.indexer

; Event declarations - important for event handling
(event_declaration
  name: (identifier) @name.definition.event) @definition.event

; Delegate declarations - important for function pointers
(delegate_declaration
  name: (identifier) @name.definition.delegate) @definition.delegate

; Variable declarations - important for local variables
(local_declaration_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @name.definition.local_variable))) @definition.local_variable

; Loop variables - important for iteration
(for_each_statement
  left: (variable_declaration
    (variable_declarator
      name: (identifier) @name.definition.loop_variable))) @definition.loop_variable

; Catch variables - important for exception handling
(catch_declaration
  name: (identifier) @name.definition.catch_variable) @definition.catch_variable

; Declaration expressions - important for pattern matching
(declaration_expression
  name: (identifier) @name.definition.declaration_expression) @definition.declaration_expression
`;