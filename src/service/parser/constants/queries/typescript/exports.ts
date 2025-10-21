/*
TypeScript Export-specific Tree-Sitter Query Patterns
*/
export default `
(export_statement
  declaration: (function_declaration
    name: (identifier) @name.export)) @definition.export

(export_statement
  declaration: (class_declaration
    name: (type_identifier) @name.export)) @definition.export

(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @name.export))) @definition.export

; Named exports
(export_statement
  (export_specifier
    name: (identifier) @name.export)) @definition.export

; Default exports
(export_statement
  (export_clause
    (identifier) @name.default)) @definition.export

; Export from
(export_statement
  source: (string) @source.export) @definition.export

; Re-exports
(export_statement
  (export_specifier
    name: (identifier) @name.reexport)) @definition.reexport
`;