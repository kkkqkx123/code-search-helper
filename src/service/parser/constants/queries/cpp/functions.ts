/*
C++ Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Function declarations (prototypes) - primary code structure
(declaration
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function)) @definition.function

; Function definitions (with body) - primary code structure
(function_definition
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function)) @definition.function

; Method definitions - important class structure
(function_definition
  declarator: (function_declarator
    declarator: (field_identifier) @name.definition.method)) @definition.method

; Template function declarations - important for generic programming
(template_declaration
  parameters: (template_parameter_list)
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @name.definition.template.function))) @definition.template

; Lambda expressions - important for functional programming
(lambda_expression) @definition.lambda

; Operator overloads - important for custom operators
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @name.definition.operator)) @definition.operator

; Operator declarations (new, delete, etc.) - important for memory management
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @name.definition.operator.new)) @definition.operator.new
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @name.definition.operator.delete)) @definition.operator.delete

; Constexpr and consteval functions - important for compile-time computation
(function_definition
  (storage_class_specifier) @name.definition.const_function
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function)) @definition.function

; Explicit constructors and conversion operators - important for type safety
(function_definition
  (explicit_specifier) @name.definition.explicit_function
  declarator: (function_declarator
    declarator: (identifier) @name.definition.constructor)) @definition.constructor

; Virtual functions - important for polymorphism
(function_definition
  (virtual_specifier) @name.definition.virtual_function
  declarator: (function_declarator
    declarator: (identifier) @name.definition.method)) @definition.method

; Override and final specifiers - important for virtual function control
(virtual_specifier) @definition.virtual_specifier

; Co-routine expressions (C++20) - important for async programming
(co_await_expression) @definition.co_await_expression
(co_yield_expression) @definition.co_yield_expression
(co_return_statement) @definition.co_return_statement
`;