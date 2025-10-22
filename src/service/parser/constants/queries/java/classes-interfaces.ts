/*
Java Class and Interface-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Module declarations
(module_declaration
  name: (scoped_identifier) @name.definition.module) @name.definition.module

; Package declarations
(package_declaration
  (scoped_identifier) @name.definition.package) @name.definition.package

; Class declarations
(class_declaration
  name: (identifier) @name.definition.class) @name.definition.class

; Interface declarations
(interface_declaration
  name: (identifier) @name.definition.interface) @name.definition.interface

; Enum declarations
(enum_declaration
  name: (identifier) @name.definition.enum) @name.definition.enum

; Record declarations
(record_declaration
  name: (identifier) @name.definition.record) @name.definition.record

; Annotation type declarations
(annotation_type_declaration
  name: (identifier) @name.definition.annotation) @name.definition.annotation

; Field declarations
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @name.definition.field)) @name.definition.field

; Enum constants
(enum_constant
  name: (identifier) @name.definition.enum_constant) @name.definition.enum_constant

; Class bodies
(class_body) @name.definition.class_body

; Interface bodies
(interface_body) @name.definition.interface_body

; Enum bodies
(enum_body) @name.definition.enum_body

; Record bodies - use class_body instead
(record_declaration
  (class_body) @name.definition.record_body) @name.definition.record_with_body

; Annotation type bodies
(annotation_type_body) @name.definition.annotation_body

; Modifiers
(modifiers) @name.definition.modifiers

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Scoped identifiers
(scoped_identifier) @name.definition.scoped_identifier

; Generic types
(generic_type
  (type_identifier) @name.definition.generic_type) @name.definition.generic_type

; Type parameters
(type_parameters
  (type_parameter) @name.definition.type_parameter) @name.definition.type_parameter

; Type arguments
(type_arguments
  (type_identifier) @name.definition.type_argument) @name.definition.type_argument

; Superclass
(superclass
  (type_identifier) @name.definition.superclass) @name.definition.superclass

; Super interfaces
(super_interfaces
  (type_list
    (type_identifier) @name.definition.super_interface)) @name.definition.super_interfaces
`;