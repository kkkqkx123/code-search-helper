# 基础设施配置说明

本文档详细说明了项目中使用的基础设施配置项及其作用。这些配置项控制着Qdrant和Nebula数据库的行为，包括缓存、性能监控、批处理、连接池和向量/图相关的配置。

所有配置项都以 `INFRA_` 前缀开头，分别针对不同的数据库和功能模块进行配置。

## 通用配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_CACHE_ENABLED | true | 是否启用缓存功能 |
| INFRA_MONITORING_ENABLED | true | 是否启用监控功能 |
| INFRA_BATCHING_ENABLED | true | 是否启用批处理功能 |
| INFRA_LOG_LEVEL | info | 日志级别 (debug, info, warn, error) |
| INFRA_HEALTH_CHECKS_ENABLED | true | 是否启用健康检查 |
| INFRA_HEALTH_CHECK_INTERVAL | 30000 | 健康检查间隔时间（毫秒） |
| INFRA_SHUTDOWN_TIMEOUT | 10000 | 优雅关闭超时时间（毫秒） |

## Qdrant 配置

### Qdrant 缓存配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_QDRANT_CACHE_TTL | 300000 | 缓存默认过期时间（毫秒） |
| INFRA_QDRANT_CACHE_MAX_ENTRIES | 10000 | 缓存最大条目数 |
| INFRA_QDRANT_CACHE_CLEANUP_INTERVAL | 60000 | 缓存清理间隔时间（毫秒） |
| INFRA_QDRANT_CACHE_STATS_ENABLED | true | 是否启用缓存统计 |

### Qdrant 性能配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_QDRANT_PERFORMANCE_INTERVAL | 30000 | 性能监控间隔时间（毫秒） |
| INFRA_QDRANT_PERFORMANCE_RETENTION | 86400000 | 性能指标保留时间（毫秒） |
| INFRA_QDRANT_PERFORMANCE_LOGGING_ENABLED | true | 是否启用详细性能日志 |
| INFRA_QDRANT_PERFORMANCE_QUERY_TIMEOUT | 3000 | 查询超时时间（毫秒） |
| INFRA_QDRANT_PERFORMANCE_MEMORY_THRESHOLD | 0.80 | 内存使用阈值（0-1之间） |
| INFRA_QDRANT_PERFORMANCE_RESPONSE_THRESHOLD | 2000 | 响应时间阈值（毫秒） |

### Qdrant 批处理配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_QDRANT_BATCH_CONCURRENCY | 5 | 最大并发操作数 |
| INFRA_QDRANT_BATCH_SIZE_DEFAULT | 50 | 默认批处理大小 |
| INFRA_QDRANT_BATCH_SIZE_MAX | 500 | 最大批处理大小 |
| INFRA_QDRANT_BATCH_SIZE_MIN | 10 | 最小批处理大小 |
| INFRA_QDRANT_BATCH_MEMORY_THRESHOLD | 0.80 | 批处理内存阈值（0-1之间） |
| INFRA_QDRANT_BATCH_PROCESSING_TIMEOUT | 300000 | 批处理超时时间（毫秒） |
| INFRA_QDRANT_BATCH_RETRY_ATTEMPTS | 3 | 重试次数 |
| INFRA_QDRANT_BATCH_RETRY_DELAY | 1000 | 重试延迟时间（毫秒） |
| INFRA_QDRANT_BATCH_ADAPTIVE_ENABLED | true | 是否启用自适应批处理 |
| INFRA_QDRANT_BATCH_PERFORMANCE_THRESHOLD | 1000 | 批处理性能阈值（毫秒） |
| INFRA_QDRANT_BATCH_ADJUSTMENT_FACTOR | 0.1 | 批处理调整因子（0-1之间） |

### Qdrant 连接配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_QDRANT_CONNECTION_POOL_MAX | 10 | 连接池最大连接数 |
| INFRA_QDRANT_CONNECTION_POOL_MIN | 2 | 连接池最小连接数 |
| INFRA_QDRANT_CONNECTION_TIMEOUT | 30000 | 连接超时时间（毫秒） |
| INFRA_QDRANT_CONNECTION_IDLE_TIMEOUT | 300000 | 连接空闲超时时间（毫秒） |
| INFRA_QDRANT_CONNECTION_ACQUIRE_TIMEOUT | 10000 | 获取连接超时时间（毫秒） |
| INFRA_QDRANT_CONNECTION_VALIDATE_INTERVAL | 6000 | 连接验证间隔时间（毫秒） |
| INFRA_QDRANT_CONNECTION_POOL_ENABLED | true | 是否启用连接池 |

### Qdrant 向量配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_QDRANT_VECTOR_COLLECTION_DEFAULT | default | 默认集合名称 |
| INFRA_QDRANT_VECTOR_SIZE | 1536 | 向量维度大小 |
| INFRA_QDRANT_VECTOR_DISTANCE | Cosine | 距离计算方式 (Cosine, Euclidean, DotProduct) |
| INFRA_QDRANT_VECTOR_INDEX_TYPE | hnsw | 索引类型 |
| INFRA_QDRANT_VECTOR_SEARCH_LIMIT | 10 | 搜索结果限制数量 |
| INFRA_QDRANT_VECTOR_SEARCH_THRESHOLD | 0.5 | 搜索相似度阈值（0-1之间） |
| INFRA_QDRANT_VECTOR_SEARCH_EXACT_ENABLED | false | 是否启用精确搜索 |

## Nebula 配置

### Nebula 缓存配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_NEBULA_CACHE_TTL | 30000 | 缓存默认过期时间（毫秒） |
| INFRA_NEBULA_CACHE_MAX_ENTRIES | 10000 | 缓存最大条目数 |
| INFRA_NEBULA_CACHE_CLEANUP_INTERVAL | 60000 | 缓存清理间隔时间（毫秒） |
| INFRA_NEBULA_CACHE_STATS_ENABLED | true | 是否启用缓存统计 |

### Nebula 性能配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_NEBULA_PERFORMANCE_INTERVAL | 30000 | 性能监控间隔时间（毫秒） |
| INFRA_NEBULA_PERFORMANCE_RETENTION | 8640000 | 性能指标保留时间（毫秒） |
| INFRA_NEBULA_PERFORMANCE_LOGGING_ENABLED | true | 是否启用详细性能日志 |
| INFRA_NEBULA_PERFORMANCE_QUERY_TIMEOUT | 1000 | 查询超时时间（毫秒） |
| INFRA_NEBULA_PERFORMANCE_MEMORY_THRESHOLD | 0.80 | 内存使用阈值（0-1之间） |
| INFRA_NEBULA_PERFORMANCE_RESPONSE_THRESHOLD | 2000 | 响应时间阈值（毫秒） |

### Nebula 批处理配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_NEBULA_BATCH_CONCURRENCY | 5 | 最大并发操作数 |
| INFRA_NEBULA_BATCH_SIZE_DEFAULT | 50 | 默认批处理大小 |
| INFRA_NEBULA_BATCH_SIZE_MAX | 500 | 最大批处理大小 |
| INFRA_NEBULA_BATCH_SIZE_MIN | 10 | 最小批处理大小 |
| INFRA_NEBULA_BATCH_MEMORY_THRESHOLD | 0.80 | 批处理内存阈值（0-1之间） |
| INFRA_NEBULA_BATCH_PROCESSING_TIMEOUT | 300000 | 批处理超时时间（毫秒） |
| INFRA_NEBULA_BATCH_RETRY_ATTEMPTS | 3 | 重试次数 |
| INFRA_NEBULA_BATCH_RETRY_DELAY | 1000 | 重试延迟时间（毫秒） |
| INFRA_NEBULA_BATCH_ADAPTIVE_ENABLED | true | 是否启用自适应批处理 |
| INFRA_NEBULA_BATCH_PERFORMANCE_THRESHOLD | 1000 | 批处理性能阈值（毫秒） |
| INFRA_NEBULA_BATCH_ADJUSTMENT_FACTOR | 0.1 | 批处理调整因子（0-1之间） |

### Nebula 连接配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_NEBULA_CONNECTION_POOL_MAX | 10 | 连接池最大连接数 |
| INFRA_NEBULA_CONNECTION_POOL_MIN | 2 | 连接池最小连接数 |
| INFRA_NEBULA_CONNECTION_TIMEOUT | 30000 | 连接超时时间（毫秒） |
| INFRA_NEBULA_CONNECTION_IDLE_TIMEOUT | 300000 | 连接空闲超时时间（毫秒） |
| INFRA_NEBULA_CONNECTION_ACQUIRE_TIMEOUT | 10000 | 获取连接超时时间（毫秒） |
| INFRA_NEBULA_CONNECTION_VALIDATE_INTERVAL | 60000 | 连接验证间隔时间（毫秒） |
| INFRA_NEBULA_CONNECTION_POOL_ENABLED | true | 是否启用连接池 |

## Nebula 图配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| INFRA_NEBULA_GRAPH_SPACE_DEFAULT | test_space | 默认图空间名称 |
| INFRA_NEBULA_GRAPH_PARTITION_COUNT | 10 | 分区数量 |
| INFRA_NEBULA_GRAPH_REPLICA_FACTOR | 1 | 副本因子 |
| INFRA_NEBULA_GRAPH_VID_TYPE | FIXED_STRING | VID类型 (FIXED_STRING, INT64) |
| INFRA_NEBULA_GRAPH_QUERY_TIMEOUT | 3000 | 查询超时时间（毫秒） |
| INFRA_NEBULA_GRAPH_QUERY_RETRIES | 3 | 查询重试次数 |
| INFRA_NEBULA_GRAPH_SCHEMA_TAGS_AUTO | false | 是否自动创建标签 |
| INFRA_NEBULA_GRAPH_SCHEMA_EDGES_AUTO | false | 是否自动创建边类型 |