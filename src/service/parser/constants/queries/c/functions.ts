/*
C Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Function definitions and declarations - primary code structure
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function))

; Function declarations (prototypes) - important for interfaces
(declaration
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function
    parameters: (parameter_list))) @definition.function

; Function declarators - important for function signatures
(function_declarator
  declarator: (identifier) @name.definition.function
  parameters: (parameter_list)) @definition.function

; Parameters in function declarations - important for function interfaces
(parameter_declaration
  declarator: (identifier) @name.definition.parameter) @definition.parameter

; Call expressions - important for function usage
(call_expression
  function: (identifier) @name.definition.call) @definition.call
`;