/*
Go Language Comment-specific Tree-Sitter Query Patterns
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

; 内联注释查询
(comment) @comment.inline

; Go文档注释标签查询
(comment) @comment.go_doc_tags

; Go特性和并发查询
(comment) @comment.go_features

; Go模块和框架查询
(comment) @comment.go_modules_frameworks

; 安全和网络查询
(comment) @comment.security_network

; 许可证和版本查询
(comment) @comment.license_version
`;