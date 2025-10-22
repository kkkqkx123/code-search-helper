/*
TypeScript Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Import statements with source
(import_statement
  "from"
  (string) @source.import) @definition.import

; Named imports within import_clause
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        (identifier) @name.import)))) @definition.import

; Namespace imports
(import_statement
  (import_clause
    (namespace_import
      "*"
      "as"
      (identifier) @name.namespace))) @definition.import

; Default imports
(import_statement
  (import_clause
    (identifier) @name.default)
  "from"
  (string) @source.import) @definition.import

; Mixed imports (default + named)
(import_statement
  (import_clause
    (identifier) @name.default
    ","
    (named_imports
      (import_specifier
        (identifier) @name.import)))
  "from"
  (string) @source.import) @definition.import
`;