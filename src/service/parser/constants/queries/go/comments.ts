/*
Go Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
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

; Go风格文档注释查询 - 双斜杠
(comment
  (#match? @comment.any "^//")) @comment.go_doc

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
    (method_declaration
      name: (field_identifier) @method.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @method.name)
  )
  (
    (comment)* @doc
    .
    (type_declaration
      (type_spec
        name: (type_identifier) @struct.name
        type: (struct_type)))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @struct.name)
  )
  (
    (comment)* @doc
    .
    (type_declaration
      (type_spec
        name: (type_identifier) @interface.name
        type: (interface_type)))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @interface.name)
  )
  (
    (comment)* @doc
    .
    (package_clause
      name: (package_identifier) @package.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @package.name)
  )
  (
    (comment)* @doc
    .
    (var_declaration
      (var_spec
        name: (identifier) @variable.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @variable.name)
  )
  (
    (comment)* @doc
    .
    (const_declaration
      (const_spec
        name: (identifier) @constant.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @constant.name)
  )
  (
    (comment)* @doc
    .
    (type_declaration
      (type_spec
        name: (type_identifier) @type_alias.name
        type: (type_identifier)))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @type_alias.name)
  )
] @documentation.any

; Go文档注释标签查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@(param|return|returns|note|see|example|deprecated|since|author|copyright|license)"))
  (comment
    (#match? @comment.any "Example.*"))
  (comment
    (#match? @comment.any "\\+build"))
  (comment
    (#match? @comment.any "//go:generate"))
  (comment
    (#match? @comment.any "//go:linkname"))
  (comment
    (#match? @comment.any "//go:embed"))
] @comment.go_doc_tags

; Go特性和并发查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(error|panic|recover|defer)"))
  (comment
    (#match? @comment.any "(goroutine|channel|select|mutex|waitgroup|once|atomic|context)"))
  (comment
    (#match? @comment.any "(benchmark|profile|pprof|escape|allocation|gc|memory)"))
  (comment
    (#match? @comment.any "(Test|Benchmark|Example|Fuzz|Main)"))
] @comment.go_features

; Go模块和框架查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(module|go|require|replace|exclude)"))
  (comment
    (#match? @comment.any "(implements|satisfies|interface)"))
  (comment
    (#match? @comment.any "(init|main|package|import)"))
  (comment
    (#match? @comment.any "(gin|echo|fiber|chi|mux|router|middleware|handler)"))
] @comment.go_modules_frameworks

; 安全和网络查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(security|crypto|hash|tls|cert|key|secret|token)"))
  (comment
    (#match? @comment.any "(http|server|client|handler|middleware|grpc|websocket)"))
  (comment
    (#match? @comment.any "(sql|database|db|query|transaction|pool|connection)"))
] @comment.security_network

; 许可证和版本查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd"))
  (comment
    (#match? @comment.any "(go1\\.|build|constraint|platform|arch|os)"))
] @comment.license_version
`;