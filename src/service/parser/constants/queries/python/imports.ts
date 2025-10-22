/*
Python Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Import statements - important for understanding dependencies
(import_from_statement) @name.definition.import
(import_statement) @name.definition.import

; Global/Nonlocal statements - important for variable scope
(global_statement) @name.definition.global
(nonlocal_statement) @name.definition.nonlocal
`;