# 图服务协调与同步方案

## 📁 Qdrant文件位置调整方案

### 当前Qdrant目录结构
```
src/database/
├── QdrantService.ts              # Qdrant主服务
├── QdrantConnectionManager.ts   # Qdrant连接管理
├── QdrantCollectionManager.ts   # Qdrant集合管理
├── QdrantVectorOperations.ts    # Qdrant向量操作
├── QdrantQueryUtils.ts          # Qdrant查询工具
├── QdrantProjectManager.ts      # Qdrant项目管理
├── QdrantTypes.ts              # Qdrant类型定义
└── ProjectIdManager.ts          # 项目ID管理（共享）
```

### 建议调整方案
将Qdrant相关文件移动到专门的子目录中，保持结构清晰：

```
src/database/
├── qdrant/                      # Qdrant专用目录
│   ├── QdrantService.ts
│   ├── QdrantConnectionManager.ts
│   ├── QdrantCollectionManager.ts
│   ├── QdrantVectorOperations.ts
│   ├── QdrantQueryUtils.ts
│   ├── QdrantProjectManager.ts
│   ├── QdrantTypes.ts
│   └── __tests__/
│       └── ...                 # Qdrant测试文件
├── nebula/                      # Nebula专用目录
│   └── ...                     # Nebula相关文件
├── ProjectIdManager.ts          # 共享的项目ID管理
├── ProjectLookupService.ts      # 共享的项目查找服务
└── IVectorStore.ts             # 共享的向量存储接口
```

## 🔄 Nebula复用ProjectIdManager方案

### 复用机制设计

Nebula服务可以通过依赖注入复用现有的ProjectIdManager和ProjectLookupService：

```typescript
// NebulaService.ts
@injectable()
export class NebulaService {
  constructor(
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.ProjectLookupService) private projectLookupService: ProjectLookupService,
    // ... 其他依赖
  ) {}
  
  async createSpaceForProject(projectPath: string): Promise<boolean> {
    const projectId = await this.projectIdManager.generateProjectId(projectPath);
    const spaceName = this.projectIdManager.getSpaceName(projectId);
    
    // 使用projectId和spaceName创建Nebula空间
    return this.createSpace(spaceName);
  }
  
  async getProjectPathBySpace(spaceName: string): Promise<string | null> {
    return this.projectLookupService.getProjectPathBySpace(spaceName);
  }
}
```

### 空间命名约定
为了保持一致性，Nebula空间命名遵循与Qdrant集合相同的模式：
- Qdrant集合名: `project-{projectId}`
- Nebula空间名: `project_{projectId}` (使用下划线分隔)

## 🤝 数据库协调模块设计

### 协调服务架构

```
src/service/coordination/
├── DatabaseCoordinator.ts        # 数据库协调主服务
├── SyncStateManager.ts           # 同步状态管理
├── FallbackHandler.ts            # 降级处理服务
├── ProgressTracker.ts            # 进度跟踪服务
└── types.ts                     # 协调相关类型
```

### DatabaseCoordinator 实现

```typescript
@injectable()
export class DatabaseCoordinator {
  private syncState: SyncState = 'idle';
  private lastSyncTime: Date | null = null;
  private errorCount: number = 0;
  private maxErrorCount: number = 3;

  constructor(
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.NebulaService) private nebulaService: NebulaService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  // 项目索引同步
  async syncProjectIndexing(projectPath: string): Promise<SyncResult> {
    const projectId = await this.projectIdManager.generateProjectId(projectPath);
    
    try {
      this.syncState = 'syncing';
      this.logger.info('Starting project indexing synchronization', { projectId });
      
      // 并行执行Qdrant和Nebula索引
      const [qdrantResult, nebulaResult] = await Promise.allSettled([
        this.qdrantService.indexProject(projectPath),
        this.nebulaService.indexProject(projectPath)
      ]);
      
      return this.handleSyncResults(qdrantResult, nebulaResult, projectId);
      
    } catch (error) {
      return this.handleSyncError(error, projectId);
    } finally {
      this.syncState = 'idle';
      this.lastSyncTime = new Date();
    }
  }
}
```

### 同步状态管理

```typescript
interface SyncState {
  status: 'idle' | 'syncing' | 'degraded' | 'error';
  qdrant: DatabaseStatus;
  nebula: DatabaseStatus;
  lastSuccessfulSync: Date | null;
  errorDetails: SyncError[];
}

interface DatabaseStatus {
  available: boolean;
  version: string;
  lastCheck: Date;
  performanceMetrics: PerformanceMetrics;
}

interface SyncError {
  database: 'qdrant' | 'nebula';
  error: Error;
  timestamp: Date;
  retryCount: number;
}
```

## 🛡️ 降级处理机制

### 分级降级策略

1. **Level 1: 性能降级**
   - 单个数据库响应缓慢
   - 启用查询缓存和结果合并
   - 记录性能指标用于优化

2. **Level 2: 功能降级** 
   - 单个数据库暂时不可用
   - 切换到备用数据库提供服务
   - 记录缺失功能用于后续同步

3. **Level 3: 完全降级**
   - 所有数据库不可用
   - 启用只读模式或维护页面
   - 保存操作日志用于恢复

### 降级处理器实现

```typescript
@injectable()
export class FallbackHandler {
  private degradationLevel: DegradationLevel = 'normal';
  private pendingOperations: PendingOperation[] = [];
  
  async handleDatabaseOperation<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    operationType: string
  ): Promise<T> {
    try {
      const result = await operation();
      this.recordSuccess(operationType);
      return result;
    } catch (error) {
      this.recordError(operationType, error);
      
      if (this.shouldUseFallback()) {
        this.logger.warn('Using fallback operation', { operationType });
        return await fallback();
      }
      
      throw error;
    }
  }
  
  private shouldUseFallback(): boolean {
    return this.degradationLevel !== 'normal' && 
           this.errorRate < this.config.maxErrorRate;
  }
}
```

## 📊 进度保留与日志记录

### 进度跟踪服务

```typescript
@injectable()
export class ProgressTracker {
  private progressStore: Map<string, ProjectProgress> = new Map();
  private syncLog: SyncLogEntry[] = [];
  
  async trackProjectProgress(
    projectId: string, 
    operation: 'indexing' | 'syncing' | 'cleanup',
    progress: number,
    details?: any
  ): Promise<void> {
    const entry: ProgressEntry = {
      projectId,
      operation,
      progress,
      timestamp: new Date(),
      details
    };
    
    this.progressStore.set(this.getProgressKey(projectId, operation), entry);
    await this.persistProgress(entry);
  }
  
  async getRecoveryData(projectId: string): Promise<RecoveryData> {
    const progress = await this.loadProgress(projectId);
    const errors = await this.loadErrors(projectId);
    const pending = await this.loadPendingOperations(projectId);
    
    return { progress, errors, pending };
  }
}
```

### 同步日志格式

```typescript
interface SyncLogEntry {
  id: string;
  timestamp: Date;
  projectId: string;
  operation: SyncOperation;
  status: 'success' | 'partial' | 'failed';
  duration: number;
  details: {
    qdrant: OperationResult;
    nebula: OperationResult;
    conflicts: ConflictInfo[];
    resolved: ResolvedConflict[];
  };
  error?: SyncError;
  retryCount: number;
}
```

## 🔄 状态同步工作流

### 正常同步流程
1. **预处理**: 检查项目状态，验证依赖
2. **并行索引**: Qdrant和Nebula同时进行索引
3. **结果验证**: 检查索引结果的一致性
4. **状态更新**: 更新项目索引状态
5. **日志记录**: 记录同步详情

### 降级同步流程
1. **错误检测**: 监控数据库可用性
2. **状态评估**: 确定降级级别
3. **备用策略**: 启用相应的降级处理
4. **部分同步**: 尽可能完成可用操作
5. **日志记录**: 记录降级原因和待处理操作

### 恢复同步流程
1. **状态检查**: 读取进度和错误日志
2. **冲突解决**: 处理数据冲突
3. **增量同步**: 只同步缺失或更新的部分
4. **完整性验证**: 确保数据一致性
5. **状态清理**: 清理恢复相关的临时数据

## 🚀 实施计划

### 阶段一：基础设施准备 (1-2周)
- 调整Qdrant文件位置结构
- 实现Nebula对ProjectIdManager的复用
- 创建协调服务基础框架

### 阶段二：同步机制实现 (2-3周)  
- 实现数据库状态监控
- 开发同步工作流引擎
- 实现进度跟踪和日志记录

### 阶段三：降级处理实现 (1-2周)
- 实现分级降级策略
- 开发错误恢复机制
- 测试各种故障场景

### 阶段四：集成测试与优化 (1-2周)
- 端到端集成测试
- 性能优化和压力测试
- 文档完善和部署指南

这个协调方案确保了Qdrant和Nebula数据库之间的状态同步，提供了完善的降级处理机制，并保留了详细的进度和日志信息用于故障恢复。