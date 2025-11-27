/*
C Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的高级语义关系
从 ref/semantic-relationships.ts 迁移而来，排除已在其他文件中的功能
*/
export default `

; 错误处理模式 - 使用交替模式
[
  (return_statement
    (identifier) @error.code
    (#match? @error.code "^(ERROR|FAIL|INVALID|NULL)$")) @semantic.relationship.error.return
  (if_statement
    condition: (binary_expression
      left: (identifier) @checked.variable
      operator: ["==" "!="]
      right: (identifier) @error.value)
    consequence: (compound_statement) @error.handling.block) @semantic.relationship.error.checking
] @semantic.relationship.error.handling

; 资源管理模式 - 使用锚点确保精确匹配
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.constructor)
  body: (compound_statement
    (declaration
      type: (type_identifier) @resource.type
      declarator: (init_declarator
        declarator: (identifier) @resource.variable
        value: (call_expression
          function: (identifier) @allocation.function))))) @semantic.relationship.resource.initialization

; 清理函数模式 - 简化模式
; 注意：与lifecycle.ts中的资源清理函数重复，建议移除或合并
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @cleanup.function)
  parameters: (parameter_list
    (parameter_declaration
      type: (primitive_type)
      declarator: (identifier) @resource.parameter))) @semantic.relationship.cleanup.pattern

; 回调函数模式 - 使用锚点确保精确匹配
[
  (declaration
    type: (type_identifier) @callback.type
    declarator: (init_declarator
      declarator: (identifier) @callback.variable
      value: (identifier) @callback.function)) @semantic.relationship.callback.assignment
  (init_declarator
    declarator: (identifier) @callback.variable
    value: (identifier) @callback.function) @semantic.relationship.callback.assignment
  (type_definition
    (function_declarator
      (parenthesized_declarator
        (pointer_declarator
          (type_identifier) @callback.type)))) @semantic.relationship.callback.type
] @semantic.relationship.callback.pattern
`;