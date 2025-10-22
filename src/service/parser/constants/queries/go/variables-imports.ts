/*
Go Variable and Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Package clause
(package_clause) @name.definition.package

; Import declarations - capture the entire import block
(import_declaration) @name.definition.import

; Import specifications - individual imports
(import_spec) @name.definition.import_spec

; Variable declarations - capture the entire declaration
(var_declaration) @name.definition.var

; Variable specifications
(var_spec) @name.definition.var_spec

; Constant declarations - capture the entire declaration  
(const_declaration) @name.definition.const

; Constant specifications
(const_spec) @name.definition.const_spec

; Assignment statements
(assignment_statement) @name.definition.assignment

; Short variable declarations
(short_var_declaration) @name.definition.short_var

; Field declarations in structs
(field_declaration) @name.definition.field

; Embedded fields in structs
(field_declaration
  (type_identifier) @name.definition.embedded_field)

; Qualified types in embedded fields
(field_declaration
  (qualified_type) @name.definition.qualified_embedded_field)

; Variadic parameters
(variadic_parameter_declaration) @name.definition.variadic

; Blank identifier
(blank_identifier) @name.definition.blank_identifier

; Identifiers
(identifier) @name.definition.identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Package identifiers
(package_identifier) @name.definition.package_identifier

; Field identifiers
(field_identifier) @name.definition.field_identifier

; Iota constant identifier
(iota) @name.definition.iota

; Dot import identifier
(dot) @name.definition.dot_import

; String literals for import paths
(interpreted_string_literal) @name.definition.import_path
`;