/*
TypeScript Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Import statements - important for understanding dependencies
(import_statement
  source: (string) @source.import) @definition.import

; Named imports - important for understanding specific dependencies
(import_statement
  (import_specifier
    name: (identifier) @name.import)) @definition.import

; Namespace imports - important for understanding module usage
(import_statement
  (namespace_import
    name: (identifier) @name.namespace)) @definition.import

; Default imports - important for understanding main exports
(import_statement
  (import_clause
    name: (identifier) @name.default)) @definition.import

; Dynamic imports - important for understanding code splitting
(import_expression
  source: (string) @source.dynamic) @definition.dynamic_import
`;