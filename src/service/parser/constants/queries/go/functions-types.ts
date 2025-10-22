/*
Go Function and Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Function declarations - capture the entire declaration
(function_declaration) @name.definition.function

; Method declarations - capture the entire declaration
(method_declaration) @name.definition.method

; Type declarations (interfaces, structs, type aliases) - capture the entire declaration
(type_declaration) @name.definition.type

; Type aliases - specific capture
(type_alias) @name.definition.type_alias

; Interface declarations - specific capture
(interface_type) @name.definition.interface

; Struct declarations - specific capture
(struct_type) @name.definition.struct

; Function literals (anonymous functions)
(func_literal) @name.definition.func_literal

; Function types
(function_type) @name.definition.function_type

; Type parameters in generic declarations
(type_parameter_list) @name.definition.type_parameter_list

; Generic type declarations with type arguments
(type_identifier) @name.definition.generic_type

; Field declarations in structs
(field_declaration) @name.definition.field_declaration

; Field identifiers
(field_identifier) @name.definition.field_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Package identifiers
(package_identifier) @name.definition.package_identifier

; Parameter declarations
(parameter_declaration) @name.definition.parameter

; Variadic parameter declarations
(variadic_parameter_declaration) @name.definition.variadic_parameter

; Return statements
(return_statement) @name.definition.return

; Test functions - simplified pattern
(function_declaration
  (identifier) @name.definition.test)

; Benchmark functions - simplified pattern
(function_declaration
  (identifier) @name.definition.benchmark)

; Example functions - simplified pattern
(function_declaration
  (identifier) @name.definition.example)
`;