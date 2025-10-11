# Project Routes 迁移与集成计划

## 📋 问题分析

### 当前问题
前端访问 `/api/v1/projects` 端点时返回404错误，原因是后端没有实现该API端点。

### 根本原因
- 前端代码在 [`frontend/src/services/api.ts`](frontend/src/services/api.ts:69-77) 中调用了 `/api/v1/projects` 端点
- 后端 [`src/api/ApiServer.ts`](src/api/ApiServer.ts:106-157) 只实现了 `/api/search`、`/api/status`、`/health` 三个端点
- 参考实现 [`ref/src/api/routes/ProjectRoutes.ts`](ref/src/api/routes/ProjectRoutes.ts) 包含完整的项目路由功能，但未被集成

## 🎯 迁移目标

### 短期目标（立即解决404错误）
1. 从 `ref/` 目录迁移完整的 ProjectRoutes 实现
2. 集成相关的依赖服务（ProjectIdManager等）
3. 确保前端能够正常加载项目列表页面

### 中期目标（完整功能集成）
1. 实现完整的项目CRUD操作
2. 集成所有相关服务（IndexService、ProjectLookupService等）
3. 提供完整的API文档

### 长期目标（系统完善）
1. 集成所有相关服务模块
2. 实现真实的项目索引和管理功能
3. 优化性能和用户体验

## 🔄 迁移策略

### 阶段一：基础集成（3-5天）
**目标**: 集成核心的ProjectRoutes功能

**需要迁移的模块**:
1. **ProjectRoutes** - 主路由类 [`ref/src/api/routes/ProjectRoutes.ts`](ref/src/api/routes/ProjectRoutes.ts)
2. **ProjectIdManager** - 项目ID管理 [`ref/src/database/ProjectIdManager.ts`](ref/src/database/ProjectIdManager.ts)
3. **ProjectLookupService** - 项目查找服务 [`ref/src/database/ProjectLookupService.ts`](ref/src/database/ProjectLookupService.ts)
4. **基础接口定义** - 相关类型定义

**需要迁移的具体部分**:
1. **ProjectRoutes类**:
   - `getProjects` 方法（GET /api/v1/projects）- 前端当前需要的主要功能
   - `getProjectDetails` 方法（GET /api/v1/projects/:projectId）
   - `deleteProject` 方法（DELETE /api/v1/projects/:projectId）
   - `reindexProject` 方法（POST /api/v1/projects/:projectId/reindex）
   - 其他方法可以后续逐步实现

2. **依赖服务**:
   - ProjectIdManager - 用于管理项目ID和路径映射
   - ProjectLookupService - 用于查找项目信息

3. **类型定义**:
   - Project接口定义
   - ProjectCreateRequest接口定义
   - ProjectUpdateRequest接口定义

**不需要立即迁移的部分**:
1. **IndexService** - 索引服务，涉及复杂的索引逻辑，可以后续集成
2. **IndexCoordinator** - 索引协调器，可以后续集成
3. **复杂的索引相关方法**:
   - `createProject` 方法（POST /api/v1/projects）
   - `updateProject` 方法（PUT /api/v1/projects/:projectId）
   - `getIndexingProgress` 方法（GET /api/v1/projects/:projectId/progress）
   - `getIndexingStats` 方法（GET /api/v1/projects/:projectId/stats）
   - `validateProjectPath` 方法（POST /api/v1/projects/validate-path）
   - `getLatestUpdatedProject` 方法（GET /api/v1/projects/latest-updated）

**集成步骤**:
1. 创建 `src/api/routes/` 目录结构
2. 复制并简化 ProjectRoutes 类，移除对IndexService等未迁移服务的依赖
3. 实现基本的项目列表功能
4. 集成到 ApiServer 中

### 阶段二：完整功能（1-2周）
**目标**: 集成所有相关服务，实现完整功能

**需要迁移的依赖服务**:
1. **IndexService** - 索引服务（如果存在）
2. **IndexCoordinator** - 索引协调器（如果存在）
3. **其他相关服务** - 根据需要逐步集成

**集成步骤**:
1. 逐步添加之前移除的方法实现
2. 集成IndexService等依赖服务
3. 实现完整的项目CRUD操作

## 📊 详细实施计划

### 第一阶段：基础集成实施

**文件结构规划**:
```
src/
├── api/
│   ├── routes/
│   │   ├── ProjectRoutes.ts          # 项目路由主类
│   │   └── index.ts                  # 路由导出
│   └── ApiServer.ts                  # 主API服务器
├── database/
│   ├── ProjectIdManager.ts           # 项目ID管理
│   └── ProjectLookupService.ts       # 项目查找服务
└── types/
    └── project.ts                    # 项目相关类型定义
```

**集成步骤**:
1. 创建类型定义文件
2. 实现简化的 ProjectIdManager
3. 创建基础的 ProjectRoutes
4. 在 ApiServer 中注册路由

### 第二阶段：服务集成

**依赖服务集成顺序**:
1. 基础配置服务
2. 日志和错误处理服务
3. 数据库连接管理
4. 索引服务框架
5. 完整的项目路由功能

## ⚠️ 风险分析与缓解

### 技术风险
1. **依赖服务缺失**
   - 缓解：先实现核心功能，逐步替换为真实实现
   - 措施：使用接口隔离，依赖注入

2. **性能问题**
   - 缓解：分阶段性能测试
   - 措施：添加性能监控和日志

3. **数据一致性**
   - 缓解：使用事务处理
   - 措施：实现数据验证和回滚机制

### 集成风险
1. **前端兼容性**
   - 缓解：保持API响应格式一致
   - 措施：版本化API端点

2. **错误处理**
   - 缓解：统一的错误响应格式
   - 措施：详细的错误信息和日志

## 🧪 测试策略

### 单元测试
- 每个路由方法的独立测试
- 模拟依赖服务的测试
- 错误场景测试

### 集成测试
- API端点功能测试
- 前端与后端集成测试
- 性能基准测试

### 测试数据
```typescript
// 测试用的项目数据
const testProjects = [
  {
    id: 'test-project-1',
    name: 'Test Project',
    path: '/test/path',
    status: 'completed',
    // ...其他字段
  }
];
```

## 📈 进度监控

### 关键里程碑
1. ✅ 问题分析和规划文档完成
2. ⏳ 第一阶段基础集成实施
3. ◻️ 前端项目列表页面功能验证
4. ◻️ 第二阶段完整功能集成
5. ◻️ 完整功能测试通过

### 质量指标
- API响应时间：< 100ms
- 错误率：< 1%
- 代码覆盖率：≥ 80%
- 前端兼容性：100%

## 🔄 迭代改进计划

每个阶段完成后进行：
1. 代码审查和重构
2. 性能优化
3. 文档更新
4. 用户反馈收集
5. 下一阶段计划调整

---
*文档版本: 1.1*
*创建日期: 2025-09-28*
*最后更新: 2025-09-28*