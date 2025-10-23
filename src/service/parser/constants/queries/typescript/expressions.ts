/*
TypeScript Expression Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter-typescript grammar
*/
export default `
; Arrow functions
(arrow_function) @name.definition.arrow_function

; Function expressions
(function_expression) @name.definition.function_expression

; Generator functions
(generator_function_declaration
  name: (identifier) @name.definition.generator_function) @definition.generator_function

; Async functions
(async_function_declaration
  name: (identifier) @name.definition.async_function) @definition.async_function

(async_function_expression) @name.definition.async_function_expression

; Async arrow functions
(arrow_function
  async: (async)) @name.definition.async_arrow_function

; Template literals
(template_string) @name.definition.template_string

; Regular expressions
(regex) @name.definition.regex

; Call expressions
(call_expression
  function: (_) @name.definition.call) @definition.call

; New expressions
(new_expression
  constructor: (_) @name.definition.new_expression) @definition.new_expression

; Member expressions
(member_expression
  object: (_) @name.definition.member_object
  property: (property_identifier) @name.definition.member_property) @definition.member_expression

; Optional chaining
(optional_chain
  object: (_) @name.definition.optional_object
  property: (property_identifier) @name.definition.optional_property) @definition.optional_chain

; Array and object patterns (destructuring)
(array_pattern) @name.definition.array_pattern
(object_pattern) @name.definition.object_pattern

; Assignment patterns
(assignment_pattern) @name.definition.assignment_pattern

; Spread elements
(spread_element) @name.definition.spread_element

; Type annotations
(type_annotation) @name.definition.type_annotation

; Type alias declarations
(type_alias_declaration
  name: (type_identifier) @name.definition.type_alias) @definition.type_alias

; Interface declarations
(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

; Enum declarations
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Namespace declarations
(namespace_declaration
  name: (identifier) @name.definition.namespace) @definition.namespace

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
  (#match? @name.definition.hook "^use[A-Z].*$")) @definition.hook

; Component functions (React)
(function_declaration
  name: (identifier) @name.definition.component
  (#match? @name.definition.component "^[A-Z][a-zA-Z]*$")) @definition.component

; Type assertions
(type_assertion
  value: (_) @name.definition.type_assertion_value
  type: (_) @name.definition.type_assertion_type) @definition.type_assertion

; As expressions
(as_expression
  value: (_) @name.definition.as_expression_value
  type: (_) @name.definition.as_expression_type) @definition.as_expression

; Satisfies expressions
(satisfies_expression
  value: (_) @name.definition.satisfies_expression_value
  type: (_) @name.definition.satisfies_expression_type) @definition.satisfies_expression

; Non-null expressions
(non_null_expression
  value: (_) @name.definition.non_null_value) @definition.non_null_expression

; Binary expressions
(binary_expression
  left: (_) @name.definition.binary_left
  operator: (_) @name.definition.binary_operator
  right: (_) @name.definition.binary_right) @definition.binary_expression

; Unary expressions
(unary_expression
  operator: (_) @name.definition.unary_operator
  argument: (_) @name.definition.unary_argument) @definition.unary_expression

; Update expressions
(update_expression
  operator: (_) @name.definition.update_operator
  argument: (_) @name.definition.update_argument) @definition.update_expression

; Logical expressions
(logical_expression
  left: (_) @name.definition.logical_left
  operator: (_) @name.definition.logical_operator
  right: (_) @name.definition.logical_right) @definition.logical_expression

; Assignment expressions
(assignment_expression
  left: (_) @name.definition.assignment_left
  operator: (_) @name.definition.assignment_operator
  right: (_) @name.definition.assignment_right) @definition.assignment_expression

; Augmented assignment expressions
(augmented_assignment_expression
  left: (_) @name.definition.augmented_left
  operator: (_) @name.definition.augmented_operator
  right: (_) @name.definition.augmented_right) @definition.augmented_assignment

; Subscript expressions
(subscript_expression
  object: (_) @name.definition.subscript_object
  index: (_) @name.definition.subscript_index) @definition.subscript_expression

; Parenthesized expressions
(parenthesized_expression
  expression: (_) @name.definition.parenthesized_expression) @definition.parenthesized_expression
`;