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
  (simple_identifier) @name.definition.generic_function) @name.definition.function_with_generics

; Function with receiver type
(function_declaration
  (type) @name.definition.receiver_type
  (simple_identifier) @name.definition.extension_function) @name.definition.function_with_receiver

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

; Function with expression body
(function_declaration
  (expression) @name.definition.function_expression_body) @name.definition.function_with_expression

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

; Property with type parameters
(property_declaration
  (type_parameters) @name.definition.type_parameters
  (variable_declaration
    (simple_identifier) @name.definition.generic_property)) @name.definition.property_with_generics

; Property with receiver type
(property_declaration
  (type) @name.definition.receiver_type
  (variable_declaration
    (simple_identifier) @name.definition.extension_property)) @name.definition.property_with_receiver

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

; Const property
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "const"))
  (variable_declaration
    (simple_identifier) @name.definition.const_property)) @name.definition.const_property

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

; Parameter with default value
(function_value_parameter
  (expression) @name.definition.parameter_default
  (simple_identifier) @name.definition.parameter_with_default)) @name.definition.parameter_with_default

; Class parameters
(class_parameter
  (simple_identifier) @name.definition.class_parameter) @name.definition.class_parameter

; Class parameter with type
(class_parameter
  (type) @name.definition.class_parameter_type
  (simple_identifier) @name.definition.typed_class_parameter)) @name.definition.class_parameter_with_type

; Class parameter with modifiers
(class_parameter
  (modifiers) @name.definition.class_parameter_modifiers
  (simple_identifier) @name.definition.modified_class_parameter)) @name.definition.class_parameter_with_modifiers

; Val class parameter
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "val"))
  (simple_identifier) @name.definition.val_class_parameter)) @name.definition.val_class_parameter

; Var class parameter
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "var"))
  (simple_identifier) @name.definition.var_class_parameter)) @name.definition.var_class_parameter

; Lambda parameters
(lambda_parameter
  (simple_identifier) @name.definition.lambda_parameter) @name.definition.lambda_parameter

; Anonymous function
(anonymous_function
  (function_body) @name.definition.anonymous_function) @name.definition.anonymous_function_with_body

; Anonymous function with parameters
(anonymous_function
  (parameters_with_optional_type
    (parameter_with_optional_type
      (simple_identifier) @name.definition.anonymous_function_parameter))) @name.definition.anonymous_function_with_parameters

; Function literals
(function_literal) @name.definition.function_literal

; Getter declarations
(getter
  (function_body) @name.definition.getter_body) @name.definition.getter_with_body

; Getter with expression
(getter
  (expression) @name.definition.getter_expression) @name.definition.getter_with_expression

; Setter declarations
(setter
  (function_body) @name.definition.setter_body) @name.definition.setter_with_body

; Setter with expression
(setter
  (expression) @name.definition.setter_expression) @name.definition.setter_with_expression

; Setter parameter
(setter
  (function_value_parameter_with_optional_type
    (parameter_with_optional_type
      (simple_identifier) @name.definition.setter_parameter))) @name.definition.setter_with_parameter

; Secondary constructors
(secondary_constructor
  (function_value_parameters) @name.definition.secondary_constructor) @name.definition.constructor_with_parameters

; Secondary constructor with delegation
(secondary_constructor
  (constructor_delegation_call) @name.definition.constructor_delegation) @name.definition.constructor_with_delegation

; Secondary constructor with body
(secondary_constructor
  (block) @name.definition.constructor_body) @name.definition.constructor_with_body

; Constructor delegation calls
(constructor_delegation_call) @name.definition.constructor_delegation_call

; Constructor invocation
(constructor_invocation) @name.definition.constructor_invocation

; Function calls
(call_expression) @name.definition.function_call

; Function call with receiver
(call_expression
  (type) @name.definition.call_receiver_type) @name.definition.call_with_receiver

; Function call with type arguments
(call_expression
  (type_arguments) @name.definition.call_type_arguments) @name.definition.call_with_type_args

; Function call with value arguments
(call_expression
  (value_arguments) @name.definition.call_value_arguments) @name.definition.call_with_value_args

; Safe call expressions
(safe_call_expression) @name.definition.safe_call

; Elvis expressions
(elvis_expression) @name.definition.elvis_expression

; Assignment expressions
(assignment_expression) @name.definition.assignment_expression

; Assignment target
(assignment_expression
  (directly_assignable_expression) @name.definition.assignment_target) @name.definition.assignment_with_target

; Assignment value
(assignment_expression
  (expression) @name.definition.assignment_value) @name.definition.assignment_with_value

; Variable declarations in for loops
(for_statement
  (variable_declaration
    (simple_identifier) @name.definition.for_loop_variable)) @name.definition.for_variable_declaration

; Destructuring declarations
(multi_variable_declaration
  (variable_declaration
    (simple_identifier) @name.definition.destructuring_variable)) @name.definition.destructuring_declaration

; Type aliases
(type_alias
  (simple_identifier) @name.definition.type_alias) @name.definition.type_alias_declaration

; Type alias with type parameters
(type_alias
  (type_parameters) @name.definition.type_alias_type_parameters
  (simple_identifier) @name.definition.generic_type_alias)) @name.definition.type_alias_with_generics

; Type alias with type
(type_alias
  (type) @name.definition.type_alias_type
  (simple_identifier) @name.definition.type_alias_with_type)) @name.definition.type_alias_declaration_with_type

; Generic types
(generic_type) @name.definition.generic_type

; Type references
(type_reference) @name.definition.type_reference

; User types
(user_type) @name.definition.user_type

; Simple user types
(simple_user_type) @name.definition.simple_user_type

; Type projections
(type_projection) @name.definition.type_projection

; Type arguments
(type_arguments) @name.definition.type_arguments

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

; Function type parameters
(function_type_parameters) @name.definition.function_type_parameters

; Parenthesized types
(parenthesized_type) @name.definition.parenthesized_type

; Nullable types
(nullable_type) @name.definition.nullable_type

; Definitely non-nullable types
(definitely_non_nullable_type) @name.definition.definitely_non_nullable_type

; Receiver types
(receiver_type) @name.definition.receiver_type

; Type modifiers
(type_modifiers) @name.definition.type_modifiers

; Type projection modifiers
(type_projection_modifiers) @name.definition.type_projection_modifiers

; Type projection modifier
(type_projection_modifier) @name.definition.type_projection_modifier

; Variance modifiers
(variance_modifier) @name.definition.variance_modifier

; Parameter modifiers
(parameter_modifiers) @name.definition.parameter_modifiers

; Parameter modifier
(parameter_modifier) @name.definition.parameter_modifier

; Annotations
(annotation) @name.definition.annotation

; Annotation with arguments
(annotation
  (value_arguments) @name.definition.annotation_with_arguments) @name.definition.annotation_with_args

; Annotation use site targets
(annotation_use_site_target) @name.definition.annotation_use_site_target

; Modifiers
(modifiers) @name.definition.modifiers

; Class modifier
(class_modifier) @name.definition.class_modifier

; Function modifier
(function_modifier) @name.definition.function_modifier

; Property modifier
(property_modifier) @name.definition.property_modifier

; Inheritance modifier
(inheritance_modifier) @name.definition.inheritance_modifier

; Parameter modifier
(parameter_modifier) @name.definition.parameter_modifier

; Type modifier
(type_modifier) @name.definition.type_modifier

; Visibility modifier
(visibility_modifier) @name.definition.visibility_modifier

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Import headers
(import_header
  (identifier) @name.definition.import) @name.definition.import_declaration

; Import with alias
(import_header
  (import_alias
    (simple_identifier) @name.definition.import_alias)) @name.definition.import_with_alias

; Import with wildcard
(import_header
  (identifier) @name.definition.import_wildcard) @name.definition.import_with_wildcard

; Package headers
(package_header
  (identifier) @name.definition.package) @name.definition.package_declaration

; File annotations
(file_annotation) @name.definition.file_annotation

; Shebang lines
(shebang_line) @name.definition.shebang_line

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

; Enum class bodies
(enum_class_body) @name.definition.enum_class_body

; Anonymous initializers
(anonymous_initializer) @name.definition.anonymous_initializer

; Companion objects
(companion_object) @name.definition.companion_object

; Object declarations
(object_declaration
  (simple_identifier) @name.definition.object) @name.definition.object_declaration

; Object literals
(object_literal) @name.definition.object_literal

; Enum entries
(enum_entry
  (simple_identifier) @name.definition.enum_entry) @name.definition.enum_entry_declaration

; Type aliases
(type_alias
  (simple_identifier) @name.definition.type_alias) @name.definition.type_alias_declaration

; Declarations
(declaration) @name.definition.declaration

; Class member declarations
(class_member_declaration) @name.definition.class_member_declaration

; Class member declarations
(class_member_declarations) @name.definition.class_member_declarations

; Top level objects
(top_level_object) @name.definition.top_level_object

; Kotlin files
(kotlinFile) @name.definition.kotlin_file
`;