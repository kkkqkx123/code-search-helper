/*
C++ Language Comment-specific Tree-Sitter Query Patterns
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

; Doxygen风格注释查询
(comment) @comment.doxygen

; 许可证头注释查询
(comment) @comment.license

; 编译器指令注释查询
(comment) @comment.directive

; C++特性注释查询
(comment) @comment.cpp_features

; Doxygen标签注释查询
(comment) @comment.doxygen_tags
`;