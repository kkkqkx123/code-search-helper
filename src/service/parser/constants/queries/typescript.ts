/*
TypeScript Tree-Sitter Query Patterns
Comprehensive coverage of TypeScript syntax structures including type system features
*/
export default `
(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(module
  name: (identifier) @name.definition.module) @definition.module

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(call_expression
  function: (identifier) @func_name
  arguments: (arguments
    (string) @name
    [(arrow_function) (function_expression)]) @definition.test)
  (#match? @func_name "^(describe|test|it)$")

(assignment_expression
  left: (member_expression
    object: (identifier) @obj
    property: (property_identifier) @prop)
  right: [(arrow_function) (function_expression)]) @definition.test
  (#eq? @obj "exports")
  (#eq? @prop "test")

(arrow_function) @definition.lambda

; Switch statements and case clauses
(switch_statement) @definition.switch

; Individual case clauses with their blocks
(switch_case) @definition.case

; Default clause
(switch_default) @definition.default

; Enum declarations
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Decorator definitions with decorated class
(export_statement
  decorator: (decorator
    (call_expression
      function: (identifier) @name.definition.decorator))
  declaration: (class_declaration
    name: (type_identifier) @name.definition.decorated_class)) @definition.decorated_class

; Explicitly capture class name in decorated class
(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Namespace declarations
(internal_module
  name: (identifier) @name.definition.namespace) @definition.namespace

; Interface declarations with generic type parameters and constraints
(interface_declaration
  name: (type_identifier) @name.definition.interface
  type_parameters: (type_parameters)?) @definition.interface

; Type alias declarations with generic type parameters and constraints
(type_alias_declaration
  name: (type_identifier) @name.definition.type
  type_parameters: (type_parameters)?) @definition.type

; Utility Types
(type_alias_declaration
  name: (type_identifier) @name.definition.utility_type) @definition.utility_type

; Class Members and Properties
(public_field_definition
  name: (property_identifier) @name.definition.property) @definition.property

; Constructor
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Getter/Setter Methods
(method_definition
  name: (property_identifier) @name.definition.accessor) @definition.accessor

; Async Functions
(function_declaration
  name: (identifier) @name.definition.async_function) @definition.async_function

; Async Arrow Functions
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.async_arrow
    value: (arrow_function))) @definition.async_arrow

; Type annotations
(type_annotation) @name.definition.type_annotation

; Type assertions (as expressions)
(as_expression) @name.definition.type_assertion

; Satisfies expressions (TypeScript 4.9+)
(satisfies_expression) @name.definition.satisfies

; Generic types
(generic_type) @name.definition.generic_type

; Type parameters
(type_parameters) @name.definition.type_parameters
(type_arguments) @name.definition.type_arguments

; Type queries (typeof, keyof)
(type_query) @name.definition.type_query
(index_type_query) @name.definition.index_type_query

; Mapped types
(mapped_type_clause) @name.definition.mapped_type

; Conditional types
(conditional_type) @name.definition.conditional_type

; Template literal types
(template_literal_type) @name.definition.template_literal_type

; Intersection types
(intersection_type) @name.definition.intersection_type

; Union types
(union_type) @name.definition.union_type

; Index signatures
(index_signature) @name.definition.index_signature

; Function types
(function_type) @name.definition.function_type

; Constructor types
(constructor_type) @name.definition.constructor_type

; Import types
(import_type) @name.definition.import_type

; Type predicates (type guards)
(type_predicate) @name.definition.type_predicate

; Assertion functions
(asserts) @name.definition.asserts

; Non-null assertions
(non_null_expression) @name.definition.non_null

; Optional chaining
(optional_chain) @name.definition.optional_chain

; Parameter properties
(parameter_property) @name.definition.parameter_property

; Readonly modifiers
(readonly: (readonly)) @name.definition.readonly

; Access modifiers (public, private, protected)
(accessibility_modifier) @name.definition.access_modifier

; Ambient declarations (declare keyword)
(declare: (declare)) @name.definition.ambient

; Export modifiers
(export: (export)) @name.definition.export_modifier

; Default exports
(default: (default)) @name.definition.default_export

; Import assertions
(import_attribute) @name.definition.import_assertion

; Namespace imports and exports
(namespace_import) @name.definition.namespace_import
(namespace_export) @name.definition.namespace_export

; Type-only imports and exports
(import_clause
  (type: (type))) @name.definition.type_only_import

(export_statement
  (type: (type))) @name.definition.type_only_export

; Literal types
(literal_type) @name.definition.literal_type

; Parenthesized types
(parenthesized_type) @name.definition.parenthesized_type

; Array types
(array_type) @name.definition.array_type

; Tuple types
(tuple_type) @name.definition.tuple_type

; Rest types
(rest_type) @name.definition.rest_type

; Optional types
(optional_type) @name.definition.optional_type

; This types
(this_type) @name.definition.this_type

; Infer types
(infer_type) @name.definition.infer_type

; Key remapping in mapped types (as clauses)
(mapped_type_clause
  (as: (as))) @name.definition.key_remapping

; Module declarations
(ambient_module_declaration) @name.definition.ambient_module

; Global declarations
(global_declaration) @name.definition.global

; External module references
(external_module_reference) @name.definition.external_module

; JSDoc comments for documentation
(comment
  (#match? @name.definition.jsdoc "^/\\*\\*")) @name.definition.jsdoc

; TypeScript-specific test patterns
(function_declaration
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^(test|it|describe|before|after|beforeEach|afterEach).*$"))

; React component patterns with TypeScript
(function_declaration
  name: (identifier) @name.definition.component
  (#match? @name.definition.component "^[A-Z][a-zA-Z]*$"))

; Hook functions with TypeScript
(function_declaration
  name: (identifier) @name.definition.hook
  (#match? @name.definition.hook "^use[A-Z].*$"))

; Generic function declarations
(function_declaration
  type_parameters: (type_parameters)) @name.definition.generic_function

; Generic class declarations
(class_declaration
  type_parameters: (type_parameters)) @name.definition.generic_class

; Generic interface declarations
(interface_declaration
  type_parameters: (type_parameters)) @name.definition.generic_interface

; Generic type aliases
(type_alias_declaration
  type_parameters: (type_parameters)) @name.definition.generic_type_alias

; Const assertions
(as_expression
  right: (const: (const))) @name.definition.const_assertion

; Readonly array types
(array_type
  (readonly: (readonly))) @name.definition.readonly_array

; Readonly tuple types
(tuple_type
  (readonly: (readonly))) @name.definition.readonly_tuple

; Type parameter constraints
(type_parameter
  constraint: (constraint)) @name.definition.type_constraint

; Default type parameters
(type_parameter
  default: (default)) @name.definition.default_type_parameter

; Variadic tuple types
(tuple_type
  (rest_type)) @name.definition.variadic_tuple

; Template type patterns
(template_literal_type
  (template_substitution)) @name.definition.template_substitution

; Enum member declarations
(enum_member) @name.definition.enum_member

; Namespace body declarations
(namespace_body) @name.definition.namespace_body

; Module block declarations
(module_block) @name.definition.module_block

; Import equals declarations
(import_alias_declaration) @name.definition.import_alias

; Export equals declarations
(export_assignment) @name.definition.export_assignment

; Type-only import specifiers
(import_specifier
  (type: (type))) @name.definition.type_only_import_specifier

; Type-only export specifiers
(export_specifier
  (type: (type))) @name.definition.type_only_export_specifier

; Import type declarations
(import_type) @name.definition.import_type_declaration

; Assertion signature patterns
(call_signature
  (asserts: (asserts))) @name.definition.assertion_signature

; Decorator factory patterns
(decorator
  (call_expression)) @name.definition.decorator_factory

; Parameter property patterns
(parameter_property
  (accessibility_modifier)) @name.definition.parameter_property_with_modifier

; Abstract method patterns in classes
(class_declaration
  body: (class_body
    (abstract_method_signature))) @name.definition.abstract_method

; Override method patterns
(method_definition
  (override: (override))) @name.definition.override_method

; Static initialization blocks
(class_static_block) @name.definition.static_block

; Private identifier patterns
(private_property_identifier) @name.definition.private_identifier

; Public API exports with TypeScript types
(export_statement
  declaration: (function_declaration
    name: (identifier) @name.definition.public_api
    type_parameters: (type_parameters)?)) @definition.public_api

(export_statement
  declaration: (class_declaration
    name: (identifier) @name.definition.public_api
    type_parameters: (type_parameters)?)) @definition.public_api

(export_statement
  declaration: (interface_declaration
    name: (identifier) @name.definition.public_api
    type_parameters: (type_parameters)?)) @definition.public_api

(export_statement
  declaration: (type_alias_declaration
    name: (identifier) @name.definition.public_api
    type_parameters: (type_parameters)?)) @definition.public_api
`