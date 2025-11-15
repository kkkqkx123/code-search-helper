/*
HTML Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; HTML注释查询 - HTML只支持<!-- -->格式的注释
(comment) @comment.html

; 文档注释查询
(comment) @comment.doc

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.html "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 特殊注释查询 - 使用交替模式
[
  (comment
    (#match? @comment.html "\\[if.*\\]"))
  (comment
    (#match? @comment.html "<!DOCTYPE"))
  (comment
    (#match? @comment.html "(?i)copyright|license|gpl|mit|apache|bsd"))
] @comment.special

; 统一的元素文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @element.name)
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @element.name)
  )
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @form.element
      (#match? @form.element "^(form|input|button|select|textarea|label|fieldset|legend)$"))
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @form.element)
  )
  (
    (comment)* @doc
    .
    (script_element) @script.element
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @script.element)
  )
  (
    (comment)* @doc
    .
    (style_element) @style.element
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @style.element)
  )
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @link.element
      (#match? @link.element "^(a|link)$"))
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @link.element)
  )
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @media.element
      (#match? @media.element "^(img|video|audio|canvas|svg|picture|source|track)$"))
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @media.element)
  )
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @table.element
      (#match? @table.element "^(table|thead|tbody|tfoot|tr|th|td|caption|col|colgroup)$"))
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @table.element)
  )
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @list.element
      (#match? @list.element "^(ul|ol|li|dl|dt|dd)$"))
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @list.element)
  )
  (
    (comment)* @doc
    .
    (start_tag
      (tag_name) @semantic.element
      (#match? @semantic.element "^(header|footer|nav|main|section|article|aside|figure|figcaption|details|summary|time|mark|data)$"))
    (#strip! @doc "^[\\s\\*<!\\-]+|^[\\s\\*<!\\-]$")
    (#select-adjacent! @doc @semantic.element)
  )
] @element.documentation

; HTML特性和优化查询 - 使用交替模式
[
  (comment
    (#match? @comment.html "(?i)meta|charset|viewport|description|keywords|author|robots"))
  (comment
    (#match? @comment.html "(?i)seo|search|engine|optimization|title|description|keywords|og:|twitter:"))
  (comment
    (#match? @comment.html "(?i)a11y|accessibility|aria|role|alt|title|tabindex|screen-reader"))
  (comment
    (#match? @comment.html "(?i)responsive|mobile|tablet|desktop|breakpoint|media|query"))
  (comment
    (#match? @comment.html "(?i)performance|optimize|lazy|load|preload|prefetch|cache|cdn"))
] @comment.html_features

; 安全和框架查询 - 使用交替模式
[
  (comment
    (#match? @comment.html "(?i)security|csrf|xss|csp|samesite|secure|httponly"))
  (comment
    (#match? @comment.html "(?i)i18n|lang|locale|translation|rtl|ltr|direction"))
  (comment
    (#match? @comment.html "(?i)react|vue|angular|component|directive|template|binding"))
  (comment
    (#match? @comment.html "(?i)template|handlebars|mustache|ejs|pug|jade|liquid"))
] @comment.security_framework

; 构建和版本查询 - 使用交替模式
[
  (comment
    (#match? @comment.html "(?i)webpack|vite|parcel|rollup|gulp|grunt|build|dev|prod"))
  (comment
    (#match? @comment.html "(?i)version|v\\d+\\.\\d+\\.\\d+|release|changelog|update"))
  (comment
    (#match? @comment.html "(?i)ie|edge|chrome|firefox|safari|opera|browser|compat|polyfill"))
  (comment
    (#match? @comment.html "(?i)debug|console|log|test|dev|development"))
] @comment.build_version

; HTML5特性和验证查询 - 使用交替模式
[
  (comment
    (#match? @comment.html "(?i)html5|web|component|service|worker|manifest|pwa"))
  (comment
    (#match? @comment.html "(?i)validation|required|pattern|min|max|step|form|novalidate"))
  (comment
    (#match? @comment.html "(?i)svg|canvas|animation|transition|transform|css|keyframes"))
  (comment
    (#match? @comment.html "(?i)data|bind|model|state|props|emit|event"))
] @comment.html5_features
`;