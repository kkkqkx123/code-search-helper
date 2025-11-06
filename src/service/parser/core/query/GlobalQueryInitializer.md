[`GlobalQueryInitializer.ts`](src/service/parser/core/query/GlobalQueryInitializer.ts:9) 的作用是作为**全局查询系统初始化管理器**，确保查询系统在整个应用生命周期内只被初始化一次，避免重复加载和潜在的资源竞争问题。

其主要功能和特点如下：

1.  **单例初始化**: 通过 `static initialized` 和 `static initializing` 两个静态属性来跟踪初始化状态。`initialize()` 方法首先检查是否已初始化，如果已完成则直接返回，防止重复执行。
2.  **并发控制**: 当多个组件同时请求初始化时，`initialize()` 方法会进入等待状态（`while (this.initializing)`），直到当前的初始化过程完成，从而保证了初始化的原子性和安全性。
3.  **依赖管理**: 它负责按正确顺序初始化查询系统的核心组件，如 `QueryRegistryImpl`。注释中明确指出，它**不应**直接调用 `QueryManager.initialize()`，以避免循环依赖问题。
4.  **状态监控**: 提供了 `isInitialized()` 和 `getStatus()` 等方法，供其他组件查询当前的初始化状态。

该类在代码库中被以下多个核心组件所使用，这些组件在初始化自身时都会调用 `GlobalQueryInitializer.initialize()` 来确保底层查询系统已准备就绪：

*   [`QueryRegistry.ts`](src/service/parser/core/query/QueryRegistry.ts:27): 查询注册表在初始化时检查全局状态，如果全局已初始化，则直接标记自身为已初始化。
*   [`QueryManager.ts`](src/service/parser/core/query/QueryManager.ts:34): 查询管理器在其 `initialize()` 方法中调用全局初始化器，确保查询系统可用。
*   [`TreeSitterQueryEngine.ts`](src/service/parser/core/query/TreeSitterQueryEngine.ts:100): Tree-sitter查询引擎在构造函数中异步初始化时，依赖全局初始化器。
*   [`TreeSitterCoreService.ts`](src/service/parser/core/parse/TreeSitterCoreService.ts:645): Tree-sitter核心服务在异步初始化查询系统时使用它。
*   [`DynamicParserManager.ts`](src/service/parser/core/parse/DynamicParserManager.ts:92): 动态解析器管理器在初始化其查询子系统时也依赖于此。

总而言之，`GlobalQueryInitializer` 是一个关键的**协调者**，它为整个解析器服务中的查询功能提供了一个安全、可靠的初始化入口，是保证系统稳定运行的基础组件。