/*
Kotlin Language Comment-specific Tree-Sitter Query Patterns
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

; KDoc文档注释查询
(comment) @comment.kdoc

; TODO/FIXME注释查询
(comment) @comment.todo

; 内联注释查询
(comment) @comment.inline

; KDoc标签查询
(comment) @comment.kdoc_tag

; Kotlin特性查询
(comment) @comment.kotlin_features

; Android开发查询
(comment) @comment.android_development

; 框架和工具查询
(comment) @comment.framework_tools

; 测试和构建查询
(comment) @comment.test_build

; 并发和性能查询
(comment) @comment.concurrency_performance

; 数据处理查询
(comment) @comment.data_processing

; 网络和API查询
(comment) @comment.network_api

; 安全和错误处理查询
(comment) @comment.security_error

; 许可证和版本查询
(comment) @comment.license_version
`;