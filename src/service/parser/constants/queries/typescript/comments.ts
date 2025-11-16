/*
TypeScript Language Comment-specific Tree-Sitter Query Patterns
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
(comment) @comment.jsdoc

; TODO/FIXME注释查询
(comment) @comment.todo

; 内联注释查询
(comment) @comment.inline

; JSDoc标签查询
(comment) @comment.jsdoc_tag

; 统一的文档注释查询
(comment) @comment.documentation.any

; JSDoc参数和返回值查询
(comment) @comment.jsdoc_param_return

; 许可证和版本信息查询
(comment) @comment.license_version

; 框架和技术栈查询
(comment) @comment.framework_tech

; 异步和模块系统查询
(comment) @comment.async_module

; 开发工具和优化查询
(comment) @comment.dev_tools

; 性能和安全查询
(comment) @comment.performance_security

; 状态管理和API查询
(comment) @comment.state_api_database

; 错误处理和兼容性查询
(comment) @comment.error_compatibility
`;