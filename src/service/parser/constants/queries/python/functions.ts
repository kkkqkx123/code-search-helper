/*
Python Function-specific Tree-Sitter Query Patterns
Extracted from the main python.ts file for better maintainability and performance
*/
export default `
; Function and method definitions (including async and decorated)
(function_definition
  name: (identifier) @name.definition.function) @definition.function

(decorated_definition
  definition: (function_definition
    name: (identifier) @name.definition.function)) @definition.function

; Async function definitions
(function_definition
  "async"
  name: (identifier) @name.definition.async_function) @definition.async_function

; Decorated async functions
(decorated_definition
  definition: (function_definition
    "async"
    name: (identifier) @name.definition.async_function)) @definition.async_function

; Lambda expressions
(lambda) @name.definition.lambda

; Generator functions (functions containing yield)
(function_definition
  name: (identifier) @name.definition.generator
  body: (block
    (expression_statement
      (yield)))) @definition.generator

; Async generator functions
(function_definition
  "async"
  name: (identifier) @name.definition.async_generator
  body: (block
    (expression_statement
      (yield)))) @definition.async_generator

; Method definitions within classes
(class_definition
  body: (block
    (function_definition
      name: (identifier) @name.definition.method))) @definition.method

; Functions with return type annotations
(function_definition
  name: (identifier) @name.definition.typed_function
  return_type: (type)) @definition.typed_function

; Async functions with return type annotations
(function_definition
  "async"
  name: (identifier) @name.definition.typed_async_function
  return_type: (type)) @definition.typed_async_function
`;