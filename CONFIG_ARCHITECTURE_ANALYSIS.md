# 配置管理架构分析与统一方案

## 当前架构问题分析

### 1. 双层配置管理结构

```
当前架构：
├── src/config/ (ConfigService)
│   ├── QdrantConfigService         ← 数据库连接配置
│   ├── NebulaConfigService         ← 数据库连接配置
│   └── 其他业务配置
└── src/infrastructure/config/ (InfrastructureConfigService)
    ├── INFRA_QDRANT_CACHE_*        ← 基础设施配置（但也包含数据库配置）
    ├── INFRA_QDRANT_PERFORMANCE_*
    ├── INFRA_QDRANT_BATCH_*
    ├── INFRA_NEBULA_CACHE_*
    ├── INFRA_NEBULA_PERFORMANCE_*
    ├── INFRA_NEBULA_BATCH_*
    └── 通用基础设施配置
```

### 2. 配置管理重复问题

#### 同一配置在两个地方定义

| 配置类型 | ConfigService 位置 | InfrastructureConfigService 位置 | 环境变量前缀 |
|--------|------------------|-------------------------------|-----------| 
| **缓存配置** | NebulaConfigService.cache | InfrastructureConfigService.nebula.cache | NEBULA_CACHE_* / INFRA_NEBULA_CACHE_* |
| **性能监控** | NebulaConfigService.performance | InfrastructureConfigService.nebula.performance | NEBULA_PERFORMANCE_* / INFRA_NEBULA_PERFORMANCE_* |
| **批处理** | 无 | InfrastructureConfigService.nebula.batch | INFRA_NEBULA_BATCH_* |
| **连接池** | NebulaConfigService.connectionPool | 无代码读取（只有 .env） | NEBULA_POOL_* / INFRA_NEBULA_CONNECTION_POOL_* |
| **Qdrant 缓存** | 无 | InfrastructureConfigService.qdrant.cache | INFRA_QDRANT_CACHE_* |
| **Qdrant 性能** | 无 | InfrastructureConfigService.qdrant.performance | INFRA_QDRANT_PERFORMANCE_* |
| **Qdrant 批处理** | 无 | InfrastructureConfigService.qdrant.batch | INFRA_QDRANT_BATCH_* |

### 3. 当前配置读取流程

```
ConfigService (主入口)
├── QdrantConfigService.loadConfig()
│   └── 读取: QDRANT_HOST, QDRANT_PORT, QDRANT_TIMEOUT, ...
│   └── 读取: NEBULA_CACHE_TTL, NEBULA_PERFORMANCE_*, ...
│   
└── NebulaConfigService.loadConfig()
    └── 读取: NEBULA_HOST, NEBULA_PORT, NEBULA_POOL_*, ...
    └── 读取: NEBULA_CACHE_TTL, NEBULA_PERFORMANCE_*, ...

InfrastructureConfigService (平行独立)
├── 读取: INFRA_QDRANT_CACHE_*, INFRA_QDRANT_PERFORMANCE_*, INFRA_QDRANT_BATCH_*
├── 读取: INFRA_NEBULA_CACHE_*, INFRA_NEBULA_PERFORMANCE_*, INFRA_NEBULA_BATCH_*
└── 读取: INFRA_NEBULA_CONNECTION_POOL_* (未使用)
```

### 4. 关键问题

#### 问题 1: 配置分散，难以维护
- Qdrant 配置在 InfrastructureConfigService 中（无 ConfigService 对应）
- Nebula 配置在两个地方都有（重复定义）
- 前缀不一致：`NEBULA_*` vs `INFRA_NEBULA_*`

#### 问题 2: 缺乏单一配置源
- 应该只有一个地方读取数据库配置
- 基础设施层应该依赖数据库层的配置，而非独立读取

#### 问题 3: 环境变量前缀混乱
- Nebula: 既有 `NEBULA_*` 又有 `INFRA_NEBULA_*`
- Qdrant: 只有 `INFRA_QDRANT_*`（配置未在 ConfigService 中）
- 连接池: `NEBULA_POOL_*` vs `INFRA_NEBULA_CONNECTION_POOL_*`

---

## 统一配置管理方案

### 目标架构

```
统一后的架构：
├── src/config/ (ConfigService)
│   ├── QdrantConfigService         ← 所有 Qdrant 配置（连接、缓存、性能、批处理）
│   ├── NebulaConfigService         ← 所有 Nebula 配置（连接、缓存、性能、批处理）
│   └── 其他业务配置
└── src/infrastructure/config/ (InfrastructureConfigService)
    └── 只包含通用基础设施配置
        ├── enableCache
        ├── enableMonitoring
        ├── enableBatching
        ├── healthCheckInterval
        └── logLevel
```

### 配置统一策略

#### 第 1 步: 移除 InfrastructureConfigService 中的数据库配置

**删除以下配置**：
- `qdrant.cache` - 移到 QdrantConfigService
- `qdrant.performance` - 移到 QdrantConfigService
- `qdrant.batch` - 移到 QdrantConfigService
- `qdrant.vector` - 保留（纯基础设施配置）
- `nebula.cache` - 移到 NebulaConfigService
- `nebula.performance` - 移到 NebulaConfigService
- `nebula.batch` - 移到 NebulaConfigService
- `nebula.graph` - 保留（纯基础设施配置）

#### 第 2 步: 统一环境变量前缀

| 配置范围 | 前缀规则 | 示例 |
|--------|--------|------|
| 数据库连接配置 | `DATABASE_*` | `QDRANT_HOST`, `NEBULA_HOST` |
| 数据库缓存配置 | `DATABASE_*` | `QDRANT_CACHE_TTL`, `NEBULA_CACHE_TTL` |
| 基础设施通用 | `INFRA_*` | `INFRA_LOG_LEVEL`, `INFRA_CACHE_ENABLED` |
| 基础设施纯粹组件 | `INFRA_*` | `INFRA_QDRANT_VECTOR_*`, `INFRA_NEBULA_GRAPH_*` |

#### 第 3 步: 数据库配置服务扩展

**QdrantConfigService 应包含**:
```typescript
interface QdrantConfig {
  // 连接配置
  host: string;
  port: number;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
  
  // 缓存配置
  cache?: {
    defaultTTL: number;
    maxEntries: number;
    cleanupInterval: number;
    enableStats: boolean;
  };
  
  // 性能配置
  performance?: {
    monitoringInterval: number;
    metricsRetentionPeriod: number;
    enableDetailedLogging: boolean;
    performanceThresholds: {
      queryExecutionTime: number;
      memoryUsage: number;
      responseTime: number;
    };
  };
  
  // 批处理配置
  batch?: {
    maxConcurrentOperations: number;
    defaultBatchSize: number;
    maxBatchSize: number;
    minBatchSize: number;
    memoryThreshold: number;
    processingTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    adaptiveBatchingEnabled: boolean;
    performanceThreshold: number;
    adjustmentFactor: number;
  };
}
```

**NebulaConfigService 应包含** (同上结构)

#### 第 4 步: 环境变量映射

```bash
# Qdrant 配置 - 所有使用 QDRANT_ 前缀
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_PERFORMANCE_INTERVAL=30000
QDRANT_BATCH_CONCURRENCY=5

# Nebula 配置 - 所有使用 NEBULA_ 前缀
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_POOL_MIN_CONNECTIONS=2
NEBULA_POOL_MAX_CONNECTIONS=10
NEBULA_CACHE_TTL=30000
NEBULA_PERFORMANCE_INTERVAL=1000
NEBULA_BATCH_CONCURRENCY=5

# 基础设施通用配置 - 使用 INFRA_ 前缀
INFRA_LOG_LEVEL=info
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
```

---

## 实现步骤

### Step 1: 扩展 QdrantConfigService

```typescript
// src/config/service/QdrantConfigService.ts
export interface QdrantConfig {
  host: string;
  port: number;
  collection: string;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
  
  // 新增
  cache?: CacheConfig;
  performance?: PerformanceConfig;
  batch?: BatchConfig;
}
```

### Step 2: 扩展 NebulaConfigService

```typescript
// src/config/service/NebulaConfigService.ts
// 从 connectionPool 扩展到包含缓存、性能、批处理
export interface NebulaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  
  // 现有配置保留
  connectionPool?: ConnectionPoolConfig;
  
  // 新增
  cache?: CacheConfig;
  performance?: PerformanceConfig;
  batch?: BatchConfig;
}
```

### Step 3: 简化 InfrastructureConfigService

```typescript
// src/infrastructure/config/InfrastructureConfigService.ts
export interface InfrastructureConfig {
  common: {
    enableCache: boolean;
    enableMonitoring: boolean;
    enableBatching: boolean;
    logLevel: string;
    enableHealthChecks: boolean;
    healthCheckInterval: number;
    gracefulShutdownTimeout: number;
  };
  
  // 删除: qdrant.cache, qdrant.performance, qdrant.batch
  // 删除: nebula.cache, nebula.performance, nebula.batch
  
  qdrant: {
    vector: VectorConfig;  // 保留
  };
  
  nebula: {
    graph: GraphConfig;    // 保留
  };
}
```

### Step 4: 更新依赖注入

数据库服务获取配置方式：
```typescript
// 从 ConfigService 获取数据库配置
this.qdrantConfigService.getConfig()      // 完整 Qdrant 配置
this.nebulaConfigService.getConfig()      // 完整 Nebula 配置

// 从 InfrastructureConfigService 只获取通用配置
this.infrastructureConfigService.getCommonConfig()
```

### Step 5: 更新 .env 文件

**删除**：
```bash
INFRA_QDRANT_CACHE_*
INFRA_QDRANT_PERFORMANCE_*
INFRA_QDRANT_BATCH_*
INFRA_QDRANT_VECTOR_*
INFRA_NEBULA_CACHE_*
INFRA_NEBULA_PERFORMANCE_*
INFRA_NEBULA_BATCH_*
INFRA_NEBULA_CONNECTION_POOL_*
```

**新增**：
```bash
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_PERFORMANCE_INTERVAL=30000
QDRANT_BATCH_CONCURRENCY=5

NEBULA_CACHE_TTL=30000
NEBULA_CACHE_MAX_ENTRIES=10000
NEBULA_PERFORMANCE_INTERVAL=1000
NEBULA_BATCH_CONCURRENCY=5
```

---

## 迁移影响范围

### 受影响的文件

| 文件 | 改动 | 优先级 |
|-----|------|--------|
| `src/config/service/QdrantConfigService.ts` | 扩展配置 | 高 |
| `src/config/service/NebulaConfigService.ts` | 扩展配置 | 高 |
| `src/infrastructure/config/InfrastructureConfigService.ts` | 删除数据库配置 | 高 |
| `src/database/qdrant/QdrantInfrastructure.ts` | 改用 ConfigService | 中 |
| `src/database/nebula/*` | 改用 ConfigService | 中 |
| `.env` | 更新前缀 | 高 |
| `src/core/registrars/*` | 更新注入 | 低 |

### 依赖变更

**Before**:
```
数据库服务 → InfrastructureConfigService
基础设施服务 → InfrastructureConfigService
```

**After**:
```
数据库服务 → ConfigService → 数据库 ConfigServices
基础设施服务 → InfrastructureConfigService (仅通用配置)
```

---

## 配置统一实现清单

- [ ] 扩展 QdrantConfigService 添加 cache/performance/batch
- [ ] 扩展 NebulaConfigService 添加 cache/performance/batch
- [ ] 简化 InfrastructureConfigService 移除数据库配置
- [ ] 删除 .env 中的 INFRA_QDRANT_* 和 INFRA_NEBULA_* 前缀
- [ ] 添加 .env 中的 QDRANT_CACHE_*, QDRANT_PERFORMANCE_*, QDRANT_BATCH_*
- [ ] 添加 .env 中的 NEBULA_CACHE_*, NEBULA_PERFORMANCE_*, NEBULA_BATCH_*
- [ ] 更新 QdrantInfrastructure 使用 ConfigService
- [ ] 更新 Nebula 相关服务使用 ConfigService
- [ ] 更新 InfrastructureManager 使用简化配置
- [ ] 更新 DI 容器绑定
- [ ] 执行测试验证

