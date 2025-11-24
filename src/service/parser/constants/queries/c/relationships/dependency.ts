/*
C Dependency Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的依赖关系
*/
export default `
; 头文件包含依赖关系 - 使用交替模式合并重复查询
[
  (preproc_include
    path: (string_literal) @dependency.include.path) @dependency.relationship.include
  (preproc_include
    path: (system_lib_string) @dependency.system.path) @dependency.relationship.system
] @dependency.relationship.include

; 宏定义依赖关系
(preproc_def
  name: (identifier) @dependency.macro.name
  value: (identifier)? @dependency.macro.value) @dependency.relationship.macro

; 宏函数定义依赖关系
(preproc_function_def
  name: (identifier) @dependency.macro.function.name
  parameters: (preproc_params
    (identifier) @dependency.macro.parameter)) @dependency.relationship.macro.function

; 条件编译依赖关系 - 使用交替模式合并重复查询
[
  (preproc_if
    condition: (identifier) @dependency.condition.symbol) @dependency.relationship.conditional
  (preproc_ifdef
    name: (identifier) @dependency.ifdef.symbol) @dependency.relationship.ifdef
  (preproc_elif
    condition: (identifier) @dependency.elif.symbol) @dependency.relationship.elif
] @dependency.relationship.conditional

; 类型引用依赖关系
(declaration
  type: (type_identifier) @dependency.type.reference
  declarator: (identifier) @dependency.variable.name) @dependency.relationship.type

; 结构体引用依赖关系
(field_declaration
  type: (type_identifier) @dependency.struct.reference
  declarator: (field_identifier) @dependency.field.name) @dependency.relationship.struct

; 函数声明依赖关系
(declaration
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @dependency.function.name
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier) @dependency.parameter.type)*)?)) @dependency.relationship.function

; 函数调用依赖关系
(call_expression
  function: (identifier) @dependency.call.function
  arguments: (argument_list
    (identifier) @dependency.call.argument)*) @dependency.relationship.call

; 枚举和联合体引用依赖关系 - 使用交替模式合并重复查询
[
  (declaration
    type: (enum_specifier
      name: (type_identifier) @dependency.enum.name)
    declarator: (identifier) @dependency.variable.name) @dependency.relationship.enum
  (declaration
    type: (union_specifier
      name: (type_identifier) @dependency.union.name)
    declarator: (identifier) @dependency.variable.name) @dependency.relationship.union
] @dependency.relationship.type_specifier


; 外部变量和静态变量依赖关系 - 使用交替模式合并重复查询
[
  (declaration
    (storage_class_specifier) @dependency.extern.specifier
    type: (_)
    declarator: (identifier) @dependency.extern.variable) @dependency.relationship.extern
  (declaration
    (storage_class_specifier) @dependency.static.specifier
    type: (_)
    declarator: (identifier) @dependency.static.variable) @dependency.relationship.static
] @dependency.relationship.storage_class
`;