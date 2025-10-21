/*
JavaScript Tree-Sitter Query Patterns
Comprehensive coverage of JavaScript syntax structures
*/
export default `
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name) @definition.method
  (#not-eq? @name "constructor")
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.method)
)

(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name)
    (class_declaration
      name: (_) @name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

(
  (comment)* @doc
  .
  [
    (function_declaration
      name: (identifier) @name)
    (generator_function_declaration
      name: (identifier) @name)
  ] @definition.function
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (variable_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

; JSON object definitions
(object) @object.definition

; JSON object key-value pairs
(pair
  key: (string) @property.name.definition
  value: [
    (object) @object.value
    (array) @array.value
    (string) @string.value
    (number) @number.value
    (true) @boolean.value
    (false) @boolean.value
    (null) @null.value
  ]
) @property.definition

; JSON array definitions
(array) @array.definition

; Decorated method definitions
(
  [
    (method_definition
      decorator: (decorator)
      name: (property_identifier) @name) @definition.method
    (method_definition
      decorator: (decorator
        (call_expression
          function: (identifier) @decorator_name))
      name: (property_identifier) @name) @definition.method
  ]
  (#not-eq? @name "constructor")
)

; Decorated class definitions
(
  [
    (class
      decorator: (decorator)
      name: (_) @name) @definition.class
    (class_declaration
      decorator: (decorator)
      name: (_) @name) @definition.class
  ]
)

; Capture method names in decorated classes
(
  (class_declaration
    decorator: (decorator)
    body: (class_body
      (method_definition
        name: (property_identifier) @name) @definition.method))
  (#not-eq? @name "constructor")
)

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

; Variable declarations
(lexical_declaration) @name.definition.lexical_declaration
(variable_declaration) @name.definition.variable_declaration

; Import and export statements
(import_statement) @name.definition.import
(export_statement) @name.definition.export

; Class heritage (extends)
(class_heritage) @name.definition.class_heritage

; Constructor methods
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Getter and setter methods
(method_definition
  kind: "get") @name.definition.getter
(method_definition
  kind: "set") @name.definition.setter

; Static methods and fields
(method_definition
  static: (static)) @name.definition.static_method
(field_definition
  static: (static)) @name.definition.static_field

; Private fields and methods
(private_property_identifier) @name.definition.private_member
(field_definition
  name: (private_property_identifier)) @name.definition.private_field
(method_definition
  name: (private_property_identifier)) @name.definition.private_method

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

; Control flow statements
(if_statement) @name.definition.if
(for_statement) @name.definition.for
(while_statement) @name.definition.while
(do_statement) @name.definition.do_while

; Switch statements
(switch_statement) @name.definition.switch
(switch_case) @name.definition.switch_case
(switch_default) @name.definition.switch_default

; Try-catch statements
(try_statement) @name.definition.try
(catch_clause) @name.definition.catch
(finally_clause) @name.definition.finally

; Throw statements
(throw_statement) @name.definition.throw

; Return statements
(return_statement) @name.definition.return

; Break and continue statements
(break_statement) @name.definition.break
(continue_statement) @name.definition.continue

; Labeled statements
(labeled_statement) @name.definition.labeled

; With statements
(with_statement) @name.definition.with

; Debugger statements
(debugger_statement) @name.definition.debugger

; Expression statements
(expression_statement) @name.definition.expression

; Binary expressions
(binary_expression) @name.definition.binary_expression

; Unary expressions
(unary_expression) @name.definition.unary_expression

; Update expressions
(update_expression) @name.definition.update_expression

; Logical expressions
(logical_expression) @name.definition.logical_expression

; Conditional expressions
(conditional_expression) @name.definition.conditional

; Assignment expressions
(assignment_expression) @name.definition.assignment
(augmented_assignment_expression) @name.definition.augmented_assignment

; Sequence expressions
(sequence_expression) @name.definition.sequence

; Yield expressions
(yield_expression) @name.definition.yield

; Await expressions
(await_expression) @name.definition.await

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

; Test functions (common patterns)
(function_declaration
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^(test|it|describe|before|after|beforeEach|afterEach).*$"))

; Hook functions (React)
(function_declaration
  name: (identifier) @name.definition.hook
  (#match? @name.definition.hook "^use[A-Z].*$"))

; Component functions (React)
(function_declaration
  name: (identifier) @name.definition.component
  (#match? @name.definition.component "^[A-Z][a-zA-Z]*$"))

; Constants (UPPER_CASE naming convention)
(lexical_declaration
  (variable_declarator
    name: (identifier) @name.definition.constant
    (#match? @name.definition.constant "^[A-Z_][A-Z0-9_]*$"))) @definition.constant

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
`