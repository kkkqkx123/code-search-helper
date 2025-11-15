/*
TSX Language Comment-specific Tree-Sitter Query Patterns
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
  (#match? @comment.any "^/\\*\\*")) @comment.jsdoc

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.any "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 内联注释查询
(comment) @comment.inline

; JSDoc标签查询 - 使用交替模式合并标签查询
[
  (comment
    (#match? @comment.any "@(param|arg|argument|return|returns|type|typedef|class|constructor|method|property|memberof|instance|static|readonly|const|var|let|const|function|async|await|generator|yield|this|bind|call|apply|extends|implements|mixins|override|abstract|interface|namespace|module|import|export|default|require|define|global|window|document|console|debugger|throw|throws|exception|error|try|catch|finally|deprecated|since|version|author|license|copyright|see|example|description|summary|remarks|todo|fixme|note|warning|experimental|internal|private|protected|public|readonly|optional|nullable|undefined|null|boolean|number|string|object|symbol|bigint|any|unknown|never|void)"))
] @comment.jsdoc_tag

; React组件文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (function_declaration
      name: (identifier) @component.name
      (#match? @component.name "^[A-Z].*"))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @component.name)
  )
  (
    (comment)* @doc
    .
    (class_declaration
      name: (type_identifier) @component.name
      (#match? @component.name "^[A-Z].*"))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @component.name)
  )
  (
    (comment)* @doc
    .
    (arrow_function
      (identifier) @hook.name
      (#match? @hook.name "^use[A-Z].*"))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @hook.name)
  )
] @react.documentation

; JSX相关注释查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(jsx|JSX|element|component|props|children|key|ref|forwardRef|memo|lazy|Suspense|Fragment|Portal|Profiler)"))
  (comment
    (#match? @comment.any "(React|useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue)"))
] @comment.jsx_react

; TypeScript和TSX特性查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(type|interface|class|enum|union|intersection|generic|constraint|mapped|conditional|infer|keyof|typeof|instanceof|as|satisfies|asserts)"))
  (comment
    (#match? @comment.any "(decorator|@|Component|Injectable|Controller|Get|Post|Put|Delete|Param|Query|Body|Req|Res|ValidationPipe|UseGuards|UseInterceptors)"))
] @comment.typescript_tsx

; 框架和工具查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(NextJS|NuxtJS|Remix|Gatsby|Vite|Webpack|Rollup|Parcel|ESLint|Prettier|Jest|Cypress|Storybook)"))
  (comment
    (#match? @comment.any "(styled-components|emotion|material-ui|ant|design|chakra|tailwind|bootstrap|css-modules|sass|less)"))
] @comment.framework_tools

; 性能和优化查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(performance|optimize|memo|useMemo|useCallback|lazy|Suspense|code|splitting|tree|shaking|bundle|size|chunk|cache)"))
  (comment
    (#match? @comment.any "(virtual|list|grid|infinite|scroll|pagination|debounce|throttle|intersection|observer|resize|observer)"))
] @comment.performance_optimization

; 状态管理查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(state|store|redux|mobx|zustand|recoil|jotai|valtio|context|useContext|useReducer|useState|useEffect)"))
  (comment
    (#match? @comment.any "(dispatch|action|reducer|selector|middleware|thunk|saga|observable|subject|behavior|subject)"))
] @comment.state_management

; 测试和开发查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(test|spec|describe|it|expect|assert|mock|stub|spy|jest|mocha|jasmine|karma|cypress|testing|library|react|testing)"))
  (comment
    (#match? @comment.any "(unit|integration|e2e|component|render|screen|fireEvent|userEvent|waitFor|findBy|getBy|queryBy)"))
] @comment.testing_dev

; API和网络查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(API|REST|GraphQL|endpoint|route|handler|controller|service|repository|dto|entity|model|schema|validation)"))
  (comment
    (#match? @comment.any "(fetch|axios|http|request|response|get|post|put|delete|patch|headers|params|query|body)"))
] @comment.api_network

; 安全和错误处理查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(security|XSS|CSRF|sanitize|escape|validate|auth|token|JWT|session|cookie|localStorage|sessionStorage|CORS|CSP|helmet)"))
  (comment
    (#match? @comment.any "(error|exception|try|catch|finally|throw|Error|TypeError|ReferenceError|SyntaxError|RangeError|custom|validation|debug|console|log|warn|error|info|debug)"))
] @comment.security_error

; 许可证和版本查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd"))
  (comment
    (#match? @comment.any "(TypeScript\\s*\\d+\\.\\d+|TS\\d+\\.\\d+|tsc|tsconfig|strict|noImplicitAny|noImplicitReturns|noUnusedLocals|noUnusedParameters)"))
  (comment
    (#match? @comment.any "(React\\s*\\d+\\.\\d+|NextJS\\s*\\d+\\.\\d+|Node\\s*\\d+\\.\\d+|npm|yarn|pnpm)"))
] @comment.license_version
`;