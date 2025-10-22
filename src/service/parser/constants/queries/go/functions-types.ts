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

; Interface declarations - specific capture
(interface_type) @name.definition.interface

; Struct declarations - specific capture
(struct_type) @name.definition.struct

; Generic type declarations
(generic_type) @name.definition.generic

; Type parameters in generic declarations
(type_parameter_declaration) @name.definition.type_parameter

; Function literals (anonymous functions)
(func_literal) @name.definition.func_literal

; Function types
(function_type) @name.definition.function_type

; Method specifications in interfaces
(method_spec) @name.definition.method_spec
`;