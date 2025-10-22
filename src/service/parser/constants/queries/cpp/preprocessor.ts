/*
C++ Preprocessor and Macro-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Macro definitions - important for compile-time code generation
(preproc_function_def
  name: (identifier) @name.definition.macro) @definition.macro
`;