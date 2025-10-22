/*
JavaScript Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Import statements - important for understanding dependencies
(import_statement) @name.definition.import

; Export statements - important for understanding public API
(export_statement) @name.definition.export
`;