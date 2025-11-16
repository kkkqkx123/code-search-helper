/*
C Struct and Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Optimized based on tree-sitter best practices
*/
export default `
; 统一的类型声明查询 - 使用交替模式
[
  (struct_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        declarator: (field_identifier) @field.name
        type: (primitive_type) @field.type)+)) @definition.struct
  (union_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        declarator: (field_identifier) @field.name
        type: (primitive_type) @field.type)+)) @definition.union
  (enum_specifier
    name: (type_identifier) @type.name
    body: (enumerator_list
      (enumerator
        name: (identifier) @enum.constant)+)) @definition.enum
] @definition.type

; 类型别名查询 - 使用锚点确保精确匹配
(type_definition
  type: (primitive_type) @original.type
  declarator: (type_identifier) @alias.name) @definition.type.alias

; 复杂声明查询 - 使用交替模式
[
  (declaration
    type: (primitive_type)
    declarator: (array_declarator
      declarator: (identifier) @array.name
      size: (_)? @array.size)) @definition.array
  (declaration
    type: (primitive_type)
    declarator: (pointer_declarator
      declarator: (identifier) @pointer.name)) @definition.pointer
  (declaration
    type: (pointer_type
      (function_declarator
        parameters: (parameter_list)))
    declarator: (pointer_declarator
      declarator: (identifier) @function.pointer.name)) @definition.function.pointer
] @definition.complex.declaration

; 成员访问查询 - 使用交替模式
[
  (field_expression
    argument: (identifier) @object.name
    field: (field_identifier) @field.name) @definition.member.access
  (field_expression
    argument: (pointer_expression
      argument: (identifier) @pointer.name)
    field: (field_identifier) @field.name) @definition.pointer.member.access
] @definition.field.access

; 数组访问查询 - 使用锚点和量词操作符
(subscript_expression
  argument: (identifier) @array.name
  index: [
    (identifier) @index.variable
    (number_literal) @index.number
    (binary_expression) @index.expression
  ]) @definition.array.access

; 嵌套结构体查询 - 使用谓词过滤
(struct_specifier
  name: (type_identifier) @nested.struct.name
  body: (field_declaration_list
    (field_declaration
      type: (struct_specifier
        name: (type_identifier) @inner.struct.name)
      declarator: (field_identifier) @nested.field.name))) @definition.nested.struct

; 位域查询 - 使用锚点确保精确匹配
(field_declaration
  type: (primitive_type)
  declarator: (field_identifier) @bitfield.name
  size: (number_literal) @bitfield.size) @definition.bitfield

; 函数指针字段查询 - 简化模式
(field_declaration
  type: (pointer_type
    (function_declarator
      parameters: (parameter_list)))
  declarator: (field_identifier) @function.pointer.field) @definition.function.pointer.field

; 前向声明查询 - 使用谓词过滤
[
  (struct_specifier
    name: (type_identifier) @forward.struct.name) @definition.forward.struct
  (union_specifier
    name: (type_identifier) @forward.union.name) @definition.forward.union
  (enum_specifier
    name: (type_identifier) @forward.enum.name) @definition.forward.enum
] @definition.forward.declaration
 `;