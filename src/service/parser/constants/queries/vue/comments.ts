/*
Vue Language Comment-specific Tree-Sitter Query Patterns
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

; Vue组件文档注释查询
(comment) @vue.documentation

; Vue特性查询
(comment) @comment.vue_features

; Vue指令查询
(comment) @comment.vue_directives

; Vue组合式API查询
(comment) @comment.vue_composition

; Vue路由和状态管理查询
(comment) @comment.vue_router_state

; Vue工具和构建查询
(comment) @comment.vue_tools_build

; Vue样式和UI查询
(comment) @comment.vue_style_ui

; Vue表单和验证查询
(comment) @comment.vue_form_validation

; Vue性能和优化查询
(comment) @comment.vue_performance_optimization

; Vue测试和调试查询
(comment) @comment.vue_test_debug

; Vue国际化和主题查询
(comment) @comment.vue_i18n_theme

; Vue安全和错误处理查询
(comment) @comment.vue_security_error

; Vue插件和生态查询
(comment) @comment.vue_plugin_ecosystem

; 许可证和版本查询
(comment) @comment.license_version
`;