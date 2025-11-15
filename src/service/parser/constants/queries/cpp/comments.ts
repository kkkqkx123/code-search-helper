/*
C++ Language Comment-specific Tree-Sitter Query Patterns
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

; Doxygen风格注释查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "/\\*\\*"))
  (comment
    (#match? @comment.any "///"))
  (comment
    (#match? @comment.any "//!"))
] @comment.doxygen

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
    (class_specifier
      name: (type_identifier) @class.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @class.name)
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
    (template_declaration
      (template_parameter_list))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @template_declaration)
  )
  (
    (comment)* @doc
    .
    (namespace_definition
      name: (namespace_identifier) @namespace.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @namespace.name)
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
    (enum_specifier
      name: (type_identifier) @enum.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @enum.name)
  )
  (
    (comment)* @doc
    .
    (field_declaration
      declarator: (field_identifier) @field.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @field.name)
  )
  (
    (comment)* @doc
    .
    (field_declaration
      declarator: (function_declarator
        declarator: (field_identifier) @method.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @method.name)
  )
] @documentation.any

; Doxygen标签查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@param|@param\[.*\]|@tparam"))
  (comment
    (#match? @comment.any "@return|@returns"))
  (comment
    (#match? @comment.any "@throw|@throws|@exception"))
  (comment
    (#match? @comment.any "@(brief|details|note|warning|todo|fixme|deprecated|since|see|example|author|date|version|copyright|license)"))
] @comment.doxygen_tags

; C++特性和性能查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(C\\+\\+11|C\\+\\+14|C\\+\\+17|C\\+\\+20|modern|deprecated)"))
  (comment
    (#match? @comment.any "(TODO|FIXME|OPTIMIZE|PERF|HOTPATH|CRITICAL)"))
  (comment
    (#match? @comment.any "(THREAD|LOCK|MUTEX|ATOMIC|CONCURRENT)"))
] @comment.cpp_features

; 许可证和编译器指令查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd"))
  (comment
    (#match? @comment.any "#(pragma|warning|error|define|undef|ifdef|ifndef|if|else|elif|endif)"))
] @comment.license_directive
`;