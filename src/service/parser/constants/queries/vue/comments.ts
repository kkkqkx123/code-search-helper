/*
Vue Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的注释查询 - 使用交替模式合并重复查询
[
  (comment) @comment.single
  (comment) @comment.multi
] @comment.any

; 文档注释查询 - 使用谓词过滤和锚点
(comment
  (#match? @comment.any "^/\\*\\*")) @comment.doc

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.any "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 内联注释查询
(comment) @comment.inline

; Vue组件文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @component.name
      (#match? @component.name "^[A-Z].*"))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @component.name)
  )
  (
    (comment)* @doc
    .
    (script_element) @script.element
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @script.element)
  )
  (
    (comment)* @doc
    .
    (style_element) @style.element
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @style.element)
  )
] @vue.documentation

; Vue特性查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Vue|vue|component|props|data|computed|methods|watch|mounted|created|beforeCreate|beforeMount|beforeUpdate|updated|beforeDestroy|destroyed)"))
  (comment
    (#match? @comment.any "(reactive|ref|toRef|toRefs|isRef|unref|shallowRef|triggerRef|customRef|computed|watchEffect|watchPostEffect|watchSyncEffect)"))
] @comment.vue_features

; Vue指令查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(v-if|v-else-if|v-else|v-for|v-show|v-model|v-bind|v-on|v-slot|v-pre|v-cloak|v-once|v-memo)"))
  (comment
    (#match? @comment.any "(@click|@submit|@input|@change|@focus|@blur|@keydown|@keyup|@mouseover|@mouseout|@scroll|@load)"))
] @comment.vue_directives

; Vue组合式API查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(setup|script|setup|defineProps|defineEmits|defineExpose|withDefaults|useSlots|useAttrs)"))
  (comment
    (#match? @comment.any "(provide|inject|useProvide|useInject|getCurrentInstance|onMounted|onUpdated|onUnmounted|onBeforeMount|onBeforeUpdate|onBeforeUnmount)"))
] @comment.vue_composition

; Vue路由和状态管理查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(router|route|navigation|guard|beforeEach|beforeResolve|afterEach|push|replace|go|back|forward)"))
  (comment
    (#match? @comment.any "(Vuex|Pinia|store|state|getters|mutations|actions|modules|namespaced|commit|dispatch|mapState|mapGetters)"))
] @comment.vue_router_state

; Vue工具和构建查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Vue|CLI|Vite|Webpack|Rollup|Parcel|esbuild|vite|vue|config|vite\\.config|vue\\.config)"))
  (comment
    (#match? @comment.any "(dev|build|serve|lint|format|test|e2e|unit|coverage|hot|reload|HMR|proxy|alias)"))
] @comment.vue_tools_build

; Vue样式和UI查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(scoped|css|sass|scss|less|stylus|postcss|autoprefixer|tailwind|bootstrap|element|plus|ant|design)"))
  (comment
    (#match? @comment.any "(transition|animation|keyframes|transform|translate|scale|rotate|opacity|duration|easing|timing|function)"))
] @comment.vue_style_ui

; Vue表单和验证查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(form|input|select|checkbox|radio|textarea|validator|validation|rules|async|validator|vee|validate)"))
  (comment
    (#match? @comment.any "(model|v-model|lazy|number|trim|debounce|throttle|change|input|submit|reset|validate)"))
] @comment.vue_form_validation

; Vue性能和优化查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(performance|optimize|lazy|load|async|component|keep|alive|v-once|v-memo|virtual|scroll|infinite|pagination)"))
  (comment
    (#match? @comment.any "(cache|memory|leak|profiler|devtools|chrome|extension|debug|production|development|mode)"))
] @comment.vue_performance_optimization

; Vue测试和调试查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(test|spec|describe|it|expect|assert|mock|stub|spy|jest|vitest|cypress|playwright|e2e|unit)"))
  (comment
    (#match? @comment.any "(mount|shallowMount|render|debug|wrapper|find|findAll|trigger|emitted|setData|setProps)"))
] @comment.vue_test_debug

; Vue国际化和主题查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(i18n|vue|i18n|locale|translation|t|\\$t|plural|datetime|number|currency)"))
  (comment
    (#match? @comment.any "(theme|dark|light|mode|toggle|switch|color|scheme|css|variable|custom|property)"))
] @comment.vue_i18n_theme

; Vue安全和错误处理查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(security|XSS|CSRF|sanitize|escape|validate|auth|token|JWT|session|cookie|localStorage|sessionStorage)"))
  (comment
    (#match? @comment.any "(error|exception|try|catch|finally|throw|Error|TypeError|ReferenceError|SyntaxError|RangeError|custom|validation|console|log|warn|error|info|debug)"))
] @comment.vue_security_error

; Vue插件和生态查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(plugin|install|use|app|config|global|property|component|directive|mixin|filter)"))
  (comment
    (#match? @comment.any "(axios|fetch|http|request|response|interceptor|transform|adapter|timeout|retry|circuit|breaker)"))
] @comment.vue_plugin_ecosystem

; 许可证和版本查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd)"))
  (comment
    (#match? @comment.any "(Vue\\s*\\d+\\.\\d+|Vue\\s*3|Vue\\s*2|Composition|API|Options|API|Vite\\s*\\d+\\.\\d+|Node\\s*\\d+\\.\\d+)"))
] @comment.license_version
`;