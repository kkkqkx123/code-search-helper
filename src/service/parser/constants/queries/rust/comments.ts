/*
Rust Language Comment-specific Tree-Sitter Query Patterns
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

; Rust文档注释查询 - 双斜杠
(comment
  (#match? @comment.any "^///")) @comment.rust_doc

; Rust模块文档注释查询 - 感叹号
(comment
  (#match? @comment.any "^//!")) @comment.module_doc

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
    (function_item
      name: (identifier) @function.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @function.name)
  )
  (
    (comment)* @doc
    .
    (struct_item
      name: (type_identifier) @struct.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @struct.name)
  )
  (
    (comment)* @doc
    .
    (enum_item
      name: (type_identifier) @enum.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @enum.name)
  )
  (
    (comment)* @doc
    .
    (trait_item
      name: (type_identifier) @trait.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @trait.name)
  )
  (
    (comment)* @doc
    .
    (mod_item
      name: (identifier) @module.name)
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @module.name)
  )
  (
    (comment)* @doc
    .
    (impl_item) @impl.item
    (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
    (#select-adjacent! @doc @impl.item)
  )
] @documentation.any

; Rust文档注释标签查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "@(param|return|returns|type|typeparam|see|example|deprecated|since|version|author|license|copyright|panic|safety|no_panic|must_use|allow|warn|deny|forbid|derive|cfg|feature|doc)"))
] @comment.rust_doc_tags

; Rust特性和安全查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(Rust\\s*\\d+\\.\\d+|rustc|1\\.\\d+\\.\\d+|stable|beta|nightly|edition\\s*2015|edition\\s*2018|edition\\s*2021)"))
  (comment
    (#match? @comment.any "(unsafe|safety|panic|unwind|memory|safety|borrow|checker|lifetime|ownership|move|copy|clone|drop)"))
  (comment
    (#match? @comment.any "(thread|async|await|future|stream|sync|mutex|rwlock|condvar|atomic|channel|mpsc|oneshot|watch|tokio|async-std)"))
  (comment
    (#match? @comment.any "(error|result|option|unwrap|expect|panic|catch|recover|failure|exception|try|\\?|!)"))
] @comment.rust_features

; 宏和泛型查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(macro|macro_rules|proc_macro|derive|attribute|codegen|compile_time|metaprogramming)"))
  (comment
    (#match? @comment.any "(generic|type|parameter|trait|bound|lifetime|where|impl|for|dyn|associated|type)"))
] @comment.macros_generics

; 性能和内存查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(performance|optimize|zero|cost|abstraction|inline|no_inline|cold|hot|cache|prefetch|simd|vector|parallel)"))
  (comment
    (#match? @comment.any "(memory|allocation|heap|stack|box|rc|arc|cell|refcell|borrow|cow|pool|arena|bump)"))
] @comment.performance_memory

; FFI和序列化查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(ffi|foreign|function|interface|c|abi|extern|link|name|stdcall|cdecl|system)"))
  (comment
    (#match? @comment.any "(serialize|deserialize|serde|json|xml|bincode|toml|yaml|pickle|protobuf|flatbuffers)"))
] @comment.ffi_serialization

; 网络和数据库查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(network|tcp|udp|http|https|websocket|tokio|async|net|socket|server|client|request|response)"))
  (comment
    (#match? @comment.any "(database|db|sql|nosql|diesel|sqlx|postgres|mysql|sqlite|redis|mongodb|connection|pool|transaction)"))
] @comment.network_database

; 生态系统和工具查询 - 使用交替模式
[
  (comment
    (#match? @comment.any "(web|http|server|framework|actix|warp|rocket|axum|tide|hyper|request|response|middleware|route|handler)"))
  (comment
    (#match? @comment.any "(embedded|no_std|cortex|m|arm|avr|microcontroller|hardware|register|interrupt|dma|gpio|spi|i2c|uart)"))
  (comment
    (#match? @comment.any "(game|gamedev|bevy|amethyst|fyrox|engine|ecs|entity|component|system|resource|render|graphics|vulkan|opengl)"))
  (comment
    (#match? @comment.any "(cli|command|line|tool|arg|clap|structopt|console|terminal|ansi|color|progress|spinner|dialog)"))
] @comment.ecosystem_tools

; 许可证头注释查询
(comment
  (#match? @comment.any "(?i)copyright|license|gpl|mit|apache|bsd")) @comment.license
`;