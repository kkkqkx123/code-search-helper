/*
Rust Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; 基本注释查询
(comment) @comment

; 单行注释查询
(comment) @comment.single

; 多行注释查询
(comment) @comment.multi

; 文档注释查询
(comment) @comment.doc

; Rust文档注释查询
(comment) @comment.rust_doc

; Rust模块文档注释查询
(comment) @comment.module_doc

; TODO/FIXME注释查询
(comment) @comment.todo

; 内联注释查询
(comment) @comment.inline

; Rust文档注释标签查询
(comment) @comment.rust_doc_tags

; Rust特性和安全查询
(comment) @comment.rust_features

; 宏和泛型查询
(comment) @comment.macros_generics

; 性能和内存查询
(comment) @comment.performance_memory

; FFI和序列化查询
(comment) @comment.ffi_serialization

; 网络和数据库查询
(comment) @comment.network_database

; 生态系统和工具查询
(comment) @comment.ecosystem_tools

; 许可证头注释查询
(comment) @comment.license
`;