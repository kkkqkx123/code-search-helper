# IndexSyncService 模块迁移详细计划

## 🎯 迁移目标

基于架构分析，制定具体的模块迁移执行计划，确保 IndexSyncService 的依赖关系更加清晰和合理。

## 📋 迁移清单

### ✅ 立即执行（高优先级）

#### 1. PerformanceOptimizerService 迁移
**源文件**: `src/service/resilience/ResilientBatchingService.ts`
**目标文件**: `src/infrastructure/batching/PerformanceOptimizerService.ts`

**迁移步骤**:
1. 复制文件到新位置
2. 更新文件中的包导入路径
3. 更新所有引用该服务的导入语句
4. 验证测试通过

**影响文件**:
- `src/service/index/IndexSyncService.ts` (第12行导入)
- `src/types.ts` (依赖注入类型定义)
- 所有测试文件中的导入路径

#### 2. 更新导入路径
**需要更新的文件**:
```typescript
// src/service/index/IndexSyncService.ts 第12行
// 从:
import { PerformanceOptimizerService } from '../resilience/ResilientBatchingService';
// 到:
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';
```

### 🔄 短期执行（中优先级）

#### 3. 批处理优化器整合
**问题**: `PerformanceOptimizerService` 和 `BatchOptimizer` 功能重叠

**整合方案**:
```typescript
// 创建统一的批处理接口
export interface IBatchProcessingService {
  processBatches<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>): Promise<R[]>;
  executeWithRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
  getOptimalBatchSize(itemCount: number): number;
  adjustBatchSizeBasedOnPerformance(executionTime: number, currentBatchSize: number): number;
}

// 在 infrastructure/batching/ 中实现统一服务
export class UnifiedBatchProcessingService implements IBatchProcessingService {
  // 合并两个服务的最佳功能
}
```

#### 4. 代码分割服务重构
**当前结构**:
```
src/service/parser/splitting/
├── ASTCodeSplitter.ts
├── Splitter.ts
```

**建议结构**:
```
src/service/parser/splitting/
├── interfaces/
│   └── ISplitter.ts          # 分割器接口
├── strategies/
│   ├── ASTChunkingStrategy.ts    # AST分割策略
│   ├── SimpleChunkingStrategy.ts # 简单分割策略
│   └── SemanticChunkingStrategy.ts # 语义分割策略
├── ChunkingStrategyManager.ts    # 策略管理器
└── ASTCodeSplitter.ts        # 主分割器（使用策略模式）
```

### 🗓️ 中期执行（低优先级）

#### 5. 文件系统服务统一
**当前问题**: 三个独立的文件系统服务，缺少统一接口实现

**统一方案**:
```typescript
// src/service/filesystem/FileSystemService.ts
export class FileSystemService implements IFileSystemService {
  constructor(
    private traversal: FileSystemTraversal,
    private watcher: FileWatcherService,
    private changeDetection: ChangeDetectionService
  ) {}

  // 实现统一的接口方法
  async traverseDirectory(rootPath: string, options?: TraversalOptions): Promise<TraversalResult> {
    return this.traversal.traverseDirectory(rootPath, options);
  }

  async startWatching(options: FileWatcherOptions): Promise<void> {
    return this.watcher.startWatching(options);
  }

  // ... 其他接口方法
}
```

#### 6. 配置服务提取
**当前问题**: IndexSyncService 中嵌入器维度配置逻辑过于复杂

**提取方案**:
```typescript
// src/service/index/IndexingConfigService.ts
export class IndexingConfigService {
  constructor(
    private embedderFactory: EmbedderFactory,
    private configService: ConfigService
  ) {}

  async getVectorDimensions(embedderProvider: string): Promise<number> {
    // 集中处理维度配置逻辑
  }

  getOptimalBatchSize(projectSize: number): number {
    // 基于项目大小返回最优批处理大小
  }

  getChunkSize(language: string): number {
    // 基于语言类型返回合适的块大小
  }
}
```

## 🏗️ 具体实施步骤

### 阶段 1: PerformanceOptimizerService 迁移 (1天)

**第1步: 文件迁移**
```bash
# 复制文件到新位置
cp src/service/resilience/Resilient