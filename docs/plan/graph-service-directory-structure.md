# 图服务目录结构设计方案

## 📁 总体目录结构

基于当前项目架构和Qdrant实现模式，图服务目录结构设计如下：

```
src/
├── database/
│   ├── nebula/                    # Nebula Graph 数据库服务模块
│   │   ├── NebulaConnectionManager.ts    # 连接管理服务
│   │   ├── NebulaQueryBuilder.ts         # 查询构建服务
│   │   ├── NebulaSpaceManager.ts         # 空间管理服务
│   │   ├── NebulaTypes.ts               # Nebula 类型定义
│   │   ├── NebulaGraphOperations.ts     # 图操作服务
│   │   └── __tests__/                   # 测试文件
│   │       ├── NebulaConnectionManager.test.ts
│   │       ├── NebulaQueryBuilder.test.ts
│   │       ├── NebulaSpaceManager.test.ts
│   │       └── NebulaGraphOperations.test.ts
│   ├── NebulaService.ts          # Nebula 主服务（外观模式）
│   └── NebulaTypes.ts           # Nebula 通用类型定义
│
├── service/
│   └── graph/                    # 图服务模块
│       ├── core/                 # 核心服务
│       │   ├── GraphService.ts          # 图分析主服务
│       │   ├── GraphSearchService.ts    # 图搜索服务
│       │   ├── GraphPersistenceService.ts # 图持久化服务
│       │   ├── IGraphService.ts         # 图服务接口
│       │   └── types.ts                 # 图服务类型定义
│       ├── query/               # 查询相关服务
│       │   ├── GraphQueryBuilder.ts     # 图查询构建器
│       │   └── GraphQueryOptimizer.ts   # 图查询优化器
│       ├── cache/               # 缓存服务
│       │   ├── GraphCacheService.ts     # 图缓存服务
│       │   └── GraphCacheTypes.ts       # 缓存类型定义
│       ├── performance/         # 性能相关
│       │   ├── GraphPerformanceMonitor.ts # 性能监控
│       │   └── GraphBatchOptimizer.ts    # 批处理优化
│       ├── utils/               # 工具类
│       │   ├── GraphPersistenceUtils.ts  # 持久化工具
│       │   └── GraphConversionUtils.ts   # 数据转换工具
│       ├── algorithms/          # 图算法实现
│       │   ├── CommunityDetection.ts     # 社区发现算法
│       │   ├── PageRankAlgorithm.ts      # PageRank算法
│       │   ├── ShortestPathFinder.ts     # 最短路径算法
│       │   └── GraphMetricsCalculator.ts # 图指标计算
│       └── __tests__/          # 测试文件
│           ├── GraphService.test.ts
│           ├── GraphSearchService.test.ts
│           ├── GraphQueryBuilder.test.ts
│           ├── GraphCacheService.test.ts
│           └── integration/     # 集成测试
│               └── GraphService.integration.test.ts
│
└── types.ts                     # 更新类型定义（添加图服务相关Symbol）
```

## 🔄 与Qdrant结构一致性设计

### 1. 数据库层结构对应关系

| Qdrant 模块 | Nebula 对应模块 | 功能描述 |
|------------|----------------|----------|
| `IQdrantConnectionManager` | `NebulaConnectionManager` | 连接管理和状态维护 |
| `IQdrantCollectionManager` | `NebulaSpaceManager` | 空间/集合管理 |
| `IQdrantVectorOperations` | `NebulaGraphOperations` | 图数据操作 |
| `IQdrantQueryUtils` | `NebulaQueryBuilder` | 查询构建和优化 |
| `IQdrantProjectManager` | `GraphPersistenceService` | 项目相关图数据管理 |

### 2. 服务层结构设计

图服务层采用与文件搜索服务类似的结构：

- **核心服务** (`core/`): 主要业务逻辑实现
- **查询服务** (`query/`): 查询构建和优化
- **缓存服务** (`cache/`): 性能优化和缓存管理
- **工具类** (`utils/`): 辅助功能和工具函数

## 📋 主要文件说明

### 数据库层文件

#### `src/database/nebula/NebulaConnectionManager.ts`
- 负责Nebula Graph连接管理
- 连接池管理和状态监控
- 连接重试和错误处理

#### `src/database/nebula/NebulaSpaceManager.ts`
- 图空间管理（对应Qdrant的集合管理）
- 空间创建、删除、查询
- 空间权限管理

#### `src/database/nebula/NebulaGraphOperations.ts`
- 图数据操作（顶点和边的CRUD）
- 图遍历和查询执行
- 批量操作支持

#### `src/database/nebula/NebulaQueryBuilder.ts`
- NebulaGraph查询语言构建
- 查询优化和参数化
- 结果格式化和转换

#### `src/database/NebulaService.ts`
- 外观模式主服务
- 协调各个Nebula模块
- 提供统一的API接口

### 图服务层文件

#### `src/service/graph/core/GraphService.ts`
- 图分析主服务
- 代码库图分析功能
- 依赖关系分析
- 图指标计算

#### `src/service/graph/core/GraphSearchService.ts`
- 图搜索功能
- 语义搜索、关系搜索、路径搜索
- 搜索结果排序和评分

#### `src/service/graph/core/GraphPersistenceService.ts`
- 图数据持久化管理
- 项目图数据同步
- 图数据导入导出

#### `src/service/graph/query/GraphQueryBuilder.ts`
- 图查询构建器
- 支持多种查询类型
- 查询优化和缓存

## 🎯 类型定义集成

### `src/types.ts` 更新内容

```typescript
// Nebula 数据库服务
NebulaService: Symbol.for('NebulaService'),
INebulaConnectionManager: Symbol.for('INebulaConnectionManager'),
INebulaSpaceManager: Symbol.for('INebulaSpaceManager'),
INebulaGraphOperations: Symbol.for('INebulaGraphOperations'),
INebulaQueryBuilder: Symbol.for('INebulaQueryBuilder'),

// 图服务
GraphService: Symbol.for('GraphService'),
GraphSearchService: Symbol.for('GraphSearchService'),
GraphPersistenceService: Symbol.for('GraphPersistenceService'),
GraphCacheService: Symbol.for('GraphCacheService'),
GraphQueryBuilder: Symbol.for('GraphQueryBuilder'),
GraphPerformanceMonitor: Symbol.for('GraphPerformanceMonitor'),
GraphBatchOptimizer: Symbol.for('GraphBatchOptimizer'),
```

### `src/database/NebulaTypes.ts`
- Nebula Graph配置类型
- 连接状态类型
- 查询结果类型
- 错误处理类型

### `src/service/graph/core/types.ts`
- 图节点和边类型定义
- 图分析选项和结果类型
- 搜索参数和结果类型

## 🔧 配置集成

### Nebula Graph配置
在 `src/config/service/` 中添加：
- `NebulaConfigService.ts` - Nebula Graph配置服务

### 图服务配置
在现有配置服务中扩展：
- 图分析配置选项
- 图搜索配置参数
- 缓存和性能配置

## 🧪 测试策略

### 单元测试
- 每个服务模块独立的单元测试
- 接口契约测试
- 错误场景测试

### 集成测试
- 数据库连接集成测试
- 图服务与Nebula集成测试
- 端到端功能测试

### 性能测试
- 图查询性能基准测试
- 并发性能测试
- 内存使用监控

## 📊 迁移优先级

1. **第一阶段**: 数据库层服务 (`src/database/nebula/`)
   - NebulaConnectionManager
   - NebulaSpaceManager  
   - NebulaGraphOperations
   - NebulaQueryBuilder

2. **第二阶段**: 图核心服务 (`src/service/graph/core/`)
   - GraphService
   - GraphSearchService
   - GraphPersistenceService

3. **第三阶段**: 辅助服务 (`src/service/graph/` 其他目录)
   - 查询构建器
   - 缓存服务
   - 性能监控

4. **第四阶段**: 集成和测试
   - 类型定义集成
   - DI容器配置
   - 全面测试覆盖

这个目录结构设计确保了与现有Qdrant实现的一致性，同时提供了清晰的模块划分和扩展性。