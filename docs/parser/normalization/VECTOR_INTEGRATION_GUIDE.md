# 向量处理集成指南

## 总体架构

### 数据流向

```
Parser Core (原始AST)
    ↓
Normalization (规范化为实体/关系)
    ↓
Post-Processing (代码转文本 + 嵌入生成)
    ↓
Vector Service (向量存储和索引)
    ↓
Qdrant/Database (持久化存储)
```

---

## 1. Normalization 模块（src/service/parser/core/normalization）

### 职责
- **类型定义**：EntityQueryResult、RelationshipQueryResult 等
- **代码转文本**：提供 ICodeToTextConverter 接口和 C/JSON/HTML 等语言实现

### 关键导出

```typescript
// 实体和关系类型
export { EntityQueryResult, RelationshipQueryResult, EntityType, RelationshipType };

// 代码转文本转换器
export { ICodeToTextConverter, CCodeToTextConverter };
```

### 使用示例

```typescript
import { ICodeToTextConverter, EntityQueryResult } from '@parser/core/normalization';
import { CCodeToTextConverter } from '@parser/core/normalization/converters';

const converter: ICodeToTextConverter = new CCodeToTextConverter();

const entity: EntityQueryResult = {
  id: 'func_main',
  name: 'main',
  entityType: 'FUNCTION',
  // ...
};

const textResult = converter.convertEntity(entity);
// textResult.text: "function main that does ..."
```

---

## 2. Post-Processing 模块（src/service/parser/post-processing）

### 新增：EmbeddingPipeline

应在 `post-processing` 层创建嵌入处理流程：

```
src/service/parser/post-processing/
├── embedding/
│   ├── EmbeddingPipeline.ts        # 统一嵌入处理流程
│   ├── IEmbeddingProcessor.ts      # 嵌入处理器接口
│   └── index.ts
└── coordinator/                    # 现有的处理协调器
    └── ProcessingCoordinator.ts
```

### EmbeddingPipeline 职责

1. **调用规范化结果**：获取 EntityQueryResult / RelationshipQueryResult
2. **代码转文本**：使用 ICodeToTextConverter 转换为自然语言
3. **生成向量**：调用 VectorEmbeddingService 生成嵌入
4. **元数据 Enrichment**：使用 VectorTypeConverter.enrichMetadataWithCodeToText() 和 enrichMetadataWithEmbedding()
5. **返回向量结果**：VectorPoint 或 Vector 对象

### 实现框架

```typescript
// src/service/parser/post-processing/embedding/EmbeddingPipeline.ts

import { injectable, inject } from 'inversify';
import { ICodeToTextConverter } from '../../core/normalization';
import { CodeToTextConfig, EmbeddingConfig, EmbeddingResult, VectorTypeConverter } from '@vector/types';
import { VectorEmbeddingService } from '@vector/embedding';

@injectable()
export class EmbeddingPipeline {
  constructor(
    @inject(TYPES.CodeToTextConverter) private codeToTextConverter: ICodeToTextConverter,
    @inject(TYPES.VectorEmbeddingService) private embeddingService: VectorEmbeddingService
  ) {}

  async processEntity(
    entity: EntityQueryResult,
    textConfig?: CodeToTextConfig,
    embeddingConfig?: EmbeddingConfig
  ): Promise<Vector> {
    // 1. 代码转文本
    const textResult = this.codeToTextConverter.convertEntity(entity, textConfig);
    
    // 2. 生成向量
    const embedding = await this.embeddingService.generateEmbedding(textResult.text);
    
    // 3. Enrichment 元数据
    const metadata = VectorTypeConverter.enrichMetadataWithCodeToText(
      entity.metadata || {},
      textResult
    );
    
    // 4. 返回向量
    return {
      id: entity.id,
      vector: embedding,
      content: textResult.text,
      metadata,
      timestamp: new Date()
    };
  }

  // 类似实现 processRelationship(), processBatch()
}
```

---

## 3. Vector Service 模块（src/service/vector）

### 更新的 VectorTypes

#### A. 新增代码转文本类型
```typescript
export interface CodeToTextConfig {
  namingConversion: { camelToNatural, snakeToNatural, pascalToNatural };
  textAssembly: { includeCodeType, includeDescription, includeSignature, includeContext };
  textCleaning: { removeSpecialChars, removeCommentSymbols, normalizeWhitespace };
}

export interface CodeToTextResult {
  text: string;
  originalCode: string;
  stats: { originalLength, convertedLength, conversionTime };
  metadata: { language, codeType, conversionRules };
}
```

#### B. 新增嵌入元数据
```typescript
export interface EmbeddingMetadata {
  model: { name, version, dimension };
  processing: { processingTime, textLength, tokenCount, wasTruncated };
  source: { sourceType, sourceId, filePath, language };
  quality: { confidence, similarity?, qualityLabel };
}
```

#### C. 增强 VectorMetadata

```typescript
export interface VectorMetadata {
  // 原有字段...
  
  // 新增：嵌入和转换信息
  embeddingInfo?: {
    model: string;
    version: string;
    dimension: number;
  };
  codeToTextInfo?: {
    originalLength: number;
    convertedLength: number;
    conversionRules: string[];
  };
}
```

#### D. 类型转换工具增强

```typescript
export class VectorTypeConverter {
  // 原有方法...
  
  // 新增：元数据 enrichment
  static enrichMetadataWithCodeToText(
    metadata: VectorMetadata,
    textResult: CodeToTextResult
  ): VectorMetadata;
  
  static enrichMetadataWithEmbedding(
    metadata: VectorMetadata,
    embeddingResult: EmbeddingResult
  ): VectorMetadata;
}
```

### VectorService 集成

```typescript
@injectable()
export class VectorService implements IVectorService {
  constructor(
    @inject(TYPES.VectorRepository) private repository: IVectorRepository,
    @inject(TYPES.VectorEmbeddingService) private embeddingService: VectorEmbeddingService,
    @inject(TYPES.EmbeddingPipeline) private embeddingPipeline: EmbeddingPipeline
  ) {}

  async createVectorsFromNormalizedResults(
    entities: EntityQueryResult[],
    relationships: RelationshipQueryResult[],
    options?: VectorOptions
  ): Promise<Vector[]> {
    // 批量处理规范化结果，生成向量
    const entityVectors = await this.embeddingPipeline.processBatch(entities);
    const relationshipVectors = await this.embeddingPipeline.processBatch(relationships);
    
    const allVectors = [...entityVectors, ...relationshipVectors];
    
    // 存储向量
    await this.repository.createBatch(allVectors);
    
    return allVectors;
  }
}
```

---

## 4. 向量嵌入服务（src/service/vector/embedding）

### VectorEmbeddingService 职责

- 调用各种嵌入模型提供商（OpenAI、Ollama、Gemini等）
- 缓存和去重机制
- 批量处理优化

### 导出接口

```typescript
export interface EmbeddingOptions {
  provider?: string;
  batchSize?: number;
  enableDeduplication?: boolean;
  enableCaching?: boolean;
  maxRetries?: number;
}

@injectable()
export class VectorEmbeddingService {
  async generateEmbedding(content: string, options?: EmbeddingOptions): Promise<number[]>;
  async generateBatchEmbeddings(contents: string[], options?: EmbeddingOptions): Promise<number[][]>;
  async calculateSimilarity(vector1: number[], vector2: number[]): number;
  getSupportedModels(): string[];
}
```

---

## 5. 向量转换服务（src/service/vector/conversion）

### VectorConversionService 更新

```typescript
@injectable()
export class VectorConversionService {
  // 原有方法...
  
  /**
   * 使用代码转文本结果进行元数据enrichment
   */
  enrichVectorWithCodeToText(vector: Vector, textResult: CodeToTextResult): Vector {
    return {
      ...vector,
      metadata: VectorTypeConverter.enrichMetadataWithCodeToText(
        vector.metadata,
        textResult
      )
    };
  }

  /**
   * 使用嵌入结果进行元数据enrichment
   */
  enrichVectorWithEmbedding(vector: Vector, embeddingResult: EmbeddingResult): Vector {
    return {
      ...vector,
      metadata: VectorTypeConverter.enrichMetadataWithEmbedding(
        vector.metadata,
        embeddingResult
      )
    };
  }
}
```

---

## 6. 依赖注入配置

在 IoC 容器中注册：

```typescript
// src/types.ts or container setup

container.bind<ICodeToTextConverter>(TYPES.CodeToTextConverter)
  .to(CCodeToTextConverter)
  .inSingletonScope();

container.bind<EmbeddingPipeline>(TYPES.EmbeddingPipeline)
  .to(EmbeddingPipeline)
  .inSingletonScope();

container.bind<VectorEmbeddingService>(TYPES.VectorEmbeddingService)
  .to(VectorEmbeddingService)
  .inSingletonScope();

container.bind<VectorService>(TYPES.VectorService)
  .to(VectorService)
  .inSingletonScope();
```

---

## 7. 完整示例流程

```typescript
// 某个处理器或 API 控制器

async processCodeFile(filePath: string) {
  // 1. 解析代码获取 AST
  const parseResult = await this.treeService.parseCode(code, 'c');
  
  // 2. 规范化：提取实体和关系
  const entities = await this.codeStructureService.extractEntities(
    parseResult.ast,
    'c',
    filePath
  );
  
  // 3. 后处理：代码转文本 + 向量嵌入
  const vectors = await this.embeddingPipeline.processBatch(entities);
  
  // 4. 存储：保存到向量数据库
  await this.vectorService.createVectors(vectors, { projectId: 'my-project' });
  
  // 5. 搜索示例
  const queryVector = await this.vectorService.searchByContent(
    'how to initialize a struct',
    { limit: 10, scoreThreshold: 0.7 }
  );
}
```

---

## 8. 关键设计要点

### ✅ 职责分离
- **normalization**：类型 + 转换器接口
- **post-processing**：流程协调 + 批量处理
- **vector**：存储 + 索引 + 搜索

### ✅ 元数据丰富
每个向量都包含：
- 源数据信息（文件、行号、语言）
- 代码转文本信息（转换规则、文本长度）
- 嵌入信息（模型、维度、质量指标）

### ✅ 可扩展性
- 语言适配器可在 normalization 中添加
- 嵌入模型提供商可在 VectorEmbeddingService 中扩展
- 后处理策略可在 post-processing 中定制

### ✅ 向后兼容
- 现有的 VectorService 接口不变
- 新的嵌入流程作为可选特性
- 可渐进式迁移

---

## 9. 后续优化方向

1. **缓存策略**：嵌入结果缓存，避免重复计算
2. **批量优化**：智能批次大小，减少 API 调用
3. **质量评估**：置信度分数，质量标签
4. **增量更新**：增量索引，部分更新支持
