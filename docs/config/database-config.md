# 数据库配置

## 概述

数据库配置包括Qdrant向量数据库和NebulaGraph图数据库的连接和管理配置。

## Qdrant配置项说明

### 连接配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `QDRANT_HOST` | `127.0.0.1` | Qdrant服务器主机地址 |
| `QDRANT_PORT` | `6333` | Qdrant服务器端口 |

## NebulaGraph配置项说明

### 连接配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `NEBULA_HOST` | `127.0.0.1` | NebulaGraph服务器主机地址 |
| `NEBULA_PORT` | `9669` | NebulaGraph服务器端口 |
| `NEBULA_USERNAME` | `root` | NebulaGraph用户名 |
| `NEBULA_PASSWORD` | `nebula` | NebulaGraph密码 |

### 连接管理配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `NEBULA_TIMEOUT` | `10000` | 连接超时时间（毫秒） |
| `NEBULA_MAX_CONNECTIONS` | `10` | 最大连接数 |
| `NEBULA_RETRY_ATTEMPTS` | `3` | 重试次数 |
| `NEBULA_RETRY_DELAY` | `5000` | 重试延迟时间（毫秒） |
| `NEBULA_BUFFER_SIZE` | `1000` | 缓冲区大小 |
| `NEBULA_PING_INTERVAL` | `3000` | 连接心跳间隔（毫秒） |
| `NEBULA_VID_TYPE_LENGTH` | `128` | VID类型长度 |

## 使用这些配置项的文件

### 1. Qdrant配置服务
- **文件**: `src/config/service/QdrantConfigService.ts`
- **用途**: 管理Qdrant数据库配置，包括连接参数和集合命名策略

### 2. NebulaGraph配置服务
- **文件**: `src/config/service/NebulaConfigService.ts`
- **用途**: 管理NebulaGraph数据库配置，包括连接参数和空间命名策略

### 3. Qdrant连接管理器
- **文件**: `src/database/qdrant/QdrantConnectionManager.ts`
- **用途**: 使用Qdrant配置建立和管理数据库连接

### 4. NebulaGraph连接管理器
- **文件**: `src/database/nebula/NebulaConnectionManager.ts`
- **用途**: 使用NebulaGraph配置建立和管理数据库连接

### 5. 项目ID管理器
- **文件**: `src/database/ProjectIdManager.ts`
- **用途**: 使用Qdrant和Nebula配置服务生成项目特定的集合和空间名称

## 配置验证

数据库配置会在连接建立时进行验证，确保能够成功连接到相应的数据库服务。

## 示例配置

```bash
# Qdrant配置示例
QDRANT_HOST=127.0.0.1
QDRANT_PORT=633

# NebulaGraph配置示例
NEBULA_HOST=127.0.0.1
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_TIMEOUT=1000
NEBULA_MAX_CONNECTIONS=10
NEBULA_RETRY_ATTEMPTS=3
NEBULA_RETRY_DELAY=5000
NEBULA_BUFFER_SIZE=1000
NEBULA_PING_INTERVAL=3000
NEBULA_VID_TYPE_LENGTH=128