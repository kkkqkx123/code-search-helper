/*
C# Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 单行注释查询
(comment) @comment.single

; 多行注释查询
(comment) @comment.multi

; XML文档注释查询 - 使用谓词过滤
(comment
  (#match? @comment.multi "^/\\*\\*")) @comment.doc

; XML文档注释查询 - 三斜杠风格
(comment
  (#match? @comment.single "^///")) @comment.xml_doc

; TODO/FIXME注释查询
(comment
  (#match? @comment.single "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 内联注释查询
(comment) @comment.inline

; XML文档注释标签查询
[
  (comment
    (#match? @comment.multi "<(summary|remarks|returns|param|paramref|exception|see|seealso|example|code|para|c|list|listheader|item|description|term|include|inheritdoc|permission|value|typeparam|typeparamref)>"))
  (comment
    (#match? @comment.single "<(summary|remarks|returns|param|paramref|exception|see|seealso|example|code|para|c|list|listheader|item|description|term|include|inheritdoc|permission|value|typeparam|typeparamref)>"))
] @comment.xml_tag

; 函数/方法文档注释查询
(
  (comment)* @doc
  .
  (method_declaration
    name: (identifier) @method.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @method.name)
) @method.documentation

; 类文档注释查询
(
  (comment)* @doc
  .
  (class_declaration
    name: (identifier) @class.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @class.name)
) @class.documentation

; 接口文档注释查询
(
  (comment)* @doc
  .
  (interface_declaration
    name: (identifier) @interface.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @interface.name)
) @interface.documentation

; 结构体文档注释查询
(
  (comment)* @doc
  .
  (struct_declaration
    name: (identifier) @struct.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @struct.name)
) @struct.documentation

; 枚举文档注释查询
(
  (comment)* @doc
  .
  (enum_declaration
    name: (identifier) @enum.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @enum.name)
) @enum.documentation

; 属性文档注释查询
(
  (comment)* @doc
  .
  (property_declaration
    name: (identifier) @property.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @property.name)
) @property.documentation

; 字段文档注释查询
(
  (comment)* @doc
  .
  (field_declaration
    declarator: (variable_declarator
      name: (identifier) @field.name))
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @field.name)
) @field.documentation

; 命名空间文档注释查询
(
  (comment)* @doc
  .
  (namespace_declaration
    name: (identifier) @namespace.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @namespace.name)
) @namespace.documentation

; 委托文档注释查询
(
  (comment)* @doc
  .
  (delegate_declaration
    name: (identifier) @delegate.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @delegate.name)
) @delegate.documentation

; 事件文档注释查询
(
  (comment)* @doc
  .
  (event_declaration
    name: (identifier) @event.name)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @event.name)
) @event.documentation

; XML参数注释查询
[
  (comment
    (#match? @comment.multi "<param.*name=.*>"))
  (comment
    (#match? @comment.single "<param.*name=.*>"))
] @comment.param

; XML返回值注释查询
[
  (comment
    (#match? @comment.multi "<returns>"))
  (comment
    (#match? @comment.single "<returns>"))
] @comment.return

; XML异常注释查询
[
  (comment
    (#match? @comment.multi "<exception.*>"))
  (comment
    (#match? @comment.single "<exception.*>"))
] @comment.exception

; XML类型参数注释查询
[
  (comment
    (#match? @comment.multi "<typeparam.*name=.*>"))
  (comment
    (#match? @comment.single "<typeparam.*name=.*>"))
] @comment.typeparam

; XML示例代码注释查询
[
  (comment
    (#match? @comment.multi "<(code|example)>"))
  (comment
    (#match? @comment.single "<(code|example)>"))
] @comment.example

; XML引用注释查询
[
  (comment
    (#match? @comment.multi "<(see|seealso).*>"))
  (comment
    (#match? @comment.single "<(see|seealso).*>"))
] @comment.reference

; 许可证头注释查询
(comment
  (#match? @comment.multi "(?i)copyright|license|gpl|mit|apache|bsd")) @comment.license

; 编译器指令注释查询
(comment
  (#match? @comment.single "#(pragma|warning|error|define|undef|ifdef|ifndef|if|else|elif|endif|region|endregion)")) @comment.directive

; .NET特性注释查询
(comment
  (#match? @comment.single "\\[(Attribute|Obsolete|Conditional|Serializable|Flags|DllImport|STAThread|MTAThread)\\]")) @comment.attribute

; 异步编程注释查询
(comment
  (#match? @comment.single "(async|await|Task|ValueTask|IAsyncEnumerable)")) @comment.async

; LINQ查询注释查询
(comment
  (#match? @comment.single "(from|where|select|group|join|into|orderby|let)")) @comment.linq

; 性能优化注释查询
(comment
  (#match? @comment.single "(TODO|FIXME|OPTIMIZE|PERF|HOTPATH|CRITICAL|CACHE|POOL)")) @comment.performance

; 线程安全注释查询
(comment
  (#match? @comment.single "(THREAD|LOCK|MUTEX|ATOMIC|CONCURRENT|VOLATILE|INTERLOCKED)")) @comment.threading

; 内存管理注释查询
(comment
  (#match? @comment.single "(IDisposable|using|GC|Memory|Span|MemoryManager)")) @comment.memory

; 序列化注释查询
(comment
  (#match? @comment.single "(Serializable|DataContract|JsonObject|JsonProperty|Xml|Binary)")) @comment.serialization
`;