/*
Python Tree-sitter Query Patterns
Updated to capture comprehensive Python syntax structures
*/
export default `
; Class definitions (including decorated)
(class_definition
  name: (identifier) @name.definition.class) @definition.class

(decorated_definition
  definition: (class_definition
    name: (identifier) @name.definition.class)) @definition.class

; Function and method definitions (including async and decorated)
(function_definition
  name: (identifier) @name.definition.function) @definition.function

(decorated_definition
  definition: (function_definition
    name: (identifier) @name.definition.function)) @definition.function

; Async function definitions
(async_function_definition
  name: (identifier) @name.definition.async_function) @definition.async_function

; Lambda expressions
(lambda) @name.definition.lambda

; Generator functions (functions containing yield)
(function_definition
  name: (identifier) @name.definition.generator
  body: (block
    (expression_statement
      (yield)))) @definition.generator

; Async generator functions
(async_function_definition
  name: (identifier) @name.definition.async_generator
  body: (block
    (expression_statement
      (yield)))) @definition.async_generator

; Comprehensions
(list_comprehension) @name.definition.list_comprehension
(dictionary_comprehension) @name.definition.dict_comprehension
(set_comprehension) @name.definition.set_comprehension
(generator_expression) @name.definition.generator_expression

; With statements
(with_statement) @name.definition.with_statement

; Try statements
(try_statement) @name.definition.try_statement

; Except clauses
(except_clause) @name.definition.except_clause

; Finally clause
(finally_clause) @name.definition.finally_clause

; Import statements
(import_from_statement) @name.definition.import
(import_statement) @name.definition.import

; Global/Nonlocal statements
(global_statement) @name.definition.global
(nonlocal_statement) @name.definition.nonlocal

; Match case statements (Python 3.10+)
(match_statement) @name.definition.match
(case_clause) @name.definition.case

; Type annotations
(typed_parameter
  type: (type)) @name.definition.type_annotation

; Variable assignments
(assignment
  left: (identifier) @name.definition.variable) @definition.variable

; Augmented assignments
(augmented_assignment
  left: (identifier) @name.definition.augmented_assignment) @definition.augmented_assignment

; Named expressions (walrus operator)
(named_expression
  name: (identifier) @name.definition.named_expression) @definition.named_expression

; Function calls
(call) @name.definition.call

; Attribute access
(attribute) @name.definition.attribute

; Subscript expressions
(subscript) @name.definition.subscript

; List, tuple, set, dictionary literals
(list) @name.definition.list
(tuple) @name.definition.tuple
(set) @name.definition.set
(dictionary) @name.definition.dictionary

; String literals
(string) @name.definition.string
(concatenated_string) @name.definition.concatenated_string

; Numeric literals
(integer) @name.definition.integer
(float) @name.definition.float
(complex) @name.definition.complex

; Boolean literals
(true) @name.definition.true
(false) @name.definition.false

; None literal
(none) @name.definition.none

; Ellipsis
(ellipsis) @name.definition.ellipsis

; Control flow statements
(if_statement) @name.definition.if
(for_statement) @name.definition.for
(while_statement) @name.definition.while

; Loop control
(break_statement) @name.definition.break
(continue_statement) @name.definition.continue

; Return statements
(return_statement) @name.definition.return

; Yield statements
(yield) @name.definition.yield

; Raise statements
(raise_statement) @name.definition.raise

; Assert statements
(assert_statement) @name.definition.assert

; Pass statements
(pass_statement) @name.definition.pass

; Del statements
(del_statement) @name.definition.del

; Expression statements
(expression_statement) @name.definition.expression

; Binary operations
(binary_operator) @name.definition.binary_operator

; Unary operations
(unary_operator) @name.definition.unary_operator

; Comparison operations
(comparison_operator) @name.definition.comparison_operator

; Boolean operations
(boolean_operator) @name.definition.boolean_operator

; Conditional expressions
(conditional_expression) @name.definition.conditional

; List splat operations
(list_splat) @name.definition.list_splat
(dictionary_splat) @name.definition.dictionary_splat

; Pattern matching constructs (Python 3.10+)
(class_pattern) @name.definition.class_pattern
(tuple_pattern) @name.definition.tuple_pattern
(list_pattern) @name.definition.list_pattern
(dict_pattern) @name.definition.dict_pattern
(keyword_pattern) @name.definition.keyword_pattern
(as_pattern) @name.definition.as_pattern
(union_pattern) @name.definition.union_pattern
(splat_pattern) @name.definition.splat_pattern

; Type hints and annotations
(type) @name.definition.type_hint
(type_alias) @name.definition.type_alias

; Parameter declarations
(parameters) @name.definition.parameters
(default_parameter) @name.definition.default_parameter
(typed_parameter) @name.definition.typed_parameter
(typed_default_parameter) @name.definition.typed_default_parameter

; Decorators
(decorator) @name.definition.decorator

; Class inheritance
(class_definition
  superclasses: (argument_list) @name.definition.superclasses)

; Method definitions in classes
(class_definition
  body: (block
    (function_definition
      name: (identifier) @name.definition.method))) @definition.method

; Property definitions
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.property
        (#match? @name.definition.property "^(property|.*property.*)$")))) @definition.property

; Static methods
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.static_method
        (#match? @name.definition.static_method "^(staticmethod|.*static.*)$")))) @definition.static_method

; Class methods
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.class_method
        (#match? @name.definition.class_method "^(classmethod|.*class.*)$")))) @definition.class_method

; Test functions
(function_definition
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^test_.*$"))

; Dunder methods (magic methods)
(function_definition
  name: (identifier) @name.definition.dunder_method
  (#match? @name.definition.dunder_method "^__.*__$"))

; Private methods (name mangling)
(function_definition
  name: (identifier) @name.definition.private_method
  (#match? @name.definition.private_method "^_.*$"))

; Comments for documentation
(comment) @name.definition.comment

; String literals that might be docstrings
(expression_statement
  (string) @name.definition.docstring
  (#match? @name.definition.docstring "^[\"']{3}.*[\"']{3}$"))

; Module-level assignments that might be constants
(assignment
  left: (identifier) @name.definition.constant
  (#match? @name.definition.constant "^[A-Z_][A-Z0-9_]*$")) @definition.constant
`