/*
HTML Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; 基本注释查询
(comment) @comment

; 文档注释查询
(comment) @comment.doc

; TODO/FIXME注释查询
(comment) @comment.todo

; 特殊注释查询
(comment) @comment.special

; HTML特性和优化查询
(comment) @comment.html_features

; 安全和框架查询
(comment) @comment.security_framework

; 构建和版本查询
(comment) @comment.build_version

; HTML5特性和验证查询
(comment) @comment.html5_features
`;