/*
C# Class and Struct-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Namespace declarations (including file-scoped) - primary code organization
; Support both simple names (TestNamespace) and qualified names (My.Company.Module)
(namespace_declaration
  name: (qualified_name) @name.definition.namespace) @definition.namespace
(namespace_declaration
  name: (identifier) @name.definition.namespace) @definition.namespace
(file_scoped_namespace_declaration
  name: (qualified_name) @name.definition.namespace) @definition.namespace
(file_scoped_namespace_declaration
  name: (identifier) @name.definition.namespace) @definition.namespace

; Class declarations (including generic, static, abstract, partial, nested) - primary OOP structure
(class_declaration
  name: (identifier) @name.definition.class) @definition.class

; Record class declarations - important for immutable types
(record_class_declaration
  name: (identifier) @name.definition.record_class) @definition.record_class

; Record struct declarations - important for immutable value types
(record_struct_declaration
  name: (identifier) @name.definition.record_struct) @definition.record_struct

; Struct declarations - important for value types
(struct_declaration
  name: (identifier) @name.definition.struct) @definition.struct

; Interface declarations - important for contracts
(interface_declaration
  name: (identifier) @name.definition.interface) @definition.interface

; Enum declarations - important for enumerated types
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Record declarations - important for record types
(record_declaration
  name: (identifier) @name.definition.record) @definition.record

; Constructor declarations - important for object initialization
(constructor_declaration
  name: (identifier) @name.definition.constructor) @definition.constructor

; Destructor declarations - important for resource cleanup
(destructor_declaration
  name: (identifier) @name.definition.destructor) @definition.destructor

; Field declarations - important for class data
(field_declaration
  (variable_declarator
    name: (identifier) @name.definition.field)) @definition.field

; Event field declarations - important for event handling
(event_field_declaration
  (variable_declaration
    (variable_declarator
      name: (identifier) @name.definition.event_field))) @definition.event_field

; Attribute declarations - important for metadata
(attribute
  name: (identifier) @name.definition.attribute) @definition.attribute
(attribute_list) @definition.attribute_list

; Generic type parameters - important for generic programming
(type_parameter
  name: (identifier) @name.definition.type_parameter) @definition.type_parameter
`;