/*
TSX JSX-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
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

; Type parameters in JSX elements
(jsx_opening_element
  (type_arguments) @definition.jsx_type_arguments)

; Template literal types in JSX context
(jsx_element
  (template_literal_type) @definition.jsx_template_literal)

; JSX fragments
(jsx_fragment) @definition.jsx_fragment
`;