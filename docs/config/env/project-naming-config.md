# 项目命名配置

## 概述

项目命名配置用于控制不同数据库中项目相关资源的命名规则，包括Qdrant集合和Nebula空间的命名模式。

## 配置项说明

### Qdrant项目命名配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `PROJECT_QDRANT_DEFAULT_COLLECTION` | `default` | Qdrant默认集合名称 |
| `PROJECT_QDRANT_NAMING_PATTERN` | `{projectId}` | Qdrant集合命名模式 |

### Nebula项目命名配置

| 配置项 | 默认值 | 说明 |
|--------|------|
| `PROJECT_NEBULA_DEFAULT_SPACE` | `default` | Nebula默认空间名称 |
| `PROJECT_NEBULA_NAMING_PATTERN` | `{projectId}` | Nebula空间命名模式 |

### 项目管理配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `PROJECT_ALLOW_REINDEX` | `true` | 是否允许项目重新索引 |

## 使用这些配置项的文件

### 1. 项目命名配置服务
- **文件**: `src/config/service/ProjectNamingConfigService.ts`
- **用途**: 管理项目命名配置参数，加载环境变量并验证配置

### 2. Qdrant配置服务
- **文件**: `src/config/service/QdrantConfigService.ts`
- **用途**: 使用项目ID生成Qdrant集合名称

### 3. Nebula配置服务
- **文件**: `src/config/service/NebulaConfigService.ts`
- **用途**: 使用项目ID生成Nebula空间名称

### 4. 项目ID管理器
- **文件**: `src/database/ProjectIdManager.ts`
- **用途**: 使用配置服务生成项目特定的集合和空间名称

### 5. 项目配置服务
- **文件**: `src/config/service/ProjectConfigService.ts`
- **用途**: 管理项目级别的配置，包括重索引权限

## 配置验证

项目命名配置会在项目创建和访问时进行验证，确保命名模式符合数据库要求。

## 示例配置

```bash
# 默认配置
PROJECT_QDRANT_DEFAULT_COLLECTION=default
PROJECT_QDRANT_NAMING_PATTERN={projectId}
PROJECT_NEBULA_DEFAULT_SPACE=default
PROJECT_NEBULA_NAMING_PATTERN={projectId}
PROJECT_ALLOW_REINDEX=true

# 使用项目前缀的配置
PROJECT_QDRANT_DEFAULT_COLLECTION=code-snippets
PROJECT_QDRANT_NAMING_PATTERN=project-{projectId}
PROJECT_NEBULA_DEFAULT_SPACE=codebase
PROJECT_NEBULA_NAMING_PATTERN=project_{projectId}
PROJECT_ALLOW_REINDEX=true

# 严格模式配置（不允许重索引）
PROJECT_QDRANT_DEFAULT_COLLECTION=default
PROJECT_QDRANT_NAMING_PATTERN={projectId}
PROJECT_NEBULA_DEFAULT_SPACE=default
PROJECT_NEBULA_NAMING_PATTERN={projectId}
PROJECT_ALLOW_REINDEX=false
```

## 配置项详细说明

- `PROJECT_QDRANT_DEFAULT_COLLECTION`: Qdrant中项目的默认集合名称
- `PROJECT_QDRANT_NAMING_PATTERN`: Qdrant集合命名模式，支持{projectId}占位符
- `PROJECT_NEBULA_DEFAULT_SPACE`: Nebula中项目的默认空间名称
- `PROJECT_NEBULA_NAMING_PATTERN`: Nebula空间命名模式，支持{projectId}占位符
- `PROJECT_ALLOW_REINDEX`: 控制是否允许对现有项目进行重新索引操作

## 命名模式说明

项目命名配置支持动态命名模式，允许根据项目ID生成唯一的数据库资源名称，从而实现项目间的完全隔离。命名模式中可以使用{projectId}占位符，系统会自动替换为实际的项目ID。

当设置了显式的环境变量（如QDRANT_COLLECTION或NEBULA_SPACE）时，这些变量会覆盖项目命名配置，用于指定固定的集合或空间名称。