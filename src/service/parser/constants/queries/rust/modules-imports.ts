/*
Rust Module and Import-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Module definitions
(mod_item
    name: (identifier) @name.definition.module) @definition.module

; Use declarations
(use_declaration) @definition.use_declaration

; Extern crates
(extern_crate_declaration
  name: (identifier) @name.definition.extern_crate) @definition.extern_crate

; Foreign function interfaces (FFI)
(foreign_item_fn
  name: (identifier) @name.definition.foreign_function) @definition.foreign_function
(foreign_static_item
  name: (identifier) @name.definition.foreign_static) @definition.foreign_static

; Path expressions (qualified names)
(scoped_identifier
  path: (identifier) @name.definition.scope
  name: (identifier) @name.definition.scoped_name) @definition.scoped
`;