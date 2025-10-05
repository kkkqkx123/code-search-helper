# Infrastructure模块集成分析与多数据库支持方案

## 一、现有Infrastructure模块分析

### 1.1 模块结构概览

当前`src/infrastructure/`模块采用依赖注入模式，包含三个核心子模块：

```
src/infrastructure/
├── caching/           # 缓存服务
│   ├── CacheService.ts
│   └── types.ts
├── monitoring/        # 性能监控
│   └── PerformanceMonitor.ts
└── batching/          # 批处理优化
    └── BatchOptimizer.ts
```

### 1.2 设计模式分析

**依赖注入模式**：所有服务都通过构造函数注入依赖，便于测试和替换
**接口实现分离**：定义清晰的接口（如ICacheService）和具体实现
**配置驱动**：通过配置对象控制服务行为，支持运行时调整

### 1.3 现有服务能力

#### CacheService能力
- LRU缓存策略和过期清理
- 图分析结果专用缓存（getGraphStatsCache/setGraphStatsCache）
- 缓存命中率和性能统计
- 多实例隔离支持

#### PerformanceMonitor能力
- 查询执行时间记录
- 缓存命中率监控
- 批处理统计跟踪
- 系统健康状态监控
- 内存使用监控

#### BatchOptimizer能力
- 自适应批大小计算
- 基于执行时间的动态调整
- 指数退避重试机制
- 并发批处理执行
- 性能阈值监控

## 二、Nebula图数据库集成支持

### 2.1 基础设施扩展需求

#### 多数据库类型支持
扩展现有服务接口以支持多种数据库类型：

```typescript
// 扩展现有接口
interface ICacheService {
  // 现有方法...
  
  // 新增多数据库支持
  getDatabaseSpecificCache<T>(key: string, databaseType: DatabaseType): Promise<T | null>
  setDatabaseSpecificCache<T>(key: string, value: T, databaseType: DatabaseType, ttl?: number): Promise<void>
  invalidateDatabaseCache(databaseType: DatabaseType): Promise<void>
}

enum DatabaseType {
  QDRANT = 'qdrant',
  NEBULA = 'nebula',
  VECTOR = 'vector',
  GRAPH = 'graph'
}
```

#### 数据库连接池管理
```typescript
interface IDatabaseConnectionPool {
  getConnection(databaseType: DatabaseType): Promise<DatabaseConnection>
  releaseConnection(connection: DatabaseConnection): Promise<void>
  getPoolStatus(databaseType: DatabaseType): PoolStatus
  optimizePoolSize(databaseType: DatabaseType, loadFactor: number): Promise<void>
}
```

#### 事务协调器
```typescript
interface ITransactionCoordinator {
  beginTransaction(transactionId: string, participants: DatabaseType[]): Promise<void>
  preparePhase(transactionId: string): Promise<Map<DatabaseType, boolean>>
  commitPhase(transactionId: string): Promise<boolean>
  rollback(transactionId: string): Promise<void>
  getTransactionStatus(transactionId: string): TransactionStatus
}
```

### 2.2 具体实现方案

#### 扩展CacheService支持Nebula
```typescript
export class ExtendedCacheService extends CacheService {
  private nebulaSpecificCache: Map<string, CacheEntry<any>>
  
  async cacheNebulaGraphData(spaceName: string, data: GraphData): Promise<void> {
    const key = `nebula:graph:${spaceName}`
    const entry = this.createCacheEntry(data, this.config.nebulaCacheTTL)
    this.nebulaSpecificCache.set(key, entry)
    
    // 同时更新统计信息
    await this.updateCacheStats(DatabaseType.NEBULA, 'set', 1)
  }
  
  async getNebulaGraphData(spaceName: string): Promise<GraphData | null> {
    const key = `nebula:graph:${spaceName}`
    const entry = this.nebulaSpecificCache.get(key)
    
    if (entry && !this.isExpired(entry)) {
      await this.updateCacheStats(DatabaseType.NEBULA, 'hit', 1)
      return entry.value as GraphData
    }
    
    await this.updateCacheStats(DatabaseType.NEBULA, 'miss', 1)
    return null
  }
  
  private async updateCacheStats(databaseType: DatabaseType, operation: string, count: number): Promise<void> {
    const metricName = `cache_${databaseType}_${operation}`
    await this.performanceMonitor.incrementCounter(metricName, count)
  }
}
```

#### 扩展PerformanceMonitor支持图数据库
```typescript
export class ExtendedPerformanceMonitor extends PerformanceMonitor {
  private databaseSpecificMetrics: Map<DatabaseType, DatabaseMetrics>
  
  async recordNebulaOperation(
    operation: string,
    spaceName: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    const metric: GraphDatabaseMetric = {
      databaseType: DatabaseType.NEBULA,
      operation,
      spaceName,
      duration,
      success,
      timestamp: Date.now(),
      metadata: {
        vertexCount: 0, // 从操作结果中获取
        edgeCount: 0    // 从操作结果中获取
      }
    }
    
    await this.recordGraphMetric(metric)
    await this.checkNebulaHealth(spaceName, success, duration)
  }
  
  private async checkNebulaHealth(spaceName: string, success: boolean, duration: number): Promise<void> {
    const healthStatus = this.calculateHealthStatus(success, duration)
    
    if (healthStatus !== 'healthy') {
      await this.alertManager.sendAlert({
        type: 'DATABASE_HEALTH',
        severity: healthStatus === 'critical' ? 'CRITICAL' : 'WARNING',
        message: `Nebula graph space ${spaceName} is ${healthStatus}`,
        metadata: { duration, success }
      })
    }
  }
  
  private calculateHealthStatus(success: boolean, duration: number): 'healthy' | 'degraded' | 'critical' {
    if (!success) return 'critical'
    if (duration > this.thresholds.nebulaSlowQuery) return 'degraded'
    return 'healthy'
  }
}
```

#### 扩展BatchOptimizer支持图数据操作
```typescript
export class GraphBatchOptimizer extends BatchOptimizer {
  private graphSpecificConfig: GraphBatchConfig
  
  async optimizeGraphOperations(
    operations: GraphOperation[],
    databaseType: DatabaseType
  ): Promise<BatchResult> {
    const batchSize = this.calculateOptimalGraphBatchSize(operations.length, databaseType)
    const batches = this.createGraphBatches(operations, batchSize)
    
    const results: BatchOperationResult[] = []
    
    for (const batch of batches) {
      const startTime = Date.now()
      
      try {
        const result = await this.executeGraphBatch(batch, databaseType)
        const duration = Date.now() - startTime
        
        results.push({
          batchId: batch.id,
          success: true,
          duration,
          processedCount: batch.operations.length,
          result
        })
        
        // 根据执行时间动态调整批大小
        this.adjustGraphBatchSize(databaseType, duration, batchSize)
        
      } catch (error) {
        const duration = Date.now() - startTime
        
        results.push({
          batchId: batch.id,
          success: false,
          duration,
          processedCount: 0,
          error: error as Error
        })
        
        // 出错时减小批大小
        this.decreaseGraphBatchSize(databaseType)
      }
    }
    
    return {
      totalOperations: operations.length,
      successfulOperations: results.filter(r => r.success).length,
      failedOperations: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      results
    }
  }
  
  private calculateOptimalGraphBatchSize(operationCount: number, databaseType: DatabaseType): number {
    const baseSize = this.getGraphBatchSizeConfig(databaseType)
    
    // 根据操作类型和数据库特性调整
    switch (databaseType) {
      case DatabaseType.NEBULA:
        // Nebula图数据库适合中等批大小
        return Math.min(baseSize, this.config.nebulaMaxBatchSize)
      
      case DatabaseType.QDRANT:
        // Qdrant向量数据库可以处理大批次
        return Math.min(baseSize * 2, this.config.qdrantMaxBatchSize)
      
      default:
        return baseSize
    }
  }
}
```

## 三、Qdrant向量数据库支持分析

### 3.1 Qdrant支持必要性分析

**业务需求**：
- Qdrant作为主要向量数据库，同样需要基础设施支持
- 向量操作和图操作在索引过程中并行执行
- 需要统一的事务协调和一致性保障

**技术需求**：
- 向量数据批量插入优化
- 向量搜索性能监控
- 向量缓存策略（避免重复计算嵌入向量）

### 3.2 Qdrant基础设施扩展

#### 向量缓存专用策略
```typescript
interface IVectorCacheService extends ICacheService {
  cacheEmbedding(vectorId: string, embedding: number[]): Promise<void>
  getEmbedding(vectorId: string): Promise<number[] | null>
  cacheVectorSearch(searchKey: string, results: SearchResult[]): Promise<void>
  getCachedVectorSearch(searchKey: string): Promise<SearchResult[] | null>
  invalidateVectorCache(vectorId?: string): Promise<void>
}
```

#### 向量操作性能监控
```typescript
interface IVectorPerformanceMonitor extends IPerformanceMonitor {
  recordVectorOperation(
    operation: 'insert' | 'search' | 'update' | 'delete',
    collectionName: string,
    vectorCount: number,
    dimension: number,
    duration: number,
    success: boolean
  ): Promise<void>
  
  recordEmbeddingGeneration(
    model: string,
    textLength: number,
    duration: number,
    tokenCount: number
  ): Promise<void>
  
  getVectorCollectionMetrics(collectionName: string): Promise<VectorCollectionMetrics>
}
```

#### 向量批处理优化
```typescript
interface IVectorBatchOptimizer extends IBatchOptimizer {
  optimizeVectorInsertions(
    vectors: VectorData[],
    collectionName: string
  ): Promise<VectorBatchResult>
  
  optimizeVectorSearches(
    searchRequests: SearchRequest[],
    collectionName: string
  ): Promise<SearchBatchResult>
  
  calculateOptimalVectorBatchSize(vectorCount: number, dimension: number): number
}
```

### 3.3 Qdrant具体实现

#### 向量缓存实现
```typescript
export class VectorCacheService implements IVectorCacheService {
  private embeddingCache: Map<string, CacheEntry<number[]>>
  private searchCache: Map<string, CacheEntry<SearchResult[]>>
  
  async cacheEmbedding(vectorId: string, embedding: number[]): Promise<void> {
    const key = `embedding:${vectorId}`
    const entry = this.createCacheEntry(embedding, this.config.embeddingCacheTTL)
    this.embeddingCache.set(key, entry)
  }
  
  async getEmbedding(vectorId: string): Promise<number[] | null> {
    const key = `embedding:${vectorId}`
    const entry = this.embeddingCache.get(key)
    
    if (entry && !this.isExpired(entry)) {
      return entry.value
    }
    
    return null
  }
  
  async cacheVectorSearch(searchKey: string, results: SearchResult[]): Promise<void> {
    const key = `search:${searchKey}`
    const entry = this.createCacheEntry(results, this.config.searchCacheTTL)
    this.searchCache.set(key, entry)
  }
  
  async getCachedVectorSearch(searchKey: string): Promise<SearchResult[] | null> {
    const key = `search:${searchKey}`
    const entry = this.searchCache.get(key)
    
    if (entry && !this.isExpired(entry)) {
      return entry.value
    }
    
    return null
  }
}
```

#### 向量性能监控实现
```typescript
export class VectorPerformanceMonitor implements IVectorPerformanceMonitor {
  async recordVectorOperation(
    operation: 'insert' | 'search' | 'update' | 'delete',
    collectionName: string,
    vectorCount: number,
    dimension: number,
    duration: number,
    success: boolean
  ): Promise<void> {
    const metric: VectorOperationMetric = {
      operation,
      collectionName,
      vectorCount,
      dimension,
      duration,
      success,
      timestamp: Date.now(),
      throughput: vectorCount / (duration / 1000) // vectors per second
    }
    
    await this.recordMetric(`vector_${operation}`, metric)
    
    // 检查性能阈值
    if (success && this.shouldAlertOnPerformance(operation, duration, vectorCount)) {
      await this.sendPerformanceAlert(operation, collectionName, duration, vectorCount)
    }
  }
  
  private shouldAlertOnPerformance(
    operation: string,
    duration: number,
    vectorCount: number
  ): boolean {
    const thresholds = this.config.performanceThresholds[operation]
    const avgDurationPerVector = duration / vectorCount
    
    return avgDurationPerVector > thresholds.maxDurationPerVector
  }
}
```

## 四、统一基础设施架构

### 4.1 统一抽象层设计

#### 数据库抽象接口
```typescript
interface IDatabaseInfrastructure {
  readonly databaseType: DatabaseType
  
  // 缓存支持
  getCacheService(): ICacheService
  
  // 性能监控
  getPerformanceMonitor(): IPerformanceMonitor
  
  // 批处理优化
  getBatchOptimizer(): IBatchOptimizer
  
  // 健康检查
  getHealthChecker(): IDatabaseHealthChecker
  
  // 连接管理
  getConnectionManager(): IDatabaseConnectionManager
}
```

#### 基础设施管理器
```typescript
export class InfrastructureManager {
  private databaseInfrastructures: Map<DatabaseType, IDatabaseInfrastructure>
  private transactionCoordinator: ITransactionCoordinator
  
  constructor(
    private config: InfrastructureConfig,
    private logger: ILogger
  ) {
    this.initializeInfrastructures()
  }
  
  private initializeInfrastructures(): void {
    // Qdrant基础设施
    this.databaseInfrastructures.set(DatabaseType.QDRANT, new QdrantInfrastructure(
      this.config.qdrant,
      this.logger
    ))
    
    // Nebula基础设施
    this.databaseInfrastructures.set(DatabaseType.NEBULA, new NebulaInfrastructure(
      this.config.nebula,
      this.logger
    ))
    
    // 初始化事务协调器
    this.transactionCoordinator = new DistributedTransactionCoordinator(
      Array.from(this.databaseInfrastructures.values()),
      this.config.transaction,
      this.logger
    )
  }
  
  getInfrastructure(databaseType: DatabaseType): IDatabaseInfrastructure {
    const infrastructure = this.databaseInfrastructures.get(databaseType)
    if (!infrastructure) {
      throw new Error(`Infrastructure not found for database type: ${databaseType}`)
    }
    return infrastructure
  }
  
  getTransactionCoordinator(): ITransactionCoordinator {
    return this.transactionCoordinator
  }
  
  async getAllHealthStatus(): Promise<Map<DatabaseType, HealthStatus>> {
    const healthStatus = new Map<DatabaseType, HealthStatus>()
    
    for (const [type, infrastructure] of this.databaseInfrastructures) {
      const healthChecker = infrastructure.getHealthChecker()
      const status = await healthChecker.checkHealth()
      healthStatus.set(type, status)
    }
    
    return healthStatus
  }
}
```

### 4.2 配置统一管理

#### 基础设施配置
```typescript
interface InfrastructureConfig {
  // 通用配置
  common: {
    enableCache: boolean
    enableMonitoring: boolean
    enableBatching: boolean
    logLevel: LogLevel
  }
  
  // Qdrant特定配置
  qdrant: {
    cache: CacheConfig
    performance: PerformanceConfig
    batch: BatchConfig
    connection: ConnectionConfig
  }
  
  // Nebula特定配置
  nebula: {
    cache: CacheConfig
    performance: PerformanceConfig
    batch: BatchConfig
    connection: ConnectionConfig
    graph: GraphSpecificConfig
  }
  
  // 事务配置
  transaction: {
    timeout: number
    retryAttempts: number
    retryDelay: number
    enableTwoPhaseCommit: boolean
  }
}
```

### 4.3 错误处理和监控

#### 统一错误处理
```typescript
export class InfrastructureErrorHandler {
  constructor(
    private logger: ILogger,
    private alertManager: IAlertManager,
    private performanceMonitor: IPerformanceMonitor
  ) {}
  
  async handleDatabaseError(
    error: Error,
    databaseType: DatabaseType,
    operation: string,
    context: Record<string, any>
  ): Promise<void> {
    const errorInfo = this.categorizeError(error, databaseType)
    
    // 记录错误指标
    await this.performanceMonitor.incrementCounter(
      `error_${databaseType}_${operation}`,
      1
    )
    
    // 记录详细错误日志
    this.logger.error(`Database operation failed`, {
      databaseType,
      operation,
      error: error.message,
      stack: error.stack,
      context,
      category: errorInfo.category,
      severity: errorInfo.severity
    })
    
    // 发送告警（根据严重程度）
    if (errorInfo.severity === 'HIGH') {
      await this.alertManager.sendAlert({
        type: 'DATABASE_ERROR',
        severity: 'CRITICAL',
        message: `${databaseType} operation failed: ${error.message}`,
        metadata: { databaseType, operation, context }
      })
    }
  }
  
  private categorizeError(error: Error, databaseType: DatabaseType): ErrorInfo {
    // 根据错误类型和数据库类型分类
    if (error.message.includes('connection')) {
      return { category: 'CONNECTION', severity: 'HIGH' }
    }
    if (error.message.includes('timeout')) {
      return { category: 'TIMEOUT', severity: 'MEDIUM' }
    }
    if (error.message.includes('constraint')) {
      return { category: 'CONSTRAINT', severity: 'LOW' }
    }
    
    return { category: 'UNKNOWN', severity: 'MEDIUM' }
  }
}
```

## 五、实施建议

### 5.1 实施优先级

**P0 - 基础设施扩展（1-2周）**
- 扩展现有服务接口支持多数据库类型
- 实现数据库特定的缓存策略
- 添加数据库连接池监控

**P1 - Qdrant支持完善（1周）**
- 实现向量缓存专用策略
- 添加向量操作性能监控
- 优化向量批处理操作

**P2 - 统一抽象层（1-2周）**
- 创建统一的基础设施管理器
- 实现配置统一管理
- 添加统一错误处理

**P3 - 高级功能（可选）**
- 自动性能优化
- 智能缓存策略
- 预测性监控

### 5.2 风险评估

**低风险**：
- 扩展现有服务接口（向后兼容）
- 添加新的缓存策略（独立实现）

**中风险**：
- 统一抽象层设计（需要充分测试）
- 配置统一管理（影响现有配置）

**高风险**：
- 事务协调器（复杂性高，需要充分验证）
- 自动性能优化（可能影响稳定性）

### 5.3 测试策略

1. **单元测试**：每个服务扩展都需要完整的单元测试
2. **集成测试**：验证多数据库协同工作
3. **性能测试**：对比优化前后的性能指标
4. **压力测试**：验证高并发下的稳定性
5. **故障注入测试**：验证错误处理和恢复机制

### 5.4 监控指标

**性能指标**：
- 各数据库操作响应时间
- 缓存命中率和效果
- 批处理优化效果
- 事务成功率

**健康指标**：
- 数据库连接状态
- 错误率和重试率
- 资源使用情况
- 系统负载

**业务指标**：
- 索引成功率
- 数据一致性检查通过率
- 用户查询响应时间
- 系统可用性

通过这套完整的基础设施集成方案，可以为Nebula图数据库和Qdrant向量数据库提供统一、高效、可靠的支持，确保整个代码搜索系统的稳定性和性能。