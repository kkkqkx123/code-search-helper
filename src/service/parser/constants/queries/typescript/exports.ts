/*
TypeScript Export-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Export statements - important for understanding public API
(export_statement
  declaration: (function_declaration
    name: (identifier) @name.export)) @definition.export

(export_statement
  declaration: (class_declaration
    name: (type_identifier) @name.export)) @definition.export

(export_statement
  declaration: (interface_declaration
    name: (type_identifier) @name.export)) @definition.export

(export_statement
  declaration: (type_alias_declaration
    name: (type_identifier) @name.export)) @definition.export

; Named exports - important for understanding specific exports
(export_statement
  (export_specifier
    name: (identifier) @name.export)) @definition.export

; Default exports - important for understanding main export
(export_statement
  (export_clause
    (identifier) @name.default)) @definition.export

; Export from - important for understanding re-exports
(export_statement
  source: (string) @source.export) @definition.export
`;