/*
C++ Namespace and Module-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Namespace definitions - primary code organization
(namespace_definition
  name: (namespace_identifier) @name.definition.namespace) @definition.namespace

; Nested namespace definitions - important for hierarchical organization
(namespace_definition
  body: (declaration_list
    (namespace_definition
      name: (namespace_identifier) @name.definition.namespace))) @definition.namespace

; Using declarations - important for name resolution
(using_declaration) @definition.using
`;