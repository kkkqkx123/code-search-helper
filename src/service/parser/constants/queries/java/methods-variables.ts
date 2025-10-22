/*
Java Method and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Constructor declarations
(constructor_declaration
  name: (identifier) @name.definition.constructor) @definition.constructor

; Method declarations
(method_declaration
  name: (identifier) @name.definition.method) @definition.method

; Lambda expressions
(lambda_expression
  (identifier) @name.definition.lambda_parameter
  (_) @definition.lambda_body) @definition.lambda

; Field declarations
(field_declaration
  (modifiers)?
  type: (_)
  declarator: (variable_declarator
    name: (identifier) @name.definition.field)) @definition.field

; Local variable declarations
(local_variable_declaration
  type: (_)
  declarator: (variable_declarator
    name: (identifier) @name.definition.local_variable)) @definition.local_variable

; Import declarations
(import_declaration
  (scoped_identifier) @name.definition.import) @definition.import

; Type parameters
(type_parameters
  (type_parameter) @name.definition.type_parameter) @definition.type_parameter

; Annotations
(annotation
  (identifier) @name.definition.annotation_name) @definition.annotation

; Method invocations
(method_invocation
  name: (identifier) @name.definition.method_call) @definition.method_invocation

; Object creation expressions
(object_creation_expression
  (type_identifier) @name.definition.constructor_call) @definition.object_creation

; Generic types
(generic_type
  (type_identifier) @name.definition.generic_type) @definition.generic

; Array types and declarations
(array_type
  (type_identifier) @name.definition.array_type) @definition.array_type
`;