/*
Java Class and Interface-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Module declarations
(module_declaration
  name: (scoped_identifier) @name.definition.module) @definition.module

; Package declarations
((package_declaration
  (scoped_identifier)) @name.definition.package) @definition.package

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
`;