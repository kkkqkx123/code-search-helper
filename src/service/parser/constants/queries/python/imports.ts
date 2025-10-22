/*
Python Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Import statements - important for understanding dependencies
(import_from_statement) @name.definition.import_from
(import_statement) @name.definition.import

; Wildcard imports
(import_from_statement
  (wildcard_import)) @name.definition.wildcard_import

; Relative imports
(import_from_statement
  (relative_import)) @name.definition.relative_import

; Global/Nonlocal statements - important for variable scope
(global_statement) @name.definition.global
(nonlocal_statement) @name.definition.nonlocal

; Import statements with specific names
(import_from_statement
  (dotted_name) @name.imported_module
  (dotted_name) @name.imported_name) @definition.specific_import

; Multiple imports from same module
(import_statement
  (dotted_name) @name.import_module
  (dotted_name) @name.imported_name) @definition.multiple_import
`;