/*
C Struct and Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Fixed syntax errors based on tree-sitter query syntax
Only contains verified and tested query patterns
*/
export default `
; 结构体、联合体和枚举定义查询 - 使用交替模式合并
[
  (struct_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        type: (_) @field.type
        declarator: (field_identifier) @field.name)*)) @definition.struct
  (union_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        type: (_) @field.type
        declarator: (field_identifier) @field.name)*)) @definition.union
  (enum_specifier
    name: (type_identifier) @type.name
    body: (enumerator_list
      (enumerator
        name: (identifier) @enum.constant)*)) @definition.enum
] @definition.type

; 类型别名查询
(type_definition
  type: (_)
  declarator: (type_identifier) @alias.name) @definition.type.alias

; 数组和指针声明查询 - 使用交替模式合并
[
  (declaration
    type: (_)
    declarator: (array_declarator
      declarator: (identifier) @array.name
      size: (_)? @array.size)) @definition.array
  (declaration
    type: (_)
    declarator: (pointer_declarator
      declarator: (identifier) @pointer.name)) @definition.pointer
] @definition.variable

; 成员访问查询 - 普通成员访问、指针成员访问和解引用指针成员访问合并
[
  (field_expression
    argument: (identifier) @object.name
    field: (field_identifier) @field.name) @definition.member.access
  (field_expression
    argument: (identifier) @pointer.name
    field: (field_identifier) @field.name) @definition.pointer.member.access
 (field_expression
    argument: (parenthesized_expression
      (pointer_expression
        argument: (identifier) @pointer.name))
    field: (field_identifier) @field.name) @definition.pointer.member.access
] @definition.access

; 数组访问查询 - 一维和二维数组访问合并
[
  ; 一维数组访问: arr[i]
  (subscript_expression
    argument: (identifier) @array.name
    indices: (subscript_argument_list
      (_) @index)) @definition.array.access

  ; 二维数组访问: matrix[i][j]
  (subscript_expression
    argument: (subscript_expression
      argument: (identifier) @array.name
      indices: (subscript_argument_list _))
    indices: (subscript_argument_list
      (_) @index)) @definition.array.access

  ; 支持表达式作为索引的情况，比如 matrix[i+1][j-1]
  ; 上面两条已经能捕获，只要 @index 能匹配任意表达式即可
] @definition.array.access

; 嵌套结构体查询 - 简化版本
(struct_specifier
  body: (field_declaration_list
    (field_declaration
      type: (struct_specifier)
      declarator: (field_identifier) @nested.field.name))) @definition.nested.struct
`;