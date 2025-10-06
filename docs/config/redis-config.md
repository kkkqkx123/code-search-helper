# Redis配置

## 概述

Redis配置用于控制Redis缓存服务的连接和管理，包括启用状态、连接URL、内存限制、多级缓存设置和各种TTL配置。

## 配置项说明

### Redis基础配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_ENABLED` | `true` | 是否启用Redis缓存 |
| `REDIS_URL` | `redis://localhost:6379` | Redis服务器连接URL |
| `REDIS_MAXMEMORY` | `128mb` | Redis最大内存限制 |

### Redis缓存配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_USE_MULTI_LEVEL` | `true` | 是否启用多级缓存 |
| `REDIS_TTL_EMBEDDING` | `86400` | 嵌入向量缓存TTL（秒） |
| `REDIS_TTL_SEARCH` | `3600` | 搜索结果缓存TTL（秒） |
| `REDIS_TTL_GRAPH` | `1800` | 图数据缓存TL（秒） |
| `REDIS_TTL_PROGRESS` | `300` | 任务进度缓存TTL（秒） |

### Redis连接池配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_RETRY_ATTEMPTS` | `3` | 连接重试次数 |
| `REDIS_RETRY_DELAY` | `1000` | 连接重试延迟（毫秒） |
| `REDIS_POOL_MIN` | `1` | 连接池最小连接数 |
| `REDIS_POOL_MAX` | `5` | 连接池最大连接数 |

## 使用这些配置项的文件

### 1. Redis配置服务
- **文件**: `src/config/service/RedisConfigService.ts`
- **用途**: 管理Redis配置参数，加载环境变量并验证配置

### 2. 缓存服务
- **文件**: `src/service/cache/CacheService.ts` (可能在其他位置)
- **用途**: 使用Redis配置实现缓存功能

### 3. 嵌入器缓存
- **文件**: `ref/src/embedders/test/OllamaEmbedder.test.ts` (使用缓存的嵌入器)
- **用途**: 使用Redis缓存嵌入结果

### 4. 搜索服务
- **文件**: `src/service/search/SearchService.ts` (可能在其他位置)
- **用途**: 使用Redis缓存搜索结果

## 配置验证

Redis配置会在应用程序启动时进行验证，确保连接URL格式正确且Redis服务可访问。

## 示例配置

```bash
# 默认配置
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_MAXMEMORY=128mb
REDIS_USE_MULTI_LEVEL=true
REDIS_TTL_EMBEDDING=86400
REDIS_TTL_SEARCH=3600
REDIS_TTL_GRAPH=1800
REDIS_TTL_PROGRESS=300
REDIS_RETRY_ATTEMPTS=3
REDIS_RETRY_DELAY=1000
REDIS_POOL_MIN=1
REDIS_POOL_MAX=5

# 高性能配置
REDIS_ENABLED=true
REDIS_URL=redis://redis-cluster:6379
REDIS_MAXMEMORY=512mb
REDIS_USE_MULTI_LEVEL=true
REDIS_TTL_EMBEDDING=17280  # 2天
REDIS_TTL_SEARCH=7200       # 2小时
REDIS_TTL_GRAPH=3600        # 1小时
REDIS_TTL_PROGRESS=600      # 10分钟
REDIS_RETRY_ATTEMPTS=5
REDIS_RETRY_DELAY=2000
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20

# 低资源环境配置
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379
REDIS_MAXMEMORY=64mb
REDIS_USE_MULTI_LEVEL=false
REDIS_TTL_EMBEDDING=43200   # 12小时
REDIS_TTL_SEARCH=1800       # 30分钟
REDIS_TTL_GRAPH=900         # 15分钟
REDIS_TTL_PROGRESS=120      # 2分钟
REDIS_RETRY_ATTEMPTS=2
REDIS_RETRY_DELAY=1500
REDIS_POOL_MIN=1
REDIS_POOL_MAX=2
```

## 配置项详细说明

- `REDIS_ENABLED`: 控制是否启用Redis缓存功能
- `REDIS_URL`: Redis服务器的连接URL，格式为redis://host:port
- `REDIS_MAXMEMORY`: Redis服务器的最大内存限制
- `REDIS_USE_MULTI_LEVEL`: 是否启用多级缓存策略
- `REDIS_TTL_EMBEDDING`: 嵌入向量在Redis中的缓存时间
- `REDIS_TTL_SEARCH`: 搜索结果在Redis中的缓存时间
- `REDIS_TTL_GRAPH`: 图数据在Redis中的缓存时间
- `REDIS_TTL_PROGRESS`: 任务进度在Redis中的缓存时间
- `REDIS_RETRY_ATTEMPTS`: Redis连接失败时的重试次数
- `REDIS_RETRY_DELAY`: Redis连接重试的延迟时间
- `REDIS_POOL_MIN`: Redis连接池的最小连接数
- `REDIS_POOL_MAX`: Redis连接池的最大连接数