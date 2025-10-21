/*
Query patterns for Java language structures
*/
export default `
; Module declarations
(module_declaration
  name: (scoped_identifier) @name.definition.module) @definition.module

; Package declarations
((package_declaration
  (scoped_identifier)) @name.definition.package) @definition.package

; Line comments
(line_comment) @definition.comment

; Block comments
(block_comment) @definition.comment

; Class declarations
(class_declaration
  name: (identifier) @name.definition.class) @definition.class

; Interface declarations
(interface_declaration
  name: (identifier) @name.definition.interface) @definition.interface

; Enum declarations
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Record declarations
(record_declaration
  name: (identifier) @name.definition.record) @definition.record

; Annotation declarations
(annotation_type_declaration
  name: (identifier) @name.definition.annotation) @definition.annotation

; Constructor declarations
(constructor_declaration
  name: (identifier) @name.definition.constructor) @definition.constructor

; Method declarations
(method_declaration
  name: (identifier) @name.definition.method) @definition.method

; Inner class declarations
(class_declaration
  (class_body
    (class_declaration
      name: (identifier) @name.definition.inner_class))) @definition.inner_class

; Static nested class declarations
(class_declaration
  (class_body
    (class_declaration
      name: (identifier) @name.definition.static_nested_class))) @definition.static_nested_class

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

; Switch expressions and statements
(switch_expression
  (parenthesized_expression) @definition.switch_condition
  (switch_block) @definition.switch_body) @definition.switch

; Switch rules and labels
(switch_rule
  (switch_label) @definition.switch_label
  (_) @definition.switch_case_body) @definition.switch_case

; Record patterns (Java 19+)
(record_pattern
  (identifier) @name.definition.record_pattern) @definition.record_pattern

; Instanceof expressions with patterns
(instanceof_expression
  (identifier) @name.definition.instanceof_variable
  (_) @definition.instanceof_pattern) @definition.instanceof

; Pattern variables
(pattern
  (type_pattern
    (type_identifier) @name.definition.pattern_type
    (identifier) @name.definition.pattern_variable))) @definition.pattern

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

; Try-catch blocks
(try_statement
  (block) @definition.try_block
  (catch_clause
    (catch_formal_parameter
      (identifier) @name.definition.exception_variable))) @definition.try_catch

; For loops
(for_statement
  (local_variable_declaration
    declarator: (variable_declarator
      name: (identifier) @name.definition.for_variable))) @definition.for_loop

; Enhanced for loops
(enhanced_for_statement
  (identifier) @name.definition.enhanced_for_variable
  (expression) @definition.enhanced_for_iterable) @definition.enhanced_for_loop

; Literals
(string_literal) @definition.string_literal
(decimal_integer_literal) @definition.integer_literal
(decimal_floating_point_literal) @definition.float_literal
(character_literal) @definition.char_literal
(true) @definition.boolean_literal
(false) @definition.boolean_literal
(null_literal) @definition.null_literal
`
