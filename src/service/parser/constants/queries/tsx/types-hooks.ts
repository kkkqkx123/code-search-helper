/*
TSX Types and Hooks-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Interface Declarations
(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

; Type Alias Declarations
(type_alias_declaration
  name: (type_identifier) @name.definition.type_alias) @definition.type_alias

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

; Type queries (typeof, keyof)
(type_query
  (identifier) @name.definition.type_query) @definition.type_query

; Index access types
(indexed_access_type
  (identifier) @name.definition.indexed_access_type) @definition.indexed_access_type

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
`;