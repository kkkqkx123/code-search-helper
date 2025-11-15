/*
Java Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; 统一的注释查询 - 使用交替模式合并重复查询
[
  (comment) @comment.single
  (comment) @comment.multi
] @comment.any

; Javadoc文档注释查询 - 使用谓词过滤和锚点
(comment
  (#match? @comment.any "^/\\*\\*")) @comment.javadoc

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
    (class_declaration
      name: (identifier) @class.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @class.name)
  )
  (
    (comment)* @doc
    .
    (interface_declaration
      name: (identifier) @interface.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @interface.name)
  )
  (
    (comment)* @doc
    .
    (enum_declaration
      name: (identifier) @enum.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @enum.name)
  )
  (
    (comment)* @doc
    .
    (method_declaration
      name: (identifier) @method.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @method.name)
  )
  (
    (comment)* @doc
    .
    (constructor_declaration
      name: (identifier) @constructor.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @constructor.name)
  )
  (
    (comment)* @doc
    .
    (field_declaration
      declarator: (variable_declarator
        name: (identifier) @field.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @field.name)
  )
  (
    (comment)* @doc
    .
    (local_variable_declaration
      declarator: (variable_declarator
        name: (identifier) @variable.name))
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @variable.name)
  )
  (
    (comment)* @doc
    .
    (package_declaration
      (scoped_identifier) @package.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @package.name)
  )
  (
    (comment)* @doc
    .
    (annotation_type_declaration
      name: (identifier) @annotation.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @annotation.name)
  )
  (
    (comment)* @doc
    .
    (record_declaration
      name: (identifier) @record.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @record.name)
  )
] @documentation.any

; Javadoc标签查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@param\\s+\\w+"))
  (comment
    (#match? @comment.any "@return|@returns"))
  (comment
    (#match? @comment.any "@throws|@exception"))
  (comment
    (#match? @comment.any "@(since|version|author)"))
  (comment
    (#match? @comment.any "@(see|seeAlso|link|linkplain)"))
  (comment
    (#match? @comment.any "@(code|literal|example)"))
  (comment
    (#match? @comment.any "@(param|return|returns|throws|exception|see|seeAlso|since|deprecated|serial|serialField|serialData|author|version|link|linkplain|code|literal|value|inheritDoc|docRoot)"))
] @comment.javadoc_tags

; Java特性和框架查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Java\\s*\\d+|JDK\\s*\\d+|JRE\\s*\\d+|1\\.[4-9]|8|9|10|11|12|13|14|15|16|17|18|19|20|21)"))
  (comment
    (#match? @comment.any "(Spring|SpringBoot|SpringMVC|SpringData|Hibernate|JPA|MyBatis|JUnit|TestNG|Mockito|Log4j|SLF4J)"))
  (comment
    (#match? @comment.any "(Singleton|Factory|Builder|Observer|Strategy|Adapter|Decorator|Facade|Proxy|Command|Template|Iterator|Composite|Flyweight|State|Mediator|Memento|Visitor|Chain|Bridge)"))
] @comment.java_features

; 并发和性能查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Thread|Runnable|Callable|Future|Executor|ThreadPool|Lock|Mutex|Semaphore|CountDownLatch|CyclicBarrier|Atomic|Volatile|Synchronized|Concurrent)"))
  (comment
    (#match? @comment.any "(Performance|Optimize|Cache|Pool|Lazy|Eager|Immutable|Memory|GC|Garbage|Collection|Heap|Stack)"))
] @comment.concurrency_performance

; 安全和网络查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Security|Authentication|Authorization|Encryption|Hash|Salt|Password|Token|JWT|OAuth|SSL|TLS|XSS|CSRF|SQL|Injection)"))
  (comment
    (#match? @comment.any "(HTTP|REST|API|SOAP|WebSocket|TCP|UDP|Socket|Server|Client|Request|Response|JSON|XML)"))
  (comment
    (#match? @comment.any "(SQL|Database|DB|Query|Transaction|Connection|Pool|JDBC|DAO|Repository|Entity|Table|Column|Index|Primary|Foreign|Key)"))
] @comment.security_network

; 许可证头注释查询
(comment
  (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd")) @comment.license
`;