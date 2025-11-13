## 分析结果：EMBEDDING_BATCH_SIZE 与 EMBEDDING_PROVIDER_SIMILARITY_BATCH_SIZE 的关系

### 1. 配置独立性分析

**两个配置是完全独立的**：

- **EMBEDDING_BATCH_SIZE (64)**：全局默认嵌入批处理大小，在 [`EmbeddingBatchConfigService.ts`](src/config/service/EmbeddingBatchConfigService.ts:33) 中作为 `defaultBatchSize` 使用
- **EMBEDDING_PROVIDER_SIMILARITY_BATCH_SIZE (64)**：专门用于相似度计算的提供商特定批处理大小，在 [`EmbeddingBatchConfigService.ts`](src/config/service/EmbeddingBatchConfigService.ts:45) 中作为 `providerBatchLimits.similarity` 使用

### 2. 使用场景分析

#### EMBEDDING_BATCH_SIZE 的使用：
- 作为所有嵌入器提供商的默认批处理大小
- 当特定提供商配置不可用时的回退值
- 在 [`EmbedderFactory.ts`](src/embedders/EmbedderFactory.ts:544) 中作为默认值返回

#### EMBEDDING_PROVIDER_SIMILARITY_BATCH_SIZE 的使用：
- 专门用于相似度计算场景
- 当相似度计算服务指定 `embedderProvider: 'similarity'` 时使用
- 在 [`EmbedderFactory.ts`](src/embedders/EmbedderFactory.ts:541-542) 中通过 switch 语句匹配

### 3. 并行使用机制

#### 相似度计算中的使用流程：
1. **策略选择**：在 [`SemanticSimilarityStrategy.ts`](src/service/similarity/strategies/SemanticSimilarityStrategy.ts:42) 中，通过 `options?.embedderProvider` 指定提供商
2. **批处理优化**：在 [`SemanticOptimizedBatchCalculator.ts`](src/service/similarity/batch/calculators/SemanticOptimizedBatchCalculator.ts:123) 中获取嵌入器
3. **批处理大小应用**：通过 [`EmbedderFactory.getEmbedderMaxBatchSize()`](src/embedders/EmbedderFactory.ts:517) 方法获取对应提供商的批处理限制

#### 实际并行使用场景：
- **常规嵌入操作**：使用 `EMBEDDING_BATCH_SIZE` 或其他提供商特定配置
- **相似度计算**：当明确指定 `embedderProvider: 'similarity'` 时，使用 `EMBEDDING_PROVIDER_SIMILARITY_BATCH_SIZE`

### 4. 关键发现

1. **配置隔离**：两个配置在系统中完全独立，互不影响
2. **显式选择**：相似度计算需要显式指定 `embedderProvider: 'similarity'` 才会使用专用配置
3. **性能优化**：相似度计算使用专门的 [`SemanticOptimizedBatchCalculator`](src/service/similarity/batch/calculators/SemanticOptimizedBatchCalculator.ts:16) 进行批处理优化
4. **默认行为**：如果不指定 `similarity` 提供商，相似度计算会使用其他提供商（如 'openai'、'siliconflow' 等）的配置

### 5. 当前配置状态

两个配置当前都设置为 64，这意味着：
- 常规嵌入操作和相似度计算的批处理大小相同
- 但它们在系统逻辑上是完全独立的配置项
- 可以根据实际需求独立调整这两个值

这种设计允许为相似度计算场景设置专门的批处理大小，以优化其特定的性能需求。