/*
Python Type and Decorator-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Type annotations with field names for better context
[
  (typed_parameter
    name: (identifier)? @parameter.name
    type: (type) @parameter.type)
  (typed_default_parameter
    name: (identifier)? @parameter.name
    type: (type) @parameter.type)
  (type) @type.hint
  (type_alias_statement
    name: (identifier) @type.alias.name
    value: (type) @type.alias.value)
] @definition.type

; Generic and union types with anchor for precise matching
[
  (generic_type
    (identifier) @generic.type.name)
  (union_type
    (type) @union.type.element)
] @definition.complex.type

; Decorators with predicate filtering for specific types
[
  (decorator
    (identifier) @decorator.name)
  (decorator
    (call
      function: (identifier) @decorator.function))
] @definition.decorator

; Method types using alternation for similar patterns
[
  (function_definition
    name: (identifier) @method.name
    (#match? @method.name "^__(.*)__$")) @definition.dunder.method
  (function_definition
    name: (identifier) @method.name
    (#match? @method.name "^_")) @definition.private.method
  (function_definition
    name: (identifier) @test.name
    (#match? @test.name "^(test_|.*_test$)")) @definition.test.function
] @definition.special.method

; Documentation elements
[
  (comment) @documentation.comment
  (expression_statement
    (string) @docstring.content) @definition.docstring
] @definition.documentation

; Parameter types with field names
[
  (parameters
    (identifier) @parameter.name)
  (default_parameter
    name: (identifier) @parameter.name
    value: (expression) @parameter.default)
] @definition.parameter
`;