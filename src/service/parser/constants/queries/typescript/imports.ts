/*
TypeScript Import-specific Tree-Sitter Query Patterns
*/
export default `
(import_statement
  source: (string) @source.import) @definition.import

; Named imports
(import_statement
  (import_specifier
    name: (identifier) @name.import) @definition.import)

; Namespace imports
(import_statement
  (namespace_import
    name: (identifier) @name.namespace) @definition.import)

; Default imports
(import_statement
  (import_clause
    name: (identifier) @name.default) @definition.import)

; Dynamic imports
(import_expression
  source: (string) @source.dynamic) @definition.dynamic_import

; Require statements (CommonJS)
(call_expression
  function: (identifier) @name.require
  arguments: (arguments
    (string) @source.require)) @definition.require
`;