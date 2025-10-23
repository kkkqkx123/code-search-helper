/*
Kotlin Constructor and Property-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Primary constructor declarations
(primary_constructor) @definition.primary_constructor

; Constructor parameters (properties in primary constructor)
(class_parameter
  (simple_identifier) @name.definition.property) @definition.constructor_property

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

; Secondary constructor declarations
(secondary_constructor) @definition.secondary_constructor

; Constructor delegation calls
(constructor_delegation_call) @definition.constructor_delegation_call

; Constructor invocations
(constructor_invocation) @definition.constructor_invocation

; Property declarations
(property_declaration
  (variable_declaration
    (simple_identifier) @name.definition.property)) @definition.property

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

; Variable declarations (local variables)
(variable_declaration
  (simple_identifier) @name.definition.variable) @definition.variable

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

; Getter declarations
(getter) @definition.getter

; Setter declarations
(setter) @definition.setter

; Property delegate
(property_delegate) @definition.property_delegate

; Class parameters
(class_parameters) @definition.class_parameters

; Function value parameters
(function_value_parameters) @definition.function_value_parameters

; Function value parameter
(function_value_parameter
  (simple_identifier) @name.definition.parameter) @definition.parameter

; Lambda parameters
(lambda_parameter
  (simple_identifier) @name.definition.lambda_parameter) @definition.lambda_parameter

; Modifiers
(modifiers) @definition.modifiers

; Property modifiers
(property_modifier) @definition.property_modifier

; Parameter modifiers
(parameter_modifiers) @definition.parameter_modifiers

; Visibility modifiers
(visibility_modifier) @definition.visibility_modifier

; Inheritance modifiers
(inheritance_modifier) @definition.inheritance_modifier

; Annotations
(annotation) @definition.annotation

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier

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

; Type arguments
(type_arguments) @name.definition.type_arguments

; Declarations
(declaration) @name.definition.declaration

; Class member declarations
(class_member_declaration) @name.definition.class_member_declaration

; Statements
(statement) @name.definition.statement

; Statements
(statements) @name.definition.statements
`;