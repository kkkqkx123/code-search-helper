/*
C++ Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Variable declarations with initialization - primary code structure
(declaration
  type: (_)
  declarator: (init_declarator
    declarator: (identifier) @name.definition.variable)) @definition.variable

; Structured bindings (C++17) - important for unpacking
(declaration
  (structured_binding_declarator
    (identifier) @name.definition.binding))) @definition.binding

; Parameter pack expansions - important for variadic templates
(parameter_pack_expansion) @definition.parameter_pack

; Assignment expressions - important for variable assignment
(assignment_expression
  left: (identifier) @name.definition.assignment) @definition.assignment

; Call expressions - important for function calls
(call_expression
  function: (identifier) @name.definition.call) @definition.call

; Member access - important for object members
(field_expression
  field: (field_identifier) @name.definition.member) @definition.member
`;