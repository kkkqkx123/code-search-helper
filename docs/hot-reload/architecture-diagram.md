# 热更新功能架构图

## 整体架构图

```mermaid
graph TB
    subgraph "应用层"
        A[主应用 main.ts]
    end
    
    subgraph "服务层"
        B[ProjectHotReloadService]
        C[IndexService]
    end
    
    subgraph "核心功能层"
        D[ChangeDetectionService]
        E[FileWatcherService]
        F[FileSystemTraversal]
    end
    
    subgraph "支持服务层"
        G[HotReloadConfigService]
        H[HotReloadMonitoringService]
        I[HotReloadRecoveryService]
        J[HotReloadErrorPersistenceService]
        K[ErrorHandlerService]
    end
    
    subgraph "外部资源"
        L[文件系统]
        M[配置文件]
        N[错误日志文件]
    end
    
    A --> B
    A --> C
    B --> D
    B --> G
    B --> H
    B --> I
    B --> J
    B --> K
    
    D --> E
    D --> F
    D --> I
    D --> K
    
    E --> F
    E --> I
    E --> K
    
    G --> M
    J --> N
    
    E --> L
    F --> L
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#bbf,stroke:#333,stroke-width:2px
    style E fill:#bbf,stroke:#333,stroke-width:2px
    style F fill:#bbf,stroke:#333,stroke-width:2px
    style G fill:#f96,stroke:#333,stroke-width:2px
    style H fill:#f96,stroke:#333,stroke-width:2px
    style I fill:#f96,stroke:#333,stroke-width:2px
    style J fill:#f96,stroke:#333,stroke-width:2px
    style K fill:#f96,stroke:#333,stroke-width:2px
```

## 文件变更检测流程图

```mermaid
sequenceDiagram
    participant FS as 文件系统
    participant FWS as FileWatcherService
    participant CDS as ChangeDetectionService
    participant PHRS as ProjectHotReloadService
    participant HMS as HotReloadMonitoringService
    participant IS as IndexService
    
    FS->>FWS: 文件变更事件
    FWS->>FWS: 事件队列处理
    FWS->>FWS: 文件过滤检查
    FWS->>FWS: 文件信息获取
    FWS->>CDS: 文件变更通知
    
    alt 文件添加
        CDS->>CDS: 处理文件添加
        CDS->>CDS: 计算文件哈希
        CDS->>CDS: 更新文件历史
    else 文件修改
        CDS->>CDS: 防抖处理
        CDS->>CDS: 比较文件哈希
        CDS->>CDS: 确认实际变更
    else 文件删除
        CDS->>CDS: 处理文件删除
        CDS->>CDS: 清理文件记录
    end
    
    CDS->>PHRS: 变更事件通知
    PHRS->>HMS: 更新指标
    PHRS->>IS: 触发索引更新
    
    alt 处理成功
        HMS->>HMS: 记录成功指标
        IS->>IS: 更新索引
    else 处理失败
        PHRS->>PHRS: 错误处理
        PHRS->>HMS: 记录错误指标
        PHRS->>HRS: 触发错误恢复
    end
```

## 错误处理流程图

```mermaid
flowchart TD
    A[错误发生] --> B{错误类型判断}
    
    B -->|FILE_WATCH_FAILED| C[文件监视失败]
    B -->|CHANGE_DETECTION_FAILED| D[变更检测失败]
    B -->|INDEX_UPDATE_FAILED| E[索引更新失败]
    B -->|PERMISSION_DENIED| F[权限错误]
    B -->|FILE_TOO_LARGE| G[文件过大]
    B -->|PROJECT_NOT_FOUND| H[项目未找到]
    B -->|其他错误| I[未知错误]
    
    C --> J[记录错误报告]
    D --> J
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J
    
    J --> K{是否可重试}
    
    K -->|是| L[执行重试逻辑]
    K -->|否| M[记录错误日志]
    
    L --> N{重试次数检查}
    N -->|未超限| O[等待重试延迟]
    N -->|已超限| M
    
    O --> P[执行恢复操作]
    P --> Q{恢复是否成功}
    
    Q -->|成功| R[更新恢复统计]
    Q -->|失败| S[记录恢复失败]
    
    R --> T[错误处理完成]
    M --> T
    S --> T
```

## 配置管理架构图

```mermaid
graph LR
    subgraph "配置源"
        A[默认配置]
        B[全局配置文件]
        C[项目配置文件]
        D[环境变量]
    end
    
    subgraph "配置管理"
        E[HotReloadConfigService]
    end
    
    subgraph "配置消费者"
        F[ProjectHotReloadService]
        G[ChangeDetectionService]
        H[FileWatcherService]
        I[HotReloadMonitoringService]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    E --> G
    E --> H
    E --> I
    
    style E fill:#f96,stroke:#333,stroke-width:2px
```

## 监控和指标收集架构图

```mermaid
graph TB
    subgraph "数据源"
        A[文件变更事件]
        B[错误事件]
        C[性能数据]
        D[系统资源]
    end
    
    subgraph "监控服务"
        E[HotReloadMonitoringService]
    end
    
    subgraph "数据处理"
        F[指标聚合]
        G[警报检查]
        H[历史记录]
    end
    
    subgraph "输出"
        I[性能报告]
        J[警报通知]
        K[监控仪表板]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    E --> G
    E --> H
    
    F --> I
    G --> J
    H --> K
    
    style E fill:#f96,stroke:#333,stroke-width:2px
```

## 组件依赖关系图

```mermaid
graph TD
    subgraph "核心组件"
        A[ProjectHotReloadService]
        B[ChangeDetectionService]
        C[FileWatcherService]
    end
    
    subgraph "支持组件"
        D[HotReloadConfigService]
        E[HotReloadMonitoringService]
        F[HotReloadRecoveryService]
        G[HotReloadErrorPersistenceService]
        H[ErrorHandlerService]
        I[FileSystemTraversal]
    end
    
    subgraph "外部依赖"
        J[chokidar]
        K[文件系统]
        L[配置文件]
        M[日志文件]
    end
    
    A --> B
    A --> D
    A --> E
    A --> F
    A --> G
    A --> H
    
    B --> C
    B --> I
    B --> F
    B --> H
    
    C --> I
    C --> J
    C --> F
    C --> H
    
    D --> L
    G --> M
    
    C --> K
    I --> K
    
    style A fill:#bbf,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#f96,stroke:#333,stroke-width:2px
    style E fill:#f96,stroke:#333,stroke-width:2px
    style F fill:#f96,stroke:#333,stroke-width:2px
    style G fill:#f96,stroke:#333,stroke-width:2px
    style H fill:#f96,stroke:#333,stroke-width:2px
    style I fill:#f96,stroke:#333,stroke-width:2px
```

## 数据流图

```mermaid
flowchart LR
    A[文件系统变更] --> B[FileWatcherService]
    B --> C[事件队列]
    C --> D[文件过滤]
    D --> E[文件信息获取]
    E --> F[ChangeDetectionService]
    F --> G[变更类型判断]
    G --> H[哈希比较]
    H --> I[变更确认]
    I --> J[ProjectHotReloadService]
    J --> K[指标更新]
    J --> L[索引更新]
    K --> M[HotReloadMonitoringService]
    L --> N[IndexService]
    
    subgraph "错误处理"
        O[错误捕获]
        P[错误分类]
        Q[恢复策略]
        R[错误记录]
    end
    
    B --> O
    F --> O
    J --> O
    O --> P
    P --> Q
    Q --> R
    R --> S[HotReloadErrorPersistenceService]
```

## 热更新生命周期图

```mermaid
stateDiagram-v2
    [*] --> 初始化
    初始化 --> 配置加载
    配置加载 --> 文件扫描
    文件扫描 --> 哈希计算
    哈希计算 --> 监控启动
    监控启动 --> 运行中
    
    运行中 --> 文件变更检测: 文件系统事件
    文件变更检测 --> 变更处理: 确认变更
    变更处理 --> 索引更新
    索引更新 --> 运行中
    
    运行中 --> 错误处理: 发生错误
    错误处理 --> 恢复尝试: 可恢复错误
    错误处理 --> 错误记录: 不可恢复错误
    恢复尝试 --> 运行中: 恢复成功
    恢复尝试 --> 错误记录: 恢复失败
    错误记录 --> 运行中
    
    运行中 --> 停止监控: 停止请求
    停止监控 --> 清理资源
    清理资源 --> [*]