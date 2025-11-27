/*
C Reference Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的引用关系
移除了控制流相关的重复查询，控制流查询已统一到control-flow.ts中
*/
export default `
; 函数引用关系 - 已移至call.ts以避免重复
; 参考 call.ts 中的统一函数调用查询

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

; 函数参数引用关系
(parameter_declaration
  type: (_)
  declarator: (identifier) @reference.parameter) @reference.relationship.parameter

; 赋值表达式中的引用关系
(assignment_expression
  left: (identifier) @reference.assignment.left
 right: (identifier) @reference.assignment.right) @reference.relationship.assignment

`;