/*
TypeScript Language Comment-specific Tree-Sitter Query Patterns
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
      name: (type_identifier) @class.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @class.name)
  )
  (
    (comment)* @doc
    .
    (interface_declaration
      name: (type_identifier) @interface.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @interface.name)
  )
  (
    (comment)* @doc
    .
    (type_alias_declaration
      name: (type_identifier) @type_alias.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @type_alias.name)
  )
  (
    (comment)* @doc
    .
    (enum_declaration
      name: (type_identifier) @enum.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @enum.name)
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
    (function_declaration
      name: (identifier) @generic.function
      type_parameters: (type_parameters))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @generic.function)
  )
] @documentation.any

; JSDoc参数和返回值查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@param\\s+\\{[^}]*\\}\\s+\\w+"))
  (comment
    (#match? @comment.any "@return\\s+\\{[^}]*\\}"))
  (comment
    (#match? @comment.any "@type\\s+\\{[^}]*\\}"))
] @comment.jsdoc_param_return

; 许可证和版本信息查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd"))
  (comment
    (#match? @comment.any "(TypeScript\\s*\\d+\\.\\d+|TS\\d+\\.\\d+|tsc|tsconfig|strict|noImplicitAny|noImplicitReturns|noUnusedLocals|noUnusedParameters)"))
] @comment.license_version

; 框架和技术栈查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(React|Vue|Angular|NextJS|NuxtJS|NestJS|Express|Koa|Fastify|TypeORM|Prisma|GraphQL|Apollo|Relay)"))
  (comment
    (#match? @comment.any "(type|interface|class|enum|union|intersection|generic|constraint|mapped|conditional|infer|keyof|typeof|instanceof|as|satisfies|asserts)"))
  (comment
    (#match? @comment.any "(decorator|@|Component|Injectable|Controller|Get|Post|Put|Delete|Param|Query|Body|Req|Res|ValidationPipe|UseGuards|UseInterceptors)"))
] @comment.framework_tech

; 异步和模块系统查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(async|await|Promise|Observable|Subject|BehaviorSubject|ReplaySubject|AsyncSubject|rxjs|stream|callback|then|catch|finally)"))
  (comment
    (#match? @comment.any "(import|export|default|require|module|namespace|declare|ambient|global|\\.d\\.ts|typings|types)"))
] @comment.async_module

; 开发工具和优化查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(config|configuration|settings|env|environment|\\.env|process\\.env|config|json|yaml|toml|ini)"))
  (comment
    (#match? @comment.any "(test|spec|describe|it|expect|assert|mock|stub|spy|jest|mocha|jasmine|karma|cypress|testing|unit|integration|e2e)"))
  (comment
    (#match? @comment.any "(build|webpack|vite|rollup|parcel|gulp|grunt|npm|yarn|pnpm|script|dev|prod|start|test|lint|format|prettier|eslint|ts-node|ts-node-dev)"))
] @comment.dev_tools

; 性能和安全查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(performance|optimize|memo|useMemo|useCallback|lazy|Suspense|code|splitting|tree|shaking|bundle|size|chunk|cache)"))
  (comment
    (#match? @comment.any "(security|XSS|CSRF|sanitize|escape|validate|auth|token|JWT|session|cookie|localStorage|sessionStorage|CORS|CSP|helmet)"))
] @comment.performance_security

; 状态管理和API查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(state|store|redux|mobx|vuex|context|useContext|useReducer|useState|useEffect|dispatch|action|reducer|selector)"))
  (comment
    (#match? @comment.any "(API|REST|GraphQL|endpoint|route|handler|controller|service|repository|dto|entity|model|schema|validation)"))
  (comment
    (#match? @comment.any "(database|db|sql|nosql|orm|prisma|typeorm|sequelize|mongoose|model|entity|repository|migration|seed|query|transaction)"))
] @comment.state_api_database

; 错误处理和兼容性查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(error|exception|try|catch|finally|throw|Error|TypeError|ReferenceError|SyntaxError|RangeError|custom|validation|debug|console|log|warn|error|info|debug)"))
  (comment
    (#match? @comment.any "(IE|Edge|Chrome|Firefox|Safari|Opera|mobile|tablet|responsive|polyfill|transpile|babel|compat|prefix|vendor|caniuse)"))
] @comment.error_compatibility
`;