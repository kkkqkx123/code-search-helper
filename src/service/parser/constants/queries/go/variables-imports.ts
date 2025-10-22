/*
Go Variable and Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Package clause
(package_clause) @name.definition.package

; Import declarations - capture the entire import block
(import_declaration) @name.definition.import

; Variable declarations - capture the entire declaration
(var_declaration) @name.definition.var

; Constant declarations - capture the entire declaration  
(const_declaration) @name.definition.const

; Assignment statements
(assignment_statement) @name.definition.assignment
(short_var_declaration) @name.definition.short_var

; Field declarations in structs
(field_declaration) @name.definition.field

; Embedded fields in structs
(field_declaration
  (type_identifier) @name.definition.embedded_field)

; Variadic parameters
(variadic_parameter_declaration) @name.definition.variadic

; Blank identifier
(blank_identifier) @name.definition.blank_identifier

; Dot imports
(dot) @name.definition.dot_import
`;