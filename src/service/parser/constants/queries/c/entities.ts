export default `
; 1. 函数声明 -> definition.function
[
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @function.name)
    body: (compound_statement) @function.body) @definition.function

  (declaration
    type: (primitive_type)
    declarator: (function_declarator
      declarator: (identifier) @function.name
      parameters: (parameter_list) @function.parameters)) @definition.function.prototype

  ; 函数指针查询 - 修复：函数指针声明的正确结构
  (function_definition
    type: (primitive_type) @return.type
      declarator: (pointer_declarator
        declarator: (function_declarator
          declarator: (identifier) @function.name
          parameters: (parameter_list) @function.parameters))) @definition.function.pointer
] @definition.function

; 2. 数组和指针声明 -> definition.variable
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

; 变量声明查询 - 使用交替模式合并
[
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable)
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable))
] @definition.variable

`;