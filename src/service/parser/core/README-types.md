# Tree-sitter 智能分段系统核心类型文档

## CodeChunk 的作用和使用

### 作用
`CodeChunk` 是一个核心数据结构，用于表示代码分段后的块。它包含：
- `content`: 代码内容
- `metadata`: 元数据，包括开始行号、结束行号、语言类型、文件路径等

### 使用位置
`CodeChunk` 在整个项目中被广泛使用，主要用于：

1. **代码分段处理**：在 `src/service/parser/processing/` 目录下的各种策略和工具中，用于表示分段后的代码块
2. **重叠计算**：在 `UnifiedOverlapCalculator` 等类中，用于计算和添加代码块之间的重叠内容
3. **代码优化**：在 `ChunkOptimizer` 等类中，用于优化代码块的大小和质量
4. **后处理**：在各种后处理器中，用于进一步处理和优化代码块

## createCache 的作用和使用

### 作用
`createCache` 是一个工厂函数，用于创建不同类型的缓存实例：
- `basic`: 基础 LRU 缓存
- `memory-aware`: 内存感知缓存
- `stats-decorated`: 带统计信息的缓存

### 使用位置
`createCache` 主要在以下位置使用：

1. **QueryCache 类**：在 `src/service/parser/core/query/QueryCache.ts` 中，用于创建三种缓存：
   - `queryCache`: 预编译查询对象缓存
   - `resultCache`: 查询结果缓存
   - `astCache`: AST对象缓存

## CodeChunkMetadata 的作用和使用

### 作用
`CodeChunkMetadata` 是 `CodeChunk` 的元数据接口，包含代码块的详细信息：
- `startLine/endLine`: 代码块的行号范围
- `language`: 编程语言类型
- `filePath`: 文件路径（可选）
- `type`: 分段类型（可选）
- `complexity`: 复杂度评分（可选）
- `nestingLevel`: 嵌套层级（可选）

### 使用位置
1. **代码分段策略**：在各种分段策略中用于记录代码块的元信息
2. **重叠计算**：用于确定代码块之间的关系和重叠范围
3. **性能优化**：用于基于复杂度和嵌套层级的优化决策

## StrategyExecutionContext 的作用和使用

### 作用
`StrategyExecutionContext` 是策略执行的上下文接口，包含执行策略所需的所有信息：
- `language`: 编程语言
- `sourceCode`: 源代码内容
- `ast`: AST根节点
- `filePath`: 文件路径（可选）
- `customParams`: 自定义参数（可选）

### 使用位置
1. **UnifiedStrategyManager**：用于传递策略执行上下文
2. **策略执行器**：各种分段策略接收此上下文来执行分段逻辑
3. **性能监控**：用于记录策略执行的性能数据

## StrategyExecutionResult 的作用和使用

### 作用
`StrategyExecutionResult` 是策略执行结果的接口，包含执行结果和性能信息：
- `chunks`: 生成的代码分段
- `executionTime`: 执行时间（毫秒）
- `processedNodes`: 处理的节点数量
- `strategyName`: 策略名称
- `success`: 是否成功
- `error`: 错误信息（可选）

### 使用位置
1. **策略管理器**：用于收集和比较不同策略的执行结果
2. **性能监控**：用于分析和优化策略性能
3. **错误处理**：用于记录和传播执行错误

## PerformanceStats 的作用和使用

### 作用
`PerformanceStats` 是性能统计信息的接口，用于记录系统或组件的性能指标：
- `executionCount`: 执行次数
- `totalExecutionTime`: 总执行时间
- `averageExecutionTime`: 平均执行时间
- `maxExecutionTime/minExecutionTime`: 最大/最小执行时间
- `successCount/failureCount`: 成功/失败次数
- `totalChunks/averageChunks`: 总分段数/平均分段数

### 使用位置
1. **性能监控系统**：在 `PerformanceMonitor` 等类中用于收集性能数据
2. **策略优先级管理**：在 `PriorityManager` 中用于评估策略性能
3. **系统健康检查**：用于评估系统整体性能状态

## QueryPattern、QueryResult 和 QueryMatch 的作用和使用

### 作用
这三个接口构成了 Tree-sitter 查询系统的核心数据结构：

- **QueryPattern**: 查询模式定义
  - `name`: 查询名称
  - `description`: 查询描述
  - `pattern`: S-expression查询模式
  - `languages`: 适用的语言
  - `captures`: 捕获名称映射
  - `conditions`: 额外的匹配条件（可选）

- **QueryResult**: 查询执行结果
  - `matches`: 匹配的节点数组
  - `executionTime`: 查询执行时间
  - `success`: 是否成功
  - `error`: 错误信息（可选）

- **QueryMatch**: 单个查询匹配
  - `node`: 匹配的节点
  - `captures`: 捕获的节点
  - `location`: 位置信息

### 使用位置
1. **TreeSitterQueryEngine**：核心查询引擎使用这些接口执行查询
2. **QueryCache**：用于缓存查询模式和结果
3. **测试工具**：在 `TestQueryExecutor` 等测试工具中用于模拟查询结果

## LanguageConfiguration 和 StrategyConfiguration 的作用和使用

### 作用
这两个接口定义了语言和策略的配置信息：

- **LanguageConfiguration**: 语言配置
  - `language`: 语言名称
  - `fileExtensions`: 文件扩展名
  - `chunkTypes`: 支持的分段类型
  - `defaultChunkConfig`: 默认分段配置
  - `syntaxRules`: 语法规则
  - `specialRules`: 特殊处理规则
  - `performanceConfig`: 性能优化配置

- **StrategyConfiguration**: 策略配置
  - `maxChunkSize/minChunkSize`: 最大/最小分段大小
  - `preserveComments/preserveEmptyLines`: 是否保留注释/空行
  - `maxNestingLevel`: 嵌套深度限制

### 使用位置
1. **LanguageConfigManager**：用于管理不同语言的配置
2. **UnifiedConfigManager**：用于统一管理所有配置
3. **策略执行**：各种策略根据配置调整行为

## IncrementalEdit 和 IncrementalParseResult 的作用和使用

### 作用
这两个接口支持增量解析功能：

- **IncrementalEdit**: 增量编辑信息
  - `type`: 编辑类型（insert/delete/replace）
  - `startPos/endPos`: 开始/结束位置
  - `newContent/oldContent`: 新/旧内容（可选）

- **IncrementalParseResult**: 增量解析结果
  - `newTree`: 新的语法树
  - `changedNodes`: 变化的节点
  - `parseTime`: 解析时间
  - `success`: 是否成功
  - `error`: 错误信息（可选）

### 使用位置
1. **增量解析系统**：用于支持代码变更时的增量更新
2. **性能优化**：避免重新解析整个文件
3. **实时编辑支持**：用于IDE等需要实时响应的场景

## CacheStats、BatchProcessingResult 和 SystemHealth 的作用和使用

### 作用
这三个接口用于系统监控和批量处理：

- **CacheStats**: 缓存统计信息
  - `hits/misses`: 缓存命中/未命中次数
  - `evictions`: 缓存驱逐次数
  - `totalRequests`: 总请求数
  - `hitRate`: 命中率
  - `astCacheSize/nodeCacheSize`: AST/节点缓存大小

- **BatchProcessingResult**: 批量处理结果
  - `filePath`: 处理的文件路径
  - `chunks`: 生成的分段
  - `processingTime`: 处理时间
  - `success`: 是否成功
  - `error`: 错误信息（可选）

- **SystemHealth**: 系统健康状态
  - `status`: 系统状态（healthy/warning/error）
  - `memoryUsage`: 内存使用情况
  - `cacheStatus`: 缓存状态
  - `performanceMetrics`: 性能指标
  - `errorCount`: 错误计数
  - `lastUpdated`: 最后更新时间

### 使用位置
1. **缓存系统**：在各种缓存实现中用于统计和监控
2. **批量处理**：在 `IndexService` 等服务中用于批量处理文件
3. **系统监控**：用于监控和评估系统整体健康状况