/*
Go Tree-Sitter Query Patterns
Updated to capture full declarations and additional syntax structures
*/
export default `
; Function declarations - capture the entire declaration
(function_declaration) @name.definition.function

; Method declarations - capture the entire declaration
(method_declaration) @name.definition.method

; Type declarations (interfaces, structs, type aliases) - capture the entire declaration
(type_declaration) @name.definition.type

; Variable declarations - capture the entire declaration
(var_declaration) @name.definition.var

; Constant declarations - capture the entire declaration  
(const_declaration) @name.definition.const

; Package clause
(package_clause) @name.definition.package

; Import declarations - capture the entire import block
(import_declaration) @name.definition.import

; Interface declarations - specific capture
(interface_type) @name.definition.interface

; Struct declarations - specific capture
(struct_type) @name.definition.struct

; Generic type declarations
(generic_type) @name.definition.generic

; Type parameters in generic declarations
(type_parameter_declaration) @name.definition.type_parameter

; Type assertions
(type_assertion_expression) @name.definition.type_assertion

; Type conversions
(type_conversion_expression) @name.definition.type_conversion

; Function literals (anonymous functions)
(func_literal) @name.definition.func_literal

; Selector expressions (field/method access)
(selector_expression) @name.definition.selector

; Call expressions
(call_expression) @name.definition.call

; Composite literals (struct, array, map, slice literals)
(composite_literal) @name.definition.composite_literal

; Slice expressions
(slice_expression) @name.definition.slice

; Index expressions
(index_expression) @name.definition.index

; Channel types and operations
(channel_type) @name.definition.channel
(send_statement) @name.definition.send
(receive_statement) @name.definition.receive

; Control flow statements
(if_statement) @name.definition.if
(for_statement) @name.definition.for
(range_clause) @name.definition.range
(switch_statement) @name.definition.switch
(select_statement) @name.definition.select

; Expression switch cases
(expression_case) @name.definition.case
(default_case) @name.definition.default_case

; Error handling
(return_statement) @name.definition.return
(panic_statement) @name.definition.panic
(defer_statement) @name.definition.defer

; Error values
(error) @name.definition.error

; Go routines
(go_statement) @name.definition.goroutine

; Assignment statements
(assignment_statement) @name.definition.assignment
(short_var_declaration) @name.definition.short_var

; Binary expressions
(binary_expression) @name.definition.binary

; Unary expressions
(unary_expression) @name.definition.unary

; Literals
(int_literal) @name.definition.int_literal
(float_literal) @name.definition.float_literal
(interpreted_string_literal) @name.definition.string_literal
(raw_string_literal) @name.definition.raw_string_literal
(rune_literal) @name.definition.rune_literal

; Comments for documentation
(comment) @name.definition.comment

; Qualified types (package.Type)
(qualified_type) @name.definition.qualified_type

; Array and slice types
(array_type) @name.definition.array_type
(slice_type) @name.definition.slice_type

; Map types
(map_type) @name.definition.map_type

; Pointer types
(pointer_type) @name.definition.pointer_type

; Function types
(function_type) @name.definition.function_type

; Variadic parameters
(variadic_parameter_declaration) @name.definition.variadic

; Field declarations in structs
(field_declaration) @name.definition.field

; Method specifications in interfaces
(method_spec) @name.definition.method_spec

; Embedded fields in structs
(field_declaration
  (type_identifier) @name.definition.embedded_field)

; Labeled statements
(labeled_statement) @name.definition.label

; Break and continue with labels
(break_statement) @name.definition.break
(continue_statement) @name.definition.continue

; Fallthrough statements
(fallthrough_statement) @name.definition.fallthrough

; Type switch statements
(type_switch_statement) @name.definition.type_switch

; Type switch cases
(type_case) @name.definition.type_case

; Empty statements (blocks)
(block) @name.definition.block

; Expression statements
(expression_statement) @name.definition.expression

; Parenthesized expressions
(parenthesized_expression) @name.definition.parenthesized

; Blank identifier
(blank_identifier) @name.definition.blank_identifier

; Dot imports
(dot) @name.definition.dot_import

; Built-in functions
(call_expression
  function: (identifier) @name.definition.builtin
  (#match? @name.definition.builtin "^(append|cap|close|complex|copy|delete|imag|len|make|new|panic|print|println|real|recover)$"))

; Test functions
(function_declaration
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^Test.*$"))

; Benchmark functions
(function_declaration
  name: (identifier) @name.definition.benchmark
  (#match? @name.definition.benchmark "^Benchmark.*$"))

; Example functions
(function_declaration
  name: (identifier) @name.definition.example
  (#match? @name.definition.example "^Example.*$"))
`