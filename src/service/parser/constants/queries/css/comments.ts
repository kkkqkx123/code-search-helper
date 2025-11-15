/*
CSS Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; CSS注释查询 - CSS只支持/* */格式的注释
(comment) @comment.css

; 文档注释查询 - 使用谓词过滤
(comment
  (#match? @comment.css "^/\\*\\*")) @comment.doc

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.css "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 统一的文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (rule_set
      selectors: (selector_list
        (selector) @selector.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @selector.name)
  )
  (
    (comment)* @doc
    .
    (media_query
      (media_feature) @media.feature)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @media.feature)
  )
  (
    (comment)* @doc
    .
    (at_rule) @at_rule.name
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @at_rule.name)
  )
  (
    (comment)* @doc
    .
    (declaration
      property: (property_name) @property.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @property.name)
  )
  (
    (comment)* @doc
    .
    (keyframes_statement
      name: (identifier) @keyframes.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @keyframes.name)
  )
  (
    (comment)* @doc
    .
    (font_face) @font_face.name
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @font_face.name)
  )
  (
    (comment)* @doc
    .
    (supports_statement) @supports.name
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @supports.name)
  )
  (
    (comment)* @doc
    .
    (layer_statement) @layer.name
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @layer.name)
  )
  (
    (comment)* @doc
    .
    (container_query) @container.name
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @container.name)
  )
] @documentation.any

; CSS特性和变量查询 - 使用交替模式
[
  (comment
    (#match? @comment.css "--[a-zA-Z0-9-_]+"))
  (comment
    (#match? @comment.css "(?i)webkit|moz|ms|o|browser|compat|vendor|prefix"))
  (comment
    (#match? @comment.css "(?i)mobile|tablet|desktop|responsive|breakpoint|media"))
  (comment
    (#match? @comment.css "(?i)optimize|performance|critical|above-the-fold|lazy|load"))
] @comment.css_features

; 布局和动画查询 - 使用交替模式
[
  (comment
    (#match? @comment.css "(?i)animation|transition|transform|keyframe|timing|easing"))
  (comment
    (#match? @comment.css "(?i)layout|flexbox|grid|position|display|float|clear"))
  (comment
    (#match? @comment.css "(?i)color|theme|palette|hue|saturation|brightness|contrast"))
] @comment.layout_animation

; 组件和工具查询 - 使用交替模式
[
  (comment
    (#match? @comment.css "(?i)component|module|block|element|modifier|BEM"))
  (comment
    (#match? @comment.css "(?i)utility|helper|margin|padding|spacing|typography"))
  (comment
    (#match? @comment.css "(?i)reset|normalize|base|default|initial"))
  (comment
    (#match? @comment.css "(?i)print|screen|media|query"))
] @comment.component_utility

; 可访问性和框架查询 - 使用交替模式
[
  (comment
    (#match? @comment.css "(?i)a11y|accessibility|sr-only|focus|visually-hidden"))
  (comment
    (#match? @comment.css "(?i)bootstrap|tailwind|bulma|foundation|materialize"))
  (comment
    (#match? @comment.css "(?i)sass|scss|less|stylus|postcss"))
] @comment.accessibility_framework
`;