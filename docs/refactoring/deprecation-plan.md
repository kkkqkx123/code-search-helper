# 模块弃用计划

## 概述

基于Repository层重构完成后，以下模块需要逐步弃用并迁移到新架构。

## 待弃用模块清单

### 1. GraphService.ts (旧版本)

**文件路径**: `src/service/graph/core/GraphService.ts`

**替代方案**: `src/service/graph/core/GraphService.refactored.ts`

**当前依赖**:
- `src/core/registrars/DatabaseServiceRegistrar.ts` (第28行, 105-106行)
- 所有通过DI注入`IGraphService`的服务

**弃用原因**:
- 直接依赖数据库层组件(NebulaClient, NebulaConnectionManager等)
- 违反分层架构原则
- 缺少Repository抽象层

**迁移步骤**:
1. 更新`DatabaseServiceRegistrar.ts`，将GraphService绑定改为GraphService.refactored
2. 验证所有依赖IGraphService的服务正常工作
3. 重命名`GraphService.refactored.ts`为`GraphService.ts`
4. 删除旧的`GraphService.ts`

### 2. service/graph/query/GraphQueryBuilder.ts

**文件路径**: `src/service/graph/query/GraphQueryBuilder.ts`

**替代方案**: `src/service/graph/query/BusinessQueryBuilder.ts`

**当前依赖**:
- `src/service/graph/core/GraphDataService.ts` (第7行)
- `src/service/graph/core/__tests__/GraphDataService.test.ts` (第8行)

**弃用原因**:
- 与数据库层的GraphQueryBuilder命名冲突
- 职责不清晰

**迁移步骤**:
1. 更新`GraphDataService.ts`，将GraphQueryBuilder改为BusinessQueryBuilder
2. 更新相关测试文件
3. 验证功能正常
4. 删除`query/GraphQueryBuilder.ts`及其测试文件

### 3. database/nebula/query/GraphQueryBuilder.ts (保留)

**文件路径**: `src/database/nebula/query/GraphQueryBuilder.ts`

**状态**: 保留，但标记为数据库层内部使用

**说明**:
- 此文件属于数据库层，提供Nebula特定的查询构建
- 不应被服务层直接使用
- 通过Repository层间接调用

## 迁移优先级

### 高优先级 (立即执行)

1. **更新GraphService的DI绑定**
   - 影响范围: 整个应用
   - 风险: 中等
   - 预计时间: 30分钟

2. **迁移GraphDataService使用BusinessQueryBuilder**
   - 影响范围: GraphDataService及其测试
   - 风险: 低
   - 预计时间: 20分钟

### 中优先级 (1周内完成)

3. **重命名GraphService.refactored.ts**
   - 影响范围: 文件引用
   - 风险: 低
   - 预计时间: 10分钟

4. **删除旧的GraphService.ts**
   - 影响范围: 无(已完成迁移)
   - 风险: 低
   - 预计时间: 5分钟

### 低优先级 (2周内完成)

5. **删除service/graph/query/GraphQueryBuilder.ts**
   - 影响范围: 无(已完成迁移)
   - 风险: 低
   - 预计时间: 5分钟

## 详细迁移步骤

### 步骤1: 更新GraphService DI绑定

**文件**: `src/core/registrars/DatabaseServiceRegistrar.ts`

**修改内容**:
```typescript
// 修改前
import { GraphService } from '../../service/graph/core/GraphService';

// 修改后
import { GraphService } from '../../service/graph/core/GraphService.refactored';
```

**验证方法**:
```bash
npm test src/service/graph/core/__tests__/GraphService.test.ts
npm run build
```

### 步骤2: 迁移GraphDataService

**文件**: `src/service/graph/core/GraphDataService.ts`

**修改内容**:
```typescript
// 修改前
import { GraphQueryBuilder } from '../../../database/nebula/query/GraphQueryBuilder';

// 修改后
import { BusinessQueryBuilder } from '../query/BusinessQueryBuilder';
```

**同时更新**:
- `src/service/graph/core/__tests__/GraphDataService.test.ts`

**验证方法**:
```bash
npm test src/service/graph/core/__tests__/GraphDataService.test.ts
```

### 步骤3: 重命名和清理

**操作**:
1. 重命名`GraphService.refactored.ts` → `GraphService.ts`
2. 删除旧的`GraphService.ts`
3. 删除`query/GraphQueryBuilder.ts`
4. 删除`query/__tests__/GraphQueryBuilder.test.ts`

**验证方法**:
```bash
npm test
npm run build
```

## 回滚计划

如果迁移过程中出现问题:

1. **立即回滚DI配置**
   ```typescript
   // 恢复到旧版本
   import { GraphService } from '../../service/graph/core/GraphService';
   ```

2. **保留旧文件直到验证完成**
   - 不要立即删除旧文件
   - 先标记为deprecated
   - 验证稳定后再删除

3. **使用Git回滚**
   ```bash
   git checkout -- src/core/registrars/DatabaseServiceRegistrar.ts
   ```

## 风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| DI绑定错误 | 高 | 低 | 完整的单元测试覆盖 |
| 接口不兼容 | 中 | 低 | 保持接口一致性 |
| 性能下降 | 低 | 低 | 性能测试验证 |
| 功能缺失 | 中 | 低 | 集成测试验证 |

## 验证清单

- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 构建成功
- [ ] 性能测试无明显下降
- [ ] 代码审查通过
- [ ] 文档已更新

## 时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 第1天 | 更新DI配置 | 30分钟 | - |
| 第1天 | 迁移GraphDataService | 20分钟 | - |
| 第2天 | 运行完整测试 | 1小时 | - |
| 第3天 | 重命名文件 | 10分钟 | - |
| 第4天 | 删除旧文件 | 5分钟 | - |
| 第5天 | 文档更新 | 30分钟 | - |

## 参考文档

- [Repository层实现总结](./repository-layer-implementation.md)
- [职责划分分析](../analysis/nebula-graph-responsibility-analysis.md)