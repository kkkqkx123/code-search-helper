/*
TypeScript Export-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Export statements with function declarations
(export_statement
  (function_declaration
    name: (identifier) @name.export)) @definition.export

; Export statements with class declarations
(export_statement
  (class_declaration
    name: (type_identifier) @name.export)) @definition.export

; Export statements with interface declarations
(export_statement
  (interface_declaration
    name: (type_identifier) @name.export)) @definition.export

; Export statements with type alias declarations
(export_statement
  (type_alias_declaration
    name: (type_identifier) @name.export)) @definition.export

; Named exports with export_clause
(export_statement
  (export_clause
    (export_specifier
      (identifier) @name.export))) @definition.export

; Default exports
(export_statement
  "default"
  (identifier) @name.default) @definition.export

; Export from statements
(export_statement
  (export_clause) @export.clause
  "from"
  (string) @source.export) @definition.export
`;