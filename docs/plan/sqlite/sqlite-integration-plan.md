# SQLite数据库集成技术方案

## 📋 概述

本文档详细说明如何将SQLite数据库集成到现有的数据库体系结构中，遵循现有的基础设施模式和架构设计。

## 🏗️ 现有架构分析

### 1. 当前数据库架构

#### 1.1 基础设施管理器模式
- **InfrastructureManager**: 统一管理所有数据库基础设施
- **IDatabaseInfrastructure**: 数据库基础设施接口，提供统一访问
- **DatabaseType**: 数据库类型枚举（QDRANT, NEBULA, VECTOR, GRAPH）

#### 1.2 现有基础设施实现
- **QdrantInfrastructure**: Qdrant向量数据库基础设施
- **NebulaInfrastructure**: Nebula图数据库基础设施
- 遵循依赖注入模式，通过DI容器管理

#### 1.3 数据库服务架构
- **IDatabaseService**: 统一数据库服务接口
- **BaseDatabaseService**: 基础数据库服务实现
- **IConnectionManager**: 连接管理器接口
- **IProjectManager**: 项目管理器接口

### 2. SQLite现状
- 已实现基础SQLite服务类：`SqliteDatabaseService`
- 位于 `src/database/splite/` 目录（注意：目录名应为sqlite）
- 提供基本的数据库连接、表结构管理、事务支持
- 尚未集成到基础设施体系中

## 🎯 集成目标

### 1. 架构一致性
- 将SQLite集成到现有的基础设施管理器中
- 遵循现有的依赖注入和接口模式
- 提供与其他数据库类型一致的访问接口

### 2. 功能完整性
- 支持缓存、性能监控、批处理优化、健康检查
- 集成到连接池管理
- 支持事务协调

### 3. 数据迁移
- 从JSON文件迁移到SQLite数据库
- 保持数据一致性
- 提供回滚机制

## 🛠️ 技术方案设计

### 1. SQLite基础设施实现

#### 1.1 新增DatabaseType枚举
```typescript
// src/infrastructure/types.ts
export enum DatabaseType {
  QDRANT = 'qdrant',
  NEBULA = 'nebula', 
  VECTOR = 'vector',
  GRAPH = 'graph',
  SQLITE = 'sqlite'  // 新增SQLite类型
}
```

#### 1.2 SQLite基础设施类
```typescript
// src/infrastructure/implementations/SqliteInfrastructure.ts
@injectable()
export class SqliteInfrastructure implements IDatabaseInfrastructure {
  readonly databaseType = DatabaseType.SQLITE;
  
  // 实现与其他基础设施类相同的接口方法
  getCacheService(): ICacheService;
  getPerformanceMonitor(): IPerformanceMonitor;
  getBatchOptimizer(): IBatchOptimizer;
  getHealthChecker(): IHealthChecker;
  getConnectionManager(): DatabaseConnectionPool;
  
  // SQLite特定的辅助方法
  async executeSqlQuery(query: string, params?: any[]): Promise<any>;
  async backupDatabase(backupPath: string): Promise<void>;
  async getDatabaseStats(): Promise<DatabaseStats>;
}
```

### 2. SQLite数据库服务适配器

#### 2.1 SQLite连接管理器
```typescript
// src/database/sqlite/SqliteConnectionManager.ts
export class SqliteConnectionManager implements IConnectionManager {
  // 实现IConnectionManager接口
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConfig(): any;
  updateConfig(config: any): void;
  getConnectionStatus(): any;
}
```

#### 2.2 SQLite项目管理器
```typescript
// src/database/sqlite/SqliteProjectManager.ts
export class SqliteProjectManager implements IProjectManager {
  // 实现IProjectManager接口
  createProjectSpace(projectPath: string, config?: any): Promise<boolean>;
  deleteProjectSpace(projectPath: string): Promise<boolean>;
  getProjectSpaceInfo(projectPath: string): Promise<any>;
  
  // SQLite特定的项目管理方法
  async getProjectById(projectId: string): Promise<Project | null>;
  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<boolean>;
  async getFileIndexStates(projectId: string): Promise<FileIndexState[]>;
}
```

#### 2.3 SQLite数据库服务
```typescript
// src/database/sqlite/SqliteDatabaseService.ts
export class SqliteDatabaseService extends BaseDatabaseService {
  // 继承BaseDatabaseService，获得基础功能
  // 添加SQLite特定的高级功能
  
  // 项目映射管理
  async createProjectMapping(project: Project): Promise<boolean>;
  async getProjectMapping(projectPath: string): Promise<Project | null>;
  async updateProjectMapping(project: Project): Promise<boolean>;
  
  // 文件索引状态管理
  async upsertFileIndexState(state: FileIndexState): Promise<boolean>;
  async getFileIndexState(projectId: string, filePath: string): Promise<FileIndexState | null>;
  async getChangedFiles(projectId: string, since: Date): Promise<FileIndexState[]>;
  
  // 项目状态管理
  async updateProjectStatus(status: ProjectStatus): Promise<boolean>;
  async getProjectStatus(projectId: string): Promise<ProjectStatus | null>;
  
  // 文件变更历史
  async recordFileChange(change: FileChange): Promise<boolean>;
  async getFileChangeHistory(projectId: string, limit?: number): Promise<FileChange[]>;
}
```

### 3. 基础设施配置

#### 3.1 扩展基础设施配置
```typescript
// src/infrastructure/config/types.ts
export interface InfrastructureConfig {
  common: CommonConfig;
  qdrant: DatabaseInfrastructureConfig;
  nebula: DatabaseInfrastructureConfig & { graph: GraphSpecificConfig };
  sqlite: DatabaseInfrastructureConfig & { 
    database: SqliteSpecificConfig 
  }; // 新增SQLite配置
  // ... 其他配置
}

export interface SqliteSpecificConfig {
  databasePath: string;
  backupPath?: string;
  backupInterval?: number;
  maxConnections?: number;
  queryTimeout?: number;
  journalMode?: 'WAL' | 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'OFF';
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  cacheSize?: number;
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY';
}
```

#### 3.2 默认配置
```typescript
// 在InfrastructureManager中添加SQLite默认配置
sqlite: {
  cache: {
    defaultTTL: 300000, // 5分钟
    maxEntries: 10000,
    cleanupInterval: 60000,
    enableStats: true,
    databaseSpecific: {}
  },
  performance: {
    monitoringInterval: 30000,
    metricsRetentionPeriod: 86400000,
    enableDetailedLogging: true,
    performanceThresholds: {
      queryExecutionTime: 100,
      memoryUsage: 80,
      responseTime: 50
    },
    databaseSpecific: {}
  },
  batch: {
    maxConcurrentOperations: 10,
    defaultBatchSize: 100,
    maxBatchSize: 1000,
    minBatchSize: 10,
    memoryThreshold: 80,
    processingTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    adaptiveBatchingEnabled: true,
    performanceThreshold: 100,
    adjustmentFactor: 0.1,
    databaseSpecific: {}
  },
  connection: {
    maxConnections: 10,
    minConnections: 2,
    connectionTimeout: 30000,
    idleTimeout: 300000,
    acquireTimeout: 10000,
    validationInterval: 60000,
    enableConnectionPooling: true,
    databaseSpecific: {}
  },
  database: {
    databasePath: './data/code-search-helper.db',
    backupPath: './data/backups',
    backupInterval: 86400000, // 24小时
    maxConnections: 10,
    queryTimeout: 30000,
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    cacheSize: -2000, // 2MB
    tempStore: 'MEMORY'
  }
}
```

### 4. 数据迁移策略

#### 4.1 迁移管理器
```typescript
// src/database/sqlite/migration/JsonToSqliteMigrator.ts
export class JsonToSqliteMigrator {
  async migrateProjectMappings(): Promise<MigrationResult>;
  async migrateProjectStates(): Promise<MigrationResult>;
  async migrateAll(): Promise<MigrationSummary>;
  async validateMigration(): Promise<ValidationResult>;
  async rollback(): Promise<RollbackResult>;
}
```

#### 4.2 迁移步骤
1. **备份现有JSON文件**
2. **创建SQLite数据库和表结构**
3. **逐条迁移项目映射数据**
4. **逐条迁移项目状态数据**
5. **验证数据完整性**
6. **切换数据访问层到SQLite**
7. **归档旧JSON文件**

## 📁 文件结构规划

```
src/
├── database/
│   ├── common/                    # 现有通用模块
│   ├── nebula/                    # 现有Nebula模块
│   ├── qdrant/                    # 现有Qdrant模块
│   ├── splite/                    # 现有SQLite基础服务（需要重命名）
│   │   └── SqliteDatabaseService.ts
│   └── sqlite/                    # 新增SQLite集成模块
│       ├── SqliteInfrastructure.ts
│       ├── SqliteConnectionManager.ts
│       ├── SqliteProjectManager.ts
│       ├── SqliteDatabaseService.ts
│       ├── types.ts
│       └── migration/
│           ├── JsonToSqliteMigrator.ts
│           ├── MigrationTypes.ts
│           └── __tests__/
│
├── infrastructure/
│   ├── implementations/
│   │   ├── QdrantInfrastructure.ts
│   │   ├── NebulaInfrastructure.ts
│   │   └── SqliteInfrastructure.ts      # 新增
│   ├── config/
│   │   └── types.ts                     # 扩展配置类型
│   └── InfrastructureManager.ts         # 更新以支持SQLite
│
└── types.ts                             # 更新DatabaseType枚举
```

## 🔄 集成实施计划

### 阶段一：基础设施集成（1周）

#### 1.1 扩展基础设施类型定义
- [ ] 在 `DatabaseType` 枚举中添加 `SQLITE`
- [ ] 扩展 `InfrastructureConfig` 接口
- [ ] 更新 `InfrastructureManager` 配置

#### 1.2 实现SQLite基础设施
- [ ] 创建 `SqliteInfrastructure` 类
- [ ] 实现 `IDatabaseInfrastructure` 接口
- [ ] 集成到DI容器

#### 1.3 更新基础设施管理器
- [ ] 在 `InfrastructureManager` 中添加SQLite支持
- [ ] 更新配置验证逻辑
- [ ] 添加SQLite特定的健康检查

### 阶段二：数据库服务适配（1-2周）

#### 2.1 实现连接管理器
- [ ] 创建 `SqliteConnectionManager`
- [ ] 实现连接池管理
- [ ] 集成到基础设施

#### 2.2 实现项目管理器
- [ ] 创建 `SqliteProjectManager`
- [ ] 实现项目空间管理
- [ ] 提供数据操作接口

#### 2.3 完善数据库服务
- [ ] 扩展 `SqliteDatabaseService`
- [ ] 实现高级查询功能
- [ ] 添加事务支持

### 阶段三：数据迁移（1周）

#### 3.1 开发迁移工具
- [ ] 创建 `JsonToSqliteMigrator`
- [ ] 实现数据验证逻辑
- [ ] 开发回滚机制

#### 3.2 执行数据迁移
- [ ] 备份现有数据
- [ ] 执行迁移脚本
- [ ] 验证数据完整性

### 阶段四：集成测试（1周）

#### 4.1 单元测试
- [ ] 基础设施测试
- [ ] 数据库服务测试
- [ ] 迁移工具测试

#### 4.2 集成测试
- [ ] 端到端功能测试
- [ ] 性能测试
- [ ] 并发测试

#### 4.3 系统测试
- [ ] 与现有系统集成测试
- [ ] 数据一致性验证
- [ ] 回滚测试

## 🎛️ 配置管理

### 1. 环境配置
```typescript
// config/sqlite.config.ts
export const sqliteConfig = {
  database: {
    path: process.env.SQLITE_DB_PATH || './data/code-search-helper.db',
    backup: {
      enabled: process.env.SQLITE_BACKUP_ENABLED === 'true',
      path: process.env.SQLITE_BACKUP_PATH || './data/backups',
      interval: parseInt(process.env.SQLITE_BACKUP_INTERVAL || '86400000')
    },
    performance: {
      journalMode: process.env.SQLITE_JOURNAL_MODE || 'WAL',
      synchronous: process.env.SQLITE_SYNCHRONOUS || 'NORMAL',
      cacheSize: parseInt(process.env.SQLITE_CACHE_SIZE || '-2000')
    }
  }
};
```

### 2. 运行时配置
- 支持热重载配置
- 配置验证和默认值处理
- 环境特定的配置覆盖

## 🔧 性能优化策略

### 1. 连接池优化
- 连接复用和生命周期管理
- 连接健康检查
- 连接泄漏检测

### 2. 查询优化
- 预编译语句缓存
- 批量操作支持
- 索引策略优化

### 3. 缓存策略
- 查询结果缓存
- 元数据缓存
- 缓存失效策略

## 🛡️ 错误处理和监控

### 1. 错误处理
- 连接错误重试机制
- 事务回滚处理
- 优雅降级策略

### 2. 监控指标
- 连接池状态监控
- 查询性能监控
- 存储空间监控
- 错误率监控

### 3. 日志记录
- 详细的操作日志
- 性能指标日志
- 错误和警告日志

## 📊 迁移风险评估

### 1. 数据丢失风险
- **风险**: 迁移过程中数据丢失或损坏
- **缓解**: 
  - 完整的备份机制
  - 数据完整性验证
  - 可回滚的迁移过程

### 2. 性能风险
- **风险**: SQLite性能不如预期
- **缓解**:
  - 性能基准测试
  - 查询优化
  - 索引策略优化

### 3. 兼容性风险
- **风险**: 与现有系统不兼容
- **缓解**:
  - 渐进式迁移
  - 功能开关控制
  - 回滚方案准备

## ✅ 验收标准

### 1. 功能验收
- [ ] SQLite基础设施正确集成到InfrastructureManager
- [ ] 所有数据库操作接口正常工作
- [ ] 数据迁移工具完整可用
- [ ] 性能指标达到预期

### 2. 质量验收
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试通过率 100%
- [ ] 性能测试达标
- [ ] 文档完整准确

### 3. 运维验收
- [ ] 监控指标完整
- [ ] 日志记录清晰
- [ ] 配置管理灵活
- [ ] 备份恢复可靠

## 🚀 后续优化方向

### 1. 高级功能
- 数据库分片支持
- 读写分离
- 数据归档策略

### 2. 运维工具
- 数据库管理界面
- 性能分析工具
- 数据迁移工具

### 3. 扩展性
- 插件化架构
- 自定义存储引擎
- 多数据库支持

---

**总结**: 本方案提供了完整的SQLite集成技术路线，确保与现有架构的无缝集成，同时提供高性能、可靠的数据持久化解决方案。