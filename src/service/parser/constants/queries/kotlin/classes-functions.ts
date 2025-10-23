/*
Kotlin Class and Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Type alias declarations
(type_alias
  (simple_identifier) @name.definition.type_alias) @definition.type_alias

; Type alias with type parameters
(type_alias
  (type_parameters) @name.definition.type_alias_type_parameters
  (simple_identifier) @name.definition.generic_type_alias) @definition.generic_type_alias

; Regular class declarations
(class_declaration
  (simple_identifier) @name.definition.class) @definition.class

; Class with type parameters
(class_declaration
  (type_parameters) @name.definition.class_type_parameters
  (simple_identifier) @name.definition.generic_class) @definition.generic_class

; Class with primary constructor
(class_declaration
  (primary_constructor) @name.definition.class_primary_constructor
  (simple_identifier) @name.definition.class_with_constructor) @definition.class_with_primary_constructor

; Class with inheritance
(class_declaration
  (delegation_specifiers) @name.definition.class_inheritance
  (simple_identifier) @name.definition.inheriting_class) @definition.class_with_inheritance

; Class with type constraints
(class_declaration
  (type_constraints) @name.definition.class_type_constraints
  (simple_identifier) @name.definition.constrained_class) @definition.class_with_constraints

; Data class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "data"))
  (simple_identifier) @name.definition.data_class) @definition.data_class

; Data class with primary constructor
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "data"))
  (primary_constructor) @name.definition.data_class_constructor
  (simple_identifier) @name.definition.data_class_with_constructor) @definition.data_class_with_primary_constructor

; Abstract class declarations
(class_declaration
  (modifiers
    (inheritance_modifier) @_modifier (#eq? @_modifier "abstract"))
  (simple_identifier) @name.definition.abstract_class) @definition.abstract_class

; Sealed class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "sealed"))
  (simple_identifier) @name.definition.sealed_class) @definition.sealed_class

; Open class declarations
(class_declaration
  (modifiers
    (inheritance_modifier) @_modifier (#eq? @_modifier "open"))
  (simple_identifier) @name.definition.open_class) @definition.open_class

; Final class declarations
(class_declaration
  (modifiers
    (inheritance_modifier) @_modifier (#eq? @_modifier "final"))
  (simple_identifier) @name.definition.final_class) @definition.final_class

; Inner class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "inner"))
  (simple_identifier) @name.definition.inner_class) @definition.inner_class

; Value class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "value"))
  (simple_identifier) @name.definition.value_class) @definition.value_class

; Enum class declarations
(class_declaration
  (simple_identifier) @name.definition.enum_class
  (enum_class_body)) @definition.enum_class

; Enum class with entries
(class_declaration
  (simple_identifier) @name.definition.enum_class_with_entries
  (enum_class_body
    (enum_entries) @name.definition.enum_entries)) @definition.enum_class_with_entries

; Interface declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "interface"))
  (simple_identifier) @name.definition.interface) @definition.interface

; Interface with type parameters
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "interface"))
  (type_parameters) @name.definition.interface_type_parameters
  (simple_identifier) @name.definition.generic_interface) @definition.generic_interface

; Interface with inheritance
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "interface"))
  (delegation_specifiers) @name.definition.interface_inheritance
  (simple_identifier) @name.definition.inheriting_interface) @definition.interface_with_inheritance

; Annotation class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "annotation"))
  (simple_identifier) @name.definition.annotation_class) @definition.annotation_class

; Regular function declarations
(function_declaration
  (simple_identifier) @name.definition.function) @definition.function

; Function with type parameters
(function_declaration
  (type_parameters) @name.definition.function_type_parameters
  (simple_identifier) @name.definition.generic_function) @definition.generic_function

; Function with receiver type
(function_declaration
  (type) @name.definition.function_receiver_type
  (simple_identifier) @name.definition.extension_function) @definition.extension_function

; Function with parameters
(function_declaration
  (function_value_parameters) @name.definition.function_parameters
  (simple_identifier) @name.definition.function_with_parameters) @definition.function_with_parameters

; Function with return type
(function_declaration
  (type) @name.definition.function_return_type
  (simple_identifier) @name.definition.function_with_return_type) @definition.function_with_return_type

; Function with body
(function_declaration
  (function_body) @name.definition.function_body) @definition.function_with_body

; Function with expression body
(function_declaration
  (expression) @name.definition.function_expression_body) @definition.function_with_expression_body

; Function with type constraints
(function_declaration
  (type_constraints) @name.definition.function_type_constraints
  (simple_identifier) @name.definition.constrained_function) @definition.function_with_constraints

; Suspend function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "suspend"))
  (simple_identifier) @name.definition.suspend_function) @definition.suspend_function

; Inline function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "inline"))
  (simple_identifier) @name.definition.inline_function) @definition.inline_function

; Tailrec function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "tailrec"))
  (simple_identifier) @name.definition.tailrec_function) @definition.tailrec_function

; Operator function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "operator"))
  (simple_identifier) @name.definition.operator_function) @definition.operator_function

; Infix function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "infix"))
  (simple_identifier) @name.definition.infix_function) @definition.infix_function

; External function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "external"))
  (simple_identifier) @name.definition.external_function) @definition.external_function

; Expect function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "expect"))
  (simple_identifier) @name.definition.expect_function) @definition.expect_function

; Actual function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "actual"))
  (simple_identifier) @name.definition.actual_function) @definition.actual_function

; Object declarations
(object_declaration
  (simple_identifier) @name.definition.object) @definition.object

; Object with inheritance
(object_declaration
  (delegation_specifiers) @name.definition.object_inheritance
  (simple_identifier) @name.definition.inheriting_object) @definition.object_with_inheritance

; Object with body
(object_declaration
  (class_body) @name.definition.object_body
  (simple_identifier) @name.definition.object_with_body) @definition.object_with_body

; Companion object declarations
(companion_object) @definition.companion_object

; Companion object with name
(companion_object
  (simple_identifier) @name.definition.named_companion_object) @definition.named_companion_object

; Companion object with inheritance
(companion_object
  (delegation_specifiers) @name.definition.companion_object_inheritance) @definition.companion_object_with_inheritance

; Companion object with body
(companion_object
  (class_body) @name.definition.companion_object_body) @definition.companion_object_with_body

; Anonymous initializer
(anonymous_initializer) @definition.anonymous_initializer

; Class bodies
(class_body) @definition.class_body

; Class member declarations
(class_member_declarations) @definition.class_member_declarations

; Enum class bodies
(enum_class_body) @definition.enum_class_body

; Enum entries
(enum_entry
  (simple_identifier) @name.definition.enum_entry) @definition.enum_entry

; Enum entries with arguments
(enum_entry
  (value_arguments) @name.definition.enum_entry_with_arguments
  (simple_identifier) @name.definition.enum_entry_with_args) @definition.enum_entry_with_arguments

; Enum entries with body
(enum_entry
  (class_body) @name.definition.enum_entry_with_body
  (simple_identifier) @name.definition.enum_entry_with_class_body) @definition.enum_entry_with_body

; Primary constructors
(primary_constructor) @definition.primary_constructor

; Primary constructor with modifiers
(primary_constructor
  (modifiers) @name.definition.primary_constructor_modifiers) @definition.primary_constructor_with_modifiers

; Primary constructor with parameters
(primary_constructor
  (class_parameters) @name.definition.primary_constructor_parameters) @definition.primary_constructor_with_parameters

; Secondary constructors
(secondary_constructor) @definition.secondary_constructor

; Secondary constructor with modifiers
(secondary_constructor
  (modifiers) @name.definition.secondary_constructor_modifiers) @definition.secondary_constructor_with_modifiers

; Secondary constructor with parameters
(secondary_constructor
  (function_value_parameters) @name.definition.secondary_constructor_parameters) @definition.secondary_constructor_with_parameters

; Secondary constructor with delegation
(secondary_constructor
  (constructor_delegation_call) @name.definition.secondary_constructor_delegation) @definition.secondary_constructor_with_delegation

; Secondary constructor with body
(secondary_constructor
  (block) @name.definition.secondary_constructor_body) @definition.secondary_constructor_with_body

; Constructor delegation calls
(constructor_delegation_call) @definition.constructor_delegation_call

; Constructor invocations
(constructor_invocation) @definition.constructor_invocation

; Type parameters
(type_parameters) @definition.type_parameters

; Type parameter
(type_parameter
  (simple_identifier) @name.definition.type_parameter) @definition.type_parameter

; Type constraints
(type_constraints) @definition.type_constraints

; Type constraint
(type_constraint
  (simple_identifier) @name.definition.type_constraint) @definition.type_constraint

; Delegation specifiers
(delegation_specifiers) @definition.delegation_specifiers

; Annotated delegation specifiers
(annotated_delegation_specifiers) @definition.annotated_delegation_specifiers

; Delegation specifier
(delegation_specifier) @definition.delegation_specifier

; Constructor invocation as delegation
(constructor_invocation) @definition.constructor_invocation_delegation

; Explicit delegation
(explicit_delegation) @definition.explicit_delegation

; User type as delegation
(user_type) @definition.user_type_delegation

; Function type as delegation
(function_type) @definition.function_type_delegation

; Suspend function type as delegation
(suspend_function_type) @definition.suspend_function_type_delegation

; Class parameters
(class_parameters) @definition.class_parameters

; Class parameter
(class_parameter
  (simple_identifier) @name.definition.class_parameter) @definition.class_parameter

; Class parameter with type
(class_parameter
  (type) @name.definition.class_parameter_type
  (simple_identifier) @name.definition.typed_class_parameter) @definition.class_parameter_with_type

; Class parameter with modifiers
(class_parameter
  (modifiers) @name.definition.class_parameter_modifiers
  (simple_identifier) @name.definition.modified_class_parameter) @definition.class_parameter_with_modifiers

; Val class parameter
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "val"))
  (simple_identifier) @name.definition.val_class_parameter) @definition.val_class_parameter

; Var class parameter
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "var"))
  (simple_identifier) @name.definition.var_class_parameter) @name.definition.var_class_parameter

; Function value parameters
(function_value_parameters) @definition.function_value_parameters

; Function value parameter
(function_value_parameter
  (simple_identifier) @name.definition.function_value_parameter) @definition.function_value_parameter

; Function value parameter with type
(function_value_parameter
  (type) @name.definition.function_value_parameter_type
  (simple_identifier) @name.definition.typed_function_value_parameter) @definition.function_value_parameter_with_type

; Function value parameter with default value
(function_value_parameter
  (expression) @name.definition.function_value_parameter_default
  (simple_identifier) @name.definition.function_value_parameter_with_default) @definition.function_value_parameter_with_default

; Function bodies
(function_body) @definition.function_body

; Function body as block
(function_body
  (block) @name.definition.function_body_block) @definition.function_body_as_block

; Function body as expression
(function_body
  (expression) @name.definition.function_body_expression) @definition.function_body_as_expression

; Modifiers
(modifiers) @definition.modifiers

; Class modifiers
(class_modifier) @definition.class_modifier

; Function modifiers
(function_modifier) @definition.function_modifier

; Inheritance modifiers
(inheritance_modifier) @definition.inheritance_modifier

; Parameter modifiers
(parameter_modifier) @definition.parameter_modifier

; Type modifiers
(type_modifier) @definition.type_modifier

; Visibility modifiers
(visibility_modifier) @definition.visibility_modifier

; Annotations
(annotation) @definition.annotation

; Annotation with arguments
(annotation
  (value_arguments) @name.definition.annotation_with_arguments) @definition.annotation_with_arguments

; Annotation use site targets
(annotation_use_site_target) @definition.annotation_use_site_target

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; User types
(user_type) @name.definition.user_type

; Simple user types
(simple_user_type) @name.definition.simple_user_type

; Type references
(type_reference) @name.definition.type_reference

; Types
(type) @name.definition.type

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

; Type projections
(type_projection) @name.definition.type_projection

; Type arguments
(type_arguments) @name.definition.type_arguments

; Type argument
(type_argument
  (type) @name.definition.type_argument) @definition.type_argument_with_type

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

; Type modifiers
(type_modifiers) @name.definition.type_modifiers

; Type modifier
(type_modifier) @name.definition.type_modifier

; Declarations
(declaration) @name.definition.declaration

; Class member declarations
(class_member_declaration) @name.definition.class_member_declaration

; Top level objects
(top_level_object) @name.definition.top_level_object

; Kotlin files
(kotlinFile) @name.definition.kotlin_file

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

; Package headers
(package_header) @name.definition.package_header

; Import headers
(import_header) @name.definition.import_header

; Import lists
(import_list) @name.definition.import_list

; File annotations
(file_annotation) @name.definition.file_annotation

; Shebang lines
(shebang_line) @name.definition.shebang_line
`;