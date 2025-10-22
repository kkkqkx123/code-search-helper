/*
Python Data Structure and Pattern Matching-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Comprehensions
(list_comprehension) @name.definition.list_comprehension
(dictionary_comprehension) @name.definition.dict_comprehension
(set_comprehension) @name.definition.set_comprehension
(generator_expression) @name.definition.generator_expression

; List, tuple, set, dictionary literals
(list) @name.definition.list
(tuple) @name.definition.tuple
(set) @name.definition.set
(dictionary) @name.definition.dictionary

; Pattern matching constructs (Python 3.10+)
(class_pattern) @name.definition.class_pattern
(tuple_pattern) @name.definition.tuple_pattern
(list_pattern) @name.definition.list_pattern
(dict_pattern) @name.definition.dict_pattern
(keyword_pattern) @name.definition.keyword_pattern
(as_pattern) @name.definition.as_pattern
(union_pattern) @name.definition.union_pattern
(splat_pattern) @name.definition.splat_pattern

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
`;