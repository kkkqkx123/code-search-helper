# 数据库配置快速参考

## 配置架构概览

```
ConfigService 层 (数据库特定配置)
├── QdrantConfigService     ← QDRANT_* 前缀
├── NebulaConfigService     ← NEBULA_* 前缀
└── 其他业务配置服务

InfrastructureConfigService 层 (通用基础设施配置)
├── 通用配置               ← INFRA_* 前缀
├── Qdrant 向量特定配置     ← INFRA_QDRANT_VECTOR_*
└── Nebula 图特定配置      ← INFRA_NEBULA_GRAPH_*
```

## 环境变量速查表

### Qdrant 配置 (QDRANT_*)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| **连接配置** |
| `QDRANT_HOST` | localhost | Qdrant 服务器地址 |
| `QDRANT_PORT` | 6333 | Qdrant 服务器端口 |
| `QDRANT_COLLECTION` | code-snippets | 默认集合名称 |
| `QDRANT_API_KEY` | - | API 密钥（可选） |
| `QDRANT_USE_HTTPS` | false | 是否使用 HTTPS |
| `QDRANT_TIMEOUT` | 30000 | 连接超时时间（毫秒） |
| **缓存配置** |
| `QDRANT_CACHE_TTL` | 30000 | 缓存生存时间（毫秒） |
| `QDRANT_CACHE_MAX_ENTRIES` | 10000 | 最大缓存条目数 |
| `QDRANT_CACHE_CLEANUP_INTERVAL` | 60000 | 清理间隔（毫秒） |
| `QDRANT_CACHE_STATS_ENABLED` | true | 是否启用缓存统计 |
| **性能配置** |
| `QDRANT_PERFORMANCE_INTERVAL` | 30000 | 监控间隔（毫秒） |
| `QDRANT_PERFORMANCE_RETENTION` | 86400000 | 指标保留时间（毫秒） |
| `QDRANT_PERFORMANCE_LOGGING_ENABLED` | true | 是否启用性能日志 |
| `QDRANT_PERFORMANCE_QUERY_TIMEOUT` | 5000 | 查询超时（毫秒） |
| `QDRANT_PERFORMANCE_MEMORY_THRESHOLD` | 80 | 内存阈值（百分比） |
| `QDRANT_PERFORMANCE_RESPONSE_THRESHOLD` | 500 | 响应阈值（毫秒） |
| **批处理配置** |
| `QDRANT_BATCH_CONCURRENCY` | 5 | 最大并发操作数 |
| `QDRANT_BATCH_SIZE_DEFAULT` | 50 | 默认批次大小 |
| `QDRANT_BATCH_SIZE_MAX` | 500 | 最大批次大小 |
| `QDRANT_BATCH_SIZE_MIN` | 10 | 最小批次大小 |
| `QDRANT_BATCH_MEMORY_THRESHOLD` | 0.80 | 内存阈值（0-1） |
| `QDRANT_BATCH_PROCESSING_TIMEOUT` | 3000 | 处理超时（毫秒） |
| `QDRANT_BATCH_RETRY_ATTEMPTS` | 3 | 重试次数 |
| `QDRANT_BATCH_RETRY_DELAY` | 1000 | 重试延迟（毫秒） |
| `QDRANT_BATCH_ADAPTIVE_ENABLED` | true | 是否启用自适应批处理 |
| `QDRANT_BATCH_PERFORMANCE_THRESHOLD` | 1000 | 性能阈值（毫秒） |
| `QDRANT_BATCH_ADJUSTMENT_FACTOR` | 0.1 | 调整因子（0-1） |

### Nebula 配置 (NEBULA_*)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| **基础配置** |
| `NEBULA_ENABLED` | false | 是否启用 Nebula |
| `NEBULA_HOST` | localhost | Nebula 服务器地址 |
| `NEBULA_PORT` | 9669 | Nebula 服务器端口 |
| `NEBULA_USERNAME` | root | 用户名 |
| `NEBULA_PASSWORD` | nebula | 密码 |
| `NEBULA_TIMEOUT` | 30000 | 连接超时（毫秒） |
| `NEBULA_MAX_CONNECTIONS` | 10 | 最大连接数 |
| `NEBULA_RETRY_ATTEMPTS` | 3 | 重试次数 |
| `NEBULA_RETRY_DELAY` | 1000 | 重试延迟（毫秒） |
| `NEBULA_BUFFER_SIZE` | 2000 | 缓冲区大小 |
| `NEBULA_PING_INTERVAL` | 3000 | 心跳间隔（毫秒） |
| `NEBULA_VID_TYPE_LENGTH` | 128 | VID 类型长度 |
| **连接池配置** |
| `NEBULA_POOL_MIN_CONNECTIONS` | 2 | 最小连接数 |
| `NEBULA_POOL_MAX_CONNECTIONS` | 10 | 最大连接数 |
| `NEBULA_POOL_ACQUIRE_TIMEOUT` | 30000 | 获取连接超时（毫秒） |
| `NEBULA_POOL_IDLE_TIMEOUT` | 300000 | 空闲超时（毫秒） |
| `NEBULA_POOL_HEALTH_CHECK_INTERVAL` | 30000 | 健康检查间隔（毫秒） |
| `NEBULA_POOL_HEALTH_CHECK_TIMEOUT` | 5000 | 健康检查超时（毫秒） |
| `NEBULA_POOL_MAX_FAILURES` | 3 | 最大失败次数 |
| **缓存配置** |
| `NEBULA_CACHE_TTL` | 30000 | 缓存生存时间（毫秒） |
| `NEBULA_CACHE_MAX_ENTRIES` | 10000 | 最大缓存条目数 |
| `NEBULA_CACHE_CLEANUP_INTERVAL` | 60000 | 清理间隔（毫秒） |
| `NEBULA_CACHE_STATS_ENABLED` | true | 是否启用缓存统计 |
| **性能配置** |
| `NEBULA_PERFORMANCE_INTERVAL` | 1000 | 监控间隔（毫秒） |
| `NEBULA_PERFORMANCE_RETENTION` | 8640000 | 指标保留时间（毫秒） |
| `NEBULA_PERFORMANCE_LOGGING_ENABLED` | true | 是否启用性能日志 |
| `NEBULA_PERFORMANCE_QUERY_TIMEOUT` | 1000 | 查询超时（毫秒） |
| `NEBULA_PERFORMANCE_MEMORY_THRESHOLD` | 0.80 | 内存阈值（0-1） |
| `NEBULA_PERFORMANCE_RESPONSE_THRESHOLD` | 2000 | 响应阈值（毫秒） |
| **批处理配置** |
| `NEBULA_BATCH_CONCURRENCY` | 5 | 最大并发操作数 |
| `NEBULA_BATCH_SIZE_DEFAULT` | 50 | 默认批次大小 |
| `NEBULA_BATCH_SIZE_MAX` | 500 | 最大批次大小 |
| `NEBULA_BATCH_SIZE_MIN` | 10 | 最小批次大小 |
| `NEBULA_BATCH_MEMORY_THRESHOLD` | 0.80 | 内存阈值（0-1） |
| `NEBULA_BATCH_PROCESSING_TIMEOUT` | 300000 | 处理超时（毫秒） |
| `NEBULA_BATCH_RETRY_ATTEMPTS` | 3 | 重试次数 |
| `NEBULA_BATCH_RETRY_DELAY` | 1000 | 重试延迟（毫秒） |
| `NEBULA_BATCH_ADAPTIVE_ENABLED` | true | 是否启用自适应批处理 |
| `NEBULA_BATCH_PERFORMANCE_THRESHOLD` | 1000 | 性能阈值（毫秒） |
| `NEBULA_BATCH_ADJUSTMENT_FACTOR` | 0.1 | 调整因子（0-1） |
| **容错配置** |
| `NEBULA_FAULT_TOLERANCE_MAX_RETRIES` | 3 | 最大重试次数 |
| `NEBULA_FAULT_TOLERANCE_RETRY_DELAY` | 1000 | 重试延迟（毫秒） |
| `NEBULA_FAULT_TOLERANCE_EXPONENTIAL_BACKOFF` | true | 是否启用指数退避 |
| `NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_ENABLED` | true | 是否启用熔断器 |
| `NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_THRESHOLD` | 5 | 熔断器阈值 |
| `NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_TIMEOUT` | 3000 | 熔断器超时（毫秒） |
| `NEBULA_FAULT_TOLERANCE_FALLBACK_STRATEGY` | cache | 降级策略 |

### 基础设施配置 (INFRA_*)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| **通用配置** |
| `INFRA_CACHE_ENABLED` | true | 是否启用缓存 |
| `INFRA_MONITORING_ENABLED` | true | 是否启用监控 |
| `INFRA_BATCHING_ENABLED` | true | 是否启用批处理 |
| `INFRA_LOG_LEVEL` | info | 日志级别 |
| `INFRA_HEALTH_CHECKS_ENABLED` | true | 是否启用健康检查 |
| `INFRA_HEALTH_CHECK_INTERVAL` | 30000 | 健康检查间隔（毫秒） |
| `INFRA_SHUTDOWN_TIMEOUT` | 10000 | 关闭超时（毫秒） |
| **Qdrant 向量配置** |
| `INFRA_QDRANT_VECTOR_COLLECTION_DEFAULT` | default | 默认集合 |
| `INFRA_QDRANT_VECTOR_SIZE` | 1536 | 向量大小 |
| `INFRA_QDRANT_VECTOR_DISTANCE` | Cosine | 距离算法 |
| `INFRA_QDRANT_VECTOR_INDEX_TYPE` | hnsw | 索引类型 |
| `INFRA_QDRANT_VECTOR_SEARCH_LIMIT` | 10 | 搜索限制 |
| `INFRA_QDRANT_VECTOR_SEARCH_THRESHOLD` | 0.5 | 搜索阈值 |
| `INFRA_QDRANT_VECTOR_SEARCH_EXACT_ENABLED` | false | 是否启用精确搜索 |
| **Nebula 图配置** |
| `INFRA_NEBULA_GRAPH_SPACE_DEFAULT` | default | 默认空间 |
| `INFRA_NEBULA_GRAPH_PARTITION_COUNT` | 10 | 分区数量 |
| `INFRA_NEBULA_GRAPH_REPLICA_FACTOR` | 1 | 副本因子 |
| `INFRA_NEBULA_GRAPH_VID_TYPE` | FIXED_STRING | VID 类型 |
| `INFRA_NEBULA_GRAPH_QUERY_TIMEOUT` | 3000 | 查询超时（毫秒） |
| `INFRA_NEBULA_GRAPH_QUERY_RETRIES` | 3 | 查询重试次数 |
| `INFRA_NEBULA_GRAPH_SCHEMA_TAGS_AUTO` | false | 是否自动创建标签 |
| `INFRA_NEBULA_GRAPH_SCHEMA_EDGES_AUTO` | false | 是否自动创建边 |

## 常用配置组合

### 开发环境快速配置

```bash
# 基本连接
QDRANT_HOST=localhost
QDRANT_PORT=6333
NEBULA_ENABLED=true
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula

# 调试配置
INFRA_LOG_LEVEL=debug
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_LOGGING_ENABLED=true
```

### 生产环境快速配置

```bash
# 安全连接
QDRANT_HOST=your-qdrant-host
QDRANT_API_KEY=your-api-key
QDRANT_USE_HTTPS=true
NEBULA_HOST=your-nebula-host
NEBULA_USERNAME=prod_user
NEBULA_PASSWORD=secure_password

# 性能优化
QDRANT_CACHE_TTL=300000
NEBULA_CACHE_TTL=300000
QDRANT_BATCH_CONCURRENCY=10
NEBULA_BATCH_CONCURRENCY=8

# 生产日志
INFRA_LOG_LEVEL=info
QDRANT_PERFORMANCE_LOGGING_ENABLED=false
NEBULA_PERFORMANCE_LOGGING_ENABLED=false
```

### 高并发环境配置

```bash
# 连接池优化
NEBULA_POOL_MIN_CONNECTIONS=10
NEBULA_POOL_MAX_CONNECTIONS=50

# 批处理优化
QDRANT_BATCH_CONCURRENCY=20
QDRANT_BATCH_SIZE_DEFAULT=200
NEBULA_BATCH_CONCURRENCY=15
NEBULA_BATCH_SIZE_DEFAULT=150

# 缓存优化
QDRANT_CACHE_MAX_ENTRIES=100000
NEBULA_CACHE_MAX_ENTRIES=75000
```

### 内存受限环境配置

```bash
# 减少缓存
QDRANT_CACHE_MAX_ENTRIES=5000
NEBULA_CACHE_MAX_ENTRIES=5000

# 降低内存阈值
QDRANT_BATCH_MEMORY_THRESHOLD=0.70
NEBULA_BATCH_MEMORY_THRESHOLD=0.70

# 减少批次大小
QDRANT_BATCH_SIZE_DEFAULT=25
NEBULA_BATCH_SIZE_DEFAULT=25
```

## 配置验证规则

### 数值范围验证

| 配置类型 | 有效范围 | 示例 |
|---------|---------|------|
| 端口号 | 1-65535 | `QDRANT_PORT=6333` |
| 百分比 | 0-100 | `QDRANT_PERFORMANCE_MEMORY_THRESHOLD=80` |
| 小数阈值 | 0-1 | `QDRANT_BATCH_MEMORY_THRESHOLD=0.80` |
| 时间（毫秒） | >= 0 | `QDRANT_TIMEOUT=30000` |
| 计数值 | >= 0 | `QDRANT_CACHE_MAX_ENTRIES=10000` |

### 字符串格式验证

| 配置类型 | 格式要求 | 示例 |
|---------|---------|------|
| 主机名 | 有效主机名或IP | `QDRANT_HOST=localhost` |
| 集合/空间名称 | 1-63字符，字母数字下划线连字符 | `QDRANT_COLLECTION=my_collection` |
| 日志级别 | debug, info, warn, error | `INFRA_LOG_LEVEL=info` |
| 布尔值 | true/false | `QDRANT_USE_HTTPS=true` |

## 项目隔离配置

### 启用项目隔离

```bash
# 不设置显式名称，使用动态命名
# QDRANT_COLLECTION=code-snippets  # 默认值
# NEBULA_SPACE=test_space         # 默认值

# 项目管理配置
PROJECT_ALLOW_REINDEX=true
```

### 禁用项目隔离

```bash
# 设置显式名称
QDRANT_COLLECTION=shared_collection
NEBULA_SPACE=shared_space
```

## 故障排除速查

### 连接问题

```bash
# 增加超时时间
QDRANT_TIMEOUT=60000
NEBULA_TIMEOUT=60000

# 检查主机地址
QDRANT_HOST=correct-hostname
NEBULA_HOST=correct-hostname
```

### 性能问题

```bash
# 启用监控
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_LOGGING_ENABLED=true

# 调整批处理
QDRANT_BATCH_CONCURRENCY=10
NEBULA_BATCH_CONCURRENCY=8
```

### 内存问题

```bash
# 减少缓存
QDRANT_CACHE_MAX_ENTRIES=5000
NEBULA_CACHE_MAX_ENTRIES=5000

# 降低阈值
QDRANT_BATCH_MEMORY_THRESHOLD=0.70
NEBULA_BATCH_MEMORY_THRESHOLD=0.70
```

## 配置文件模板

### 最小配置模板

```bash
# 必需配置
QDRANT_HOST=localhost
QDRANT_PORT=6333

# 可选 Nebula 配置
NEBULA_ENABLED=false
```

### 完整配置模板

```bash
# 复制完整的配置示例从 configuration-examples-faq.md
# 根据需要修改具体值
```

## 相关文档

- [数据库配置实现说明](database-configuration-implementation.md)
- [配置使用指南和最佳实践](configuration-usage-guide.md)
- [配置示例和常见问题解答](configuration-examples-faq.md)

## 快速命令

```bash
# 验证配置
npm run typecheck
npm run build

# 运行配置测试
npm test -- --testPathPattern="config"

# 检查环境变量
env | grep -E "^(QDRANT|NEBULA|INFRA)_"
```

这个快速参考文档提供了配置系统的核心信息，方便在日常开发和运维中快速查阅。