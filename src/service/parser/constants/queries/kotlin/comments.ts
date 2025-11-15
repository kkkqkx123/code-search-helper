/*
Kotlin Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的注释查询 - 使用交替模式合并重复查询
[
  (comment) @comment.single
  (comment) @comment.multi
] @comment.any

; KDoc文档注释查询 - 使用谓词过滤和锚点
(comment
  (#match? @comment.any "^/\\*\\*")) @comment.kdoc

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.any "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 内联注释查询
(comment) @comment.inline

; KDoc标签查询 - 使用交替模式合并标签查询
[
  (comment
    (#match? @comment.any "@(param|return|returns|type|property|receiver|constructor|see|since|suppress|throws|exception|sample|example|author|version|deprecated|license|copyright|hide|internal|public|private|protected|internal|set|get|setparam|getparam|property|setter|getter)"))
] @comment.kdoc_tag

; 统一的文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (function_declaration
      name: (simple_identifier) @function.name)
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
    (object_declaration
      name: (simple_identifier) @object.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @object.name)
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
    (type_alias
      name: (type_identifier) @type_alias.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @type_alias.name)
  )
  (
    (comment)* @doc
    .
    (property_declaration
      name: (simple_identifier) @property.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @property.name)
  )
  (
    (comment)* @doc
    .
    (companion_object
      name: (simple_identifier)? @companion.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @companion.name)
  )
] @documentation.any

; Kotlin特性查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(suspend|coroutine|async|await|launch|runBlocking|withContext|flow|Channel|Actor|Scope|Job|Deferred)"))
  (comment
    (#match? @comment.any "(inline|noinline|crossinline|reified|operator|infix|extension|sealed|enum|annotation|data|value|companion|object|lateinit|lazy|const)"))
] @comment.kotlin_features

; Android开发查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Android|Activity|Fragment|View|ViewModel|LiveData|Room|RecyclerView|Adapter|ViewHolder|Layout|Resource|Manifest|Intent|Bundle|Context)"))
  (comment
    (#match? @comment.any "(Jetpack|Compose|UI|State|Effect|remember|mutableStateOf|LaunchedEffect|SideEffect|Canvas|Modifier|Box|Column|Row)"))
] @comment.android_development

; 框架和工具查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Spring|Boot|Ktor|Micronaut|Quarkus|Vert\\.x|Javalin|http|server|client|rest|api|controller|service|repository)"))
  (comment
    (#match? @comment.any "(Koin|Dagger|Hilt|Kodein|Guice|dependency|injection|DI|module|component|singleton|factory|provider)"))
] @comment.framework_tools

; 测试和构建查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(test|spec|describe|it|expect|assert|mock|stub|spy|JUnit|MockK|TestNG|Spek|Kotest)"))
  (comment
    (#match? @comment.any "(Gradle|Kotlin|DSL|build|gradle|kts|dependencies|implementation|api|testImplementation|plugins|tasks)"))
] @comment.test_build

; 并发和性能查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(thread|concurrent|parallel|mutex|lock|semaphore|atomic|volatile|synchronized|threadSafe|race|condition|queue|stack|pool)"))
  (comment
    (#match? @comment.any "(performance|optimize|benchmark|profile|memory|allocation|gc|garbage|collection|heap|stack|cache|buffer|stream)"))
] @comment.concurrency_performance

; 数据处理查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(database|db|sql|nosql|orm|exposed|room|jooq|mybatis|hibernate|entity|model|schema|migration|seed|query|transaction)"))
  (comment
    (#match? @comment.any "(serialization|deserialize|json|xml|yaml|protobuf|gson|jackson|kotlinx|serialization|parser|encoder|decoder)"))
] @comment.data_processing

; 网络和API查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(network|http|https|tcp|udp|websocket|rest|graphql|endpoint|route|handler|controller|service|client|server)"))
  (comment
    (#match? @comment.any "(request|response|header|param|query|body|status|code|error|timeout|retry|circuit|breaker|rate|limit)"))
] @comment.network_api

; 安全和错误处理查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(security|auth|authentication|authorization|password|hash|encrypt|decrypt|token|jwt|ssl|tls|https|csrf|xss|injection)"))
  (comment
    (#match? @comment.any "(error|exception|try|catch|finally|throw|throws|Result|Either|Option|Nullable|NonEmpty|validation|check|require|checkNotNull)"))
] @comment.security_error

; 许可证和版本查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd)"))
  (comment
    (#match? @comment.any "(Kotlin\\s*\\d+\\.\\d+|JVM|Java\\s*\\d+|Android\\s*API|Gradle\\s*\\d+|Maven|SBT)"))
] @comment.license_version
`;