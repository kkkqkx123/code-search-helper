/*
C Function Annotation Tree-Sitter Query Patterns
Shared queries for function annotations used across entities and relationships
*/
export default `
; 函数注解 - 属性说明符在函数定义中
(function_definition
  (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)?
  declarator: (function_declarator
    declarator: (identifier) @function.name)
  body: (compound_statement) @function.body) @function.definition.with.annotation

; 内联函数注解
(function_definition
  (storage_class_specifier) @func.type
 (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)?
  declarator: (function_declarator
    declarator: (identifier) @inline.function)
  body: (compound_statement) @inline.body
  (#match? @func.type "inline|static")) @function.inline.with.annotation
`;