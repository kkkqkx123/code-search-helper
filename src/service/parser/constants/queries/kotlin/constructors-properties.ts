/*
Kotlin Constructor and Property-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Primary constructor declarations
(primary_constructor) @definition.primary_constructor

; Primary constructor with modifiers
(primary_constructor
  (modifiers) @name.definition.primary_constructor_modifiers) @definition.primary_constructor_with_modifiers

; Primary constructor with parameters
(primary_constructor
  (class_parameters) @name.definition.primary_constructor_parameters) @definition.primary_constructor_with_parameters

; Primary constructor with modifiers and parameters
(primary_constructor
  (modifiers) @name.definition.primary_constructor_modifiers
  (class_parameters) @name.definition.primary_constructor_parameters) @definition.primary_constructor_with_modifiers_and_parameters

; Constructor parameters (properties in primary constructor)
(class_parameter
  (simple_identifier) @name.definition.property) @definition.constructor_property

; Constructor parameter with type
(class_parameter
  (type) @name.definition.constructor_parameter_type
  (simple_identifier) @name.definition.typed_constructor_property) @definition.constructor_property_with_type

; Constructor parameter with modifiers
(class_parameter
  (modifiers) @name.definition.constructor_parameter_modifiers
  (simple_identifier) @name.definition.modified_constructor_property) @definition.constructor_property_with_modifiers

; Val constructor parameter (immutable property)
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "val"))
  (simple_identifier) @name.definition.val_constructor_property) @definition.val_constructor_property

; Var constructor parameter (mutable property)
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "var"))
  (simple_identifier) @name.definition.var_constructor_property) @definition.var_constructor_property

; Constructor parameter with default value
(class_parameter
  (expression) @name.definition.constructor_parameter_default
  (simple_identifier) @name.definition.constructor_property_with_default) @definition.constructor_property_with_default

; Constructor parameter with vararg
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "vararg"))
  (simple_identifier) @name.definition.vararg_constructor_property) @definition.vararg_constructor_property

; Constructor parameter with noinline
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "noinline"))
  (simple_identifier) @name.definition.noinline_constructor_property) @definition.noinline_constructor_property

; Constructor parameter with crossinline
(class_parameter
  (modifiers
    (parameter_modifier) @_modifier (#eq? @_modifier "crossinline"))
  (simple_identifier) @name.definition.crossinline_constructor_property) @definition.crossinline_constructor_property

; Secondary constructor declarations
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

; Secondary constructor with this delegation
(secondary_constructor
  (constructor_delegation_call
    (this) @name.definition.constructor_this_delegation)) @definition.secondary_constructor_with_this_delegation

; Secondary constructor with super delegation
(secondary_constructor
  (constructor_delegation_call
    (super) @name.definition.constructor_super_delegation)) @definition.secondary_constructor_with_super_delegation

; Constructor delegation calls
(constructor_delegation_call) @definition.constructor_delegation_call

; Constructor invocations
(constructor_invocation) @definition.constructor_invocation

; Constructor invocation with type arguments
(constructor_invocation
  (type_arguments) @name.definition.constructor_invocation_with_type_args) @definition.constructor_invocation_with_type_arguments

; Constructor invocation with value arguments
(constructor_invocation
  (value_arguments) @name.definition.constructor_invocation_with_value_args) @definition.constructor_invocation_with_value_arguments

; Property declarations
(property_declaration
  (variable_declaration
    (simple_identifier) @name.definition.property)) @definition.property

; Property with type parameters
(property_declaration
  (type_parameters) @name.definition.property_type_parameters
  (variable_declaration
    (simple_identifier) @name.definition.generic_property)) @definition.generic_property

; Property with receiver type
(property_declaration
  (type) @name.definition.property_receiver_type
  (variable_declaration
    (simple_identifier) @name.definition.extension_property)) @definition.extension_property

; Property with type
(property_declaration
  (type) @name.definition.property_type
  (variable_declaration
    (simple_identifier) @name.definition.typed_property)) @definition.typed_property

; Property with getter
(property_declaration
  (getter) @name.definition.property_getter
  (variable_declaration
    (simple_identifier) @name.definition.property_with_getter)) @definition.property_with_getter

; Property with setter
(property_declaration
  (setter) @name.definition.property_setter
  (variable_declaration
    (simple_identifier) @name.definition.property_with_setter)) @definition.property_with_setter

; Property with getter and setter
(property_declaration
  (getter) @name.definition.property_getter
  (setter) @name.definition.property_setter
  (variable_declaration
    (simple_identifier) @name.definition.property_with_getter_setter)) @definition.property_with_getter_setter

; Property with delegate
(property_declaration
  (property_delegate) @name.definition.property_delegate
  (variable_declaration
    (simple_identifier) @name.definition.delegated_property)) @definition.delegated_property

; Property with initializer
(property_declaration
  (expression) @name.definition.property_initializer
  (variable_declaration
    (simple_identifier) @name.definition.property_with_initializer)) @definition.property_with_initializer

; Val property (immutable)
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "val"))
  (variable_declaration
    (simple_identifier) @name.definition.val_property)) @definition.val_property

; Var property (mutable)
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "var"))
  (variable_declaration
    (simple_identifier) @name.definition.var_property)) @definition.var_property

; Lateinit property
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "lateinit"))
  (variable_declaration
    (simple_identifier) @name.definition.lateinit_property)) @definition.lateinit_property

; Const property
(property_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "const"))
  (variable_declaration
    (simple_identifier) @name.definition.const_property)) @definition.const_property

; Override property
(property_declaration
  (modifiers
    (inheritance_modifier) @_modifier (#eq? @_modifier "override"))
  (variable_declaration
    (simple_identifier) @name.definition.override_property)) @definition.override_property

; Open property
(property_declaration
  (modifiers
    (inheritance_modifier) @_modifier (#eq? @_modifier "open"))
  (variable_declaration
    (simple_identifier) @name.definition.open_property)) @definition.open_property

; Private property
(property_declaration
  (modifiers
    (visibility_modifier) @_modifier (#eq? @_modifier "private"))
  (variable_declaration
    (simple_identifier) @name.definition.private_property)) @definition.private_property

; Protected property
(property_declaration
  (modifiers
    (visibility_modifier) @_modifier (#eq? @_modifier "protected"))
  (variable_declaration
    (simple_identifier) @name.definition.protected_property)) @definition.protected_property

; Internal property
(property_declaration
  (modifiers
    (visibility_modifier) @_modifier (#eq? @_modifier "internal"))
  (variable_declaration
    (simple_identifier) @name.definition.internal_property)) @definition.internal_property

; Public property
(property_declaration
  (modifiers
    (visibility_modifier) @_modifier (#eq? @_modifier "public"))
  (variable_declaration
    (simple_identifier) @name.definition.public_property)) @definition.public_property

; Property with multiple modifiers
(property_declaration
  (modifiers) @name.definition.property_modifiers
  (variable_declaration
    (simple_identifier) @name.definition.modified_property)) @definition.property_with_modifiers

; Multi-variable property declarations
(property_declaration
  (multi_variable_declaration
    (variable_declaration
      (simple_identifier) @name.definition.multi_property)) @definition.multi_variable_property) @definition.multi_variable_property_declaration

; Variable declarations (local variables)
(variable_declaration
  (simple_identifier) @name.definition.variable) @definition.variable

; Variable with type
(variable_declaration
  (type) @name.definition.variable_type
  (simple_identifier) @name.definition.typed_variable)) @definition.typed_variable

; Variable with initializer
(variable_declaration
  (expression) @name.definition.variable_initializer
  (simple_identifier) @name.definition.variable_with_initializer)) @definition.variable_with_initializer

; Variable with type and initializer
(variable_declaration
  (type) @name.definition.variable_type
  (expression) @name.definition.variable_initializer
  (simple_identifier) @name.definition.typed_variable_with_initializer)) @definition.typed_variable_with_initializer

; Val variable (immutable local)
(variable_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "val"))
  (simple_identifier) @name.definition.val_variable)) @definition.val_variable

; Var variable (mutable local)
(variable_declaration
  (modifiers
    (property_modifier) @_modifier (#eq? @_modifier "var"))
  (simple_identifier) @name.definition.var_variable)) @definition.var_variable

; Multi-variable declarations
(multi_variable_declaration
  (variable_declaration
    (simple_identifier) @name.definition.multi_variable)) @definition.multi_variable_declaration

; Destructuring declarations
(multi_variable_declaration
  (variable_declaration
    (simple_identifier) @name.definition.destructuring_variable)) @definition.destructuring_declaration

; Getter declarations
(getter) @definition.getter

; Getter with modifiers
(getter
  (modifiers) @name.definition.getter_modifiers) @definition.getter_with_modifiers

; Getter with body
(getter
  (function_body) @name.definition.getter_body) @definition.getter_with_body

; Getter with expression
(getter
  (expression) @name.definition.getter_expression) @definition.getter_with_expression

; Getter with parameters
(getter
  (function_value_parameters) @name.definition.getter_parameters) @definition.getter_with_parameters

; Setter declarations
(setter) @definition.setter

; Setter with modifiers
(setter
  (modifiers) @name.definition.setter_modifiers) @definition.setter_with_modifiers

; Setter with body
(setter
  (function_body) @name.definition.setter_body) @definition.setter_with_body

; Setter with expression
(setter
  (expression) @name.definition.setter_expression) @definition.setter_with_expression

; Setter with parameters
(setter
  (function_value_parameter_with_optional_type
    (parameter_with_optional_type
      (simple_identifier) @name.definition.setter_parameter))) @definition.setter_with_parameter

; Property delegate
(property_delegate) @definition.property_delegate

; Property delegate with expression
(property_delegate
  (expression) @name.definition.property_delegate_expression) @definition.property_delegate_with_expression

; Class parameters
(class_parameters) @definition.class_parameters

; Function value parameters
(function_value_parameters) @definition.function_value_parameters

; Function value parameter
(function_value_parameter
  (simple_identifier) @name.definition.parameter) @definition.parameter

; Function value parameter with type
(function_value_parameter
  (type) @name.definition.parameter_type
  (simple_identifier) @name.definition.typed_parameter)) @definition.parameter_with_type

; Function value parameter with default value
(function_value_parameter
  (expression) @name.definition.parameter_default
  (simple_identifier) @name.definition.parameter_with_default)) @definition.parameter_with_default

; Function value parameter with modifiers
(function_value_parameter
  (parameter_modifiers) @name.definition.parameter_modifiers
  (simple_identifier) @name.definition.modified_parameter)) @definition.parameter_with_modifiers

; Lambda parameters
(lambda_parameter
  (simple_identifier) @name.definition.lambda_parameter) @definition.lambda_parameter

; Lambda parameter with type
(lambda_parameter
  (type) @name.definition.lambda_parameter_type
  (simple_identifier) @name.definition.typed_lambda_parameter)) @definition.lambda_parameter_with_type

; Parameters with optional type
(parameters_with_optional_type) @definition.parameters_with_optional_type

; Parameter with optional type
(parameter_with_optional_type
  (simple_identifier) @name.definition.parameter_with_optional_type)) @definition.parameter_with_optional_type

; Function value parameter with optional type
(function_value_parameter_with_optional_type
  (parameter_with_optional_type
    (simple_identifier) @name.definition.function_value_parameter_with_optional_type)) @definition.function_value_parameter_with_optional_type

; Modifiers
(modifiers) @definition.modifiers

; Property modifiers
(property_modifier) @definition.property_modifier

; Parameter modifiers
(parameter_modifiers) @definition.parameter_modifiers

; Parameter modifier
(parameter_modifier) @definition.parameter_modifier

; Visibility modifiers
(visibility_modifier) @definition.visibility_modifier

; Inheritance modifiers
(inheritance_modifier) @definition.inheritance_modifier

; Annotations
(annotation) @definition.annotation

; Annotation with arguments
(annotation
  (value_arguments) @name.definition.annotation_with_arguments) @definition.annotation_with_arguments

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Types
(type) @name.definition.type

; Expressions
(expression) @name.definition.expression

; Blocks
(block) @name.definition.block

; Function bodies
(function_body) @name.definition.function_body

; Value arguments
(value_arguments) @name.definition.value_arguments

; Value argument
(value_argument
  (expression) @name.definition.value_argument) @definition.value_argument_with_expression

; Type arguments
(type_arguments) @name.definition.type_arguments

; Type argument
(type_argument
  (type) @name.definition.type_argument) @definition.type_argument_with_type

; Declarations
(declaration) @name.definition.declaration

; Class member declarations
(class_member_declaration) @name.definition.class_member_declaration

; Statements
(statement) @name.definition.statement

; Statements
(statements) @name.definition.statements
`;