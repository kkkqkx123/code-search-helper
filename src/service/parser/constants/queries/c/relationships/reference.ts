/*
C Reference Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的引用关系
*/
export default `
; 变量引用关系
(identifier) @reference.variable
(#not-match? @reference.variable "^(if|for|while|do|switch|break|continue|return|goto|sizeof|typeof|alignof)$")

; 函数引用关系
(call_expression
  function: (identifier) @reference.function) @reference.relationship.function

; 结构体字段引用关系
(field_expression
  argument: (identifier) @reference.object
  field: (field_identifier) @reference.field) @reference.relationship.field

; 数组元素引用关系
(subscript_expression
  argument: (identifier) @reference.array
  index: (_) @reference.index) @reference.relationship.array

; 指针解引用关系
(pointer_expression
  argument: (identifier) @reference.pointer) @reference.relationship.pointer

; 类型引用关系
(type_identifier) @reference.type

; 枚举常量引用关系
(identifier) @reference.enum.constant
(#match? @reference.enum.constant "^[A-Z][A-Z0-9_]*$")

; 函数参数引用关系
(parameter_declaration
  type: (_)
  declarator: (identifier) @reference.parameter) @reference.relationship.parameter

; 局部变量引用关系
(declaration
  type: (_)
  declarator: (identifier) @reference.local.variable) @reference.relationship.local

; 全局变量引用关系
(identifier) @reference.global.variable
(#match? @reference.global.variable "^[gG][a-zA-Z0-9_]*$")

; 静态变量引用关系
(identifier) @reference.static.variable
(#match? @reference.static.variable "^[sS][a-zA-Z0-9_]*$")

; 宏引用关系
(identifier) @reference.macro
(#match? @reference.macro "^[A-Z_][A-Z0-9_]*$")

; 标签引用关系
(goto_statement
  label: (statement_identifier) @reference.label) @reference.relationship.goto

; case标签引用关系
(case_statement
  value: (identifier) @reference.case.label) @reference.relationship.case

; 函数指针引用关系
(pointer_declarator
  declarator: (identifier) @reference.function.pointer) @reference.relationship.function.pointer

; 结构体类型引用关系
(struct_specifier
  name: (type_identifier) @reference.struct.type) @reference.relationship.struct

; 联合体类型引用关系
(union_specifier
  name: (type_identifier) @reference.union.type) @reference.relationship.union

; 枚举类型引用关系
(enum_specifier
  name: (type_identifier) @reference.enum.type) @reference.relationship.enum

; 类型别名引用关系
(type_identifier) @reference.type.alias

; 函数声明引用关系
(declaration
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @reference.function.declaration)) @reference.relationship.function.declaration

; 返回语句中的引用关系
(return_statement
  (identifier) @reference.return.variable) @reference.relationship.return

; 赋值表达式中的引用关系
(assignment_expression
  left: (identifier) @reference.assignment.left
  right: (identifier) @reference.assignment.right) @reference.relationship.assignment

; 条件表达式中的引用关系
(if_statement
  condition: (identifier) @reference.condition.variable) @reference.relationship.condition

; 循环中的引用关系
[
  (for_statement
    condition: (identifier) @reference.loop.condition)
  (while_statement
    condition: (identifier) @reference.loop.condition)
  (do_statement
    condition: (identifier) @reference.loop.condition)
] @reference.relationship.loop

; 函数调用参数中的引用关系
(call_expression
  arguments: (argument_list
    (identifier) @reference.call.argument)) @reference.relationship.call.argument
`;