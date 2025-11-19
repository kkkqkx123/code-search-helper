/*
C Control Flow and Expression-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Optimized based on tree-sitter best practices
*/
export default `
; 控制语句查询 - 使用交替模式和字段名
[
  (if_statement
    condition: (_) @if.condition
    consequence: (compound_statement) @if.body
    alternative: (_)? @if.else)
  (for_statement
    initializer: (_)? @for.init
    condition: (_)? @for.condition
    update: (_)? @for.update
    body: (_) @for.body)
  (while_statement
    condition: (_) @while.condition
    body: (_) @while.body)
  (do_statement
    body: (_) @do.body
    condition: (_) @do.condition)
  (switch_statement
    condition: (_) @switch.condition
    body: (compound_statement) @switch.body)
] @definition.control_statement

; 跳转语句查询 - 使用交替模式
[
  (break_statement) @definition.break
  (continue_statement) @definition.continue
  (return_statement
    (expression)? @return.expression) @definition.return
  (goto_statement
    label: (statement_identifier) @goto.label) @definition.goto
] @definition.jump_statement

; 标签语句查询 - 使用锚点确保精确匹配
(labeled_statement
  label: (statement_identifier) @label.name
  statement: (_) @label.statement) @definition.labeled_statement

; 表达式查询 - 使用交替模式合并相似表达式
[
  (binary_expression
    left: (_) @binary.left
    operator: _ @binary.operator
    right: (_) @binary.right) @definition.binary_expression
  (unary_expression
    operator: _ @unary.operator
    argument: (_) @unary.argument) @definition.unary_expression
  (update_expression
    argument: (_) @update.argument
    operator: _ @update.operator) @definition.update_expression
  (conditional_expression
    condition: (_) @conditional.condition
    consequence: (_) @conditional.consequence
    alternative: (_) @conditional.alternative) @definition.conditional_expression
] @definition.expression

; 类型转换和大小查询 - 使用交替模式
[
  (cast_expression
    type: (type_descriptor) @cast.type
    value: (_) @cast.value) @definition.cast_expression
  (sizeof_expression
    argument: (_) @sizeof.argument) @definition.sizeof_expression
  (sizeof_expression) @definition.sizeof_expression
  (alignof_expression) @definition.alignof_expression
  (_Alignof_expression) @definition.alignof_expression
  (expression_statement
    (sizeof_expression
      argument: (_) @sizeof.argument)) @definition.sizeof_expression
  (assignment_expression
    right: (sizeof_expression
      argument: (_) @sizeof.argument)) @definition.sizeof_expression
] @definition.type_expression

; 复合表达式查询 - 简化模式
[
  (parenthesized_expression
    expression: (_) @parenthesized.expression) @definition.parenthesized_expression
  (comma_expression
    left: (_) @comma.left
    right: (_) @comma.right) @definition.comma_expression
  (comma_expression) @definition.comma_expression
  (assignment_expression
    right: (parenthesized_expression
      (comma_expression
        left: (_) @comma.left
        right: (_) @comma.right))) @definition.comma_expression
  (expression_statement
    (comma_expression
      left: (_) @comma.left
      right: (_) @comma.right)) @definition.comma_expression
  (assignment_expression
    right: (comma_expression
      left: (_) @comma.left
      right: (_) @comma.right)) @definition.comma_expression
  (assignment_expression
    right: (parenthesized_expression
      (comma_expression))) @definition.comma_expression
  (assignment_expression
    right: (comma_expression)) @definition.comma_expression
  (assignment_expression
    right: (parenthesized_expression
      expression: (_) @parenthesized.expression)) @definition.parenthesized_expression
  (binary_expression
    left: (parenthesized_expression
      expression: (_) @parenthesized.expression)
    operator: _
    right: (_)) @definition.parenthesized_expression
] @definition.compound_expression

; 字面量查询 - 使用交替模式
[
  (number_literal) @definition.number_literal
  (string_literal) @definition.string_literal
  (char_literal) @definition.char_literal
  (true) @definition.boolean_literal
  (false) @definition.boolean_literal
  (null) @definition.null_literal
] @definition.literal

; 类型修饰符查询 - 使用交替模式
[
  (type_qualifier) @definition.type_qualifier
  (storage_class_specifier) @definition.storage_class
  (primitive_type) @definition.primitive_type
] @definition.type_modifier

; 现代C特性查询 - 使用谓词过滤
[
  (generic_expression
    selector: (_) @generic.selector
    associations: (generic_association_list
      (generic_association
        pattern: (_) @association.pattern
        result: (_) @association.result)*)) @definition.generic_expression
  (alignas_qualifier) @definition.alignas_qualifier
  (_Alignas_qualifier) @definition.alignas_qualifier
  (extension_expression
    argument: (_) @extension.argument) @definition.extension_expression
] @definition.modern_feature

; 注释查询 - 简化模式
(comment) @definition.comment
`;