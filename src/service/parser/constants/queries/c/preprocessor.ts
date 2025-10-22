/*
C Preprocessor-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Object-like macros - important for compile-time constants
(preproc_def
  name: (identifier) @name.definition.macro) @definition.macro

; Function-like macros - important for compile-time functions
(preproc_function_def
  name: (identifier) @name.definition.macro) @definition.macro

; Preprocessor includes - important for file organization
(preproc_include
  path: (system_lib_string) @name.definition.include) @definition.include
(preproc_include
  path: (string_literal) @name.definition.include) @definition.include

; Preprocessor conditionals - important for conditional compilation
(preproc_if
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition
(preproc_ifdef
  name: (identifier) @name.definition.preproc_ifdef) @definition.preproc_ifdef
(preproc_elif
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition
(preproc_else) @definition.preproc_else
`;