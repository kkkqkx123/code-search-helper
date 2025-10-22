/*
C++ Class and Struct-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Struct declarations - primary code structure
(struct_specifier
  name: (type_identifier) @name.definition.class) @definition.class

; Union declarations - important for variant types
(union_specifier
  name: (type_identifier) @name.definition.class) @definition.class

; Class declarations - primary OOP structure
(class_specifier
  name: (type_identifier) @name.definition.class) @definition.class

; Template class declarations - important for generic programming
(template_declaration
  parameters: (template_parameter_list)
  (class_specifier
    name: (type_identifier) @name.definition.template.class)) @definition.template

; Template struct declarations - important for generic programming
(template_declaration
  parameters: (template_parameter_list)
  (struct_specifier
    name: (type_identifier) @name.definition.template.struct)) @definition.template

; Access specifiers - important for class encapsulation
(access_specifier) @definition.access_specifier

; Constructor declarations - important for object initialization
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name.definition.constructor)) @definition.constructor

; Destructor declarations - important for resource cleanup
(function_definition
  declarator: (function_declarator
    declarator: (destructor_name) @name.definition.destructor)) @definition.destructor

; Constructor initializer lists - important for member initialization
(constructor_initializer) @definition.constructor_initializer

; Base classes in inheritance - important for OOP relationships
(base_class_clause
  (type_identifier) @name.definition.base_class) @definition.base_class

; Member initializer lists - important for member initialization
(member_initializer
  (field_identifier) @name.definition.member_initializer) @definition.member_initializer

; Friend declarations - important for class relationships
(friend_declaration) @definition.friend
`;