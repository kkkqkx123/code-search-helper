# 配置统一实施指南

## 概述

本文档提供配置统一的具体实施步骤和修改意见，基于对现有配置模块职责划分和必要性的重新分析。

## 1. 配置模块职责重新分析

### 1.1 核心配置模块（必须保留）

| 模块 | 职责 | 必要性 | 冲突项 |
|------|------|--------|--------|
| **NebulaConfigService** | Nebula数据库连接配置 | 高 | maxConnections, timeout, retryAttempts |
| **QdrantConfigService** | Qdrant数据库连接配置 | 高 | 无直接冲突 |
| **InfrastructureConfigService** | 基础设施通用配置 | 高 | maxConcurrentOperations, processingTimeout |
| **ConfigService** | 应用配置聚合 | 高 | 聚合层冲突 |

### 1.2 业务配置模块（保留但需优化）

| 模块 | 职责 | 必要性 | 优化建议 |
|------|------|--------|----------|
| **EmbeddingConfigService** | 嵌入模型配置 | 高 | 简化provider配置 |
| **BatchProcessingConfigService** | 批处理配置 | 中 | 与InfrastructureConfig合并 |
| **IndexingConfigService** | 索引配置 | 中 | 简化配置项 |

### 1.3 辅助配置模块（可合并或简化）

| 模块 | 职责 | 必要性 | 处理建议 |
|------|------|--------|----------|
| **LoggingConfigService** | 日志配置 | 中 | 合并到EnvironmentConfig |
| **MonitoringConfigService** | 监控配置 | 中 | 合并到InfrastructureConfig |
| **EnvironmentConfigService** | 环境配置 | 高 | 扩展职责 |
| **ProjectConfigService** | 项目配置 | 中 | 简化配置项 |
| **FileProcessingConfigService** | 文件处理配置 | 低 | 合并到IndexingConfig |

### 1.4 专用配置模块（保持独立）

| 模块 | 职责 | 必要性 | 处理建议 |
|------|------|--------|----------|
| **HotReloadConfigService** | 热重载配置 | 高 | 保持独立 |
| **TreeSitterConfigService** | 语法解析配置 | 中 | 保持独立 |
| **ProjectNamingConfigService** | 项目命名配置 | 中 | 保持独立 |
| **GraphCacheConfigService** | 图缓存配置 | 中 | 保持独立 |
| **EmbeddingBatchConfigService** | 嵌入批处理配置 | 中 | 保持独立 |
| **SimilarityConfigService** | 相似度配置 | 中 | 保持独立 |

### 1.5 应移除的配置模块

| 模块 | 职责 | 移除原因 | 替代方案 |
|------|------|----------|----------|
| **GraphConfigService** | 图容错配置 | **建议彻底移除** | 合并到 NebulaConfigService |

#### GraphConfigService 移除理由：

1. **功能单一且重复**：
   - 只提供一个方法 `getFaultToleranceOptions()`
   - 返回硬编码的容错配置，与 NebulaConfigService 的重试配置重复

2. **配置冲突**：
   - `maxRetries: 3` 与 `NebulaConfigService.retryAttempts: 3` 重复
   - `retryDelay: 1000` 与 `NebulaConfigService.retryDelay: 1000` 重复

3. **设计不合理**：
   - 依赖 ConfigService 但实际上不使用其配置
   - 注入 ConfigService 只是为了符合依赖注入模式

4. **使用场景有限**：
   - 仅在 NebulaConnectionManager 中使用
   - 可以直接使用 NebulaConfigService 的配置

#### 替代方案：

```typescript
// 将容错配置合并到 NebulaConfigService
export interface NebulaConfig {
  // 现有配置...
  retryAttempts?: number;
  retryDelay?: number;
  
  // 新增容错配置
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

## 2. 配置冲突解决方案

### 2.1 连接池配置冲突

**问题**：
- `ConnectionPool` 硬编码：maxConnections = 10
- `NebulaConfigService`：maxConnections = 10 (NEBULA_MAX_CONNECTIONS)
- `InfrastructureConfigService`：maxConcurrentOperations = 5 (INFRA_NEBULA_BATCH_CONCURRENCY)
- `BatchProcessingConfigService`：maxConcurrentOperations = 5 (MAX_CONCURRENT_OPERATIONS)

**解决方案**：
```typescript
// 扩展 NebulaConfig 接口
export interface NebulaConfig {
  // 现有配置...
  maxConnections?: number;
  
  // 新增连接池配置
  connectionPool?: {
    minConnections?: number;
    maxConnections?: number;
    acquireTimeout?: number;
    idleTimeout?: number;
  };
}
```

**修改步骤**：
1. 扩展 `NebulaConfigService` 配置接口
2. 添加环境变量支持：`NEBULA_POOL_MIN_CONNECTIONS`, `NEBULA_POOL_MAX_CONNECTIONS`
3. 修改 `ConnectionPool` 使用配置服务
4. 移除 `InfrastructureConfigService` 中的重复配置

### 2.2 超时配置冲突

**问题**：
- `ConnectionPool`：acquireTimeout = 30000, idleTimeout = 300000
- `NebulaConfigService`：timeout = 30000 (NEBULA_TIMEOUT)
- `InfrastructureConfigService`：processingTimeout = 300000 (INFRA_NEBULA_BATCH_PROCESSING_TIMEOUT)
- `BatchProcessingConfigService`：processingTimeout = 300000 (PROCESSING_TIMEOUT)

**解决方案**：
```typescript
// 统一超时配置
export interface NebulaConfig {
  // 连接超时
  timeout?: number;
  
  // 操作超时
  operationTimeout?: number;
  
  // 连接池超时
  connectionPool?: {
    acquireTimeout?: number;
    idleTimeout?: number;
  };
}
```

**修改步骤**：
1. 明确不同超时的用途
2. 统一环境变量命名：`NEBULA_TIMEOUT`, `NEBULA_OPERATION_TIMEOUT`, `NEBULA_POOL_ACQUIRE_TIMEOUT`
3. 更新配置验证逻辑

### 2.3 重试配置冲突

**问题**：
- `NebulaConfigService`：retryAttempts = 3, retryDelay = 30000
- `InfrastructureConfigService`：retryAttempts = 3, retryDelay = 100
- `BatchProcessingConfigService`：retryAttempts = 3, retryDelay = 1000
- `GraphConfigService`：maxRetries = 3

**解决方案**：
```typescript
// 统一重试配置
export interface NebulaConfig {
  retryAttempts?: number;
  retryDelay?: number;
  
  // 可选：不同场景的重试配置
  retryConfig?: {
    connection?: {
      attempts?: number;
      delay?: number;
    };
    query?: {
      attempts?: number;
      delay?: number;
    };
  };
}
```

## 3. 具体实施步骤

### 3.1 第一阶段：解决核心冲突（1周）

#### 步骤1：扩展 NebulaConfigService
```typescript
// 文件：src/config/service/NebulaConfigService.ts

export interface NebulaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  
  // 基础连接配置
  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  
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
  
  // 缓存配置
  cache?: {
    defaultTTL?: number;
    maxEntries?: number;
    cleanupInterval?: number;
    enableStats?: boolean;
  };
  
  // 性能配置
  performance?: {
    monitoringInterval?: number;
    queryExecutionTime?: number;
    memoryUsage?: number;
    responseTime?: number;
  };
}
```

#### 步骤2：更新配置加载逻辑
```typescript
loadConfig(): NebulaConfig {
  try {
    const rawConfig = {
      host: process.env.NEBULA_HOST || 'localhost',
      port: parseInt(process.env.NEBULA_PORT || '9669'),
      username: process.env.NEBULA_USERNAME || 'root',
      password: process.env.NEBULA_PASSWORD || 'nebula',
      
      // 基础连接配置
      timeout: parseInt(process.env.NEBULA_TIMEOUT || '30000'),
      maxConnections: parseInt(process.env.NEBULA_MAX_CONNECTIONS || '10'),
      retryAttempts: parseInt(process.env.NEBULA_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.NEBULA_RETRY_DELAY || '1000'),
      
      // 连接池配置
      connectionPool: {
        minConnections: parseInt(process.env.NEBULA_POOL_MIN_CONNECTIONS || '2'),
        maxConnections: parseInt(process.env.NEBULA_POOL_MAX_CONNECTIONS || '10'),
        acquireTimeout: parseInt(process.env.NEBULA_POOL_ACQUIRE_TIMEOUT || '30000'),
        idleTimeout: parseInt(process.env.NEBULA_POOL_IDLE_TIMEOUT || '300000'),
        healthCheckInterval: parseInt(process.env.NEBULA_POOL_HEALTH_CHECK_INTERVAL || '30000'),
        healthCheckTimeout: parseInt(process.env.NEBULA_POOL_HEALTH_CHECK_TIMEOUT || '5000'),
        maxFailures: parseInt(process.env.NEBULA_POOL_MAX_FAILURES || '3'),
      },
      
      // 缓存配置
      cache: {
        defaultTTL: parseInt(process.env.NEBULA_CACHE_TTL || '30000'),
        maxEntries: parseInt(process.env.NEBULA_CACHE_MAX_ENTRIES || '10000'),
        cleanupInterval: parseInt(process.env.NEBULA_CACHE_CLEANUP_INTERVAL || '60000'),
        enableStats: process.env.NEBULA_CACHE_STATS_ENABLED !== 'false',
      },
      
      // 性能配置
      performance: {
        monitoringInterval: parseInt(process.env.NEBULA_PERFORMANCE_INTERVAL || '1000'),
        queryExecutionTime: parseInt(process.env.NEBULA_PERFORMANCE_QUERY_TIMEOUT || '1000'),
        memoryUsage: parseInt(process.env.NEBULA_PERFORMANCE_MEMORY_THRESHOLD || '80'),
        responseTime: parseInt(process.env.NEBULA_PERFORMANCE_RESPONSE_THRESHOLD || '500'),
      },
      
      space: this.getSpaceName(),
      vidTypeLength: parseInt(process.env.NEBULA_VID_TYPE_LENGTH || '128'),
    };

    return this.validateConfig(rawConfig);
  } catch (error) {
    this.errorHandler.handleError(
      error instanceof Error ? error : new Error('Unknown error in NebulaConfigService'),
      { component: 'NebulaConfigService', operation: 'loadConfig' }
    );
    throw error;
  }
}
```

#### 步骤3：修改 ConnectionPool
```typescript
// 文件：src/database/nebula/connection/ConnectionPool.ts

export class ConnectionPool extends EventEmitter implements IConnectionPool {
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.ConnectionWarmer) connectionWarmer: ConnectionWarmer,
    @inject(TYPES.LoadBalancer) loadBalancer: LoadBalancer
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.performanceMonitor = performanceMonitor;
    this.connectionWarmer = connectionWarmer;
    this.loadBalancer = loadBalancer;
    
    // 从配置服务获取配置，而不是使用硬编码
    this.loadPoolConfig();
    this.healthChecker = new ConnectionHealthChecker(this.poolConfig.healthCheck);
    
    this.setupHealthCheckerEvents();
    this.setupLoadBalancerEvents();
    this.connectionWarmer.updateConfig(this.poolConfig.warming);
    this.loadBalancer.updateConfig(this.poolConfig.loadBalancing);
  }
  
  private loadPoolConfig(): void {
    const nebulaConfig = this.configService.getConfig();
    
    // 使用配置服务的值，提供合理的默认值
    this.poolConfig = {
      minConnections: nebulaConfig.connectionPool?.minConnections || 2,
      maxConnections: nebulaConfig.connectionPool?.maxConnections || nebulaConfig.maxConnections || 10,
      acquireTimeout: nebulaConfig.connectionPool?.acquireTimeout || 30000,
      idleTimeout: nebulaConfig.connectionPool?.idleTimeout || 300000,
      healthCheck: {
        interval: nebulaConfig.connectionPool?.healthCheckInterval || 30000,
        timeout: nebulaConfig.connectionPool?.healthCheckTimeout || 5000,
        maxFailures: nebulaConfig.connectionPool?.maxFailures || 3,
        retryDelay: nebulaConfig.retryDelay || 1000,
      },
      warming: {
        enabled: true,
        warmupQueries: ['YIELD 1 AS warmup_test;', 'SHOW SPACES;', 'SHOW HOSTS;'],
        warmupConcurrency: 3,
        warmupTimeout: 10000,
        retryAttempts: nebulaConfig.retryAttempts || 2,
        retryDelay: nebulaConfig.retryDelay || 1000,
      },
      loadBalancing: {
        strategy: LoadBalanceStrategy.LEAST_RESPONSE_TIME,
        healthCheckWeight: 0.3,
        responseTimeWeight: 0.4,
        errorRateWeight: 0.2,
        connectionCountWeight: 0.1,
        weightUpdateInterval: 30000,
        maxWeight: 100,
        minWeight: 1,
      },
    };
  }
}
```

### 3.2 第二阶段：清理重复配置（1周）

#### 步骤1：简化 InfrastructureConfigService
```typescript
// 文件：src/infrastructure/config/InfrastructureConfigService.ts

// 移除与 NebulaConfigService 重复的配置
loadInfrastructureConfigFromEnv(): InfrastructureConfig {
  return {
    common: {
      enableCache: EnvUtils.getEnvBooleanValue('INFRA_CACHE_ENABLED', true),
      enableMonitoring: EnvUtils.getEnvBooleanValue('INFRA_MONITORING_ENABLED', true),
      enableBatching: EnvUtils.getEnvBooleanValue('INFRA_BATCHING_ENABLED', true),
      logLevel: (EnvUtils.getEnvValue('INFRA_LOG_LEVEL') as any) || 'info',
      enableHealthChecks: EnvUtils.getEnvBooleanValue('INFRA_HEALTH_CHECKS_ENABLED', true),
      healthCheckInterval: EnvUtils.getEnvNumberValue('INFRA_HEALTH_CHECK_INTERVAL', 30000),
      gracefulShutdownTimeout: EnvUtils.getEnvNumberValue('INFRA_SHUTDOWN_TIMEOUT', 10000)
    },
    qdrant: {
      // 保留 Qdrant 特定配置
      cache: {
        defaultTTL: EnvUtils.getEnvNumberValue('INFRA_QDRANT_CACHE_TTL', 30000),
        maxEntries: EnvUtils.getEnvNumberValue('INFRA_QDRANT_CACHE_MAX_ENTRIES', 10000),
        cleanupInterval: EnvUtils.getEnvNumberValue('INFRA_QDRANT_CACHE_CLEANUP_INTERVAL', 60000),
        enableStats: EnvUtils.getEnvBooleanValue('INFRA_QDRANT_CACHE_STATS_ENABLED', true),
        databaseSpecific: {}
      },
      // ... 其他 Qdrant 配置
    },
    nebula: {
      // 简化 nebula 配置，只保留基础设施特有的
      cache: {
        defaultTTL: EnvUtils.getEnvNumberValue('INFRA_NEBULA_CACHE_TTL', 30000),
        maxEntries: EnvUtils.getEnvNumberValue('INFRA_NEBULA_CACHE_MAX_ENTRIES', 10000),
        cleanupInterval: EnvUtils.getEnvNumberValue('INFRA_NEBULA_CACHE_CLEANUP_INTERVAL', 60000),
        enableStats: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_CACHE_STATS_ENABLED', true),
        databaseSpecific: {}
      },
      performance: {
        monitoringInterval: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_INTERVAL', 1000),
        metricsRetentionPeriod: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_RETENTION', 8640000),
        enableDetailedLogging: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_PERFORMANCE_LOGGING_ENABLED', true),
        performanceThresholds: {
          queryExecutionTime: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_QUERY_TIMEOUT', 1000),
          memoryUsage: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_MEMORY_THRESHOLD', 80),
          responseTime: EnvUtils.getEnvNumberValue('INFRA_NEBULA_PERFORMANCE_RESPONSE_THRESHOLD', 500),
        },
        databaseSpecific: {}
      },
      // 移除 batch 配置，由 NebulaConfigService 统一管理
      graph: {
        defaultSpace: EnvUtils.getEnvValue('INFRA_NEBULA_GRAPH_SPACE_DEFAULT') || 'default',
        spaceOptions: {
          partitionNum: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_PARTITION_COUNT', 10),
          replicaFactor: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_REPLICA_FACTOR', 1),
          vidType: (EnvUtils.getEnvValue('INFRA_NEBULA_GRAPH_VID_TYPE') as any) || 'FIXED_STRING'
        },
        queryOptions: {
          timeout: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_QUERY_TIMEOUT', 30000),
          retryAttempts: EnvUtils.getEnvNumberValue('INFRA_NEBULA_GRAPH_QUERY_RETRIES', 3)
        },
        schemaManagement: {
          autoCreateTags: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_GRAPH_SCHEMA_TAGS_AUTO', false),
          autoCreateEdges: EnvUtils.getEnvBooleanValue('INFRA_NEBULA_GRAPH_SCHEMA_EDGES_AUTO', false)
        }
      }
    }
  };
}
```

#### 步骤2：合并 BatchProcessingConfigService
```typescript
// 将批处理配置合并到 InfrastructureConfigService
// 或者保留但简化配置项，避免与 NebulaConfigService 冲突
```

### 3.3 第三阶段：优化配置服务结构（1周）

#### 步骤1：移除 GraphConfigService
```typescript
// 1. 从 NebulaConnectionManager 中移除 GraphConfigService 依赖
// 文件：src/database/nebula/NebulaConnectionManager.ts

export class NebulaConnectionManager implements INebulaConnectionManager {
  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService,
    // 移除 GraphConfigService 依赖
    // @inject(TYPES.GraphConfigService) graphConfigService: GraphConfigService,
    @inject(TYPES.SpaceValidator) spaceValidator: SpaceValidator,
    @inject(TYPES.IQueryRunner) queryRunner: IQueryRunner
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.nebulaConfigService = nebulaConfigService;
    // 移除 graphConfigService
    // this.graphConfigService = graphConfigService;
    this.eventEmitter = new EventEmitter();
    this.spaceValidator = spaceValidator;
    this.queryRunner = queryRunner;
    
    this.loadConfiguration();
  }
  
  private loadConfiguration(): void {
    try {
      const baseConfig = this.nebulaConfigService.loadConfig();
      
      // 直接从 NebulaConfig 获取容错配置，不再使用 GraphConfigService
      const faultToleranceConfig = baseConfig.faultTolerance || {
        maxRetries: baseConfig.retryAttempts || 3,
        retryDelay: baseConfig.retryDelay || 1000,
        exponentialBackoff: true,
        circuitBreakerEnabled: true,
        circuitBreakerFailureThreshold: 5,
        circuitBreakerTimeout: 3000,
        fallbackStrategy: 'cache' as const
      };
      
      this.config = { ...baseConfig };
      this.updateConnectionStatusFromConfig();
      
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Configuration loaded', config: this.config }
      });
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to load configuration'),
        { component: 'NebulaConnectionManager', operation: 'loadConfiguration' }
      );
      throw error;
    }
  }
}
```

#### 步骤2：从 DI 容器中移除 GraphConfigService
```typescript
// 文件：src/core/registrars/InfrastructureServiceRegistrar.ts

export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    // ... 其他注册代码
    
    // 移除 GraphConfigService 注册
    // container.bind<GraphConfigService>(TYPES.GraphConfigService)
    //   .to(GraphConfigService).inSingletonScope();
  }
}
```

#### 步骤3：更新 TYPES 定义
```typescript
// 文件：src/types.ts

export const TYPES = {
  // ... 其他类型定义
  
  // 移除 GraphConfigService 类型
  // GraphConfigService: Symbol.for('GraphConfigService'),
};

// 移除相关导入
// import { GraphConfigService } from '../config/service/GraphConfigService';
```

#### 步骤4：合并辅助配置服务
```typescript
// 扩展 EnvironmentConfigService
export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  debug: boolean;
  
  // 合并日志配置
  logging?: {
    level: string;
    format: string;
  };
  
  // 合并监控配置
  monitoring?: {
    enabled: boolean;
    port: number;
    prometheusTargetDir: string;
  };
}
```

#### 步骤5：简化业务配置服务
```typescript
// 简化 IndexingConfigService
export interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
  
  // 合并文件处理配置
  fileProcessing?: {
    maxFileSize: number;
    supportedExtensions: string;
    chunkSize: number;
    overlapSize: number;
  };
}
```

## 4. 配置模块重构计划

### 4.1 保留模块（11个）

| 模块 | 状态 | 修改内容 |
|------|------|----------|
| NebulaConfigService | 扩展 | 添加连接池、缓存、性能、容错配置 |
| QdrantConfigService | 保持 | 无修改 |
| InfrastructureConfigService | 简化 | 移除重复的 nebula 配置 |
| ConfigService | 保持 | 无修改 |
| EmbeddingConfigService | 简化 | 简化 provider 配置 |
| HotReloadConfigService | 保持 | 无修改 |
| TreeSitterConfigService | 保持 | 无修改 |
| ProjectNamingConfigService | 保持 | 无修改 |
| GraphCacheConfigService | 保持 | 无修改 |
| EmbeddingBatchConfigService | 保持 | 无修改 |
| SimilarityConfigService | 保持 | 无修改 |

### 4.2 合并模块（4个）

| 原模块 | 目标模块 | 合并方式 |
|--------|----------|----------|
| LoggingConfigService | EnvironmentConfigService | 扩展接口 |
| MonitoringConfigService | EnvironmentConfigService | 扩展接口 |
| FileProcessingConfigService | IndexingConfigService | 扩展接口 |
| BatchProcessingConfigService | InfrastructureConfigService | 部分合并 |

### 4.3 移除模块（1个）

| 模块 | 移除原因 | 替代方案 |
|------|----------|----------|
| **GraphConfigService** | 功能重复且设计不合理 | 合并到 NebulaConfigService |

## 5. 验证和测试

### 5.1 配置验证测试
```typescript
// 创建配置验证测试
describe('Configuration Unification', () => {
  it('should resolve connection pool conflicts', () => {
    const nebulaConfig = nebulaConfigService.getConfig();
    expect(nebulaConfig.connectionPool?.maxConnections).toBeDefined();
    expect(nebulaConfig.maxConnections).toBe(nebulaConfig.connectionPool?.maxConnections);
  });
  
  it('should maintain backward compatibility', () => {
    // 测试旧的环境变量仍然有效
    process.env.NEBULA_MAX_CONNECTIONS = '20';
    const config = nebulaConfigService.getConfig();
    expect(config.maxConnections).toBe(20);
  });
});
```

### 5.2 集成测试
```typescript
// 创建集成测试
describe('Configuration Integration', () => {
  it('should work with ConnectionPool', async () => {
    const connectionPool = new ConnectionPool(/* dependencies */);
    await connectionPool.initialize(nebulaConfigService.getConfig());
    // 验证连接池使用正确的配置
  });
});
```

## 6. 部署和监控

### 6.1 部署检查清单
- [ ] 所有配置接口更新完成
- [ ] 环境变量映射正确
- [ ] 向后兼容性测试通过
- [ ] 配置验证测试通过
- [ ] 集成测试通过

### 6.2 监控指标
- 配置加载时间
- 配置验证错误
- 配置冲突检测
- 配置变更频率

## 7. 风险控制

### 7.1 回滚计划
1. 保留原始配置文件备份
2. 提供配置回滚脚本
3. 监控配置变更影响

### 7.2 渐进式部署
1. 先在开发环境验证
2. 在测试环境进行集成测试
3. 在生产环境灰度部署
4. 全量部署

## 8. 总结

通过以上实施步骤，可以：

1. **解决配置冲突**：统一连接池、超时、重试配置
2. **简化配置结构**：减少配置服务数量，明确职责边界
3. **提高可维护性**：统一的配置接口和验证机制
4. **保持兼容性**：支持现有环境变量和配置方式

整个实施过程预计需要3周时间，分阶段进行，确保系统稳定性和配置一致性。