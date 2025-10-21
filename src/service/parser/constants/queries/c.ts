/*
C Language Constructs Supported by Tree-Sitter Parser:

1. Class-like Constructs:
- struct definitions (with fields)
- union definitions (with variants)
- enum definitions (with values)
- anonymous unions/structs
- aligned structs

2. Function-related Constructs:
- function definitions (with parameters)
- function declarations (prototypes)
- static functions
- function pointers

3. Type Definitions:
- typedef declarations (all types)
- function pointer typedefs
- struct/union typedefs

4. Variable Declarations:
- global variables
- static variables
- array declarations
- pointer declarations

5. Preprocessor Constructs:
- function-like macros
- object-like macros
- conditional compilation
*/

export default `
; Function definitions and declarations
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function))

(declaration
  type: (_)?
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function
    parameters: (parameter_list)?)?) @definition.function

(function_declarator
  declarator: (identifier) @name.definition.function
  parameters: (parameter_list)?) @definition.function

; Struct definitions
(struct_specifier
  name: (type_identifier) @name.definition.struct) @definition.struct

; Union definitions
(union_specifier
  name: (type_identifier) @name.definition.union) @definition.union

; Enum definitions
(enum_specifier
  name: (type_identifier) @name.definition.enum) @definition.enum

; Typedef declarations
(type_definition
  declarator: (type_identifier) @name.definition.type) @definition.type

; Global variables
(declaration
  (storage_class_specifier)?
  type: (_)
  declarator: (identifier) @name.definition.variable) @definition.variable

(declaration
  (storage_class_specifier)?
  type: (_)
  declarator: (init_declarator
    declarator: (identifier) @name.definition.variable)) @definition.variable

; Object-like macros
(preproc_def
  name: (identifier) @name.definition.macro) @definition.macro

; Function-like macros
(preproc_function_def
  name: (identifier) @name.definition.macro) @definition.macro

; Parameters in function declarations
(parameter_declaration
  declarator: (identifier) @name.definition.parameter) @definition.parameter

; Array declarations
(declaration
  type: (_)
  declarator: (array_declarator
    declarator: (identifier) @name.definition.array)) @definition.array

; Pointer declarations
(declaration
  type: (_)
  declarator: (pointer_declarator
    declarator: (identifier) @name.definition.pointer)) @definition.pointer

; Field declarations in structs/unions
(field_declaration
  declarator: (field_identifier) @name.definition.field) @definition.field

; Preprocessor includes
(preproc_include
  path: (system_lib_string) @name.definition.include) @definition.include
(preproc_include
  path: (string_literal) @name.definition.include) @definition.include

; Preprocessor conditionals
(preproc_if
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition
(preproc_ifdef
  name: (identifier) @name.definition.preproc_ifdef) @definition.preproc_ifdef
(preproc_elif
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition
(preproc_else) @definition.preproc_else

; Assignment expressions
(assignment_expression
  left: (identifier) @name.definition.assignment) @definition.assignment

; Call expressions
(call_expression
  function: (identifier) @name.definition.call) @definition.call

; Member access
(field_expression
  field: (field_identifier) @name.definition.member) @definition.member

; Subscript access
(subscript_expression
  (identifier) @name.definition.subscript) @definition.subscript

; Binary expressions
(binary_expression) @definition.binary_expression

; Unary expressions
(unary_expression) @definition.unary_expression

; Update expressions
(update_expression) @definition.update_expression

; Cast expressions
(cast_expression) @definition.cast_expression

; Sizeof expressions
(sizeof_expression) @definition.sizeof_expression

; Type qualifiers
(type_qualifier) @definition.type_qualifier

; Storage class specifiers
(storage_class_specifier) @definition.storage_class

; Primitive types
(primitive_type) @definition.primitive_type

; Comments
(comment) @definition.comment

; Literals
(number_literal) @definition.number_literal
(string_literal) @definition.string_literal
(char_literal) @definition.char_literal
(true) @definition.boolean_literal
(false) @definition.boolean_literal
(null) @definition.null_literal

; Control statements
(if_statement) @definition.control_statement
(for_statement) @definition.control_statement
(while_statement) @definition.control_statement
(do_statement) @definition.control_statement
(switch_statement) @definition.control_statement
(case_statement) @definition.control_statement
(break_statement) @definition.control_statement
(continue_statement) @definition.control_statement
(return_statement) @definition.control_statement
(goto_statement) @definition.control_statement

; Labeled statements
(labeled_statement
  label: (statement_identifier) @name.definition.label) @definition.label

; Compound statements
(compound_statement) @definition.compound_statement

; Parenthesized expressions
(parenthesized_expression) @definition.parenthesized_expression

; Comma expressions
(comma_expression) @definition.comma_expression

; Conditional expressions
(conditional_expression) @definition.conditional_expression

; Generic expressions (C11)
(generic_expression) @definition.generic_expression

; Alignas and alignof (C1)
(alignas_qualifier) @definition.alignas_qualifier
(alignof_expression) @definition.alignof_expression

; Extension expressions (GCC)
(extension_expression) @definition.extension_expression
`
