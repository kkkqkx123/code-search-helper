/*
Python Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; Python注释查询 - Python只支持#格式的注释
(comment) @comment.python

; 文档字符串查询 - 三引号字符串
(string
  (#match? @comment.python '"""')) @comment.docstring

; TODO/FIXME注释查询 - 使用谓词过滤
(comment
  (#match? @comment.python "TODO|FIXME|XXX|HACK|NOTE|BUG|WARN|WARNING")) @comment.todo

; 统一的文档注释查询 - 使用交替模式和锚点
[
  (
    (comment)* @doc
    .
    (function_definition
      name: (identifier) @function.name)
    (#strip! @doc "^[\\s#]+|^[\\s#]$")
    (#select-adjacent! @doc @function.name)
  )
  (
    (comment)* @doc
    .
    (class_definition
      name: (identifier) @class.name)
    (#strip! @doc "^[\\s#]+|^[\\s#]$")
    (#select-adjacent! @doc @class.name)
  )
  (
    (comment)* @doc
    .
    (class_definition
      body: (block
        (function_definition
          name: (identifier) @method.name)))
    (#strip! @doc "^[\\s#]+|^[\\s#]$")
    (#select-adjacent! @doc @method.name)
  )
  (
    (comment)* @doc
    .
    (assignment
      left: (identifier) @variable.name)
    (#strip! @doc "^[\\s#]+|^[\\s#]$")
    (#select-adjacent! @doc @variable.name)
  )
  (
    (comment)* @doc
    .
    (import_statement) @import.statement
    (#strip! @doc "^[\\s#]+|^[\\s#]$")
    (#select-adjacent! @doc @import.statement)
  )
] @documentation.any

; Python文档字符串标签查询 - 使用交替模式
(string
  (#match? @comment.docstring ":(param|parameter|arg|argument|type|return|returns|rtype|raises|raise|except|exception|yield|ytype|var|ivar|cvar|type|note|warning|todo|deprecated|since|version|author|license|copyright|see|example|references|todo|note|warning)")) @comment.docstring_tag

; Python特性和框架查询 - 使用交替模式
[
  (comment
    (#match? @comment.python "(Python\\s*\\d+\\.\\d+|py\\d+|2\\.7|3\\.\\d+|3\\.6|3\\.7|3\\.8|3\\.9|3\\.10|3\\.11|3\\.12|3\\.13)"))
  (comment
    (#match? @comment.python "(Django|Flask|FastAPI|Tornado|Bottle|Pyramid|SQLAlchemy|Pandas|NumPy|SciPy|Matplotlib|Scikit-learn|TensorFlow|PyTorch|Keras|Celery|Redis|MongoDB|PostgreSQL|MySQL)"))
  (comment
    (#match? @comment.python "(async|await|asyncio|coroutine|Future|Task|EventLoop|async\\s+def|await\\s+)"))
  (comment
    (#match? @comment.python "(decorator|@|property|staticmethod|classmethod|dataclass|wrapper|cache|lru_cache|functools)"))
  (comment
    (#match? @comment.python "(type|hint|typing|Union|Optional|List|Dict|Set|Tuple|Callable|Iterator|Generator|Protocol|TypeVar|Generic|Any|NoReturn)"))
] @comment.python_features

; 测试和性能查询 - 使用交替模式
[
  (comment
    (#match? @comment.python "(test|unittest|pytest|nose|doctest|mock|fixture|parametrize|assert|setUp|tearDown|TestCase)"))
  (comment
    (#match? @comment.python "(performance|optimize|profile|cProfile|timeit|memory|cache|memoization|lazy|generator|yield|comprehension)"))
  (comment
    (#match? @comment.python "(threading|multiprocessing|concurrent|futures|ThreadPool|ProcessPool|Queue|Lock|Semaphore|Event|Condition|Barrier)"))
] @comment.test_performance

; 数据处理和机器学习查询 - 使用交替模式
[
  (comment
    (#match? @comment.python "(pandas|numpy|dataframe|series|array|matrix|vector|csv|json|xml|sql|database|query|etl|pipeline)"))
  (comment
    (#match? @comment.python "(machine|learning|ML|AI|model|train|test|predict|classify|regress|cluster|neural|deep|learning|tensorflow|pytorch|sklearn)"))
  (comment
    (#match? @comment.python "(web|API|REST|HTTP|request|response|server|client|flask|django|fastapi|wsgi|asgi|middleware|route|endpoint)"))
] @comment.data_ml_web

; 安全和配置查询 - 使用交替模式
[
  (comment
    (#match? @comment.python "(security|auth|authentication|authorization|password|hash|encrypt|decrypt|token|jwt|ssl|tls|https|csrf|xss)"))
  (comment
    (#match? @comment.python "(config|configuration|settings|env|environment|yaml|json|toml|ini|cfg|properties)"))
  (comment
    (#match? @comment.python "(log|logging|logger|debug|info|warn|warning|error|critical|exception|handler|formatter|filter)"))
] @comment.security_config

; 许可证头注释查询
(comment
  (#match? @comment.python "(?i)copyright|license|gpl|mit|apache|bsd")) @comment.license
`;