/*
TypeScript Function-specific Tree-Sitter Query Patterns
Extracted from the main typescript.ts file for better maintainability and performance
*/
export default `
(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(arrow_function) @definition.lambda

; Async Functions
(function_declaration
  name: (identifier) @name.definition.async_function) @definition.async_function

; Async Arrow Functions
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.async_arrow
    value: (arrow_function))) @definition.async_arrow

; Generic function declarations
(function_declaration
  type_parameters: (type_parameters)) @definition.generic_function

; Test functions
(function_declaration
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^(test|it|describe|before|after|beforeEach|afterEach).*$"))

; Hook functions (React)
(function_declaration
  name: (identifier) @name.definition.hook
  (#match? @name.definition.hook "^use[A-Z].*$"))
`;