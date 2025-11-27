# 配置统一实现方案 - 详细步骤

## 总体策略

从 **双层配置** 迁移到 **分层单源**：
- **ConfigService 层**: 管理所有数据库特定配置（连接池、缓存、性能、批处理）
- **InfrastructureConfigService 层**: 仅管理通用基础设施配置

---

## Phase 1: 准备工作

### 1.1 备份现有配置

```bash
# 备份关键文件
cp .env .env.backup
cp src/infrastructure/config/InfrastructureConfigService.ts src/infrastructure/config/InfrastructureConfigService.ts.backup
cp src/config/service/QdrantConfigService.ts src/config/service/QdrantConfigService.ts.backup
cp src/config/service/NebulaConfigService.ts src/config/service/NebulaConfigService.ts.backup
```

### 1.2 识别所有使用点

**使用 InfrastructureConfigService.getDatabaseConfig() 的地方**：
```bash
grep -r "getDatabaseConfig" src/ --include="*.ts" | grep -v test | grep -v ".backup"
```

**预期结果**：
- `src/database/qdrant/QdrantInfrastructure.ts`
- `src/infrastructure/InfrastructureManager.ts`
- 测试文件（暂时不改）

---

## Phase 2: 扩展 ConfigService 层的数据库配置

### 2.1 更新 QdrantConfigService

**文件**: `src/config/service/QdrantConfigService.ts`

```typescript
// 扩展后的完整接口
export interface QdrantCacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  enableStats: boolean;
}

export interface QdrantPerformanceConfig {
  monitoringInterval: number;
  metricsRetentionPeriod: number;
  enableDetailedLogging: boolean;
  performanceThresholds: {
    queryExecutionTime: number;
    memoryUsage: number;
    responseTime: number;
  };
}

export interface QdrantBatchConfig {
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
}

export interface QdrantConfig {
  host: string;
  port: number;
  collection: string;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
  
  // 新增配置块
  cache?: QdrantCacheConfig;
  performance?: QdrantPerformanceConfig;
  batch?: QdrantBatchConfig;
}
```

**loadConfig() 方法**:
```typescript
loadConfig(): QdrantConfig {
  try {
    const rawConfig = {
      host: EnvironmentUtils.parseString('QDRANT_HOST', 'localhost'),
      port: EnvironmentUtils.parsePort('QDRANT_PORT', 6333),
      collection: this.getCollectionName(),
      apiKey: EnvironmentUtils.parseOptionalString('QDRANT_API_KEY'),
      useHttps: EnvironmentUtils.parseBoolean('QDRANT_USE_HTTPS', false),
      timeout: EnvironmentUtils.parseNumber('QDRANT_TIMEOUT', 30000),
      
      // 新增: 缓存配置
      cache: {
        defaultTTL: EnvironmentUtils.parseNumber('QDRANT_CACHE_TTL', 30000),
        maxEntries: EnvironmentUtils.parseNumber('QDRANT_CACHE_MAX_ENTRIES', 10000),
        cleanupInterval: EnvironmentUtils.parseNumber('QDRANT_CACHE_CLEANUP_INTERVAL', 60000),
        enableStats: EnvironmentUtils.parseBoolean('QDRANT_CACHE_STATS_ENABLED', true),
      },
      
      // 新增: 性能配置
      performance: {
        monitoringInterval: EnvironmentUtils.parseNumber('QDRANT_PERFORMANCE_INTERVAL', 30000),
        metricsRetentionPeriod: EnvironmentUtils.parseNumber('QDRANT_PERFORMANCE_RETENTION', 86400000),
        enableDetailedLogging: EnvironmentUtils.parseBoolean('QDRANT_PERFORMANCE_LOGGING_ENABLED', true),
        performanceThresholds: {
          queryExecutionTime: EnvironmentUtils.parseNumber('QDRANT_PERFORMANCE_QUERY_TIMEOUT', 5000),
          memoryUsage: EnvironmentUtils.parseNumber('QDRANT_PERFORMANCE_MEMORY_THRESHOLD', 80),
          responseTime: EnvironmentUtils.parseNumber('QDRANT_PERFORMANCE_RESPONSE_THRESHOLD', 500),
        },
      },
      
      // 新增: 批处理配置
      batch: {
        maxConcurrentOperations: EnvironmentUtils.parseNumber('QDRANT_BATCH_CONCURRENCY', 5),
        defaultBatchSize: EnvironmentUtils.parseNumber('QDRANT_BATCH_SIZE_DEFAULT', 50),
        maxBatchSize: EnvironmentUtils.parseNumber('QDRANT_BATCH_SIZE_MAX', 500),
        minBatchSize: EnvironmentUtils.parseNumber('QDRANT_BATCH_SIZE_MIN', 10),
        memoryThreshold: EnvironmentUtils.parseFloat('QDRANT_BATCH_MEMORY_THRESHOLD', 0.80),
        processingTimeout: EnvironmentUtils.parseNumber('QDRANT_BATCH_PROCESSING_TIMEOUT', 3000),
        retryAttempts: EnvironmentUtils.parseNumber('QDRANT_BATCH_RETRY_ATTEMPTS', 3),
        retryDelay: EnvironmentUtils.parseNumber('QDRANT_BATCH_RETRY_DELAY', 1000),
        adaptiveBatchingEnabled: EnvironmentUtils.parseBoolean('QDRANT_BATCH_ADAPTIVE_ENABLED', true),
        performanceThreshold: EnvironmentUtils.parseNumber('QDRANT_BATCH_PERFORMANCE_THRESHOLD', 1000),
        adjustmentFactor: EnvironmentUtils.parseFloat('QDRANT_BATCH_ADJUSTMENT_FACTOR', 0.1),
      },
    };

    return this.validateConfig(rawConfig);
  } catch (error) {
    // 错误处理...
  }
}
```

### 2.2 更新 NebulaConfigService

**文件**: `src/config/service/NebulaConfigService.ts`

同样扩展，添加 cache/performance/batch 配置块（类似于 QdrantConfigService）

**关键环境变量映射**:
```typescript
// 缓存配置
cache: {
  defaultTTL: parseInt(process.env.NEBULA_CACHE_TTL || '30000'),
  maxEntries: parseInt(process.env.NEBULA_CACHE_MAX_ENTRIES || '10000'),
  cleanupInterval: parseInt(process.env.NEBULA_CACHE_CLEANUP_INTERVAL || '60000'),
  enableStats: process.env.NEBULA_CACHE_STATS_ENABLED !== 'false',
},

// 性能配置（注意修复 parseFloat）
performance: {
  monitoringInterval: parseInt(process.env.NEBULA_PERFORMANCE_INTERVAL || '1000'),
  metricsRetentionPeriod: parseInt(process.env.NEBULA_PERFORMANCE_RETENTION || '8640000'),
  enableDetailedLogging: process.env.NEBULA_PERFORMANCE_LOGGING_ENABLED !== 'false',
  performanceThresholds: {
    queryExecutionTime: parseInt(process.env.NEBULA_PERFORMANCE_QUERY_TIMEOUT || '1000'),
    memoryUsage: parseFloat(process.env.NEBULA_PERFORMANCE_MEMORY_THRESHOLD || '0.80'),
    responseTime: parseInt(process.env.NEBULA_PERFORMANCE_RESPONSE_THRESHOLD || '500'),
  },
},

// 批处理配置
batch: {
  maxConcurrentOperations: parseInt(process.env.NEBULA_BATCH_CONCURRENCY || '5'),
  defaultBatchSize: parseInt(process.env.NEBULA_BATCH_SIZE_DEFAULT || '50'),
  maxBatchSize: parseInt(process.env.NEBULA_BATCH_SIZE_MAX || '500'),
  minBatchSize: parseInt(process.env.NEBULA_BATCH_SIZE_MIN || '10'),
  memoryThreshold: parseFloat(process.env.NEBULA_BATCH_MEMORY_THRESHOLD || '0.80'),
  processingTimeout: parseInt(process.env.NEBULA_BATCH_PROCESSING_TIMEOUT || '300000'),
  retryAttempts: parseInt(process.env.NEBULA_BATCH_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.NEBULA_BATCH_RETRY_DELAY || '1000'),
  adaptiveBatchingEnabled: process.env.NEBULA_BATCH_ADAPTIVE_ENABLED !== 'false',
  performanceThreshold: parseInt(process.env.NEBULA_BATCH_PERFORMANCE_THRESHOLD || '1000'),
  adjustmentFactor: parseFloat(process.env.NEBULA_BATCH_ADJUSTMENT_FACTOR || '0.1'),
}
```

---

## Phase 3: 简化 InfrastructureConfigService

### 3.1 删除数据库相关配置

**文件**: `src/infrastructure/config/InfrastructureConfigService.ts`

**删除以下配置块**：
```typescript
// ❌ 删除这些
qdrant: {
  cache: { ... },
  performance: { ... },
  batch: { ... },
  vector: { ... },
}

nebula: {
  cache: { ... },
  performance: { ... },
  batch: { ... },
  graph: { ... },
}
```

**保留纯基础设施配置**：
```typescript
// ✅ 保留这些
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
  // 移除 qdrant 和 nebula 整个块
  // 这些由 ConfigService 管理
}
```

### 3.2 删除 getDatabaseConfig() 方法

```typescript
// ❌ 删除此方法
getDatabaseConfig(databaseType: DatabaseType): any {
  switch (databaseType) {
    case DatabaseType.QDRANT:
      return this.config.qdrant;
    case DatabaseType.NEBULA:
      return this.config.nebula;
    // ...
  }
}

// 替代方案：使用 ConfigService
// const qdrantConfig = configService.get('qdrant');
// const nebulaConfig = configService.get('nebula');
```

---

## Phase 4: 更新数据库服务

### 4.1 更新 QdrantInfrastructure

**文件**: `src/database/qdrant/QdrantInfrastructure.ts`

```typescript
// Before
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.InfrastructureConfigService) configService: InfrastructureConfigService,
  // ...
) {
  const config = this.configService.getConfig();
  const monitoringInterval = config.qdrant?.performance?.monitoringInterval || 30000;
}

// After
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.QdrantConfigService) qdrantConfigService: QdrantConfigService,
  @inject(TYPES.InfrastructureConfigService) infraConfigService: InfrastructureConfigService,
  // ...
) {
  const qdrantConfig = this.qdrantConfigService.getConfig();
  const monitoringInterval = qdrantConfig.performance?.monitoringInterval || 30000;
  
  const commonConfig = this.infraConfigService.getCommonConfig();
  const enableCache = commonConfig.enableCache;
}
```

### 4.2 更新 Nebula 相关服务

**文件**: `src/database/nebula/*`

类似修改：从 InfrastructureConfigService.getDatabaseConfig() 改为 NebulaConfigService.getConfig()

---

## Phase 5: 更新 .env 文件

### 5.1 删除旧配置

```bash
# ❌ 删除以下行
INFRA_QDRANT_CACHE_TTL=30000
INFRA_QDRANT_CACHE_MAX_ENTRIES=10000
INFRA_QDRANT_CACHE_CLEANUP_INTERVAL=60000
INFRA_QDRANT_CACHE_STATS_ENABLED=true
INFRA_QDRANT_PERFORMANCE_INTERVAL=30000
INFRA_QDRANT_PERFORMANCE_RETENTION=86400000
INFRA_QDRANT_PERFORMANCE_LOGGING_ENABLED=true
INFRA_QDRANT_PERFORMANCE_QUERY_TIMEOUT=5000
INFRA_QDRANT_PERFORMANCE_MEMORY_THRESHOLD=80
INFRA_QDRANT_PERFORMANCE_RESPONSE_THRESHOLD=500
INFRA_QDRANT_BATCH_CONCURRENCY=5
INFRA_QDRANT_BATCH_SIZE_DEFAULT=50
INFRA_QDRANT_BATCH_SIZE_MAX=500
INFRA_QDRANT_BATCH_SIZE_MIN=10
INFRA_QDRANT_BATCH_MEMORY_THRESHOLD=0.80
INFRA_QDRANT_BATCH_PROCESSING_TIMEOUT=3000
INFRA_QDRANT_BATCH_RETRY_ATTEMPTS=3
INFRA_QDRANT_BATCH_RETRY_DELAY=1000
INFRA_QDRANT_BATCH_ADAPTIVE_ENABLED=true
INFRA_QDRANT_BATCH_PERFORMANCE_THRESHOLD=1000
INFRA_QDRANT_BATCH_ADJUSTMENT_FACTOR=0.1

INFRA_NEBULA_CACHE_TTL=30000
INFRA_NEBULA_CACHE_MAX_ENTRIES=10000
INFRA_NEBULA_CACHE_CLEANUP_INTERVAL=60000
INFRA_NEBULA_CACHE_STATS_ENABLED=true
INFRA_NEBULA_PERFORMANCE_INTERVAL=30000
INFRA_NEBULA_PERFORMANCE_RETENTION=8640000
INFRA_NEBULA_PERFORMANCE_LOGGING_ENABLED=true
INFRA_NEBULA_PERFORMANCE_QUERY_TIMEOUT=1000
INFRA_NEBULA_PERFORMANCE_MEMORY_THRESHOLD=0.80
INFRA_NEBULA_PERFORMANCE_RESPONSE_THRESHOLD=2000
INFRA_NEBULA_BATCH_CONCURRENCY=5
INFRA_NEBULA_BATCH_SIZE_DEFAULT=50
INFRA_NEBULA_BATCH_SIZE_MAX=500
INFRA_NEBULA_BATCH_SIZE_MIN=10
INFRA_NEBULA_BATCH_MEMORY_THRESHOLD=0.80
INFRA_NEBULA_BATCH_PROCESSING_TIMEOUT=300000
INFRA_NEBULA_BATCH_RETRY_ATTEMPTS=3
INFRA_NEBULA_BATCH_RETRY_DELAY=1000
INFRA_NEBULA_BATCH_ADAPTIVE_ENABLED=true
INFRA_NEBULA_BATCH_PERFORMANCE_THRESHOLD=1000
INFRA_NEBULA_BATCH_ADJUSTMENT_FACTOR=0.1

INFRA_NEBULA_CONNECTION_POOL_MAX=10
INFRA_NEBULA_CONNECTION_POOL_MIN=2
INFRA_NEBULA_CONNECTION_TIMEOUT=30000
INFRA_NEBULA_CONNECTION_IDLE_TIMEOUT=300000
INFRA_NEBULA_CONNECTION_ACQUIRE_TIMEOUT=10000
INFRA_NEBULA_CONNECTION_VALIDATE_INTERVAL=60000
INFRA_NEBULA_CONNECTION_POOL_ENABLED=true

INFRA_QDRANT_CONNECTION_POOL_MAX=10
INFRA_QDRANT_CONNECTION_POOL_MIN=2
INFRA_QDRANT_CONNECTION_TIMEOUT=30000
INFRA_QDRANT_CONNECTION_IDLE_TIMEOUT=300000
INFRA_QDRANT_CONNECTION_ACQUIRE_TIMEOUT=10000
INFRA_QDRANT_CONNECTION_VALIDATE_INTERVAL=6000
INFRA_QDRANT_CONNECTION_POOL_ENABLED=true
```

### 5.2 添加新配置

```bash
# ✅ 添加以下行

# Qdrant 缓存配置
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_CACHE_CLEANUP_INTERVAL=60000
QDRANT_CACHE_STATS_ENABLED=true

# Qdrant 性能配置
QDRANT_PERFORMANCE_INTERVAL=30000
QDRANT_PERFORMANCE_RETENTION=86400000
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
QDRANT_PERFORMANCE_QUERY_TIMEOUT=5000
QDRANT_PERFORMANCE_MEMORY_THRESHOLD=80
QDRANT_PERFORMANCE_RESPONSE_THRESHOLD=500

# Qdrant 批处理配置
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

# Nebula 缓存配置
NEBULA_CACHE_TTL=30000
NEBULA_CACHE_MAX_ENTRIES=10000
NEBULA_CACHE_CLEANUP_INTERVAL=60000
NEBULA_CACHE_STATS_ENABLED=true

# Nebula 性能配置
NEBULA_PERFORMANCE_INTERVAL=30000
NEBULA_PERFORMANCE_RETENTION=8640000
NEBULA_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_QUERY_TIMEOUT=1000
NEBULA_PERFORMANCE_MEMORY_THRESHOLD=0.80
NEBULA_PERFORMANCE_RESPONSE_THRESHOLD=2000

# Nebula 批处理配置
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

# Nebula 连接池配置（保持现有前缀）
NEBULA_POOL_MIN_CONNECTIONS=2
NEBULA_POOL_MAX_CONNECTIONS=10
NEBULA_POOL_ACQUIRE_TIMEOUT=30000
NEBULA_POOL_IDLE_TIMEOUT=300000
NEBULA_POOL_HEALTH_CHECK_INTERVAL=30000
NEBULA_POOL_HEALTH_CHECK_TIMEOUT=5000
NEBULA_POOL_MAX_FAILURES=3
```

---

## Phase 6: 更新依赖注入和使用点

### 6.1 更新 InfrastructureServiceRegistrar

```typescript
// Before
const infrastructureConfigService = context.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);
const qdrantConfig = infrastructureConfigService.getDatabaseConfig(DatabaseType.QDRANT);
const nebulaConfig = infrastructureConfigService.getDatabaseConfig(DatabaseType.NEBULA);

// After
const configService = context.get<ConfigService>(TYPES.ConfigService);
const qdrantConfig = configService.get('qdrant');
const nebulaConfig = configService.get('nebula');
```

### 6.2 更新 InfrastructureManager

```typescript
// 移除对 getDatabaseConfig 的调用
// 使用场景已移到对应的数据库服务
```

---

## Phase 7: 验证和测试

### 7.1 单元测试

```bash
npm test src/config/service/QdrantConfigService.test.ts
npm test src/config/service/NebulaConfigService.test.ts
npm test src/infrastructure/config/InfrastructureConfigService.test.ts
```

### 7.2 集成测试

```bash
npm test src/__tests__/integration/configuration-unification.test.ts
```

### 7.3 构建验证

```bash
npm run build
npm run typecheck
npm run lint
```

---

## 回滚计划

如有问题，可快速回滚：

```bash
# 恢复备份
cp .env.backup .env
cp src/infrastructure/config/InfrastructureConfigService.ts.backup src/infrastructure/config/InfrastructureConfigService.ts
cp src/config/service/QdrantConfigService.ts.backup src/config/service/QdrantConfigService.ts
cp src/config/service/NebulaConfigService.ts.backup src/config/service/NebulaConfigService.ts

# 清理本地修改
git checkout -- .
```

---

## 预期效果

✅ **配置管理统一**：
- 所有数据库配置集中在 ConfigService 层
- InfrastructureConfigService 仅管理通用基础设施

✅ **环境变量清晰**：
- Qdrant: `QDRANT_*` 前缀
- Nebula: `NEBULA_*` 前缀
- 基础设施: `INFRA_*` 前缀

✅ **维护性改善**：
- 单一配置源，减少重复定义
- 数据库服务自包含完整配置
- 配置读取流程清晰

✅ **依赖关系清晰**：
```
ConfigService (数据库配置) ← 数据库服务
    ↓
InfrastructureConfigService (通用配置) ← 基础设施服务
```

