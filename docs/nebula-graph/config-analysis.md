## 详细实施方案

### 1. 配置项映射和值统一

首先，让我分析当前NEBULA_*配置与代码默认值的差异：

| 配置项 | .env值 | 代码默认值 | 建议值 | 说明 |
|--------|--------|------------|--------|------|
| `NEBULA_TIMEOUT` | 10000 | 30000 (NebulaConfigService) / 3000 (DatabaseConfigManager) | **30000** | 使用NebulaConfigService的默认值 |
| `NEBULA_RETRY_DELAY` | 5000 | 30000 (NebulaConfigService) / 1000 (DatabaseConfigManager) | **30000** | 使用NebulaConfigService的默认值 |
| `NEBULA_BUFFER_SIZE` | 1000 | 2000 (NebulaConfigService) | **2000** | 使用代码默认值 |
| `NEBULA_PING_INTERVAL` | 3000 | 3000 (NebulaConfigService) | **3000** | 保持一致 |

### 2. 具体修改步骤

#### 步骤1：更新NEBULA_*配置值
修改`.env`文件中的以下行：
- 第17行：`NEBULA_TIMEOUT = 30000` (从10000改为30000)
- 第20行：`NEBULA_RETRY_DELAY = 30000` (从5000改为30000)  
- 第21行：`NEBULA_BUFFER_SIZE = 2000` (从1000改为2000)

#### 步骤2：移除INFRA_GRAPH_*配置块
删除第308-353行的整个INFRA_GRAPH_*配置块。

#### 步骤3：验证INFRA_NEBULA_*配置
确保第216-261行的INFRA_NEBULA_*配置保持不变，因为这些配置在`InfrastructureConfigService.ts`中被正确使用。

### 3. 风险评估和回滚计划

#### 风险点：
1. **配置值变更**：修改NEBULA_*配置值可能影响现有功能
2. **配置移除**：移除INFRA_GRAPH_*配置如果被意外使用会导致问题

#### 缓解措施：
1. **测试验证**：在修改前运行相关测试
2. **备份**：修改前备份`.env`文件
3. **渐进式修改**：先更新配置值，验证后再移除配置块

#### 回滚计划：
- 如果出现问题，恢复备份的`.env`文件
- 或者重新添加INFRA_GRAPH_*配置块

### 4. 验证方法

#### 功能测试：
1. **Nebula连接测试**：验证使用新配置值能否正常连接
2. **超时测试**：验证NEBULA_TIMEOUT=30000是否正常工作
3. **重试机制测试**：验证NEBULA_RETRY_DELAY=30000是否正常工作

#### 配置加载测试：
1. **NebulaConfigService测试**：验证配置加载是否正确
2. **DatabaseConfigManager测试**：验证备用配置加载是否正确

### 5. 实施时间表

- **阶段1**（立即）：备份`.env`文件
- **阶段2**（5分钟）：更新NEBULA_*配置值
- **阶段3**（2分钟）：移除INFRA_GRAPH_*配置块  
- **阶段4**（10分钟）：运行测试验证
- **阶段5**（5分钟）：更新相关文档

### 6. 文档更新

需要更新以下文档：
- `AGENTS.md` - 更新配置说明
- `docs/nebula-graph/nebula-usage-guide.md` - 更新配置示例
- `.env.example` - 同步配置变更

这个实施方案确保了配置的一致性、简洁性和可维护性，同时最小化了对现有功能的影响。