/*
Python Function-specific Tree-Sitter Query Patterns
Extracted from the main python.ts file for better maintainability and performance
*/
export default `
; Unified function definitions using alternation to reduce redundancy
[
  (function_definition
    name: (identifier) @function.name)
  (decorated_definition
    definition: (function_definition
      name: (identifier) @function.name))
] @definition.function

; Async functions with alternation
[
  (function_definition
    "async"
    name: (identifier) @async.function.name)
  (decorated_definition
    definition: (function_definition
      "async"
      name: (identifier) @async.function.name))
] @definition.async_function

; Generator functions with yield detection using anchor
(function_definition
  name: (identifier) @generator.name
  body: (block
    (expression_statement
      (yield) .))) @definition.generator

; Async generator functions with yield detection
(function_definition
  "async"
  name: (identifier) @async.generator.name
  body: (block
    (expression_statement
      (yield) .))) @definition.async_generator

; Functions with type annotations
[
  (function_definition
    name: (identifier) @typed.function.name
    return_type: (type))
  (function_definition
    "async"
    name: (identifier) @typed.async.function.name
    return_type: (type))
] @definition.typed_function

; Lambda expressions with anchor for precise matching
(lambda
  parameters: (parameters)? @lambda.params
  body: (_) @lambda.body) @definition.lambda

; Method definitions within classes using alternation
(class_definition
  body: (block
    [
      (function_definition
        name: (identifier) @method.name)
      (decorated_definition
        definition: (function_definition
          name: (identifier) @method.name))
      (function_definition
        "async"
        name: (identifier) @async.method.name)
    ])) @definition.method
`;