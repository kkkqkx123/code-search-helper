/*
JavaScript Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; 统一的注释查询 - 使用交替模式合并重复查询
[
  (comment) @comment.single
  (comment) @comment.multi
] @comment.any

; JSDoc文档注释查询 - 使用谓词过滤和锚点
(comment
  (#match? @comment.any "^/\\*\\*")) @comment.jsdoc

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.any "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 内联注释查询
(comment) @comment.inline

; 统一的文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (function_declaration
      name: (identifier) @function.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @function.name)
  )
  (
    (comment)* @doc
    .
    (class_declaration
      name: (identifier) @class.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @class.name)
  )
  (
    (comment)* @doc
    .
    (method_definition
      name: (property_identifier) @method.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @method.name)
  )
  (
    (comment)* @doc
    .
    (variable_declaration
      (variable_declarator
        name: (identifier) @variable.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @variable.name)
  )
  (
    (comment)* @doc
    .
    (variable_declaration
      (variable_declarator
        name: (identifier) @arrow.name
        value: (arrow_function)))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @arrow.name)
  )
  (
    (comment)* @doc
    .
    (import_statement) @import.statement
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @import.statement)
  )
  (
    (comment)* @doc
    .
    (export_statement) @export.statement
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @export.statement)
  )
] @documentation.any

; JSDoc标签查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@param\\s+\\{[^}]*\\}\\s+\\w+"))
  (comment
    (#match? @comment.any "@return\\s+\\{[^}]*\\}"))
  (comment
    (#match? @comment.any "@type\\s+\\{[^}]*\\}"))
  (comment
    (#match? @comment.any "@(param|arg|argument|return|returns|type|typedef|class|constructor|method|property|memberof|instance|static|readonly|const|var|let|const|function|async|await|generator|yield|this|bind|call|apply|extends|implements|mixins|override|abstract|interface|namespace|module|import|export|default|require|define|global|window|document|console|debugger|throw|throws|exception|error|try|catch|finally|deprecated|since|version|author|license|copyright|see|example|description|summary|remarks|todo|fixme|note|warning|experimental|internal|private|protected|public|readonly|optional|nullable|undefined|null|boolean|number|string|object|symbol|bigint|any|unknown|never|void)"))
] @comment.jsdoc_tags

; JavaScript特性和框架查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(ES5|ES6|ES2015|ES2016|ES2017|ES2018|ES2019|ES2020|ES2021|ES2022|ESNext|JavaScript|JS|Node|NodeJS)"))
  (comment
    (#match? @comment.any "(React|Vue|Angular|jQuery|Express|Koa|Fastify|NestJS|NextJS|NuxtJS|Gatsby|Webpack|Vite|Rollup|Parcel|Babel|TypeScript|Flow)"))
  (comment
    (#match? @comment.any "(async|await|Promise|callback|then|catch|finally|resolve|reject|all|race|generator|yield|async\\*|function\\*)"))
] @comment.js_features

; 事件处理和DOM查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(event|listener|handler|emit|on|off|addEventListener|removeEventListener|dispatch|preventDefault|stopPropagation)"))
  (comment
    (#match? @comment.any "(DOM|document|window|element|node|querySelector|getElementById|createElement|appendChild|removeChild|innerHTML|textContent|style|class|attribute)"))
] @comment.event_dom

; 性能和安全查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(performance|optimize|debounce|throttle|memo|cache|lazy|load|virtual|scroll|intersection|observer|requestAnimationFrame|requestIdleCallback)"))
  (comment
    (#match? @comment.any "(security|XSS|CSRF|sanitize|escape|validate|auth|token|JWT|session|cookie|localStorage|sessionStorage|CORS|CSP)"))
  (comment
    (#match? @comment.any "(fetch|axios|XMLHttpRequest|AJAX|HTTP|GET|POST|PUT|DELETE|PATCH|API|REST|GraphQL|WebSocket|SSE)"))
] @comment.performance_security

; 开发工具和测试查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(build|webpack|vite|rollup|parcel|gulp|grunt|npm|yarn|pnpm|script|dev|prod|start|test|lint|format|prettier|eslint)"))
  (comment
    (#match? @comment.any "(test|spec|describe|it|expect|assert|mock|stub|spy|jest|mocha|chai|jasmine|karma|cypress|selenium|unit|integration|e2e)"))
  (comment
    (#match? @comment.any "(IE|Edge|Chrome|Firefox|Safari|Opera|mobile|tablet|responsive|polyfill|transpile|babel|compat|prefix|vendor)"))
] @comment.dev_tools_testing

; 许可证头注释查询
(comment
  (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd")) @comment.license
`;