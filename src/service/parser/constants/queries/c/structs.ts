/*
C Struct and Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Struct definitions - primary code structure
(struct_specifier
  name: (type_identifier) @name.definition.struct) @definition.struct

; Union definitions - important for variant types
(union_specifier
  name: (type_identifier) @name.definition.union) @definition.union

; Enum definitions - important for enumerated types
(enum_specifier
  name: (type_identifier) @name.definition.enum) @definition.enum

; Typedef declarations - important for type aliases
(type_definition
  declarator: (type_identifier) @name.definition.type) @definition.type

; Field declarations in structs/unions - important for data structure
(field_declaration
  declarator: (field_identifier) @name.definition.field) @definition.field

; Array declarations - important for data structures
(declaration
  type: (_)
  declarator: (array_declarator
    declarator: (identifier) @name.definition.array)) @definition.array

; Pointer declarations - important for memory management
(declaration
  type: (_)
  declarator: (pointer_declarator
    declarator: (identifier) @name.definition.pointer)) @definition.pointer

; Member access - important for struct/union field access
(field_expression
  field: (field_identifier) @name.definition.member) @definition.member

; Subscript access - important for array element access
(subscript_expression
  argument: (identifier) @name.definition.subscript) @definition.subscript
`;