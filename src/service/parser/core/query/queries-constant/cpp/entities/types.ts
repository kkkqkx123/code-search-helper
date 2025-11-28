/*
C++ Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Type definitions - important for custom types
(type_definition
  type: (_)
  declarator: (type_identifier) @name.definition.type) @definition.type

; Type aliases using 'using' - important for type aliases
(type_alias_declaration
  name: (identifier) @name.definition.type_alias) @definition.type_alias

; Enum declarations - important for enumerated types
(enum_specifier
  name: (type_identifier) @name.definition.enum) @definition.enum

; Template enum declarations - important for generic enums
(template_declaration
  parameters: (template_parameter_list)
  (enum_specifier
    name: (type_identifier) @name.definition.template.enum)) @definition.template

; Concept definitions (C++20) - important for template constraints
(concept_definition
  name: (identifier) @name.definition.concept) @definition.concept

; Template instantiations - important for template usage
(template_function
  (identifier) @name.definition.template.instantiation) @definition.template
(template_type
  (type_identifier) @name.definition.template.instantiation) @definition.template

; Auto type deduction - important for type inference
(declaration
  type: (auto)
  declarator: (init_declarator
    declarator: (identifier) @name.definition.auto_var)) @definition.auto_var

; Type qualifiers - important for type modifiers
(type_qualifier) @definition.type_qualifier

; Primitive types - important for basic types
(primitive_type) @definition.primitive_type
`;