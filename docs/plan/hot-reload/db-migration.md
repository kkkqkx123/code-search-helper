## 热重载功能数据库修改方案总结

基于对代码的深入分析，我已经完成了热重载功能数据库需求的全面评估。以下是详细的修改方案：

### 📋 当前状态分析

**现有数据库结构**：
- `project_status` 表缺少热重载相关字段
- 热重载配置目前存储在内存和JSON文件中
- `SqliteStateManager` 只处理基础项目状态数据

**热重载数据需求**（来自 [`ProjectStateManager.ts`](src/service/project/ProjectStateManager.ts:45-62)）：
```typescript
hotReload: {
  enabled: boolean;
  config: {
    debounceInterval?: number;
    watchPatterns?: string[];
    ignorePatterns?: string[];
    maxFileSize?: number;
    errorHandling?: {
      maxRetries?: number;
      alertThreshold?: number;
      autoRecovery?: boolean;
    };
  };
  lastEnabled?: Date;
  lastDisabled?: Date;
  changesDetected?: number;
  errorsCount?: number;
}
```

### 🎯 推荐修改方案

#### 方案一：扩展 `project_status` 表（推荐）

**SQL迁移脚本**：
```sql
-- src/database/splite/migrations/001_add_hot_reload_columns.sql
BEGIN TRANSACTION;

ALTER TABLE project_status ADD COLUMN hot_reload_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE project_status ADD COLUMN hot_reload_config JSON;
ALTER TABLE project_status ADD COLUMN hot_reload_last_enabled DATETIME;
ALTER TABLE project_status ADD COLUMN hot_reload_last_disabled DATETIME;
ALTER TABLE project_status ADD COLUMN hot_reload_changes_detected INTEGER DEFAULT 0;
ALTER TABLE project_status ADD COLUMN hot_reload_errors_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_project_status_hot_reload_enabled 
ON project_status(hot_reload_enabled);

COMMIT;
```

#### 方案二：创建独立表（备选）
```sql
CREATE TABLE IF NOT EXISTS hot_reload_configs (
    project_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    config JSON,
    last_enabled DATETIME,
    last_disabled DATETIME,
    changes_detected INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 🔧 实施计划

#### 阶段一：数据库迁移（1-2天）
1. **创建迁移脚本**：实现SQL迁移脚本
2. **迁移执行器**：创建自动执行迁移的工具
3. **数据迁移**：将现有JSON文件中的热重载配置迁移到SQLite

#### 阶段二：代码更新（2-3天）
1. **更新SqliteStateManager**：扩展接口和实现以支持热重载数据
2. **更新ProjectStateManager**：确保热重载数据正确同步到SQLite
3. **更新数据同步逻辑**：在 [`ProjectStateManager.ts`](src/service/project/ProjectStateManager.ts:261-285) 中添加热重载数据保存

#### 阶段三：测试验证（1-2天）
1. **单元测试**：测试新的数据库操作
2. **集成测试**：测试完整的热重载工作流
3. **数据一致性验证**：确保SQLite和JSON备份数据一致

### ✅ 兼容性保证

**向后兼容性措施**：
- 新增字段使用默认值，不影响现有数据
- 保持JSON文件备份机制作为回滚方案
- 现有API接口完全保持不变
- 热重载配置服务逻辑无需修改

**性能优化**：
- 新增索引优化查询性能
- 批量操作减少数据库I/O
- 异步数据同步避免阻塞主线程

### 🚀 实施优先级

**高优先级**：
1. 数据库迁移脚本
2. SqliteStateManager扩展
3. ProjectStateManager数据同步更新

**中优先级**：
1. 迁移执行器工具
2. 数据一致性验证工具
3. 性能监控

**低优先级**：
1. 高级查询优化
2. 历史数据迁移工具

### 📊 风险评估与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 数据库迁移失败 | 中 | 实现回滚机制，保持JSON备份 |
| 数据不一致 | 中 | 实现数据验证和同步检查 |
| 性能下降 | 低 | 新增索引，监控性能指标 |

### 🎯 结论

**数据库需要修改**以支持热重载功能的完整持久化。推荐采用**方案一**（扩展 `project_status` 表），因为：

1. **性能更好**：减少表连接操作
2. **一致性更强**：项目状态数据集中管理
3. **实现更简单**：无需创建新表和外键关系
4. **维护成本低**：单一数据源管理
