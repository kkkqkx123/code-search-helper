export default `
; 1. 预处理器 -> entity.preprocessor 5
[
  (preproc_def
    name: (identifier) @name.entity.macro)
  (preproc_function_def
    name: (identifier) @name.entity.macro)
  (preproc_ifdef
    name: (identifier) @name.entity.preproc_ifdef) @entity.preproc_ifdef
  (preproc_if
    condition: (_) @name.entity.preproc_condition) @entity.preproc_condition
  (preproc_elif
    condition: (_) @name.entity.preproc_condition) @entity.preproc_condition
  (preproc_else
    condition: (_) @name.entity.preproc_condition) @entity.preproc_condition
  (preproc_include
    path: (system_lib_string) @name.entity.include_lib)
  (preproc_includeW
    path: (string_literal)@name.included)
] @entity.preprocessor

; 2. 结构体、联合体、枚举、类型别名定义 -> entity.type 4
[
  (struct_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        type: (_) @field.type
        declarator: (field_identifier) @field.name)*)) @entity.struct
  (union_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        type: (_) @field.type
        declarator: (field_identifier) @field.name)*)) @entity.union
  (enum_specifier
    name: (type_identifier) @type.name
    body: (enumerator_list
      (enumerator
        name: (identifier) @enum.constant)*)) @entity.enum
; 类型别名
  (type_entity
    type: (_)
    declarator: (type_identifier) @alias.name) @entity.type.alias
] @entity.type

; 3. 函数声明 -> entity.function 3
[
  (function_entity
    declarator: (function_declarator
      declarator: (identifier) @function.name)
    body: (compound_statement) @function.body) @entity.function

  (declaration
    type: (primitive_type)
    declarator: (function_declarator
      declarator: (identifier) @function.name
      parameters: (parameter_list) @function.parameters)) @entity.function.prototype

  ; 函数指针查询 - 修复：函数指针声明的正确结构
  (function_entity
    type: (primitive_type) @return.type
      declarator: (pointer_declarator
        declarator: (function_declarator
          declarator: (identifier) @function.name
          parameters: (parameter_list) @function.parameters))) @entity.function.pointer
] @entity.function

; 4. 数组和指针声明 -> entity.variable 2
[
; 数组查询只能捕获单维数组，但对于多维数组能够覆盖内部结构
  (declaration
    type: (_)
    declarator: (array_declarator
      declarator: (identifier) @array.name
      size: (_)? @array.size)) @entity.array
  (declaration
    type: (_)
    declarator: (pointer_declarator
      declarator: (identifier) @pointer.name)) @entity.compound_variable
] @entity.variable

; 5. 变量声明查询 - 使用交替模式合并 1
[
  (declaration
    type: (_)
    declarator: (identifier) @name.entity.variable)
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.entity.variable))
] @entity.variable

`;