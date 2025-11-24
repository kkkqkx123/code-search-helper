# 关系提取机制流程图和架构图

## 1. 系统整体架构图

```mermaid
graph TB
    subgraph "应用层"
        RA[RelationshipAnalyzer<br/>核心关系分析器]
    end
    
    subgraph "服务层"
        QRN[QueryResultNormalizer<br/>查询结果标准化器]
        QM[QueryManager<br/>查询管理器]
        QL[QueryLoader<br/>查询加载器]
    end
    
    subgraph "管理层"
        REM1[RelationshipExtractorManager<br/>关系提取器管理器<br/>base/]
        REM2[RelationshipExtractorManager<br/>关系提取器管理器<br/>adapters/base/]
    end
    
    subgraph "适配层"
        BLA[BaseLanguageAdapter<br/>基础语言适配器]
        CLA[CLanguageAdapter<br/>C语言适配器]
        JLA[JavaScriptLanguageAdapter<br/>JS语言适配器]
        PLA[PythonLanguageAdapter<br/>Python语言适配器]
    end
    
    subgraph "提取层"
        BRE[BaseRelationshipExtractor<br/>基础关系提取器]
        CRE[CallRelationshipExtractor<br/>调用关系提取器]
        IRE[InheritanceRelationshipExtractor<br/>继承关系提取器]
        DRE[DependencyRelationshipExtractor<br/>依赖关系提取器]
        DFE[DataFlowRelationshipExtractor<br/>数据流关系提取器]
        CFE[ControlFlowRelationshipExtractor<br/>控制流关系提取器]
    end
    
    subgraph "基础层"
        CHM[CppHelperMethods<br/>C++辅助方法]
        REU[RelationshipExtractorUtils<br/>关系提取工具]
        RT[RelationshipTypes<br/>关系类型定义]
        NG[NodeIdGenerator<br/>节点ID生成器]
        CS[CacheService<br/>缓存服务]
        PM[PerformanceMonitor<br/>性能监控]
    end
    
    RA --> QRN
    QRN --> QM
    QRN --> QL
    QRN --> BLA
    BLA --> CLA
    BLA --> JLA
    BLA --> PLA
    BLA --> REM2
    REM2 --> BRE
    REM2 --> CRE
    REM2 --> IRE
    REM2 --> DRE
    REM2 --> DFE
    REM2 --> CFE
    CRE --> CHM
    IRE --> CHM
    DRE --> CHM
    BRE --> REU
    REU --> RT
    REU --> NG
    BLA --> CS
    BLA --> PM
    RA --> CS
    RA --> PM
```

## 2. 关系提取核心流程图

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant RA as RelationshipAnalyzer
    participant QRN as QueryResultNormalizer
    participant BLA as BaseLanguageAdapter
    participant REM as RelationshipExtractorManager
    participant RE as RelationshipExtractor
    participant CS as CacheService
    
    Client->>RA: 分析关系请求
    RA->>CS: 检查缓存
    alt 缓存命中
        CS-->>RA: 返回缓存结果
        RA-->>Client: 返回关系结果
    else 缓存未命中
        RA->>QRN: 标准化查询结果
        QRN->>BLA: 获取语言适配器
        BLA->>REM: 初始化关系提取器管理器
        REM->>RE: 动态加载关系提取器
        RE->>RE: 执行关系提取
        RE-->>REM: 返回关系结果
        REM-->>BLA: 返回提取的关系
        BLA-->>QRN: 返回标准化结果
        QRN-->>RA: 返回标准化结果
        RA->>RA: 转换和后处理
        RA->>CS: 缓存结果
        RA-->>Client: 返回关系结果
    end
```

## 3. 关系提取器管理器内部流程

```mermaid
flowchart TD
    A[提取关系请求] --> B[按语言筛选提取器]
    B --> C[按关系类型筛选提取器]
    C --> D[按优先级排序]
    D --> E{启用并行执行?}
    E -->|是| F[并行执行提取器]
    E -->|否| G[顺序执行提取器]
    F --> H[收集执行结果]
    G --> H
    H --> I[过滤成功结果]
    I --> J[关系去重处理]
    J --> K[生成关系键]
    K --> L[检查重复]
    L --> M{是否重复?}
    M -->|否| N[添加到结果集]
    M -->|是| O[跳过重复关系]
    N --> P{还有更多关系?}
    O --> P
    P -->|是| K
    P -->|否| Q[返回最终结果]
```

## 4. 语言适配器工作流程

```mermaid
stateDiagram-v2
    [*] --> 初始化处理上下文
    初始化处理上下文 --> 预处理查询结果
    预处理查询结果 --> 处理单个结果
    处理单个结果 --> 映射查询类型
    映射查询类型 --> 提取基本信息
    提取基本信息 --> 生成节点ID
    生成节点ID --> 创建元数据构建器
    创建元数据构建器 --> {是否为关系类型?}
    {是否为关系类型?} -->|是| 提取关系元数据
    {是否为关系类型?} -->|否| 创建符号信息
    提取关系元数据 --> 创建标准化结果
    创建符号信息 --> 创建标准化结果
    创建标准化结果 --> {还有更多结果?}
    {还有更多结果?} -->|是| 处理单个结果
    {还有更多结果?} -->|否| 后处理结果
    后处理结果 --> 缓存结果
    缓存结果 --> [*]
```

## 5. 具体关系提取器实现模式

```mermaid
classDiagram
    class BaseRelationshipExtractor {
        <<abstract>>
        +getName(): string
        +getSupportedRelationshipTypes(): RelationshipType[]
        +getRelationshipCategory(): RelationshipCategory
        +canHandle(astNode: Parser.SyntaxNode): boolean
        +extractRelationships(context: RelationshipExtractionContext): Promise~RelationshipResult[]~
        +extractMetadata(context: RelationshipExtractionContext): Promise~TMetadata~
        #validateRelationship(relationship: RelationshipResult): boolean
        #createRelationship(source, target, type, metadata): RelationshipResult
        #extractRelationshipsWithCache(context): Promise~RelationshipResult[]~
    }
    
    class CallRelationshipExtractor {
        +extractCallMetadata(result, astNode, symbolTable): RelationshipMetadata
        +extractCallRelationships(result): Array~any~
    }
    
    class InheritanceRelationshipExtractor {
        +extractInheritanceMetadata(result, astNode, symbolTable): RelationshipMetadata
        +extractInheritanceRelationships(result): Array~any~
        #determineInheritanceType(astNode): string
        #extractInheritanceNodes(astNode, inheritanceType): object
        #isInheritanceNode(astNode): boolean
    }
    
    class DependencyRelationshipExtractor {
        +extractDependencyMetadata(result, astNode, symbolTable): RelationshipMetadata
        +extractDependencyRelationships(result): Array~any~
        #determineDependencyType(astNode): string
        #extractDependencyNodes(astNode, dependencyType): object
    }
    
    BaseRelationshipExtractor <|-- CallRelationshipExtractor
    BaseRelationshipExtractor <|-- InheritanceRelationshipExtractor
    BaseRelationshipExtractor <|-- DependencyRelationshipExtractor
```

## 6. 缓存系统架构

```mermaid
graph LR
    subgraph "多级缓存系统"
        L1[Level 1: 内容级缓存<br/>RelationshipAnalyzer]
        L2[Level 2: 适配器级缓存<br/>BaseLanguageAdapter]
        L3[Level 3: 提取器级缓存<br/>BaseRelationshipExtractor]
        L4[Level 4: 系统级缓存<br/>CacheService]
    end
    
    subgraph "缓存策略"
        TTL[TTL策略<br/>30分钟默认]
        LRU[LRU淘汰<br/>大小限制]
        HASH[哈希键<br/>内容+语言+类型]
        STATS[统计信息<br/>命中率监控]
    end
    
    L1 --> L4
    L2 --> L4
    L3 --> L4
    L4 --> TTL
    L4 --> LRU
    L4 --> HASH
    L4 --> STATS
```

## 7. 关系类型分类体系

```mermaid
mindmap
  root((关系类型))
    数据流关系
      assignment
      parameter
      return
      field_access
      channel_operation
    控制流关系
      conditional
      loop
      exception
      callback
      select
      switch
      jump
    语义关系
      overrides
      overloads
      delegates
      observes
      configures
      implements
      decorates
      composes
    生命周期关系
      instantiates
      initializes
      destroys
      manages
      allocates
      releases
    并发关系
      synchronizes
      locks
      communicates
      races
      waits
      coordinates
    注解关系
      struct_tag
      comment
      directive
    调用关系
      function
      method
      constructor
      static
      callback
      builtin
      goroutine
    创建关系
      struct_instance
      slice
      map
      channel
      function
      goroutine_instance
    依赖关系
      import
      package
      qualified_identifier
    继承关系
      extends
      implements
      interface_inheritance
      struct_embedding
    引用关系
      read
      write
      declaration
      usage
```

## 8. 错误处理和降级机制

```mermaid
flowchart TD
    A[关系提取请求] --> B[尝试主要提取流程]
    B --> C{是否成功?}
    C -->|是| D[返回成功结果]
    C -->|否| E[记录错误信息]
    E --> F{错误次数超过阈值?}
    F -->|是| G[抛出异常停止处理]
    F -->|否| H[启用降级机制]
    H --> I[使用基础分析]
    I --> J[遍历AST节点]
    J --> K[基本结构识别]
    K --> L[简单关系提取]
    L --> M[返回降级结果]
    M --> N[记录降级日志]
    N --> D
```

## 9. 性能监控系统

```mermaid
graph TB
    subgraph "性能监控指标"
        RT[响应时间<br/>Response Time]
        THR[吞吐量<br/>Throughput]
        ERR[错误率<br/>Error Rate]
        CPU[CPU使用率<br/>CPU Usage]
        MEM[内存使用<br/>Memory Usage]
        CACHE[缓存命中率<br/>Cache Hit Rate]
    end
    
    subgraph "监控组件"
        PM[PerformanceMonitor<br/>性能监控器]
        LS[LoggerService<br/>日志服务]
        CS[CacheService<br/>缓存服务]
        HS[HealthCheck<br/>健康检查]
    end
    
    subgraph "监控输出"
        METRICS[性能指标]
        LOGS[日志记录]
        ALERTS[告警信息]
        REPORTS[性能报告]
    end
    
    RT --> PM
    THR --> PM
    ERR --> PM
    CPU --> PM
    MEM --> PM
    CACHE --> CS
    
    PM --> METRICS
    PM --> LOGS
    PM --> ALERTS
    PM --> REPORTS
    
    LS --> LOGS
    CS --> METRICS
    HS --> ALERTS
```

## 10. 扩展点架构

```mermaid
graph LR
    subgraph "扩展点"
        EP1[关系类型扩展点]
        EP2[语言适配器扩展点]
        EP3[提取器扩展点]
        EP4[缓存策略扩展点]
        EP5[监控扩展点]
    end
    
    subgraph "扩展机制"
        REG[注册机制<br/>Registry]
        FACTORY[工厂模式<br/>Factory]
        PLUGIN[插件系统<br/>Plugin System]
        HOOK[钩子机制<br/>Hook System]
    end
    
    subgraph "扩展实现"
        CUSTOM_REL[自定义关系提取器]
        CUSTOM_LANG[自定义语言适配器]
        CUSTOM_CACHE[自定义缓存策略]
        CUSTOM_MONITOR[自定义监控器]
    end
    
    EP1 --> REG
    EP2 --> FACTORY
    EP3 --> PLUGIN
    EP4 --> HOOK
    EP5 --> HOOK
    
    REG --> CUSTOM_REL
    FACTORY --> CUSTOM_LANG
    PLUGIN --> CUSTOM_REL
    HOOK --> CUSTOM_CACHE
    HOOK --> CUSTOM_MONITOR
```

## 11. 数据流图

```mermaid
flowchart LR
    subgraph "输入数据"
        AST[AST树]
        LANG[语言标识]
        QT[查询类型]
    end
    
    subgraph "处理流程"
        NORM[标准化处理]
        EXTRACT[关系提取]
        VALID[验证处理]
        MERGE[合并去重]
        CACHE[缓存存储]
    end
    
    subgraph "输出数据"
        REL[关系结果]
        META[元数据]
        STATS[统计信息]
    end
    
    AST --> NORM
    LANG --> NORM
    QT --> NORM
    NORM --> EXTRACT
    EXTRACT --> VALID
    VALID --> MERGE
    MERGE --> CACHE
    CACHE --> REL
    CACHE --> META
    CACHE --> STATS
```

## 12. 部署架构图

```mermaid
graph TB
    subgraph "客户端层"
        WEB[Web界面]
        API[API接口]
        CLI[命令行工具]
    end
    
    subgraph "应用层"
        APP[应用服务器]
        REL_SERVICE[关系提取服务]
        NORM_SERVICE[标准化服务]
    end
    
    subgraph "数据层"
        CACHE_DB[(缓存数据库)]
        GRAPH_DB[(图数据库)]
        VECTOR_DB[(向量数据库)]
    end
    
    subgraph "基础设施"
        MONITOR[监控系统]
        LOG[日志系统]
        CONFIG[配置中心]
    end
    
    WEB --> API
    API --> APP
    CLI --> APP
    APP --> REL_SERVICE
    APP --> NORM_SERVICE
    REL_SERVICE --> CACHE_DB
    REL_SERVICE --> GRAPH_DB
    NORM_SERVICE --> VECTOR_DB
    APP --> MONITOR
    APP --> LOG
    APP --> CONFIG
```

这些图表全面展示了关系提取机制的各个方面，从整体架构到具体实现细节，为理解和维护系统提供了清晰的视觉指导。