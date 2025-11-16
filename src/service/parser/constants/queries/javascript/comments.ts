/*
JavaScript Language Comment-specific Tree-Sitter Query Patterns
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

; JSDoc文档注释查询
(comment) @comment.jsdoc

; TODO/FIXME注释查询
(comment) @comment.todo

; 内联注释查询
(comment) @comment.inline

; JSDoc标签查询
(comment) @comment.jsdoc_tags

; JavaScript特性和框架查询
(comment) @comment.js_features

; 事件处理和DOM查询
(comment) @comment.event_dom

; 性能和安全查询
(comment) @comment.performance_security

; 开发工具和测试查询
(comment) @comment.dev_tools_testing

; 许可证头注释查询
(comment) @comment.license
`;