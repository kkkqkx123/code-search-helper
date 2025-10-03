# Qdrant与Nebula命名约定实施迁移指南

## 📋 概述

本文档提供了将现有项目迁移到新的Qdrant与Nebula命名约定配置的详细步骤。新实现提供了项目隔离、统一命名约定和增强的错误处理。

## 🎯 迁移目标

- **项目隔离**: 每个项目使用独立的集合/空间
- **统一命名**: Qdrant和Nebula使用相同的命名约定（连字符分隔）
- **配置灵活性**: 支持显式配置和自动生成
- **错误处理**: 改进的错误处理和日志记录

## 🚀 迁移步骤

### 阶段一：环境配置更新（预计时间：10分钟）

#### 1. 更新 `.env.example` 文件

**修改前:**
```bash
# Qdrant Configuration
QDRANT_HOST = 127.0.0.1
QDRANT_PORT = 6333
QDRANT_COLLECTION = code-snippets  # 固定集合名称

# NebulaGraph Configuration  
NEBULA_HOST = 127.0.1
NEBULA_PORT = 9669
NEBULA_SPACE = code_graphs        # 固定空间名称
```

**修改后:**
```bash
# Qdrant Configuration
QDRANT_HOST = 127.0.0.1
QDRANT_PORT = 6333
# QDRANT_COLLECTION = (可选) # 显式设置将覆盖自动生成

# NebulaGraph Configuration  
NEBULA_HOST = 127.0.0.1
NEBULA_PORT = 9669
# NEBULA_SPACE = (可选)     # 显式设置将覆盖自动生成
```

#### 2. 保留显式配置（可选）

如果需要为特定项目使用固定名称，可以设置环境变量：
```bash
QDRANT_COLLECTION = my-custom-collection
NEBULA_SPACE = my-custom-space
```

### 阶段二：代码集成（预计时间：15分钟）

#### 1. 配置服务使用

新实现提供了以下方法来获取命名：

```typescript
// 获取Qdrant集合名称
const collectionName = qdrantConfigService.getCollectionNameForProject(projectId);

// 获取Nebula空间名称
const spaceName = nebulaConfigService.getSpaceNameForProject(projectId);
```

#### 2. 命名验证

新实现包含命名验证功能：
```typescript
// 验证命名是否符合数据库要求
const isValid = configService.validateNamingConvention(name);
```

### 阶段三：数据迁移（预计时间：30分钟）

#### 1. 现有数据迁移

如果当前使用固定集合/空间，需要迁移现有数据：

```bash
# Qdrant数据迁移示例
# 1. 导出现有数据
qdrant-cli dump --collection code-snippets --output backup.json

# 2. 为每个项目创建新集合并导入数据
qdrant-cli create-collection --collection project-{projectId}
qdrant-cli import --collection project-{projectId} --input backup.json
```

#### 2. 项目映射更新

新实现会自动管理项目映射，无需手动干预。

## ⚠️ 注意事项

### 1. 向后兼容性

- 新实现保持了向后兼容性
- 现有配置在环境变量中仍然有效
- 默认行为是为每个项目创建独立的集合/空间

### 2. 配置冲突检测

系统会自动检测配置冲突：
```typescript
// 检测显式配置是否与项目隔离命名冲突
const hasConflict = ProjectIdManager.checkConfigurationConflict(explicitName, projectId);
```

### 3. 命名约定规则

- **格式**: `[a-zA-Z0-9_-]{1,63}`
- **不允许**: 以 `_` 开头的名称
- **推荐**: 使用连字符分隔，如 `project-{projectId}`

## 🔧 故障排除

### 常见问题

#### 1. 命名验证失败
**问题**: `Generated collection name is invalid`
**解决方案**: 检查生成的名称是否符合命名约定

#### 2. 配置未生效
**问题**: 环境变量配置未被使用
**解决方案**: 确保环境变量名称正确且不等于默认值

#### 3. 项目隔离未工作
**问题**: 所有项目使用相同集合/空间
**解决方案**: 确保未设置显式环境变量覆盖

## 📈 最佳实践

### 1. 推荐配置

对于新项目，推荐使用自动生成的命名：
```bash
# 保持环境变量为空或注释掉，使用自动生成
# QDRANT_COLLECTION = 
# NEBULA_SPACE = 
```

### 2. 显式配置使用场景

仅在以下情况下使用显式配置：
- 需要共享集合/空间的特殊场景
- 迁移现有固定命名的项目
- 特殊的命名需求

### 3. 监控和日志

新实现提供详细的日志记录：
- 配置加载日志
- 命名生成日志
- 错误处理日志

## 🔄 版本升级

### 从旧版本升级

1. 备份现有配置和数据
2. 更新依赖包
3. 应用新的环境配置
4. 测试配置服务
5. 验证命名生成
6. 监控系统运行状态

## 📞 支持

如遇到迁移问题，请参考以下资源：

- [项目文档](docs/)
- [API参考](src/config/service/)
- [测试用例](src/__tests__/integration/naming-convention-integration.test.ts)

---

**文档版本**: 1.0  
**最后更新**: 2025-10-03  
**作者**: Code Assistant