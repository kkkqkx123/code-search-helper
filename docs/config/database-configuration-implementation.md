# 数据库配置实现说明

## 概述

本文档详细说明了当前项目中数据库配置的实现架构、使用方法和最佳实践。项目已完成配置统一，采用分层单源配置管理策略。

## 配置架构

### 分层设计

```
配置管理架构：
├── ConfigService 层 (数据库特定配置)
│   ├── QdrantConfigService     ← 所有 Qdrant 相关配置
│   ├── NebulaConfigService     ← 所有 Nebula 相关配置
│   └── 其他业务配置服务
└── InfrastructureConfigService 层 (通用基础设施配置)
    ├── 通用缓存、监控、批处理开关
    ├── Qdrant 向量特定配置
    └── Nebula 图特定配置
```

### 配置职责分离

| 配置类型 | 负责服务 | 环境变量前缀 | 说明 |
|---------|---------|-------------|------|
| **Qdrant 连接配置** | QdrantConfigService | `QDRANT_*` | 主机、端口、API密钥等 |
| **Qdrant 缓存配置** | QdrantConfigService | `QDRANT_CACHE_*` | TTL、最大条目等 |
| **Qdrant 性能配置** | QdrantConfigService | `QDRANT_PERFORMANCE_*` | 监控间隔、阈值等 |
| **Qdrant 批处理配置** | QdrantConfigService | `QDRANT_BATCH_*` | 并发数、批次大小等 |
| **Nebula 连接配置** | NebulaConfigService | `NEBULA_*` | 主机、端口、认证等 |
| **Nebula 连接池配置** | NebulaConfigService | `NEBULA_POOL_*` | 连接池参数 |
| **Nebula 缓存配置** | NebulaConfigService | `NEBULA_CACHE_*` | TTL、最大条目等 |
| **Nebula 性能配置** | NebulaConfigService | `NEBULA_PERFORMANCE_*` | 监控间隔、阈值等 |
| **Nebula 批处理配置** | NebulaConfigService | `NEBULA_BATCH_*` | 并发数、批次大小等 |
| **通用基础设施配置** | InfrastructureConfigService | `INFRA_*` | 全局开关、日志级别等 |
| **Qdrant 向量特定配置** | InfrastructureConfigService | `INFRA_QDRANT_VECTOR_*` | 向量大小、距离算法等 |
| **Nebula 图特定配置** | InfrastructureConfigService | `INFRA_NEBULA_GRAPH_*` | 图空间、分区等 |

## 配置服务实现

### QdrantConfigService

**文件位置**: [`src/config/service/QdrantConfigService.ts`](../../src/config/service/QdrantConfigService.ts)

**配置接口**:
```typescript
interface QdrantConfig {
  // 连接配置
  host: string;
  port: number;
  collection: string;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
  
  // 缓存配置
  cache?: QdrantCacheConfig;
  
  // 性能配置
  performance?: QdrantPerformanceConfig;
  
  // 批处理配置
  batch?: QdrantBatchConfig;
}
```

**关键特性**:
- 支持项目隔离的动态集合命名
- 配置验证和命名约定检查
- 环境变量优先级处理
- 完整的配置验证（Joi schema）

**环境变量映射**:
```bash
# 连接配置
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=code-snippets
QDRANT_API_KEY=optional
QDRANT_USE_HTTPS=false
QDRANT_TIMEOUT=30000

# 缓存配置
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_CACHE_CLEANUP_INTERVAL=60000
QDRANT_CACHE_STATS_ENABLED=true

# 性能配置
QDRANT_PERFORMANCE_INTERVAL=30000
QDRANT_PERFORMANCE_RETENTION=86400000
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
QDRANT_PERFORMANCE_QUERY_TIMEOUT=5000
QDRANT_PERFORMANCE_MEMORY_THRESHOLD=80
QDRANT_PERFORMANCE_RESPONSE_THRESHOLD=500

# 批处理配置
QDRANT_BATCH_CONCURRENCY=5
QDRANT_BATCH_SIZE_DEFAULT=50
QDRANT_BATCH_SIZE_MAX=500
QDRANT_BATCH_SIZE_MIN=10
QDRANT_BATCH_MEMORY_THRESHOLD=0.80
QDRANT_BATCH_PROCESSING_TIMEOUT=3000
QDRANT_BATCH_RETRY_ATTEMPTS=3
QDRANT_BATCH_RETRY_DELAY=1000
QDRANT_BATCH_ADAPTIVE_ENABLED=true
QDRANT_BATCH_PERFORMANCE_THRESHOLD=1000
QDRANT_BATCH_ADJUSTMENT_FACTOR=0.1
```

### NebulaConfigService

**文件位置**: [`src/config/service/NebulaConfigService.ts`](../../src/config/service/NebulaConfigService.ts)

**配置接口**:
```typescript
interface NebulaConfig {
  // 连接配置
  host: string;
  port: number;
  username: string;
  password: string;
  
  // 基础连接配置
  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  space?: string;
  
  // 连接池配置
  connectionPool?: {
    minConnections?: number;
    maxConnections?: number;
    acquireTimeout?: number;
    idleTimeout?: number;
    healthCheckInterval?: number;
    healthCheckTimeout?: number;
    maxFailures?: number;
  };
  
  // 缓存、性能、批处理配置
  cache?: NebulaCacheConfig;
  performance?: NebulaPerformanceConfig;
  batch?: NebulaBatchConfig;
  
  // 容错配置
  faultTolerance?: {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
    circuitBreakerEnabled?: boolean;
    circuitBreakerFailureThreshold?: number;
    circuitBreakerTimeout?: number;
    fallbackStrategy?: 'cache' | 'default' | 'error';
  };
}
```

**关键特性**:
- 支持项目隔离的动态空间命名
- 连接池管理和健康检查
- 容错机制和熔断器
- 完整的配置验证

**环境变量映射**:
```bash
# 连接配置
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_TIMEOUT=30000
NEBULA_MAX_CONNECTIONS=10
NEBULA_RETRY_ATTEMPTS=3
NEBULA_RETRY_DELAY=1000

# 连接池配置
NEBULA_POOL_MIN_CONNECTIONS=2
NEBULA_POOL_MAX_CONNECTIONS=10
NEBULA_POOL_ACQUIRE_TIMEOUT=30000
NEBULA_POOL_IDLE_TIMEOUT=300000
NEBULA_POOL_HEALTH_CHECK_INTERVAL=30000
NEBULA_POOL_HEALTH_CHECK_TIMEOUT=5000
NEBULA_POOL_MAX_FAILURES=3

# 缓存配置
NEBULA_CACHE_TTL=30000
NEBULA_CACHE_MAX_ENTRIES=10000
NEBULA_CACHE_CLEANUP_INTERVAL=60000
NEBULA_CACHE_STATS_ENABLED=true

# 性能配置
NEBULA_PERFORMANCE_INTERVAL=1000
NEBULA_PERFORMANCE_RETENTION=8640000
NEBULA_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_QUERY_TIMEOUT=1000
NEBULA_PERFORMANCE_MEMORY_THRESHOLD=0.80
NEBULA_PERFORMANCE_RESPONSE_THRESHOLD=2000

# 批处理配置
NEBULA_BATCH_CONCURRENCY=5
NEBULA_BATCH_SIZE_DEFAULT=50
NEBULA_BATCH_SIZE_MAX=500
NEBULA_BATCH_SIZE_MIN=10
NEBULA_BATCH_MEMORY_THRESHOLD=0.80
NEBULA_BATCH_PROCESSING_TIMEOUT=300000
NEBULA_BATCH_RETRY_ATTEMPTS=3
NEBULA_BATCH_RETRY_DELAY=1000
NEBULA_BATCH_ADAPTIVE_ENABLED=true
NEBULA_BATCH_PERFORMANCE_THRESHOLD=1000
NEBULA_BATCH_ADJUSTMENT_FACTOR=0.1

# 容错配置
NEBULA_FAULT_TOLERANCE_MAX_RETRIES=3
NEBULA_FAULT_TOLERANCE_RETRY_DELAY=1000
NEBULA_FAULT_TOLERANCE_EXPONENTIAL_BACKOFF=true
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_ENABLED=true
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_THRESHOLD=5
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_TIMEOUT=3000
NEBULA_FAULT_TOLERANCE_FALLBACK_STRATEGY=cache
```

### InfrastructureConfigService

**文件位置**: [`src/infrastructure/config/InfrastructureConfigService.ts`](../../src/infrastructure/config/InfrastructureConfigService.ts)

**配置职责**:
- 仅管理通用基础设施配置
- 管理纯基础设施特有的配置（如向量算法、图分区等）
- 提供配置降级和验证机制

**配置接口**:
```typescript
interface InfrastructureConfig {
  common: {
    enableCache: boolean;
    enableMonitoring: boolean;
    enableBatching: boolean;
    logLevel: string;
    enableHealthChecks: boolean;
    healthCheckInterval: number;
    gracefulShutdownTimeout: number;
  };
  
  // 纯基础设施配置
  qdrant: {
    vector: VectorSpecificConfig;
  };
  
  nebula: {
    graph: GraphSpecificConfig;
  };
}
```

**环境变量映射**:
```bash
# 通用配置
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
INFRA_BATCHING_ENABLED=true
INFRA_LOG_LEVEL=info
INFRA_HEALTH_CHECKS_ENABLED=true
INFRA_HEALTH_CHECK_INTERVAL=30000
INFRA_SHUTDOWN_TIMEOUT=10000

# Qdrant 向量特定配置
INFRA_QDRANT_VECTOR_COLLECTION_DEFAULT=default
INFRA_QDRANT_VECTOR_SIZE=1536
INFRA_QDRANT_VECTOR_DISTANCE=Cosine
INFRA_QDRANT_VECTOR_INDEX_TYPE=hnsw
INFRA_QDRANT_VECTOR_SEARCH_LIMIT=10
INFRA_QDRANT_VECTOR_SEARCH_THRESHOLD=0.5
INFRA_QDRANT_VECTOR_SEARCH_EXACT_ENABLED=false

# Nebula 图特定配置
INFRA_NEBULA_GRAPH_SPACE_DEFAULT=default
INFRA_NEBULA_GRAPH_PARTITION_COUNT=10
INFRA_NEBULA_GRAPH_REPLICA_FACTOR=1
INFRA_NEBULA_GRAPH_VID_TYPE=FIXED_STRING
INFRA_NEBULA_GRAPH_QUERY_TIMEOUT=3000
INFRA_NEBULA_GRAPH_QUERY_RETRIES=3
INFRA_NEBULA_GRAPH_SCHEMA_TAGS_AUTO=false
INFRA_NEBULA_GRAPH_SCHEMA_EDGES_AUTO=false
```

## 配置使用方法

### 依赖注入

数据库服务通过依赖注入获取配置：

```typescript
// Qdrant 服务
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.QdrantConfigService) qdrantConfigService: QdrantConfigService,
  @inject(TYPES.InfrastructureConfigService) infraConfigService: InfrastructureConfigService
) {
  const qdrantConfig = this.qdrantConfigService.getConfig();
  const commonConfig = this.infraConfigService.getCommonConfig();
}

// Nebula 服务
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService,
  @inject(TYPES.InfrastructureConfigService) infraConfigService: InfrastructureConfigService
) {
  const nebulaConfig = this.nebulaConfigService.getConfig();
  const commonConfig = this.infraConfigService.getCommonConfig();
}
```

### 项目隔离配置

#### Qdrant 集合命名

```typescript
// 获取项目特定的集合名称
const collectionName = qdrantConfigService.getCollectionNameForProject(projectId);

// 优先级：
// 1. 显式环境变量 QDRANT_COLLECTION
// 2. 项目隔离的动态命名 (project-{projectId})
```

#### Nebula 空间命名

```typescript
// 获取项目特定的空间名称
const spaceName = nebulaConfigService.getSpaceNameForProject(projectId);

// 优先级：
// 1. 显式环境变量 NEBULA_SPACE
// 2. 项目隔离的动态命名 (project-{projectId})
```

## 配置验证

### Joi Schema 验证

所有配置服务都使用 Joi 进行严格的配置验证：

```typescript
// 示例：Qdrant 配置验证
const schema = Joi.object({
  host: Joi.string().hostname().default('localhost'),
  port: ValidationUtils.portSchema(6333),
  cache: Joi.object({
    defaultTTL: Joi.number().min(1000).default(30000),
    maxEntries: Joi.number().min(100).default(10000),
    // ...
  }).optional(),
  // ...
});
```

### 命名约定验证

```typescript
// 集合/空间名称验证
validateNamingConvention(name: string): boolean {
  const pattern = /^[a-zA-Z0-9_-]{1,63}$/;
  return pattern.test(name) && !name.startsWith('_');
}
```

## 配置加载策略

### InfrastructureConfigService 降级策略

1. **策略1**: 从环境变量加载
2. **策略2**: 从主配置服务加载
3. **策略3**: 使用安全默认配置
4. **策略4**: 使用最小配置（最后降级）

### 配置优先级

```
环境变量 > 默认配置 > 最小配置
```

## 最佳实践

### 1. 环境变量命名

- 使用清晰的前缀：`QDRANT_*`, `NEBULA_*`, `INFRA_*`
- 采用层次化命名：`QDRANT_CACHE_TTL`, `QDRANT_PERFORMANCE_INTERVAL`
- 使用描述性名称：`BATCH_CONCURRENCY` 而不是 `BATCH_MAX`

### 2. 配置分组

- 相关配置使用相同前缀和分组
- 逻辑分组：连接、缓存、性能、批处理
- 避免配置分散和重复

### 3. 默认值设置

- 提供合理的默认值
- 确保系统在无配置情况下可运行
- 使用生产环境友好的默认值

### 4. 验证和错误处理

- 严格的配置验证
- 清晰的错误消息
- 优雅的降级处理

### 5. 项目隔离

- 支持多项目部署
- 动态命名生成
- 配置冲突检测

## 常见问题

### Q1: 如何修改 Qdrant 连接参数？

A: 修改 `QDRANT_HOST`, `QDRANT_PORT`, `QDRANT_API_KEY` 等环境变量：

```bash
QDRANT_HOST=your-qdrant-host
QDRANT_PORT=6333
QDRANT_API_KEY=your-api-key
```

### Q2: 如何调整缓存性能？

A: 修改对应的缓存配置环境变量：

```bash
# Qdrant 缓存
QDRANT_CACHE_TTL=60000
QDRANT_CACHE_MAX_ENTRIES=20000

# Nebula 缓存
NEBULA_CACHE_TTL=60000
NEBULA_CACHE_MAX_ENTRIES=20000
```

### Q3: 如何启用项目隔离？

A: 不设置显式的集合/空间名称，系统会自动使用项目隔离：

```bash
# 不设置这些变量或设置为默认值
QDRANT_COLLECTION=code-snippets
NEBULA_SPACE=test_space
```

### Q4: 如何调整批处理性能？

A: 修改批处理相关配置：

```bash
# 增加并发数
QDRANT_BATCH_CONCURRENCY=10
NEBULA_BATCH_CONCURRENCY=10

# 调整批次大小
QDRANT_BATCH_SIZE_DEFAULT=100
NEBULA_BATCH_SIZE_DEFAULT=100
```

### Q5: 配置验证失败怎么办？

A: 检查配置值是否符合验证规则：

- 端口号：1-65535
- TTL：>= 1000ms
- 内存阈值：0-1 之间的小数
- 集合/空间名称：1-63 字符，字母数字下划线连字符

## 配置迁移

### 从旧配置迁移

如果需要从旧的 `INFRA_*` 前缀迁移：

1. 删除旧的 `INFRA_QDRANT_*` 和 `INFRA_NEBULA_*` 数据库配置
2. 添加新的 `QDRANT_*` 和 `NEBULA_*` 配置
3. 更新服务代码使用新的配置服务

### 配置验证

迁移后运行配置验证：

```bash
npm run typecheck
npm run build
npm test -- --testPathPattern="config"
```

## 总结

当前的数据库配置实现具有以下优势：

✅ **单一配置源**: 每个数据库的所有配置集中在一个服务中
✅ **清晰的职责分离**: 数据库配置 vs 基础设施配置
✅ **统一的环境变量命名**: 一致的前缀和命名规范
✅ **完整的配置验证**: Joi schema 和自定义验证
✅ **项目隔离支持**: 动态命名和冲突检测
✅ **优雅的降级处理**: 多层配置加载策略
✅ **类型安全**: TypeScript 接口定义

这种配置架构确保了系统的可维护性、可扩展性和可靠性。