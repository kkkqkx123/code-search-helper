# SQLite迁移实施计划

## 概述

本计划详细说明了如何将ProjectIdManager、ProjectStateManager和ChangeDetectionService从JSON/内存存储迁移到SQLite数据库，实现内存存储+SQLite持久化的混合架构。

**当前状态：** ✅ SQLite基础架构已完成，数据迁移工具已实现，需要完成服务层集成

## 迁移目标

1. **ProjectIdManager**：从JSON文件迁移到SQLite数据库
2. **ProjectStateManager**：从JSON文件迁移到SQLite数据库  
3. **ChangeDetectionService**：从纯内存存储迁移到内存缓存+SQLite持久化
4. **保持向后兼容性**：确保现有API和功能不受影响

## 已实现的基础架构

### ✅ 已完成的基础组件

#### 1.1 SqliteDatabaseService
- **文件**: `src/database/splite/SqliteDatabaseService.ts`
- **状态**: ✅ 已实现
- **功能**: 数据库连接管理、表结构初始化、事务支持

#### 1.2 SqliteProjectManager  
- **文件**: `src/database/splite/SqliteProjectManager.ts`
- **状态**: ✅ 已实现
- **功能**: 项目空间管理、数据操作接口

#### 1.3 数据迁移工具
- **文件**: `src/database/splite/migration/JsonToSqliteMigrator.ts`
- **状态**: ✅ 已实现
- **功能**: JSON到SQLite的数据迁移、验证和回滚

#### 1.4 数据库表结构
```sql
-- 项目表
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    collection_name TEXT,
    space_name TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_indexed_at DATETIME,
    status TEXT NOT NULL,
    settings JSON,
    metadata JSON
);

-- 文件索引状态表（包含文件哈希）
CREATE TABLE file_index_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    file_size INTEGER,
    last_modified DATETIME NOT NULL,
    last_indexed DATETIME,
    indexing_version INTEGER DEFAULT 1,
    chunk_count INTEGER,
    vector_count INTEGER,
    language TEXT,
    file_type TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    metadata JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE(project_id, file_path),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 项目状态表
CREATE TABLE project_status (
    project_id TEXT PRIMARY KEY,
    vector_status JSON NOT NULL,
    graph_status JSON NOT NULL,
    indexing_progress REAL DEFAULT 0,
    total_files INTEGER DEFAULT 0,
    indexed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    last_updated DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 文件变更历史表
CREATE TABLE file_change_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    project_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    previous_hash TEXT,
    current_hash TEXT,
    file_size INTEGER,
    timestamp DATETIME NOT NULL,
    metadata JSON,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

## 待实施的迁移步骤

### 阶段一：FileHashManager实现（1-2周）

#### 1.1 创建FileHashManager服务

**文件**: `src/service/filesystem/FileHashManager.ts`

```typescript
// 核心接口定义
export interface FileHashEntry {
  projectId: string;
  filePath: string;
  hash: string;
  lastModified: Date;
  fileSize: number;
  language?: string;
  fileType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileHashManager {
  getFileHash(projectId: string, filePath: string): Promise<string | null>;
  updateFileHash(projectId: string, filePath: string, hash: string, metadata?: Partial<FileHashEntry>): Promise<void>;
  getFileHashes(projectId: string, filePaths: string[]): Promise<Map<string, string>>;
  batchUpdateHashes(updates: Array<{projectId: string, filePath: string, hash: string}>): Promise<void>;
  deleteFileHash(projectId: string, filePath: string): Promise<void>;
  getChangedFiles(projectId: string, since: Date): Promise<FileHashEntry[]>;
  cleanupExpiredHashes(expiryDays?: number): Promise<number>;
}
```

#### 1.2 实现FileHashManager

**实现核心功能**：
- 内存LRU缓存管理
- 数据库持久化操作
- 批量操作优化
- 缓存失效策略

### 阶段二：ChangeDetectionService迁移（2-3周）

#### 2.1 修改ChangeDetectionService

**文件**: `src/service/filesystem/ChangeDetectionService.ts`

```typescript
// 主要修改点：
export class ChangeDetectionService extends EventEmitter {
  // 移除原有的内存存储
  // private fileHashes: Map<string, string> = new Map();
  // private fileHistory: Map<string, FileHistoryEntry[]> = new Map();
  
  // 添加FileHashManager依赖
  constructor(
    @inject(TYPES.FileHashManager) private fileHashManager: FileHashManager,
    // ... 其他依赖
  ) {
    // ...
  }
  
  // 修改初始化方法
  private async initializeFileHashes(rootPaths: string[]): Promise<void> {
    for (const rootPath of rootPaths) {
      const projectId = await this.getProjectIdForPath(rootPath);
      const result = await this.fileSystemTraversal.traverseDirectory(rootPath);
      
      // 批量更新文件哈希到数据库
      const hashUpdates = result.files.map(file => ({
        projectId,
        filePath: file.relativePath,
        hash: file.hash,
        fileSize: file.size,
        lastModified: file.lastModified,
        language: file.language,
        fileType: path.extname(file.path)
      }));
      
      await this.fileHashManager.batchUpdateHashes(hashUpdates);
    }
  }
  
  // 修改文件变更处理方法
  private async handleFileChanged(fileInfo: FileInfo): Promise<void> {
    const projectId = await this.getProjectIdForPath(fileInfo.path);
    const previousHash = await this.fileHashManager.getFileHash(projectId, fileInfo.relativePath);
    
    // ... 其他逻辑保持不变
  }
}
```

#### 2.2 更新依赖注入配置

**文件**: `src/core/registrars/BusinessServiceRegistrar.ts`

```typescript
// 添加FileHashManager注册
container.bind<FileHashManager>(TYPES.FileHashManager).to(FileHashManager).inSingletonScope();

// 更新ChangeDetectionService依赖
container.bind<ChangeDetectionService>(TYPES.ChangeDetectionService)
  .to(ChangeDetectionService)
  .inSingletonScope();
```

### 阶段三：ProjectIdManager迁移（2-3周）

#### 3.1 修改ProjectIdManager使用SQLite

**文件**: `src/database/ProjectIdManager.ts`

```typescript
export class ProjectIdManager {
  // 添加SQLite服务依赖
  constructor(
    @inject(TYPES.SqliteProjectManager) private sqliteProjectManager: SqliteProjectManager,
    // ... 其他依赖
  ) {
    // ...
  }
  
  // 修改保存方法使用SQLite
  private async saveMappingWithRetry(maxRetries: number = 3): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 使用SQLite保存项目映射
        for (const [projectPath, projectId] of this.projectIdMap.entries()) {
          const project: Project = {
            id: projectId,
            path: projectPath,
            name: this.extractProjectName(projectPath),
            collection_name: this.collectionMap.get(projectId),
            space_name: this.spaceMap.get(projectId),
            created_at: this.projectUpdateTimes.get(projectId) || new Date(),
            updated_at: new Date(),
            status: 'active'
          };
          
          await this.sqliteProjectManager.createProjectMapping(project);
        }
        return;
      } catch (error) {
        // 错误处理和重试逻辑
      }
    }
  }
}
```

### 阶段四：ProjectStateManager迁移（2-3周）

#### 4.1 创建SqliteStateManager

**文件**: `src/database/splite/SqliteStateManager.ts`

```typescript
@injectable()
export class SqliteStateManager {
  constructor(@inject(TYPES.SqliteDatabaseService) private sqliteService: SqliteDatabaseService) {}
  
  async saveProjectState(state: ProjectState): Promise<boolean> {
    const stmt = this.sqliteService.prepare(`
      INSERT OR REPLACE INTO project_status 
      (project_id, vector_status, graph_status, indexing_progress, total_files, indexed_files, failed_files, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      state.projectId,
      JSON.stringify(state.vectorStatus),
      JSON.stringify(state.graphStatus),
      state.indexingProgress || 0,
      state.totalFiles || 0,
      state.indexedFiles || 0,
      state.failedFiles || 0,
      new Date()
    ).changes > 0;
  }
  
  async getProjectState(projectId: string): Promise<ProjectState | null> {
    // 实现查询逻辑
  }
}
```

#### 4.2 修改ProjectStateManager

**文件**: `src/service/project/ProjectStateManager.ts`

```typescript
export class ProjectStateManager {
  // 添加SQLite状态管理器依赖
  constructor(
    @inject(TYPES.SqliteStateManager) private sqliteStateManager: SqliteStateManager,
    // ... 其他依赖
  ) {
    // ...
  }
  
  // 修改保存方法
  private async saveProjectStates(): Promise<void> {
    // 使用SQLite保存状态，同时保持JSON备份
    for (const [projectId, state] of this.projectStates.entries()) {
      await this.sqliteStateManager.saveProjectState(state);
    }
    
    // 可选：保持JSON备份用于回滚
    await ProjectStateStorageUtils.saveProjectStates(
      this.projectStates,
      this.storagePath,
      this.logger,
      this.errorHandler
    );
  }
}
```

## 风险评估和缓解措施

### 风险1：数据丢失
- **缓解**：实现数据备份和回滚机制
- **缓解**：分阶段迁移，保持JSON备份

### 风险2：性能下降
- **缓解**：实现高效的内存缓存
- **缓解**：优化数据库查询和索引
- **缓解**：分批处理大数据集

### 风险3：向后兼容性
- **缓解**：保持现有API不变
- **缓解**：提供配置开关控制存储方式
- **缓解**：详细的迁移日志和错误处理

## 成功标准

1. **功能完整性**：所有现有功能正常工作
2. **性能指标**：响应时间不超过原有实现的110%
3. **数据一致性**：迁移后数据100%准确
4. **向后兼容**：现有API和配置无需修改
5. **测试覆盖**：单元测试覆盖率>90%

## 时间估算

| 阶段 | 时间估算 | 关键里程碑 |
|------|----------|------------|
| 阶段一 | 1-2周 | FileHashManager完成 |
| 阶段二 | 2-3周 | ChangeDetectionService迁移完成 |
| 阶段三 | 2-3周 | ProjectIdManager迁移完成 |
| 阶段四 | 2-3周 | ProjectStateManager迁移完成 |
| 阶段五 | 1-2周 | 性能优化和测试完成 |

**总时间估算**: 8-13周

## 下一步行动

1. **立即开始**：实现FileHashManager和SQLite表扩展
2. **并行开发**：各阶段可以部分并行进行
3. **持续测试**：每个阶段完成后进行完整测试
4. **渐进部署**：先在测试环境验证，再部署到生产环境

这个迁移计划将确保系统平稳过渡到SQLite存储，同时保持高性能和向后兼容性。