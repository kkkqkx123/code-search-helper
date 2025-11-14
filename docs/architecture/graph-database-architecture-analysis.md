# 图数据库架构分析

## 当前架构问题

### 1. 重复的连接管理
- `src/database/nebula/NebulaConnectionManager.ts` - 已存在的 Nebula 连接管理器
- `src/database/graph/utils/ConnectionManager.ts` - 我们创建的重复连接管理器（已删除）

### 2. 职责混乱
- GraphDatabaseService 试图管理连接，但这应该由 NebulaConnectionManager 处理
- QueryManager 试图处理查询执行，但这应该由 NebulaConnectionManager 处理

## 正确的架构设计

### 1. 层次结构
```
服务层 (Service Layer)
├── GraphSearchService - 业务逻辑编排
└── GraphDatabaseService - 数据库抽象层

数据库层 (Database Layer)
├── graph/ - 图数据库抽象
│   └── GraphDatabaseService - 协调器角色
└── nebula/ - Nebula Graph 具体实现
    ├── NebulaConnectionManager - 连接管理
    ├── NebulaSpaceManager - 空间管理
    ├── NebulaQueryBuilder - 查询构建
    └── NebulaDataBatchProcessor - 批处理
```

### 2. 职责分配

#### GraphDatabaseService (协调器)
- **职责**: 协调不同的 Nebula 组件，提供统一的图数据库接口
- **不应该**: 直接管理连接、执行查询、处理批处理
- **应该**: 委托给适当的 Nebula 组件

#### NebulaConnectionManager (连接管理)
- **职责**: Nebula Graph 连接管理、健康检查、重连逻辑
- **接口**: executeQuery, getConnectionStatus, validateSpace

#### NebulaSpaceManager (空间管理)
- **职责**: 空间创建、删除、清空、信息获取
- **接口**: createSpace, deleteSpace, clearSpace, getSpaceInfo

#### NebulaDataBatchProcessor (批处理)
- **职责**: 批量插入节点、边，批量删除
- **接口**: batchInsertNodes, batchInsertEdges, batchDeleteNodes

## 重构方案

### 1. 简化 GraphDatabaseService
```typescript
@injectable()
export class GraphDatabaseService implements IGraphDatabaseService {
  constructor(
    @inject(TYPES.NebulaConnectionManager) private connectionManager: NebulaConnectionManager,
    @inject(TYPES.NebulaSpaceManager) private spaceManager: NebulaSpaceManager,
    @inject(TYPES.NebulaDataBatchProcessor) private batchProcessor: NebulaDataBatchProcessor,
    // 其他依赖...
  ) {}

  async executeReadQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    return this.connectionManager.executeQuery(query, parameters);
  }

  async executeWriteQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    return this.connectionManager.executeQuery(query, parameters);
  }

  async createSpace(spaceName: string, options?: any): Promise<boolean> {
    return this.spaceManager.createSpace(spaceName, options);
  }

  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    return this.batchProcessor.batchInsertNodes(nodes, projectId);
  }
}
```

### 2. 删除重复的工具类
- 删除 `src/database/graph/utils/QueryManager.ts`
- 删除 `src/database/graph/utils/GraphDatabaseUtils.ts`
- 删除 `src/database/graph/constants/GraphDatabaseConstants.ts`

### 3. 使用现有的 Nebula 组件
- 使用 `NebulaConnectionManager` 进行连接管理和查询执行
- 使用 `NebulaSpaceManager` 进行空间管理
- 使用 `NebulaDataBatchProcessor` 进行批处理

## 迁移步骤

### 1. 清理重复代码
- [x] 删除 ConnectionManager.ts
- [ ] 删除 QueryManager.ts
- [ ] 删除 GraphDatabaseUtils.ts
- [ ] 删除 GraphDatabaseConstants.ts

### 2. 重构 GraphDatabaseService
- [ ] 更新构造函数，注入 Nebula 组件
- [ ] 简化方法实现，委托给 Nebula 组件
- [ ] 移除重复的连接管理逻辑

### 3. 更新依赖注入
- [ ] 确保所有 Nebula 组件正确注册
- [ ] 更新 GraphDatabaseService 的依赖注入配置

## 最终架构

```
src/
├── service/graph/
│   ├── core/
│   │   └── GraphSearchService.ts (318行)
│   ├── constants/
│   │   └── GraphSearchConstants.ts (207行)
│   └── utils/
│       ├── PropertyFormatter.ts (130行)
│       ├── QueryBuilder.ts (162行)
│       └── CacheManager.ts (103行)
└── database/graph/
    └── GraphDatabaseService.ts (~200行)
```

## 收益

1. **消除重复代码**: 不再有重复的连接管理和查询执行逻辑
2. **职责清晰**: 每个组件都有明确的职责
3. **利用现有组件**: 充分利用已有的 Nebula 组件
4. **更简单的架构**: 减少了不必要的抽象层
5. **更易维护**: 代码量更少，依赖关系更清晰

## 结论

正确的架构应该是：
- GraphDatabaseService 作为协调器，委托给 Nebula 组件
- 使用现有的 Nebula 组件，而不是创建重复的工具类
- 保持简单的层次结构，避免过度抽象