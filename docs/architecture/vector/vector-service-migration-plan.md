# 向量服务迁移实施计划

## 概述

本文档详细描述了从现有分散的向量操作服务迁移到统一的向量服务模块的实施计划。迁移将分阶段进行，确保系统的稳定性和向后兼容性。

## 迁移原则

1. **渐进式迁移**：分阶段实施，避免大规模重构
2. **向后兼容**：保持现有API接口，逐步替换实现
3. **风险可控**：每个阶段都有明确的回滚方案
4. **测试覆盖**：充分的单元测试和集成测试
5. **性能监控**：实时监控迁移过程中的性能指标

## 迁移阶段规划

### 第一阶段：基础架构搭建 (预计2周)

#### 目标
- 建立向量服务基础框架
- 实现核心接口和依赖注入
- 建立基本的测试覆盖

#### 具体任务

**Week 1: 项目结构和基础代码**
1. 创建 `src/service/vector/` 目录结构
2. 实现基础类型定义 (`types/VectorTypes.ts`)
3. 创建核心接口 (`core/IVectorService.ts`, `repository/IVectorRepository.ts`)
4. 建立依赖注入配置 (`VectorModule.ts`)
5. 实现基础的VectorService类

**Week 2: 仓库层实现**
1. 实现VectorRepository类
2. 集成现有的Qdrant数据库层
3. 实现基本的CRUD操作
4. 添加单元测试
5. 创建集成测试框架

#### 交付物
- 完整的向量服务框架
- 基础的CRUD功能
- 单元测试覆盖率 > 80%
- 集成测试框架

#### 风险评估
- **风险**：新框架可能存在设计缺陷
- **缓解**：充分的设计评审和代码审查
- **回滚**：保留现有服务，可随时切换回退

### 第二阶段：核心功能迁移 (预计3周)

#### 目标
- 迁移ChunkToVectorCoordinationService的核心功能
- 实现向量生成和存储功能
- 集成嵌入器服务

#### 具体任务

**Week 3: 嵌入功能集成**
1. 分析现有ChunkToVectorCoordinationService的嵌入逻辑
2. 实现EmbeddingOperations类
3. 集成EmbedderFactory
4. 实现嵌入缓存机制
5. 添加批处理优化

**Week 4: 向量存储功能**
1. 实现向量到数据库的存储逻辑
2. 迁移现有的向量格式处理
3. 实现项目级向量管理
4. 添加向量验证和错误处理
5. 性能优化和调优

**Week 5: 搜索功能实现**
1. 实现基本的向量搜索功能
2. 集成现有的搜索选项
3. 实现搜索结果缓存
4. 添加搜索性能监控
5. 实现高级搜索功能

#### 交付物
- 完整的向量创建和搜索功能
- 与现有功能兼容的API
- 性能基准测试报告
- 详细的集成测试

#### 风险评估
- **风险**：功能迁移可能引入bug
- **缓解**：并行运行新旧实现，对比验证
- **回滚**：保留原始实现，可快速切换

### 第三阶段：高级功能完善 (预计2周)

#### 目标
- 实现协调层功能
- 完善缓存策略
- 添加性能监控

#### 具体任务

**Week 6: 协调层实现**
1. 实现VectorCoordinationService
2. 智能批处理优化
3. 错误处理和降级策略
4. 并发控制机制
5. 资源管理优化

**Week 7: 缓存和监控**
1. 实现多级缓存策略
2. 集成VectorCacheService功能
3. 实现性能监控
4. 添加健康检查
5. 实现指标收集和报告

#### 交付物
- 智能协调层
- 完善的缓存机制
- 全面的性能监控
- 运维文档和监控面板

#### 风险评估
- **风险**：缓存策略可能影响数据一致性
- **缓解**：充分的缓存测试和验证
- **回滚**：可禁用缓存功能，回退到直接数据库访问

### 第四阶段：集成测试和优化 (预计2周)

#### 目标
- 全面的集成测试
- 性能测试和优化
- 生产环境准备

#### 具体任务

**Week 8: 集成测试**
1. 端到端功能测试
2. 性能基准测试
3. 压力测试和容量评估
4. 兼容性测试
5. 安全测试

**Week 9: 优化和文档**
1. 性能调优
2. 代码重构和清理
3. 完善文档
4. 准备生产环境配置
5. 制定运维手册

#### 交付物
- 完整的测试报告
- 性能优化报告
- 生产就绪的代码
- 运维和监控文档

#### 风险评估
- **风险**：生产环境可能出现问题
- **缓解**：灰度发布，逐步切换流量
- **回滚**：完整的回滚方案和工具

## 详细实施步骤

### 步骤1：环境准备

```bash
# 创建向量服务目录
mkdir -p src/service/vector/{core,repository,caching,coordination,operations,types,utils,monitoring}

# 创建测试目录
mkdir -p src/service/vector/__tests__/{unit,integration,e2e}

# 创建文档目录
mkdir -p docs/service/vector
```

### 步骤2：依赖注入配置

更新 `src/types.ts`：

```typescript
// 添加向量服务相关类型
export const TYPES = {
  // ... 现有类型
  
  // 向量服务
  IVectorService: Symbol.for('IVectorService'),
  IVectorRepository: Symbol.for('IVectorRepository'),
  IVectorCacheManager: Symbol.for('IVectorCacheManager'),
  IVectorCoordinationService: Symbol.for('IVectorCoordinationService'),
  IVectorEventPublisher: Symbol.for('IVectorEventPublisher'),
  
  // 向量操作
  IVectorOperations: Symbol.for('IVectorOperations'),
  IEmbeddingOperations: Symbol.for('IEmbeddingOperations'),
  ISearchOperations: Symbol.for('ISearchOperations'),
  
  // 向量监控
  IVectorPerformanceMonitor: Symbol.for('IVectorPerformanceMonitor'),
};
```

### 步骤3：基础类型定义

创建 `src/service/vector/types/VectorTypes.ts`：

```typescript
// 基础向量类型定义
export interface Vector {
  id: string;
  vector: number[];
  content: string;
  metadata: VectorMetadata;
  timestamp: Date;
}

export interface VectorMetadata {
  projectId: string;
  filePath?: string;
  language?: string;
  chunkType?: string[];
  startLine?: number;
  endLine?: number;
  functionName?: string;
  className?: string;
  snippetMetadata?: any;
  customFields?: Record<string, any>;
}

// ... 其他类型定义
```

### 步骤4：核心服务实现

创建 `src/service/vector/core/VectorService.ts`：

```typescript
@injectable()
export class VectorService implements IVectorService {
  constructor(
    @inject(TYPES.IVectorRepository) private repository: IVectorRepository,
    @inject(TYPES.IVectorCoordinationService) private coordinator: IVectorCoordinationService,
    @inject(TYPES.IVectorCacheManager) private cacheManager: IVectorCacheManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  async createVectors(content: string[], options?: VectorOptions): Promise<Vector[]> {
    try {
      this.logger.info(`Creating vectors for ${content.length} contents`);
      
      // 使用协调器处理复杂的创建流程
      const vectors = await this.coordinator.coordinateVectorCreation(content, options);
      
      this.logger.info(`Successfully created ${vectors.length} vectors`);
      return vectors;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorService',
        operation: 'createVectors',
        contentCount: content.length
      });
      throw error;
    }
  }

  // ... 其他方法实现
}
```

### 步骤5：仓库层实现

创建 `src/service/vector/repository/VectorRepository.ts`：

```typescript
@injectable()
export class VectorRepository implements IVectorRepository {
  constructor(
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  async create(vector: Vector): Promise<string> {
    try {
      // 使用现有的Qdrant服务
      const success = await this.qdrantService.upsertVectorsForProject(
        vector.metadata.projectId,
        [this.convertToVectorPoint(vector)]
      );
      
      if (success) {
        return vector.id;
      } else {
        throw new Error('Failed to create vector');
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'VectorRepository',
        operation: 'create',
        vectorId: vector.id
      });
      throw error;
    }
  }

  private convertToVectorPoint(vector: Vector): VectorPoint {
    return {
      id: vector.id,
      vector: vector.vector,
      payload: {
        content: vector.content,
        filePath: vector.metadata.filePath || '',
        language: vector.metadata.language || 'unknown',
        chunkType: vector.metadata.chunkType || ['code'],
        startLine: vector.metadata.startLine,
        endLine: vector.metadata.endLine,
        functionName: vector.metadata.functionName,
        className: vector.metadata.className,
        snippetMetadata: vector.metadata.snippetMetadata,
        metadata: vector.metadata.customFields || {},
        timestamp: vector.timestamp,
        projectId: vector.metadata.projectId
      }
    };
  }

  // ... 其他方法实现
}
```

### 步骤6：协调层实现

创建 `src/service/vector/coordination/VectorCoordinationService.ts`：

```typescript
@injectable()
export class VectorCoordinationService implements IVectorCoordinationService {
  constructor(
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.IVectorRepository) private repository: IVectorRepository,
    @inject(TYPES.IVectorCacheManager) private cacheManager: IVectorCacheManager,
    @inject(TYPES.BatchProcessingService) private batchService: BatchProcessingService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async coordinateVectorCreation(contents: string[], options?: VectorOptions): Promise<Vector[]> {
    try {
      this.logger.info(`Coordinating vector creation for ${contents.length} contents`);
      
      // 1. 生成嵌入向量
      const embeddings = await this.handleEmbeddingGeneration(contents, options);
      
      // 2. 创建向量对象
      const vectors = contents.map((content, index) => ({
        id: this.generateVectorId(content, options),
        vector: embeddings[index],
        content,
        metadata: this.buildMetadata(content, options),
        timestamp: new Date()
      }));
      
      // 3. 批量存储向量
      const vectorIds = await this.repository.createBatch(vectors);
      
      // 4. 缓存结果
      await this.cacheVectors(vectors);
      
      this.logger.info(`Successfully coordinated creation of ${vectors.length} vectors`);
      return vectors;
    } catch (error) {
      this.logger.error('Error coordinating vector creation:', error);
      throw error;
    }
  }

  private async handleEmbeddingGeneration(contents: string[], options?: EmbeddingOptions): Promise<number[][]> {
    // 使用批处理服务优化嵌入生成
    return await this.batchService.processBatches(
      contents,
      async (batch: string[]) => {
        const embedder = await this.embedderFactory.getEmbedder(options?.provider || 'default');
        const results = await Promise.all(
          batch.map(content => embedder.embed({ text: content }))
        );
        return results.map(result => result.vector);
      },
      { batchSize: options?.batchSize || 50 }
    );
  }

  // ... 其他方法实现
}
```

### 步骤7：缓存层实现

创建 `src/service/vector/caching/VectorCacheManager.ts`：

```typescript
@injectable()
export class VectorCacheManager implements IVectorCacheManager {
  private vectorCache: Map<string, CacheEntry<Vector>>;
  private searchCache: Map<string, CacheEntry<SearchResult[]>>;
  
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    this.vectorCache = new Map();
    this.searchCache = new Map();
    this.initializeCleanup();
  }

  async getVector(key: string): Promise<Vector | null> {
    const entry = this.vectorCache.get(key);
    if (entry && !this.isExpired(entry)) {
      this.logger.debug(`Cache hit for vector: ${key}`);
      return entry.data;
    }
    return null;
  }

  async setVector(key: string, vector: Vector, ttl?: number): Promise<void> {
    const entry: CacheEntry<Vector> = {
      data: vector,
      timestamp: Date.now(),
      ttl: ttl || this.getDefaultTTL()
    };
    this.vectorCache.set(key, entry);
    this.logger.debug(`Cached vector: ${key}`);
  }

  // ... 其他方法实现
}
```

### 步骤8：测试实现

创建 `src/service/vector/__tests__/unit/VectorService.test.ts`：

```typescript
describe('VectorService', () => {
  let vectorService: IVectorService;
  let mockRepository: jest.Mocked<IVectorRepository>;
  let mockCoordinator: jest.Mocked<IVectorCoordinationService>;
  let mockCacheManager: jest.Mocked<IVectorCacheManager>;

  beforeEach(() => {
    // 创建mock对象
    mockRepository = createMockRepository();
    mockCoordinator = createMockCoordinator();
    mockCacheManager = createMockCacheManager();

    // 创建服务实例
    vectorService = new VectorService(
      mockRepository,
      mockCoordinator,
      mockCacheManager,
      mockLogger,
      mockErrorHandler
    );
  });

  describe('createVectors', () => {
    it('should create vectors successfully', async () => {
      const contents = ['content1', 'content2'];
      const expectedVectors = [createMockVector('1'), createMockVector('2')];
      
      mockCoordinator.coordinateVectorCreation.mockResolvedValue(expectedVectors);

      const result = await vectorService.createVectors(contents);

      expect(result).toEqual(expectedVectors);
      expect(mockCoordinator.coordinateVectorCreation).toHaveBeenCalledWith(contents, undefined);
    });

    it('should handle errors gracefully', async () => {
      const contents = ['content1'];
      const error = new Error('Creation failed');
      
      mockCoordinator.coordinateVectorCreation.mockRejectedValue(error);

      await expect(vectorService.createVectors(contents)).rejects.toThrow(error);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  // ... 其他测试用例
});
```

## 监控和告警

### 关键指标监控

1. **性能指标**：
   - 向量创建响应时间
   - 搜索响应时间
   - 批处理吞吐量
   - 缓存命中率

2. **业务指标**：
   - 向量创建成功率
   - 搜索成功率
   - 错误率
   - 活跃项目数

3. **系统指标**：
   - 内存使用量
   - 数据库连接数
   - 缓存大小
   - 队列长度

### 告警规则

```yaml
alerts:
  - name: vector_service_high_error_rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    
  - name: vector_service_slow_response
    condition: avg_response_time > 1000ms
    duration: 10m
    severity: warning
    
  - name: vector_service_low_cache_hit_rate
    condition: cache_hit_rate < 80%
    duration: 30m
    severity: warning
```

## 回滚策略

### 回滚触发条件

1. **性能严重下降**：响应时间增加超过50%
2. **错误率异常**：错误率超过10%
3. **功能异常**：核心功能无法正常工作
4. **用户投诉**：大量用户反馈问题

### 回滚步骤

1. **立即切换**：将流量切换回原有服务
2. **数据检查**：验证数据一致性
3. **问题排查**：分析失败原因
4. **修复验证**：修复问题并重新测试
5. **重新发布**：在修复后重新发布

### 回滚工具

```bash
# 快速回滚脚本
./scripts/rollback-vector-service.sh

# 数据一致性检查
./scripts/verify-vector-data-consistency.sh

# 服务状态检查
./scripts/check-vector-service-health.sh
```

## 成功标准

### 技术指标

1. **性能要求**：
   - 向量创建：< 500ms (P95)
   - 向量搜索：< 200ms (P95)
   - 批处理：> 1000 vectors/second

2. **可靠性要求**：
   - 可用性：> 99.9%
   - 错误率：< 1%
   - 数据一致性：100%

3. **扩展性要求**：
   - 支持 > 1000 并发请求
   - 支持 > 100万 向量存储
   - 支持水平扩展

### 业务指标

1. **用户满意度**：> 90%
2. **开发效率提升**：> 30%
3. **维护成本降低**：> 20%
4. **新功能交付速度**：提升 > 25%

## 总结

这个迁移计划提供了一个系统性的、风险可控的路径，从现有的分散向量操作服务迁移到统一的向量服务模块。通过分阶段实施、充分的测试和完善的监控，可以确保迁移的成功和系统的稳定性。