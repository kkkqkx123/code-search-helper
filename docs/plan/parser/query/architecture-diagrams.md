# Parser Query模块架构图

## 📋 当前架构图

### 整体架构关系图

```mermaid
graph TD
    A[TreeSitterCoreService] --> B[QueryManager]
    A --> C[DynamicParserManager]
    B --> D[QueryRegistry]
    B --> E[QueryLoader]
    B --> F[QueryTransformer]
    D --> G[Constants/Queries]
    G --> H[typescript.ts]
    G --> I[javascript.ts]
    G --> J[python.ts]
    G --> K[其他语言查询文件]
    C --> L[Tree-sitter解析器实例]
    A --> M[TreeSitterQueryEngine]
    M --> D
    N[QueryRegistryCompatibility] --> D
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fce4ec
    style F fill:#f1f8e9
    style M fill:#e0f2f1
    style N fill:#f5f5f5
```

### 数据流图

```mermaid
sequenceDiagram
    participant Client
    participant TreeSitterCoreService
    participant QueryManager
    participant QueryRegistry
    participant QueryLoader
    participant QueryTransformer
    participant TreeSitterQueryEngine
    participant Constants

    Client->>TreeSitterCoreService: extractFunctions(ast, language)
    TreeSitterCoreService->>QueryManager: getQuery(language, 'functions', parser)
    QueryManager->>QueryRegistry: getPattern(language, 'functions')
    
    alt Pattern not cached
        QueryRegistry->>QueryLoader: loadLanguageQueries(language)
        QueryLoader->>Constants: import query file
        Constants-->>QueryLoader: query string
        QueryLoader->>QueryTransformer: extractPatternType(query, 'functions', language)
        QueryTransformer-->>QueryLoader: specific pattern
        QueryLoader-->>QueryRegistry: pattern
    else Pattern cached
        QueryRegistry-->>QueryManager: cached pattern
    end
    
    QueryManager-->>TreeSitterCoreService: Parser.Query
    TreeSitterCoreService->>TreeSitterQueryEngine: executeQuery(ast, pattern, language)
    TreeSitterQueryEngine-->>TreeSitterCoreService: QueryResult
    TreeSitterCoreService-->>Client: extracted functions
```

### 缓存层次图

```mermaid
graph TB
    A[查询请求] --> B{QueryManager缓存检查}
    B -->|命中| C[返回缓存结果]
    B -->|未命中| D{QueryRegistry缓存检查}
    D -->|命中| E[返回缓存模式]
    D -->|未命中| F{QueryLoader缓存检查}
    F -->|命中| G[返回缓存查询]
    F -->|未命中| H[从文件系统加载]
    H --> I[QueryTransformer处理]
    I --> J[更新所有缓存层]
    J --> K[返回结果]
    
    E --> L[创建Parser.Query]
    G --> L
    L --> M[TreeSitterQueryEngine执行]
    M --> N{结果缓存检查}
    N -->|命中| O[返回缓存结果]
    N -->|未命中| P[执行查询]
    P --> Q[缓存结果]
    Q --> R[返回结果]
    
    style B fill:#ffeb3b
    style D fill:#ff9800
    style F fill:#f44336
    style N fill:#4caf50
```

## 🚀 第一阶段优化后架构图

### 原生API集成架构

```mermaid
graph TD
    A[TreeSitterCoreService] --> B[QueryManager]
    A --> C[DynamicParserManager]
    B --> D[QueryRegistry]
    B --> E[QueryLoader]
    B --> F[QueryTransformer]
    D --> G[Constants/Queries]
    G --> H[typescript.ts]
    G --> I[javascript.ts]
    G --> J[python.ts]
    C --> K[Tree-sitter解析器实例]
    A --> L[TreeSitterQueryEngine]
    L --> D
    L --> M[QueryCache]
    L --> N[QueryPerformanceMonitor]
    O[QueryRegistryCompatibility] --> D
    
    style L fill:#e1f5fe
    style M fill:#f3e5f5
    style N fill:#e8f5e8
```

### 优化后的数据流

```mermaid
sequenceDiagram
    participant Client
    participant TreeSitterCoreService
    participant QueryManager
    participant QueryRegistry
    participant QueryCache
    participant TreeSitterQueryEngine
    participant PerformanceMonitor

    Client->>TreeSitterCoreService: extractFunctions(ast, language)
    TreeSitterCoreService->>QueryManager: getQuery(language, 'functions', parser)
    QueryManager->>QueryRegistry: getPattern(language, 'functions')
    QueryRegistry-->>QueryManager: pattern string
    QueryManager-->>TreeSitterCoreService: Parser.Query
    
    TreeSitterCoreService->>TreeSitterQueryEngine: executeQuery(ast, pattern, language)
    TreeSitterQueryEngine->>QueryCache: getQuery(language, pattern)
    
    alt Cache hit
        QueryCache-->>TreeSitterQueryEngine: cached Parser.Query
    else Cache miss
        TreeSitterQueryEngine->>QueryCache: create new Parser.Query
        QueryCache-->>TreeSitterQueryEngine: new Parser.Query
    end
    
    TreeSitterQueryEngine->>TreeSitterQueryEngine: query.matches(ast)
    TreeSitterQueryEngine->>PerformanceMonitor: recordQuery(type, time)
    TreeSitterQueryEngine-->>TreeSitterCoreService: QueryResult
    TreeSitterCoreService-->>Client: extracted functions
```

## 📁 第二阶段优化后架构图

### 新查询文件结构

```mermaid
graph TD
    A[TreeSitterCoreService] --> B[QueryManager]
    B --> C[QueryRegistry]
    B --> D[QueryLoader]
    C --> E[Constants/Queries]
    
    E --> F[typescript/]
    F --> F1[functions.ts]
    F --> F2[classes.ts]
    F --> F3[imports.ts]
    F --> F4[exports.ts]
    F --> F5[methods.ts]
    F --> F6[interfaces.ts]
    F --> F7[types.ts]
    F --> F8[properties.ts]
    F --> F9[variables.ts]
    
    E --> G[javascript/]
    G --> G1[functions.ts]
    G --> G2[classes.ts]
    G --> G3[imports.ts]
    G --> G4[exports.ts]
    
    E --> H[python/]
    H --> H1[functions.ts]
    H --> H2[classes.ts]
    H --> H3[imports.ts]
    
    style F fill:#e3f2fd
    style G fill:#f3e5f5
    style H fill:#e8f5e8
```

### 简化的查询加载流程

```mermaid
sequenceDiagram
    participant Client
    participant TreeSitterCoreService
    participant QueryManager
    participant QueryLoader
    participant QueryFiles

    Client->>TreeSitterCoreService: extractFunctions(ast, language)
    TreeSitterCoreService->>QueryManager: getQueryPattern(language, 'functions')
    QueryManager->>QueryLoader: getQuery(language, 'functions')
    
    alt New structure available
        QueryLoader->>QueryFiles: import language/queryType.ts
        QueryFiles-->>QueryLoader: specific query pattern
    else Fallback to old structure
        QueryLoader->>QueryFiles: import language.ts
        QueryFiles-->>QueryLoader: complete query
        QueryLoader->>QueryLoader: QueryTransformer.extractPatternType()
    end
    
    QueryLoader-->>QueryManager: query pattern
    QueryManager-->>TreeSitterCoreService: query pattern
    TreeSitterCoreService-->>Client: extracted functions
```

## 🔧 第三阶段可选优化架构图

### 简化接口架构

```mermaid
graph TD
    A[Client Code] --> B[SimpleQueryEngine]
    A --> C[Advanced Query API]
    
    B --> D[TreeSitterQueryEngine]
    C --> D
    
    D --> E[QueryCache]
    D --> F[QueryPerformanceMonitor]
    D --> G[QueryRegistry]
    
    G --> H[QueryLoader]
    H --> I[Optimized Query Files]
    
    style B fill:#e1f5fe
    style D fill:#f3e5f5
    style E fill:#e8f5e8
    style F fill:#fff3e0
```

### 双层API架构

```mermaid
graph TB
    subgraph "简化API层"
        A[SimpleQueryEngine.findFunctions]
        B[SimpleQueryEngine.findClasses]
        C[SimpleQueryEngine.findImports]
        D[SimpleQueryEngine.findExports]
    end
    
    subgraph "高级API层"
        E[QueryManager.getQuery]
        F[TreeSitterQueryEngine.executeQuery]
        G[QueryRegistry.getPattern]
    end
    
    subgraph "核心层"
        H[QueryCache]
        I[QueryPerformanceMonitor]
        J[QueryLoader]
        K[Query Files]
    end
    
    A --> F
    B --> F
    C --> F
    D --> F
    
    E --> G
    F --> H
    F --> I
    G --> J
    J --> K
    
    style A fill:#4caf50
    style B fill:#4caf50
    style C fill:#4caf50
    style D fill:#4caf50
    style E fill:#2196f3
    style F fill:#2196f3
    style G fill:#2196f3
```

## 📊 性能对比图

### 查询执行时间对比

```mermaid
gantt
    title 查询执行时间对比（毫秒）
    dateFormat X
    axisFormat %s
    
    section 当前实现
    函数查询     :0, 50
    类查询       :0, 60
    导入查询     :0, 40
    导出查询     :0, 45
    
    section 第一阶段优化
    函数查询     :0, 20
    类查询       :0, 25
    导入查询     :0, 15
    导出查询     :0, 18
    
    section 第二阶段优化
    函数查询     :0, 15
    类查询       :0, 18
    导入查询     :0, 12
    导出查询     :0, 14
```

### 缓存命中率对比

```mermaid
pie title 当前缓存命中率
    "查询缓存" : 75
    "模式缓存" : 80
    "结果缓存" : 65
    "未命中" : 15
```

```mermaid
pie title 优化后缓存命中率
    "查询缓存" : 90
    "模式缓存" : 95
    "结果缓存" : 85
    "未命中" : 5
```

## 🔄 组件交互图

### 详细组件交互

```mermaid
graph LR
    subgraph "客户端层"
        A[TreeSitterCoreService]
    end
    
    subgraph "查询管理层"
        B[QueryManager]
        C[QueryRegistry]
        D[QueryLoader]
        E[QueryTransformer]
    end
    
    subgraph "执行层"
        F[TreeSitterQueryEngine]
        G[QueryCache]
        H[PerformanceMonitor]
    end
    
    subgraph "存储层"
        I[Constants/Queries]
        J[LRU Caches]
    end
    
    A --> B
    B --> C
    B --> F
    C --> D
    C --> E
    D --> I
    F --> G
    F --> H
    G --> J
    C --> J
    B --> J
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style F fill:#e8f5e8
    style I fill:#fff3e0
```

### 错误处理流程

```mermaid
flowchart TD
    A[查询请求] --> B{QueryManager初始化?}
    B -->|否| C[初始化QueryManager]
    C --> D{初始化成功?}
    D -->|否| E[抛出初始化错误]
    D -->|是| F[继续处理]
    B -->|是| F
    
    F --> G{查询模式存在?}
    G -->|否| H[返回空结果]
    G -->|是| I[创建Parser.Query]
    
    I --> J{Query创建成功?}
    J -->|否| K[记录错误日志]
    K --> L[回退到硬编码实现]
    J -->|是| M[执行查询]
    
    M --> N{查询执行成功?}
    N -->|否| O[记录错误日志]
    O --> P[返回空结果]
    N -->|是| Q[缓存结果]
    Q --> R[返回查询结果]
    
    L --> S{硬编码实现成功?}
    S -->|否| T[返回错误]
    S -->|是| U[返回硬编码结果]
    
    style E fill:#ff5252
    style H fill:#ff9800
    style K fill:#ff9800
    style O fill:#ff9800
    style T fill:#ff5252
    style R fill:#4caf50
    style U fill:#4caf50
```

## 📈 监控架构图

### 性能监控系统

```mermaid
graph TD
    A[QueryPerformanceMonitor] --> B[指标收集]
    B --> C[执行时间]
    B --> D[缓存命中率]
    B --> E[错误率]
    B --> F[内存使用]
    
    C --> G[时间序列数据库]
    D --> G
    E --> G
    F --> G
    
    G --> H[性能分析引擎]
    H --> I[趋势分析]
    H --> J[异常检测]
    H --> K[性能报告]
    
    I --> L[性能仪表板]
    J --> M[告警系统]
    K --> N[定期报告]
    
    style A fill:#e1f5fe
    style G fill:#f3e5f5
    style H fill:#e8f5e8
    style L fill:#fff3e0
    style M fill:#ffebee
    style N fill:#e8f5e8
```

### 缓存监控架构

```mermaid
graph TB
    A[QueryCache] --> B[缓存统计]
    C[PatternCache] --> B
    D[ResultCache] --> B
    
    B --> E[缓存命中率]
    B --> F[缓存大小]
    B --> G[淘汰次数]
    B --> H[内存占用]
    
    E --> I[缓存优化建议]
    F --> I
    G --> I
    H --> I
    
    I --> J[自动调优]
    J --> K[缓存大小调整]
    J --> L[淘汰策略优化]
    
    style A fill:#4caf50
    style C fill:#2196f3
    style D fill:#ff9800
    style I fill:#9c27b0
    style J fill:#f44336
```

## 🎯 架构演进路径

### 演进时间线

```mermaid
timeline
    title Parser Query模块架构演进
    
    section 当前状态
        模拟实现 : TreeSitterQueryEngine使用模拟实现
        单一文件 : 查询模式集中在单一文件中
        多层转换 : QueryTransformer处理模式提取
    
    section 第一阶段优化
        原生API : 集成tree-sitter原生Query API
        预编译缓存 : 实现QueryCache提升性能
        性能监控 : 添加QueryPerformanceMonitor
    
    section 第二阶段优化
        文件分离 : 按用途分离查询文件
        简化加载 : 减少QueryTransformer依赖
        回退机制 : 支持新旧结构平滑迁移
    
    section 第三阶段优化
        简化接口 : 提供SimpleQueryEngine
        双层API : 保持高级API的同时提供简化接口
        持续优化 : 基于使用数据持续改进
```

### 技术债务清理

```mermaid
graph LR
    subgraph "技术债务"
        A[模拟实现]
        B[复杂转换]
        C[单一文件]
        D[性能瓶颈]
    end
    
    subgraph "解决方案"
        E[原生API]
        F[直接查询]
        G[文件分离]
        H[缓存优化]
    end
    
    subgraph "收益"
        I[性能提升50-80%]
        J[维护性提升]
        K[扩展性增强]
        L[用户体验改善]
    end
    
    A --> E
    B --> F
    C --> G
    D --> H
    
    E --> I
    F --> J
    G --> K
    H --> L
    
    style A fill:#ff5252
    style B fill:#ff5252
    style C fill:#ff5252
    style D fill:#ff5252
    style E fill:#4caf50
    style F fill:#4caf50
    style G fill:#4caf50
    style H fill:#4caf50
    style I fill:#2196f3
    style J fill:#2196f3
    style K fill:#2196f3
    style L fill:#2196f3
```

这些架构图清晰地展示了Parser Query模块的当前状态、优化路径和最终目标，为实施团队提供了可视化的指导。