# NebulaService 架构图说明

## 📊 当前架构（问题状态）

### 架构图
```mermaid
graph TB
    subgraph "NebulaService (单体服务 - 1000+ 行)"
        NS[NebulaService]
        
        subgraph "内部职责混杂"
            CM[连接管理]
            QE[查询执行]
            DO[数据操作]
            PM[项目管理]
            EH[错误处理]
            LH[日志处理]
            EV[事件处理]
            HC[健康检查]
        end
        
        NS --> CM
        NS --> QE
        NS --> DO
        NS --> PM
        NS --> EH
        NS --> LH
        NS --> EV
        NS --> HC
    end
    
    subgraph "依赖注入 (14个依赖)"
        D1[DatabaseLoggerService]
        D2[ErrorHandlerService]
        D3[ConfigService]
        D4[NebulaConnectionManager]
        D5[NebulaDataService]
        D6[NebulaSpaceService]
        D7[NebulaQueryBuilder]
        D8[NebulaProjectManager]
        D9[NebulaEventManager]
        D10[INebulaQueryService]
        D11[INebulaTransactionService]
        D12[INebulaDataOperations]
        D13[INebulaSchemaManager]
        D14[INebulaIndexManager]
    end
    
    NS -.-> D1
    NS -.-> D2
    NS -.-> D3
    NS -.-> D4
    NS -.-> D5
    NS -.-> D6
    NS -.-> D7
    NS -.-> D8
    NS -.-> D9
    NS -.-> D10
    NS -.-> D11
    NS -.-> D12
    NS -.-> D13
    NS -.-> D14
```

### 当前问题分析
- **🟥 违反单一职责原则**: 一个类承担8个不同职责
- **🟥 代码重复严重**: `executeReadQuery` 和 `executeWriteQuery` 90%+ 重复
- **🟥 依赖过多**: 14个依赖项，耦合度高
- **🟥 可测试性差**: 难以进行单元测试
- **🟥 维护困难**: 任何修改都可能影响多个功能

## 🎯 优化后架构（目标状态）

### 架构图
```mermaid
graph TB
    subgraph "NebulaFacade (轻量级门面 - <300 行)"
        NF[NebulaFacade]
        
        NF --> CS
        NF --> QS
        NF --> DS
        NF --> PS
        NF --> HS
    end
    
    subgraph "专注服务集群"
        CS[NebulaConnectionService<br/>连接管理]
        QS[NebulaQueryExecutorService<br/>查询执行]
        DS[NebulaDataService<br/>数据操作]
        PS[NebulaProjectService<br/>项目管理]
        HS[NebulaHealthService<br/>健康检查]
        ES[NebulaEventService<br/>事件处理]
    end
    
    subgraph "底层基础设施"
        CM[NebulaConnectionManager]
        QM[INebulaQueryService]
        TM[INebulaTransactionService]
        DM[INebulaDataOperations]
        PM[NebulaProjectManager]
        LM[DatabaseLoggerService]
        EM[ErrorHandlerService]
    end
    
    CS --> CM
    QS --> QM
    QS --> TM
    DS --> DM
    PS --> PM
    HS --> CM
    ES --> LM
    ES --> EM
    
    style NF fill:#e1f5fe
    style CS fill:#f3e5f5
    style QS fill:#e8f5e8
    style DS fill:#fff3e0
    style PS fill:#fce4ec
    style HS fill:#e0f2f1
    style ES fill:#fff9c4
```

### 优化后优势
- **🟩 单一职责**: 每个服务只负责一个明确领域
- **🟩 代码复用**: 消除重复逻辑，提高代码复用率
- **🟩 依赖清晰**: 依赖关系明确，耦合度降低
- **🟩 易于测试**: 每个服务都可以独立测试
- **🟩 维护简单**: 修改一个功能只需修改一个服务

## 🔄 服务职责划分

### 1. NebulaConnectionService (连接服务)
```mermaid
graph LR
    CS[NebulaConnectionService]
    
    CS --> M1[initialize]
    CS --> M2[reconnect]
    CS --> M3[isConnected]
    CS --> M4[close]
    CS --> M5[isInitialized]
    
    style CS fill:#f3e5f5
```

**职责**: 专负责连接状态管理、重连逻辑、连接健康检查

### 2. NebulaQueryExecutorService (查询执行服务)
```mermaid
graph LR
    QS[NebulaQueryExecutorService]
    
    QS --> M1[executeReadQuery]
    QS --> M2[executeWriteQuery]
    QS --> M3[executeTransaction]
    QS --> M4[validateQuery]
    
    style QS fill:#e8f5e8
```

**职责**: 专负责所有查询执行、事务处理、查询验证

### 3. NebulaDataService (数据服务)
```mermaid
graph LR
    DS[NebulaDataService]
    
    DS --> M1[insertNodes]
    DS --> M2[insertRelationships]
    DS --> M3[findNodesByLabel]
    DS --> M4[findRelationships]
    DS --> M5[updateNode]
    DS --> M6[updateRelationship]
    
    style DS fill:#fff3e0
```

**职责**: 专负责数据CRUD操作、批量数据处理

### 4. NebulaProjectService (项目服务)
```mermaid
graph LR
    PS[NebulaProjectService]
    
    PS --> M1[createSpaceForProject]
    PS --> M2[deleteSpaceForProject]
    PS --> M3[getSpaceInfoForProject]
    PS --> M4[clearSpaceForProject]
    
    style PS fill:#fce4ec
```

**职责**: 专负责项目空间管理、项目相关操作

### 5. NebulaHealthService (健康服务)
```mermaid
graph LR
    HS[NebulaHealthService]
    
    HS --> M1[healthCheck]
    HS --> M2[getDatabaseStats]
    HS --> M3[monitorPerformance]
    
    style HS fill:#e0f2f1
```

**职责**: 专负责健康检查、性能监控、统计信息

### 6. NebulaEventService (事件服务)
```mermaid
graph LR
    ES[NebulaEventService]
    
    ES --> M1[addEventListener]
    ES --> M2[removeEventListener]
    ES --> M3[emitEvent]
    ES --> M4[handleEventRouting]
    
    style ES fill:#fff9c4
```

**职责**: 专负责事件处理、事件路由、监听器管理

## 📈 架构迁移路线图

### 阶段1: 基础架构搭建 (Week 1)
```mermaid
gantt
    title 阶段1: 基础架构搭建
    dateFormat YYYY-MM-DD
    section 服务定义
    创建接口定义     :a1, 2025-10-08, 2d
    实现基础服务     :a2, after a1, 3d
    section 依赖配置
    更新DI配置      :a3, after a2, 2d
    测试基础功能     :a4, after a3, 2d
```

### 阶段2: 核心功能迁移 (Week 2-3)
```mermaid
gantt
    title 阶段2: 核心功能迁移
    dateFormat YYYY-MM-DD
    section 连接管理
    迁移连接方法     :b1, 2025-10-15, 3d
    测试连接功能     :b2, after b1, 2d
    section 查询执行
    迁移查询方法     :b3, after b2, 4d
    测试查询功能     :b4, after b3, 3d
```

### 阶段3: 数据操作迁移 (Week 4)
```mermaid
gantt
    title 阶段3: 数据操作迁移
    dateFormat YYYY-MM-DD
    section 数据操作
    迁移数据方法     :c1, 2025-10-28, 4d
    测试数据功能     :c2, after c1, 3d
    section 项目迁移
    迁移项目方法     :c3, after c2, 3d
    测试项目功能     :c4, after c3, 2d
```

### 阶段4: 收尾优化 (Week 5)
```mermaid
gantt
    title 阶段4: 收尾优化
    dateFormat YYYY-MM-DD
    section 优化清理
    性能优化       :d1, 2025-11-08, 3d
    代码清理       :d2, after d1, 2d
    section 最终测试
    集成测试       :d3, after d2, 4d
    部署上线       :d4, after d3, 1d
```

## 🎨 架构色彩说明

- **🔵 蓝色**: 门面/协调层服务
- **🟣 紫色**: 连接相关服务
- **🟢 绿色**: 查询相关服务
- **🟠 橙色**: 数据相关服务
- **🔴 红色**: 项目相关服务
- **🔵 淡蓝**: 健康相关服务
- **🟡 黄色**: 事件相关服务

## 📊 预期指标对比

| 指标 | 当前架构 | 优化后架构 | 改善幅度 |
|------|---------|-----------|---------|
| 代码行数 | 1000+ | <300 | 70%+ |
| 依赖数量 | 14 | 4-5 | 64-71% |
| 单元测试覆盖率 | 低 | >90% | 显著提升 |
| 代码重复率 | 高 | <5% | 显著降低 |
| 平均方法行数 | 30+ | 10-15 | 50-67% |
| 可维护性指数 | 低 | 高 | 大幅提升 |

## ✅ 架构验证检查点

### 1. 依赖关系验证
- [ ] 无循环依赖
- [ ] 依赖数量合理
- [ ] 依赖方向正确（高层不依赖低层）

### 2. 接口设计验证
- [ ] 接口职责单一
- [ ] 方法签名合理
- [ ] 参数设计规范

### 3. 实现质量验证
- [ ] 代码行数符合目标
- [ ] 单元测试覆盖全面
- [ ] 性能指标达标

### 4. 集成验证
- [ ] 服务间协作正常
- [ ] 错误处理一致
- [ ] 日志格式统一

---

**文档版本**: 1.0  
**最后更新**: 2025-10-08  
**负责人**: 架构评审委员会