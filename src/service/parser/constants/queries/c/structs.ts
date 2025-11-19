/*
C Struct and Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Fixed syntax errors based on tree-sitter query syntax
Only contains verified and tested query patterns
*/
export default `
; 结构体定义查询
(struct_specifier
  name: (type_identifier) @type.name
  body: (field_declaration_list
    (field_declaration
      type: (_) @field.type
      declarator: (field_identifier) @field.name)*)) @definition.struct

; 联合体定义查询
(union_specifier
  name: (type_identifier) @type.name
  body: (field_declaration_list
    (field_declaration
      type: (_) @field.type
      declarator: (field_identifier) @field.name)*)) @definition.union

; 枚举定义查询
(enum_specifier
  name: (type_identifier) @type.name
  body: (enumerator_list
    (enumerator
      name: (identifier) @enum.constant)*)) @definition.enum

; 类型别名查询
(type_definition
  type: (_)
  declarator: (type_identifier) @alias.name) @definition.type.alias

; 数组声明查询
(declaration
  type: (_)
  declarator: (array_declarator
    declarator: (identifier) @array.name
    size: (_)? @array.size)) @definition.array

; 指针声明查询
(declaration
  type: (_)
  declarator: (pointer_declarator
    declarator: (identifier) @pointer.name)) @definition.pointer

; 成员访问查询
(field_expression
  argument: (identifier) @object.name
  field: (field_identifier) @field.name) @definition.member.access

; 指针成员访问查询
; 匹配简单的指针成员访问 (ptr->field)
(field_expression
  argument: (identifier) @pointer.name
  field: (field_identifier) @field.name) @definition.pointer.member.access

; 匹配解引用的指针成员访问 ((*ptr)->field)
(field_expression
  argument: (parenthesized_expression
    (pointer_expression
      argument: (identifier) @pointer.name))
  field: (field_identifier) @field.name) @definition.pointer.member.access

; 数组访问查询
(subscript_expression
  argument: (identifier) @array.name
  index: (_) @index) @definition.array.access

; 嵌套结构体查询 - 简化版本
(struct_specifier
  body: (field_declaration_list
    (field_declaration
      type: (struct_specifier)
      declarator: (field_identifier) @nested.field.name))) @definition.nested.struct

; 前向声明查询 - 简单匹配（这会与完整定义有重叠，但这是预期的）
(struct_specifier
  name: (type_identifier) @forward.struct.name) @definition.forward.struct

(union_specifier
  name: (type_identifier) @forward.union.name) @definition.forward.union

(enum_specifier
  name: (type_identifier) @forward.enum.name) @definition.forward.enum
`;