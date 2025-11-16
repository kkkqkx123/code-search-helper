/*
TSX Language Comment-specific Tree-Sitter Query Patterns
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

; React组件文档注释查询
(comment) @react.documentation

; JSX相关注释查询
(comment) @comment.jsx_react

; TypeScript和TSX特性查询
(comment) @comment.typescript_tsx

; 框架和工具查询
(comment) @comment.framework_tools

; 性能和优化查询
(comment) @comment.performance_optimization

; 状态管理查询
(comment) @comment.state_management

; 测试和开发查询
(comment) @comment.testing_dev

; API和网络查询
(comment) @comment.api_network

; 安全和错误处理查询
(comment) @comment.security_error

; 许可证和版本查询
(comment) @comment.license_version
`;