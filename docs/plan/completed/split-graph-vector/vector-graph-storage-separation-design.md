# 向量嵌入与图存储分离管理设计方案

## 📋 概述

本方案旨在实现向量嵌入（Qdrant）和图存储（Nebula Graph）的状态分离管理，提供独立的API端点执行操作，并在前端增加相应的交互组件。

## 🎯 设计目标

1. **状态分离**：独立跟踪向量嵌入和图存储的状态和进度
2. **独立操作**：支持分别执行向量嵌入和图存储操作
3. **前端集成**：提供直观的用户界面进行分离操作
4. **向后兼容**：保持现有功能的正常运行

## 🔧 技术方案

### 1. 项目状态管理扩展

#### 1.1 扩展 ProjectState 接口

```typescript
export interface ProjectState {
  projectId: string;
  projectPath: string;
  name: string;
  description?: string;
  
  // 主状态（向后兼容）
  status: 'active' | 'inactive' | 'indexing' | 'error';
  
  // 分离的状态管理
  vectorStatus: StorageStatus;
  graphStatus: StorageStatus;
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt?: Date;
  
  // 进度统计
  indexingProgress?: number;
  totalFiles?: number;
  indexedFiles?: number;
  failedFiles?: number;
  
  // 集合信息
  collectionInfo?: {
    name: string;
    vectorsCount: number;
    status: string;
  };
  
  // 设置
  settings: {
    autoIndex: boolean;
    watchChanges: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
  };
  
  metadata?: Record<string, any>;
}

// 新增存储状态接口
export interface StorageStatus {
  status: 'pending' | 'indexing' | 'completed' | 'error' | 'partial';
  progress: number; // 0-100
  totalFiles?: number;
  processedFiles?: number;
  failedFiles?: number;
  lastUpdated: Date;
  lastCompleted?: Date;
  error?: string;
}
```

#### 1.2 状态管理逻辑

- **初始化状态**：新项目创建时，vectorStatus和graphStatus都设置为pending
- **状态同步**：当任一存储状态变化时，更新主状态
- **错误处理**：单个存储失败不影响另一个存储的操作

### 2. API端点设计

#### 2.1 新增独立端点

```typescript
// 向量嵌入相关端点
POST /api/v1/projects/:projectId/index-vectors   // 执行向量嵌入
GET /api/v1/projects/:projectId/vector-status   // 获取向量状态

// 图存储相关端点  
POST /api/v1/projects/:projectId/index-graph     // 执行图存储
GET /api/v1/projects/:projectId/graph-status     // 获取图状态

// 批量操作端点
POST /api/v1/projects/batch-index-vectors        // 批量向量嵌入
POST /api/v1/projects/batch-index-graph          // 批量图存储
```

#### 2.2 请求/响应格式

**执行向量嵌入请求**：
```json
{
  "options": {
    "embedder": "openai",
    "batchSize": 100,
    "maxConcurrency": 3
  }
}
```

**执行向量嵌入响应**：
```json
{
  "success": true,
  "data": {
    "projectId": "proj_123",
    "operationId": "op_456",
    "status": "started",
    "estimatedTime": 300
  }
}
```

**获取状态响应**：
```json
{
  "success": true,
  "data": {
    "status": "indexing",
    "progress": 45,
    "totalFiles": 1000,
    "processedFiles": 450,
    "failedFiles": 2,
    "startTime": "2024-01-15T10:30:00Z",
    "estimatedCompletion": "2024-01-15T10:35:00Z"
  }
}
```

### 3. 后端服务架构

#### 3.1 服务层扩展

```typescript
// 新增分离的索引服务
export class VectorIndexService {
  async indexVectors(projectId: string, options?: IndexOptions): Promise<IndexResult>;
  async getVectorStatus(projectId: string): Promise<StorageStatus>;
}

export class GraphIndexService {
  async indexGraph(projectId: string, options?: IndexOptions): Promise<IndexResult>;
  async getGraphStatus(projectId: string): Promise<StorageStatus>;
}

// 协调服务
export class StorageCoordinatorService {
  async coordinateIndexing(projectId: string, options: {
    vectors?: boolean;
    graph?: boolean;
  }): Promise<CoordinatedResult>;
}
```

#### 3.2 路由层实现

```typescript
// 在 ProjectRoutes 中新增端点
private setupRoutes(): void {
  // 现有路由...
  
  // 新增向量端点
  this.router.post('/:projectId/index-vectors', this.indexVectors.bind(this));
  this.router.get('/:projectId/vector-status', this.getVectorStatus.bind(this));
  
  // 新增图端点
  this.router.post('/:projectId/index-graph', this.indexGraph.bind(this));
  this.router.get('/:projectId/graph-status', this.getGraphStatus.bind(this));
  
  // 批量端点
  this.router.post('/batch-index-vectors', this.batchIndexVectors.bind(this));
  this.router.post('/batch-index-graph', this.batchIndexGraph.bind(this));
}
```

### 4. 前端交互设计

#### 4.1 项目页面增强

**项目列表增强**：
- 显示双状态指示器（向量/图）
- 分别的操作按钮
- 进度条分别显示

**操作面板**：
```html
<div class="storage-actions">
  <div class="vector-action">
    <span class="status-indicator" data-status="completed"></span>
    <span>向量存储</span>
    <button class="action-button" data-action="index-vectors">执行向量嵌入</button>
    <progress value="100" max="100"></progress>
  </div>
  
  <div class="graph-action">
    <span class="status-indicator" data-status="pending"></span>
    <span>图存储</span>
    <button class="action-button" data-action="index-graph">执行图存储</button>
    <progress value="0" max="100"></progress>
  </div>
</div>
```

#### 4.2 API客户端扩展

```typescript
// 扩展 ApiClient
class ApiClient {
  async indexVectors(projectId: string, options?: any): Promise<ApiResponse>;
  async indexGraph(projectId: string, options?: any): Promise<ApiResponse>;
  async getVectorStatus(projectId: string): Promise<ApiResponse>;
  async getGraphStatus(projectId: string): Promise<ApiResponse>;
  async batchIndexVectors(projectIds: string[], options?: any): Promise<ApiResponse>;
  async batchIndexGraph(projectIds: string[], options?: any): Promise<ApiResponse>;
}
```

### 5. 实施计划

#### 5.1 阶段一：核心功能（1-2周）
- [ ] 扩展 ProjectState 接口
- [ ] 实现状态管理逻辑
- [ ] 新增API端点
- [ ] 基础前端集成

#### 5.2 阶段二：高级功能（1周）
- [ ] 批量操作支持
- [ ] 状态监控和通知
- [ ] 错误处理和重试机制

#### 5.3 阶段三：优化和测试（1周）
- [ ] 性能优化
- [ ] 完整测试覆盖
- [ ] 文档编写

### 6. 风险评估与缓解

#### 6.1 技术风险
- **状态一致性**：实现双状态同步机制
- **性能影响**：异步处理避免阻塞
- **错误处理**：完善的异常处理流程

#### 6.2 兼容性风险
- 保持现有API端点功能不变
- 逐步迁移，分阶段发布

## 🚀 预期成果

1. **独立状态管理**：向量和图存储状态完全分离
2. **灵活操作**：支持分别执行和批量操作
3. **增强可视化**：清晰的状态显示和操作界面
4. **系统稳定性**：完善的错误处理和恢复机制

## 📊 成功指标

- 状态分离准确率：100%
- 独立操作成功率：>99%
- 性能影响：<10% 额外开销
- 用户满意度：操作直观性提升

---

*设计方案版本：v1.0*
*最后更新：2024-01-15*