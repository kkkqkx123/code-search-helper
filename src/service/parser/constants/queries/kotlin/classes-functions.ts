/*
Kotlin Class and Function-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Type alias declarations
(type_alias
  (simple_identifier) @name.definition.type_alias) @definition.type_alias

; Regular class declarations
(class_declaration
  (simple_identifier) @name.definition.class) @definition.class

; Data class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "data"))
  (simple_identifier) @name.definition.data_class) @definition.data_class

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

; Enum class declarations
(class_declaration
  (simple_identifier) @name.definition.enum_class
  (enum_class_body)) @definition.enum_class

; Interface declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "interface"))
  (simple_identifier) @name.definition.interface) @definition.interface

; Annotation class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "annotation"))
  (simple_identifier) @name.definition.annotation_class) @definition.annotation_class

; Regular function declarations
(function_declaration
  (simple_identifier) @name.definition.function) @definition.function

; Suspend function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "suspend"))
  (simple_identifier) @name.definition.suspend_function) @definition.suspend_function

; Extension function declarations
(function_declaration
  (type) @name.definition.function_receiver_type
  (simple_identifier) @name.definition.extension_function) @definition.extension_function

; Object declarations
(object_declaration
  (simple_identifier) @name.definition.object) @definition.object

; Companion object declarations
(companion_object) @definition.companion_object

; Primary constructors
(primary_constructor) @definition.primary_constructor

; Secondary constructors
(secondary_constructor) @definition.secondary_constructor

; Class bodies
(class_body) @definition.class_body

; Enum class bodies
(enum_class_body) @definition.enum_class_body

; Function bodies
(function_body) @definition.function_body

; Type parameters
(type_parameters) @name.definition.type_parameters) @definition.type_parameters

; Type constraints
(type_constraints) @name.definition.type_constraints) @definition.type_constraints

; Delegation specifiers
(delegation_specifiers) @name.definition.delegation_specifiers) @definition.delegation_specifiers

; Modifiers
(modifiers) @name.definition.modifiers) @definition.modifiers

; Annotations
(annotation) @name.definition.annotation) @definition.annotation

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier) @definition.simple_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier) @name.definition.type_identifier

; User types
(user_type) @name.definition.user_type) @name.definition.user_type

; Types
(type) @name.definition.type) @name.definition.type

; Function types
(function_type) @name.definition.function_type) @name.definition.function_type

; Declarations
(declaration) @name.definition.declaration) @name.definition.declaration

; Class member declarations
(class_member_declaration) @name.definition.class_member_declaration) @name.definition.class_member_declaration

; Top level objects
(top_level_object) @name.definition.top_level_object) @name.definition.top_level_object

; Kotlin files
(kotlinFile) @name.definition.kotlin_file) @name.definition.kotlin_file

; Source files
(source_file) @name.definition.source_file) @name.definition.source_file

; Scripts
(script) @name.definition.script) @name.definition.script

; Statements
(statements) @name.definition.statements) @name.definition.statements

; Statement
(statement) @name.definition.statement) @name.definition.statement

; Expressions
(expression) @name.definition.expression) @name.definition.expression

; Blocks
(block) @name.definition.block) @name.definition.block

; Package headers
(package_header) @name.definition.package_header) @name.definition.package_header

; Import headers
(import_header) @name.definition.import_header) @name.definition.import_header

; Import lists
(import_list) @name.definition.import_list) @name.definition.import_list

; File annotations
(file_annotation) @name.definition.file_annotation) @name.definition.file_annotation

; Shebang lines
(shebang_line) @name.definition.shebang_line) @name.definition.shebang_line
`;