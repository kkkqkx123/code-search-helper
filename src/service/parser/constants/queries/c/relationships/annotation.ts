/*
C Annotation Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的注解关系
*/
export default `
; C11属性说明符
(attribute_declaration
  (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)) @annotation.relationship

; 类型注解
(type_definition
  (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)?) @annotation.relationship.type

; 函数注解
(function_definition
  (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)?) @annotation.relationship.function

; 变量注解
(declaration
  (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)?) @annotation.relationship.variable

; 结构体字段注解
(field_declaration
  (attribute_specifier
    name: (identifier) @annotation.name
    arguments: (argument_list
      (_) @annotation.argument)*)?) @annotation.relationship.field
`;