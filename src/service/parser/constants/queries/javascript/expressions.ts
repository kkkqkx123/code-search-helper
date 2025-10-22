/*
JavaScript Expression and Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Arrow functions
(arrow_function) @name.definition.arrow_function

; Function expressions
(function_expression) @name.definition.function_expression

; Generator functions
(generator_function) @name.definition.generator_function

; Async functions
(async_function_declaration) @name.definition.async_function
(async_function_expression) @name.definition.async_function_expression

; Async arrow functions
(arrow_function
  async: (async)) @name.definition.async_arrow_function

; Template literals
(template_string) @name.definition.template_string

; Regular expressions
(regex) @name.definition.regex

; Call expressions
(call_expression) @name.definition.call

; New expressions
(new_expression) @name.definition.new_expression

; Member expressions
(member_expression) @name.definition.member_expression

; Optional chaining
(optional_chain) @name.definition.optional_chain

; Array and object patterns (destructuring)
(array_pattern) @name.definition.array_pattern
(object_pattern) @name.definition.object_pattern

; Assignment patterns
(assignment_pattern) @name.definition.assignment_pattern

; Spread elements
(spread_element) @name.definition.spread_element

; Type annotations (TypeScript/Flow)
(type_annotation) @name.definition.type_annotation
(type_alias_declaration) @name.definition.type_alias

; Interface declarations
(interface_declaration) @name.definition.interface

; Enum declarations
(enum_declaration) @name.definition.enum

; Namespace declarations
(namespace_declaration) @name.definition.namespace

; Type parameters
(type_parameters) @name.definition.type_parameters
(type_arguments) @name.definition.type_arguments

; JSX elements (for React/JSX files)
(jsx_element) @name.definition.jsx_element
(jsx_self_closing_element) @name.definition.jsx_self_closing_element
(jsx_fragment) @name.definition.jsx_fragment
(jsx_attribute) @name.definition.jsx_attribute
(jsx_expression) @name.definition.jsx_expression

; Hook functions (React)
(function_declaration
  name: (identifier) @name.definition.hook
  (#match? @name.definition.hook "^use[A-Z].*$"))

; Component functions (React)
(function_declaration
  name: (identifier) @name.definition.component
  (#match? @name.definition.component "^[A-Z][a-zA-Z]*$"))

; Comments for documentation
(comment) @name.definition.comment

; String literals that might be JSDoc
(comment
  (#match? @name.definition.comment "^/\\*\\*")) @name.definition.jsdoc

; Module-level exports that might be public API
(export_statement
  declaration: (function_declaration
    name: (identifier) @name.definition.public_api)) @definition.public_api

(export_statement
  declaration: (class_declaration
    name: (identifier) @name.definition.public_api)) @definition.public_api

; Error handling patterns
(try_statement
  body: (statement_block
    (throw_statement))) @name.definition.error_handling

; Promise patterns
(call_expression
  function: (member_expression
    object: (_)
    property: (property_identifier) @name.definition.promise_method
    (#match? @name.definition.promise_method "^(then|catch|finally)$"))) @definition.promise
`;