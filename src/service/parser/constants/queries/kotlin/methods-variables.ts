/*
Kotlin Method and Variable-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Function declarations
(function_declaration
  (simple_identifier) @name.definition.function) @name.definition.function

; Function with type parameters
(function_declaration
  (type_parameters) @name.definition.type_parameters
  (simple_identifier) @name.definition.generic_function) @name.definition.generic_function

; Function with receiver type
(function_declaration
  (type) @name.definition.receiver_type
  (simple_identifier) @name.definition.extension_function) @name.definition.extension_function

; Function with parameters
(function_declaration
  (function_value_parameters
    (function_value_parameter
      (simple_identifier) @name.definition.parameter)) @name.definition.function_with_parameters) @name.definition.function_with_params

; Function with return type
(function_declaration
  (type) @name.definition.return_type
  (simple_identifier) @name.definition.function_with_return_type) @name.definition.function_with_return

; Function with body
(function_declaration
  (function_body) @name.definition.function_body) @name.definition.function_with_body

; Suspend function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "suspend"))
  (simple_identifier) @name.definition.suspend_function) @name.definition.suspend_function

; Inline function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "inline"))
  (simple_identifier) @name.definition.inline_function) @name.definition.inline_function

; Property declarations
(property_declaration
  (variable_declaration
    (simple_identifier) @name.definition.property)) @name.definition.property

; Property with type
(property_declaration
  (type) @name.definition.property_type
  (variable_declaration
    (simple_identifier) @name.definition.typed_property)) @name.definition.property_with_type

; Property with getter
(property_declaration
  (getter) @name.definition.property_getter) @name.definition.property_with_getter

; Property with setter
(property_declaration
  (setter) @name.definition.property_setter) @name.definition.property_with_setter

; Property with delegate
(property_declaration
  (property_delegate) @name.definition.property_delegate) @name.definition.property_with_delegate

; Property with initializer
(property_declaration
  (expression) @name.definition.property_initializer) @name.definition.property_with_initializer

; Val property (immutable)
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "val"))
  (variable_declaration
    (simple_identifier) @name.definition.val_property)) @name.definition.val_property

; Var property (mutable)
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "var"))
  (variable_declaration
    (simple_identifier) @name.definition.var_property)) @name.definition.var_property

; Lateinit property
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "lateinit"))
  (variable_declaration
    (simple_identifier) @name.definition.lateinit_property)) @name.definition.lateinit_property

; Variable declarations (local variables)
(variable_declaration
  (simple_identifier) @name.definition.variable) @name.definition.variable

; Variable with type
(variable_declaration
  (type) @name.definition.variable_type
  (simple_identifier) @name.definition.typed_variable)) @name.definition.variable_with_type

; Variable with initializer
(variable_declaration
  (expression) @name.definition.variable_initializer) @name.definition.variable_with_initializer

; Multi-variable declarations
(multi_variable_declaration
  (variable_declaration
    (simple_identifier) @name.definition.multi_variable)) @name.definition.multi_variable_declaration

; Function value parameters
(function_value_parameter
  (simple_identifier) @name.definition.parameter) @name.definition.parameter

; Parameter with type
(function_value_parameter
  (type) @name.definition.parameter_type
  (simple_identifier) @name.definition.typed_parameter)) @name.definition.parameter_with_type

; Class parameters
(class_parameter
  (simple_identifier) @name.definition.class_parameter) @name.definition.class_parameter

; Lambda parameters
(lambda_parameter
  (simple_identifier) @name.definition.lambda_parameter) @name.definition.lambda_parameter

; Anonymous function
(anonymous_function
  (function_body) @name.definition.anonymous_function) @name.definition.anonymous_function_with_body

; Getter declarations
(getter
  (function_body) @name.definition.getter_body) @name.definition.getter_with_body

; Setter declarations
(setter
  (function_body) @name.definition.setter_body) @name.definition.setter_with_body

; Function calls
(call_expression) @name.definition.function_call

; Safe call expressions
(safe_call_expression) @name.definition.safe_call

; Elvis expressions
(elvis_expression) @name.definition.elvis_expression

; Assignment expressions
(assignment_expression) @name.definition.assignment_expression

; Type aliases
(type_alias
  (simple_identifier) @name.definition.type_alias) @name.definition.type_alias_declaration

; Generic types
(generic_type) @name.definition.generic_type

; Type references
(type_reference) @name.definition.type_reference

; User types
(user_type) @name.definition.user_type

; Type parameters
(type_parameters) @name.definition.type_parameters

; Type parameter
(type_parameter
  (simple_identifier) @name.definition.type_parameter) @name.definition.type_parameter_declaration

; Type constraints
(type_constraints) @name.definition.type_constraints

; Type constraint
(type_constraint
  (simple_identifier) @name.definition.type_constraint) @name.definition.type_constraint_declaration

; Function types
(function_type) @name.definition.function_type

; Nullable types
(nullable_type) @name.definition.nullable_type

; Receiver types
(receiver_type) @name.definition.receiver_type

; Annotations
(annotation) @name.definition.annotation

; Modifiers
(modifiers) @name.definition.modifiers

; Function modifier
(function_modifier) @name.definition.function_modifier

; Property modifier
(property_modifier) @name.definition.property_modifier

; Visibility modifier
(visibility_modifier) @name.definition.visibility_modifier

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Import headers
(import_header
  (identifier) @name.definition.import) @name.definition.import_declaration

; Package headers
(package_header
  (identifier) @name.definition.package) @name.definition.package_declaration

; Source files
(source_file) @name.definition.source_file

; Scripts
(script) @name.definition.script

; Statements
(statements) @name.definition.statements

; Statement
(statement) @name.definition.statement

; Expressions
(expression) @name.definition.expression

; Blocks
(block) @name.definition.block

; Function bodies
(function_body) @name.definition.function_body

; Class bodies
(class_body) @name.definition.class_body

; Declarations
(declaration) @name.definition.declaration

; Class member declarations
(class_member_declaration) @name.definition.class_member_declaration

; Top level objects
(top_level_object) @name.definition.top_level_object

; Kotlin files
(kotlinFile) @name.definition.kotlin_file
`;