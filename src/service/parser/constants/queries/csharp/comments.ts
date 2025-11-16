/*
C# Language Comment-specific Tree-Sitter Query Patterns
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

; XML文档注释查询
(comment) @comment.doc

; TODO/FIXME注释查询
(comment) @comment.todo

; 内联注释查询
(comment) @comment.inline

; XML文档注释标签查询
(comment) @comment.xml_tag

; 许可证头注释查询
(comment) @comment.license

; 编译器指令注释查询
(comment) @comment.directive

; .NET特性注释查询
(comment) @comment.attribute

; 异步编程注释查询
(comment) @comment.async

; LINQ查询注释查询
(comment) @comment.linq

; 性能优化注释查询
(comment) @comment.performance

; 线程安全注释查询
(comment) @comment.threading

; 内存管理注释查询
(comment) @comment.memory

; 序列化注释查询
(comment) @comment.serialization
`;