/*
Supported C++ structures:
- struct/class/union declarations
- function/method declarations
- typedef declarations
- enum declarations
- namespace definitions
- template declarations
- macro definitions
- variable declarations
- constructors/destructors
- operator overloads
- friend declarations
- using declarations
*/
export default `
; Basic declarations
(struct_specifier
  name: (type_identifier) @name.definition.class) @definition.class

(union_specifier
  name: (type_identifier) @name.definition.class) @definition.class

; Function declarations (prototypes)
(declaration
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function)) @definition.function

; Function definitions (with body)
(function_definition
  type: (_)
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function)) @definition.function

(function_definition
  declarator: (function_declarator
    declarator: (field_identifier) @name.definition.method)) @definition.method

(type_definition
  type: (_)
  declarator: (type_identifier) @name.definition.type) @definition.type

(class_specifier
  name: (type_identifier) @name.definition.class) @definition.class

; Enum declarations
(enum_specifier
  name: (type_identifier) @name.definition.enum) @definition.enum

; Namespace definitions
(namespace_definition
  name: (namespace_identifier) @name.definition.namespace) @definition.namespace

(namespace_definition
  body: (declaration_list
    (namespace_definition
      name: (namespace_identifier) @name.definition.namespace))) @definition.namespace

; Template declarations
(template_declaration
  parameters: (template_parameter_list)
  (class_specifier
    name: (type_identifier) @name.definition.template.class)) @definition.template

; Macro definitions
(preproc_function_def
  name: (identifier) @name.definition.macro) @definition.macro

; Variable declarations with initialization
(declaration
  type: (_)
  declarator: (init_declarator
    declarator: (identifier) @name.definition.variable)) @definition.variable

; Constructor declarations
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name.definition.constructor)) @definition.constructor

; Destructor declarations
(function_definition
  declarator: (function_declarator
    declarator: (destructor_name) @name.definition.destructor)) @definition.destructor

; Operator overloads
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @name.definition.operator)) @definition.operator

; Friend declarations
(friend_declaration) @definition.friend

; Using declarations
(using_declaration) @definition.using

; Template function declarations
(template_declaration
  parameters: (template_parameter_list)
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @name.definition.template.function))) @definition.template

; Template struct/class declarations
(template_declaration
  parameters: (template_parameter_list)
  (struct_specifier
    name: (type_identifier) @name.definition.template.struct)) @definition.template

; Template enum declarations
(template_declaration
  parameters: (template_parameter_list)
  (enum_specifier
    name: (type_identifier) @name.definition.template.enum)) @definition.template

; Lambda expressions
(lambda_expression) @definition.lambda

; Access specifiers
(access_specifier) @definition.access_specifier

; Constructor initializer lists
(constructor_initializer) @definition.constructor_initializer

; Base classes in inheritance
(base_class_clause
  (type_identifier) @name.definition.base_class) @definition.base_class

; Member initializer lists
(member_initializer
  (field_identifier) @name.definition.member_initializer) @definition.member_initializer

; Try-catch blocks
(try_statement) @definition.try_statement
(catch_clause) @definition.catch_clause

; Exception specifications
(throw_specifier) @definition.throw_specifier
(noexcept_specifier) @definition.noexcept_specifier

; Explicit specializations
(explicit_specialization) @definition.explicit_specialization

; Template instantiations
(template_function
  (identifier) @name.definition.template.instantiation)) @definition.template
(template_type
  (type_identifier) @name.definition.template.instantiation)) @definition.template

; Operator declarations (new, delete, etc.)
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @name.definition.operator.new)) @definition.operator.new
(function_definition
  declarator: (function_declarator
    declarator: (operator_name) @name.definition.operator.delete)) @definition.operator.delete

; Static_assert declarations
(static_assert_declaration) @definition.static_assert

; Attribute declarations
(attribute_declaration) @definition.attribute_declaration
(attribute_specifier) @definition.attribute_specifier

; Concept definitions (C++20)
(concept_definition
  name: (identifier) @name.definition.concept) @definition.concept

; Requires clauses (C++20)
(requires_clause) @definition.requires_clause

; Co-routine expressions (C++20)
(co_await_expression) @definition.co_await_expression
(co_yield_expression) @definition.co_yield_expression
(co_return_statement) @definition.co_return_statement

; Range-based for loops
(range_based_for_statement) @definition.range_for

; Type aliases using 'using'
(type_alias_declaration
  name: (identifier) @name.definition.type_alias) @definition.type_alias

; Constexpr and consteval functions
(function_definition
  (storage_class_specifier) @name.definition.const_function
  declarator: (function_declarator
    declarator: (identifier) @name.definition.function)) @definition.function

; Explicit constructors and conversion operators
(function_definition
  (explicit_specifier) @name.definition.explicit_function
  declarator: (function_declarator
    declarator: (identifier) @name.definition.constructor)) @definition.constructor

; Virtual functions
(function_definition
  (virtual_specifier) @name.definition.virtual_function
  declarator: (function_declarator
    declarator: (identifier) @name.definition.method)) @definition.method

; Override and final specifiers
(virtual_specifier) @definition.virtual_specifier

; Parameter pack expansions
(parameter_pack_expansion) @definition.parameter_pack

; Fold expressions (C++17)
(fold_expression) @definition.fold_expression

; Structured bindings (C++17)
(declaration
  (structured_binding_declarator
    (identifier) @name.definition.binding))) @definition.binding

; Auto type deduction
(declaration
  type: (auto)
  declarator: (init_declarator
    declarator: (identifier) @name.definition.auto_var)) @definition.auto_var

; Range expressions (C++20)
(range_expression) @definition.range_expression

; New and delete expressions
(new_expression) @definition.new_expression
(delete_expression) @definition.delete_expression

; Alignment specifiers
(alignas_specifier) @definition.alignas_specifier

; User-defined literals
(literal_suffix) @definition.literal_suffix

; Assignment expressions
(assignment_expression
  left: (identifier) @name.definition.assignment) @definition.assignment

; Call expressions
(call_expression
  function: (identifier) @name.definition.call) @definition.call

; Member access
(field_expression
  field: (field_identifier) @name.definition.member) @definition.member

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

; Typeid expressions
(typeid_expression) @definition.typeid_expression

; Comments
(comment) @definition.comment

; Literals
(number_literal) @definition.number_literal
(string_literal) @definition.string_literal
(char_literal) @definition.char_literal
(true) @definition.boolean_literal
(false) @definition.boolean_literal

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

; Conditional expressions
(conditional_expression) @definition.conditional_expression
`
