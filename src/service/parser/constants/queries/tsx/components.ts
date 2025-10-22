/*
TSX Component-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
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

; HOC Components
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.hoc_component
    value: (call_expression
      function: (identifier)))) @definition.hoc_component

; Generic Components
(function_declaration
  name: (identifier) @name.definition.generic_component
  type_parameters: (type_parameters)) @definition.generic_component
`;