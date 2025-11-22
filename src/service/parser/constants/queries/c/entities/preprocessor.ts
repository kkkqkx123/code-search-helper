/*
C Preprocessor-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Macro definitions - important for compile-time constants and functions
[
  (preproc_def
    name: (identifier) @name.definition.macro)
  (preproc_function_def
    name: (identifier) @name.definition.macro)
] @definition.macro

; Preprocessor includes - important for file organization
[
  (preproc_include
    path: (system_lib_string) @name.definition.include)
  (preproc_include
    path: (string_literal) @name.definition.include)
] @definition.include

; Preprocessor conditionals - important for conditional compilation
(preproc_if
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition

; Preprocessor elif - important for conditional compilation
(preproc_elif
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition

; Preprocessor ifdef - important for conditional compilation
(preproc_ifdef
  name: (identifier) @name.definition.preproc_ifdef) @definition.preproc_ifdef

; Preprocessor else - important for conditional compilation
(preproc_else) @definition.preproc_else
`;