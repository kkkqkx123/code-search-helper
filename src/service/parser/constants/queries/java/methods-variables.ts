/*
Java Method and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Constructor declarations
(constructor_declaration
  name: (identifier) @name.definition.constructor) @name.definition.constructor

; Method declarations
(method_declaration
  name: (identifier) @name.definition.method) @name.definition.method

; Lambda expressions
(lambda_expression) @name.definition.lambda

; Lambda parameters
(lambda_expression
  (formal_parameters
    (formal_parameter
      name: (identifier) @name.definition.lambda_parameter))) @name.definition.lambda_with_params

; Lambda body
(lambda_expression
  (_) @name.definition.lambda_body) @name.definition.lambda_with_body

; Field declarations
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @name.definition.field)) @name.definition.field

; Local variable declarations
(local_variable_declaration
  declarator: (variable_declarator
    name: (identifier) @name.definition.local_variable)) @name.definition.local_variable

; Import declarations
(import_declaration
  (scoped_identifier) @name.definition.import) @name.definition.import

; Static import declarations
(import_declaration
  (identifier) @name.definition.static_import) @name.definition.static_import

; Type parameters
(type_parameters
  (type_parameter) @name.definition.type_parameter) @name.definition.type_parameter

; Annotations
(annotation
  name: (identifier) @name.definition.annotation_name) @name.definition.annotation

; Marker annotations
(marker_annotation
  name: (identifier) @name.definition.marker_annotation) @name.definition.marker_annotation

; Method invocations
(method_invocation
  name: (identifier) @name.definition.method_call) @name.definition.method_invocation

; Object creation expressions
(object_creation_expression
  type: (type_identifier) @name.definition.constructor_call) @name.definition.object_creation

; Generic types
(generic_type
  (type_identifier) @name.definition.generic_type) @name.definition.generic_type

; Array types
(array_type
  (type_identifier) @name.definition.array_type) @name.definition.array_type

; Array dimensions
(dimensions) @name.definition.dimensions

; Formal parameters
(formal_parameters
  (formal_parameter
    name: (identifier) @name.definition.parameter)) @name.definition.formal_parameters

; Variable declarators
(variable_declarator
  name: (identifier) @name.definition.variable_declarator) @name.definition.variable_declarator

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Scoped type identifiers
(scoped_type_identifier) @name.definition.scoped_type_identifier

; Integral types
(integral_type) @name.definition.integral_type

; Floating point types
(floating_point_type) @name.definition.floating_point_type

; Void type
(void_type) @name.definition.void_type

; Boolean type
(boolean_type) @name.definition.boolean_type

; Class literals
(class_literal
  (type_identifier) @name.definition.class_literal) @name.definition.class_literal

; This expressions
(this) @name.definition.this_expression

; Super expressions
(super) @name.definition.super_expression

; Cast expressions
(cast_expression
  value: (_) @name.definition.cast_value) @name.definition.cast_expression

; Instanceof expressions
(instanceof_expression) @name.definition.instanceof_expression

; Assignment expressions
(assignment_expression
  left: (identifier) @name.definition.assignment_target) @name.definition.assignment_expression

; Binary expressions
(binary_expression) @name.definition.binary_expression

; Unary expressions
(unary_expression) @name.definition.unary_expression

; Update expressions
(update_expression) @name.definition.update_expression

; Parenthesized expressions
(parenthesized_expression) @name.definition.parenthesized_expression
`;