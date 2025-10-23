/*
Kotlin Control Flow and Pattern-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; When expressions
(when_expression) @name.definition.when_expression

; When entry
(when_entry) @name.definition.when_entry

; When condition
(when_entry
  (expression) @name.definition.when_condition) @name.definition.when_with_condition

; Try expressions
(try_expression) @name.definition.try_expression

; Try block
(try_expression
  (block) @name.definition.try_block) @name.definition.try_with_block

; Catch blocks
(catch_block) @name.definition.catch_block

; Catch parameter
(catch_block
  (simple_identifier) @name.definition.exception_variable) @name.definition.catch_parameter

; Finally block
(finally_block) @name.definition.finally_block

; For statements
(for_statement) @name.definition.for_statement

; For variable declarations
(for_statement
  (variable_declaration
    (simple_identifier) @name.definition.for_variable)) @name.definition.for_with_variable

; For iterable
(for_statement
  (expression) @name.definition.for_iterable) @name.definition.for_with_iterable

; While statements
(while_statement) @name.definition.while_statement

; Do while statements
(do_while_statement) @name.definition.do_while_statement

; If expressions
(if_expression) @name.definition.if_expression

; If conditions
(if_expression
  (expression) @name.definition.if_condition) @name.definition.if_with_condition

; Jump expressions (return, break, continue)
(jump_expression) @name.definition.jump_expression

; Return expressions
(return_expression) @name.definition.return_expression

; Break expressions
(break_expression) @name.definition.break_expression

; Continue expressions
(continue_expression) @name.definition.continue_expression

; Throw expressions
(throw_expression) @name.definition.throw_expression

; Labeled expressions
(labeled_expression) @name.definition.labeled_expression

; Block expressions
(block) @name.definition.block

; Lambda literals
(lambda_literal) @name.definition.lambda_literal

; Lambda parameters
(lambda_literal
  (lambda_parameters
    (variable_declaration
      (simple_identifier) @name.definition.lambda_parameter))) @name.definition.lambda_with_parameters

; Lambda body
(lambda_literal
  (_) @name.definition.lambda_body) @name.definition.lambda_with_body

; Safe call expressions
(safe_call_expression) @name.definition.safe_call_expression

; Elvis expressions
(elvis_expression) @name.definition.elvis_expression

; Call expressions
(call_expression) @name.definition.call_expression

; Call suffix
(call_suffix) @name.definition.call_suffix

; Value arguments
(value_arguments) @name.definition.value_arguments

; Value argument
(value_argument
  (expression) @name.definition.value_argument) @name.definition.value_argument_with_expression

; Type arguments
(type_arguments) @name.definition.type_arguments

; Type argument
(type_argument
  (type) @name.definition.type_argument) @name.definition.type_argument_with_type

; Indexing suffix
(indexing_suffix) @name.definition.indexing_suffix

; Navigation suffix
(navigation_suffix) @name.definition.navigation_suffix

; Postfix unary expressions
(postfix_unary_expression) @name.definition.postfix_unary_expression

; Prefix unary expressions
(prefix_unary_expression) @name.definition.prefix_unary_expression

; As expressions
(as_expression) @name.definition.as_expression

; Is expressions
(is_expression) @name.definition.is_expression

; Binary expressions
(binary_expression) @name.definition.binary_expression

; Range expressions
(range_expression) @name.definition.range_expression

; Collection literals
(collection_literal) @name.definition.collection_literal

; Parenthesized expressions
(parenthesized_expression) @name.definition.parenthesized_expression

; String literals
(string_literal) @name.definition.string_literal

; Line string literals
(line_string_literal) @name.definition.line_string_literal

; Multi line string literals
(multi_line_string_literal) @name.definition.multi_line_string_literal

; Character literals
(character_literal) @name.definition.character_literal

; Literal constants
(literal_constant) @name.definition.literal_constant

; Boolean literals
(true) @name.definition.true_literal
(false) @name.definition.false_literal

; Null literals
(null_literal) @name.definition.null_literal

; This expressions
(this_expression) @name.definition.this_expression

; Super expressions
(super_expression) @name.definition.super_expression

; Callable references
(callable_reference) @name.definition.callable_reference

; Object literals
(object_literal) @name.definition.object_literal

; Function types
(function_type) @name.definition.function_type

; Parenthesized types
(parenthesized_type) @name.definition.parenthesized_type

; Nullable types
(nullable_type) @name.definition.nullable_type

; User types
(user_type) @name.definition.user_type

; Simple user types
(simple_user_type) @name.definition.simple_user_type

; Type projections
(type_projection) @name.definition.type_projection

; Type parameters
(type_parameters) @name.definition.type_parameters

; Type parameter
(type_parameter
  (simple_identifier) @name.definition.type_parameter) @name.definition.type_parameter_with_identifier

; Type constraints
(type_constraints) @name.definition.type_constraints

; Type constraint
(type_constraint
  (simple_identifier) @name.definition.type_constraint) @name.definition.type_constraint_with_identifier

; Annotations
(annotation) @name.definition.annotation

; Annotation use site targets
(annotation_use_site_target) @name.definition.annotation_use_site_target

; Modifiers
(modifiers) @name.definition.modifiers

; Class modifier
(class_modifier) @name.definition.class_modifier

; Function modifier
(function_modifier) @name.definition.function_modifier

; Property modifier
(property_modifier) @name.definition.property_modifier

; Inheritance modifier
(inheritance_modifier) @name.definition.inheritance_modifier

; Parameter modifier
(parameter_modifier) @name.definition.parameter_modifier

; Type modifier
(type_modifier) @name.definition.type_modifier

; Visibility modifier
(visibility_modifier) @name.definition.visibility_modifier

; Simple identifiers
(simple_identifier) @name.definition.simple_identifier

; Type identifiers
(type_identifier) @name.definition.type_identifier

; Comments
(line_comment) @name.definition.line_comment
(block_comment) @name.definition.block_comment

; Shebang line
(shebang_line) @name.definition.shebang_line

; File annotations
(file_annotation) @name.definition.file_annotation

; Package header
(package_header) @name.definition.package_header

; Import header
(import_header) @name.definition.import_header

; Import lists
(import_list) @name.definition.import_list

; Import alias
(import_alias) @name.definition.import_alias

; Source file
(source_file) @name.definition.source_file

; Script
(script) @name.definition.script

; Statements
(statements) @name.definition.statements

; Statement
(statement) @name.definition.statement

; Expression
(expression) @name.definition.expression

; Assignment
(assignment) @name.definition.assignment

; Semicolons
(semi) @name.definition.semi
(semis) @name.definition.semis
`;