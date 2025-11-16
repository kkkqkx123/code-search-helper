/*
CSS Language Comment-specific Tree-Sitter Query Patterns
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

; CSS特性注释查询
(comment) @comment.css_features

; 布局和动画注释查询
(comment) @comment.layout_animation

; 组件和工具注释查询
(comment) @comment.component_utility

; 可访问性和框架注释查询
(comment) @comment.accessibility_framework
`;