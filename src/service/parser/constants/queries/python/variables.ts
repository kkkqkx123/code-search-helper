/*
Python Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Variable assignments
(assignment
  left: (identifier) @name.definition.variable) @definition.variable

; Augmented assignments
(augmented_assignment
  left: (identifier) @name.definition.augmented_assignment) @definition.augmented_assignment

; Named expressions (walrus operator)
(named_expression
  name: (identifier) @name.definition.named_expression) @definition.named_expression

; Module-level assignments that might be constants
(assignment
  left: (identifier) @name.definition.constant
  (#match? @name.definition.constant "^[A-Z_][A-Z0-9_]*$")) @definition.constant

; Variable assignments with type annotations
(assignment
  left: (identifier) @name.definition.typed_variable
  type: (type)) @definition.typed_variable

; Pattern assignments (destructuring)
(assignment
  left: (pattern_list
    (identifier) @name.definition.pattern_variable)) @definition.pattern_assignment

; Attribute assignments
(assignment
  left: (attribute
    attribute: (identifier) @name.definition.attribute_variable)) @definition.attribute_assignment

; Subscript assignments
(assignment
  left: (subscript
    (identifier) @name.definition.subscript_variable)) @definition.subscript_assignment

; Tuple unpacking assignments
(assignment
  left: (tuple_pattern
    (identifier) @name.definition.tuple_variable)) @definition.tuple_assignment

; List pattern assignments
(assignment
  left: (list_pattern
    (identifier) @name.definition.list_variable)) @definition.list_assignment
`;