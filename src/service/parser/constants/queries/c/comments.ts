/*
C Language Comment-specific Tree-Sitter Query Patterns
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

; TODO/FIXME注释查询
(comment) @comment.todo

; 许可证头注释查询
(comment) @comment.license

; 编译器指令注释查询
(comment) @comment.directive

; 特殊标记注释查询
(comment) @comment.special
`;