/*
TypeScript Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Function declarations - primary code structure
(function_declaration
  name: (identifier) @name.definition.function) @definition.function

; Method definitions - important class structure
(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

; Arrow functions - common pattern for callbacks
(arrow_function) @definition.lambda

; Async functions - important for understanding async flow
(function_declaration
  "async"
  name: (identifier) @name.definition.async_function) @definition.async_function

; Generic function declarations - important for type understanding
(function_declaration
  type_parameters: (type_parameters)) @definition.generic_function

; Test functions - important for test code segmentation
(function_declaration
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^(test|it|describe|before|after|beforeEach|afterEach).*$")) @definition.test

; React Hook functions - important for React component structure
(function_declaration
  name: (identifier) @name.definition.hook
  (#match? @name.definition.hook "^use[A-Z].*$")) @definition.hook
`;