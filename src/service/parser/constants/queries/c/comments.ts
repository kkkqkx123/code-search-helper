/*
C Language Comment-specific Tree-Sitter Query Patterns
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
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @function.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @function.name)
  )
  (
    (comment)* @doc
    .
    (struct_specifier
      name: (type_identifier) @struct.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @struct.name)
  )
  (
    (comment)* @doc
    .
    (enum_specifier
      name: (type_identifier) @enum.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @enum.name)
  )
  (
    (comment)* @doc
    .
    (declaration
      declarator: (identifier) @variable.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @variable.name)
  )
  (
    (comment)* @doc
    .
    (preproc_def
      name: (identifier) @macro.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @macro.name)
  )
  (
    (comment)* @doc
    .
    (preproc_if)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @preproc_if)
  )
] @documentation.any

; 特殊标记注释查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@(author|date|version|param|return|brief|details|note|warning|todo|fixme|deprecated|since|see|example)"))
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd"))
  (comment
    (#match? @comment.any "#(pragma|warning|error|define|undef|ifdef|ifndef|if|else|elif|endif)"))
] @comment.special

; 许可证头注释查询
(comment
  (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd")) @comment.license

; 编译器指令注释查询
(comment
  (#match? @comment.any "#(pragma|warning|error|define|undef|ifdef|ifndef|if|else|elif|endif)")) @comment.directive
`;