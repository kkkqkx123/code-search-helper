import typescriptQuery from "./typescript"

/**
 * Tree-sitter Query for TSX Files
 *
 * This query captures React component definitions in TSX files:
 * - Function Components
 * - Class Components
 * - Higher Order Components
 * - Type Definitions
 * - Props Interfaces
 * - State Definitions
 * - Generic Components
 */

export default `${typescriptQuery}

; Function Components - Both function declarations and arrow functions
(function_declaration
  name: (identifier) @name.definition.function_component) @definition.function_component

; Arrow Function Components
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.arrow_function_component
    value: (arrow_function))) @definition.arrow_function_component

; Export Statement Components
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @name.definition.exported_component
      value: (arrow_function)))) @definition.exported_component

; Class Components
(class_declaration
  name: (type_identifier) @name.definition.class_component) @definition.class_component

; Interface Declarations
(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

; Type Alias Declarations
(type_alias_declaration
  name: (type_identifier) @name.definition.type_alias) @definition.type_alias

; HOC Components
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.hoc_component
    value: (call_expression
      function: (identifier)))) @definition.hoc_component

; JSX Component Usage - Capture all components in JSX
(jsx_element
  open_tag: (jsx_opening_element
    name: [(identifier) @name.definition.jsx_component (member_expression) @name.definition.jsx_component])) @definition.jsx_element

; Self-closing JSX elements
(jsx_self_closing_element
  name: [(identifier) @name.definition.jsx_self_closing_component (member_expression) @name.definition.jsx_self_closing_component]) @definition.jsx_self_closing_element

; JSX attributes
(jsx_attribute
  (property_identifier) @name.definition.jsx_attribute) @definition.jsx_attribute

; JSX text content
(jsx_text) @definition.jsx_text

; JSX expressions (inside curly braces)
(jsx_expression
  (identifier) @name.definition.jsx_expression) @definition.jsx_expression

; Capture all member expressions in JSX
(member_expression
  object: (identifier) @name.definition.jsx_member_object
  property: (property_identifier) @name.definition.jsx_member_property) @definition.jsx_member_expression

; Capture components in conditional expressions
(ternary_expression
  consequence: (parenthesized_expression
    (jsx_element
      open_tag: (jsx_opening_element
        name: (identifier) @name.definition.conditional_component)))) @definition.conditional_component

(ternary_expression
  alternative: (jsx_self_closing_element
    name: (identifier) @name.definition.conditional_component)) @definition.conditional_component

; Generic Components
(function_declaration
  name: (identifier) @name.definition.generic_component
  type_parameters: (type_parameters)) @definition.generic_component

; React hooks
(call_expression
  (identifier) @name.definition.react_hook
  (#match? @name.definition.react_hook "^use[A-Z]")) @definition.react_hook

; Type assertions with 'as'
(as_expression
  (identifier) @name.definition.type_assertion_variable
  (type_identifier) @name.definition.type_assertion_type) @definition.as_expression

; Satisfies expressions
(satisfies_expression
  (identifier) @name.definition.satisfies_expression_variable
  (type_identifier) @name.definition.satisfies_expression_type) @definition.satisfies_expression

; Type parameters in JSX elements
(jsx_opening_element
  (type_arguments) @definition.jsx_type_arguments)

; Type queries (typeof, keyof)
(type_query
  (identifier) @name.definition.type_query) @definition.type_query

; Index access types
(indexed_access_type
  (identifier) @name.definition.indexed_access_type) @definition.indexed_access_type

; Template literal types in JSX context
(jsx_element
  (template_literal_type) @definition.jsx_template_literal)

; JSX fragments
(jsx_fragment) @definition.jsx_fragment

; Import type statements
(import_type
  (identifier) @name.definition.import_type) @definition.import_type

; Assertion functions
(declare_statement
  (function_signature
    (asserts_identifier) @name.definition.assertion_function)) @definition.assertion_function

; Non-null assertions in JSX context
(non_null_expression
  (identifier) @name.definition.non_null_assertion) @definition.non_null_expression

; Optional chaining in JSX context
(optional_chain
  (identifier) @name.definition.optional_chain) @definition.optional_chain
`
