现在我来设计向量嵌入需求的类型，重点关注代码转文本的标准化接口和向量嵌入的元数据结构，参考后处理.md的方案。

## 向量嵌入类型设计

### 核心设计原则

1. **基于后处理.md方案**：参考Qdrant的代码预处理流程
2. **代码转文本标准化**：提供统一的代码到自然语言转换接口
3. **嵌入模型适配**：支持不同嵌入模型的需求
4. **元数据丰富性**：保留代码的完整上下文信息

### 代码转文本标准化接口

基于 [`后处理.md`](docs/ref/后处理.md:1) 的方案，设计代码转文本的标准化接口：

```typescript
/**
 * 代码转文本配置接口
 */
interface CodeToTextConfig {
  /** 命名风格转换配置 */
  namingConversion: {
    /** 是否启用驼峰转自然语言 */
    camelToNatural: boolean;
    /** 是否启用蛇形转自然语言 */
    snakeToNatural: boolean;
    /** 是否启用帕斯卡转自然语言 */
    pascalToNatural: boolean;
  };
  
  /** 文本组装配置 */
  textAssembly: {
    /** 是否包含代码类型 */
    includeCodeType: boolean;
    /** 是否包含功能描述 */
    includeDescription: boolean;
    /** 是否包含签名信息 */
    includeSignature: boolean;
    /** 是否包含上下文信息 */
    includeContext: boolean;
  };
  
  /** 文本清洗配置 */
  textCleaning: {
    /** 是否移除特殊字符 */
    removeSpecialChars: boolean;
    /** 是否移除注释符号 */
    removeCommentSymbols: boolean;
    /** 是否标准化空白字符 */
    normalizeWhitespace: boolean;
  };
}

/**
 * 代码转文本结果接口
 */
interface CodeToTextResult {
  /** 转换后的自然语言文本 */
  text: string;
  /** 原始代码内容 */
  originalCode: string;
  /** 转换统计信息 */
  stats: {
    /** 原始字符数 */
    originalLength: number;
    /** 转换后字符数 */
    convertedLength: number;
    /** 转换时间（毫秒） */
    conversionTime: number;
  };
  /** 转换元数据 */
  metadata: {
    /** 代码语言 */
    language: string;
    /** 代码类型 */
    codeType: string;
    /** 使用的转换规则 */
    conversionRules: string[];
  };
}

/**
 * 代码转文本转换器接口
 */
interface CodeToTextConverter {
  /**
   * 将实体查询结果转换为自然语言文本
   */
  convertEntity(entity: EntityQueryResult, config?: CodeToTextConfig): CodeToTextResult;
  
  /**
   * 将关系查询结果转换为自然语言文本
   */
  convertRelationship(relationship: RelationshipQueryResult, config?: CodeToTextConfig): CodeToTextResult;
  
  /**
   * 批量转换
   */
  convertBatch(items: (EntityQueryResult | RelationshipQueryResult)[], config?: CodeToTextConfig): CodeToTextResult[];
  
  /**
   * 获取支持的转换规则
   */
  getSupportedRules(): string[];
}
```

### C语言专用转换器实现

```typescript
/**
 * C语言代码转文本转换器
 */
class CCodeToTextConverter implements CodeToTextConverter {
  private defaultConfig: CodeToTextConfig = {
    namingConversion: {
      camelToNatural: true,
      snakeToNatural: true,
      pascalToNatural: true
    },
    textAssembly: {
      includeCodeType: true,
      includeDescription: true,
      includeSignature: true,
      includeContext: true
    },
    textCleaning: {
      removeSpecialChars: true,
      removeCommentSymbols: true,
      normalizeWhitespace: true
    }
  };
  
  convertEntity(entity: EntityQueryResult, config: CodeToTextConfig = this.defaultConfig): CodeToTextResult {
    const startTime = Date.now();
    
    // 1. 命名风格转换
    const naturalName = this.convertNaming(entity.name, config.namingConversion);
    
    // 2. 提取功能描述
    const description = this.extractDescription(entity, config.textAssembly);
    
    // 3. 提取签名信息
    const signature = this.extractSignature(entity, config.textAssembly);
    
    // 4. 提取上下文信息
    const context = this.extractContext(entity, config.textAssembly);
    
    // 5. 组装文本
    let text = '';
    if (config.textAssembly.includeCodeType) {
      text += `${entity.entityType} `;
    }
    text += naturalName;
    if (config.textAssembly.includeDescription && description) {
      text += ` that does ${description} `;
    }
    if (config.textAssembly.includeSignature && signature) {
      text += `defined as ${signature} `;
    }
    if (config.textAssembly.includeContext && context) {
      text += context;
    }
    
    // 6. 文本清洗
    text = this.cleanText(text, config.textCleaning);
    
    const endTime = Date.now();
    
    return {
      text,
      originalCode: entity.content,
      stats: {
        originalLength: entity.content.length,
        convertedLength: text.length,
        conversionTime: endTime - startTime
      },
      metadata: {
        language: entity.language,
        codeType: entity.entityType,
        conversionRules: this.getUsedRules(entity, config)
      }
    };
  }
  
  convertRelationship(relationship: RelationshipQueryResult, config: CodeToTextConfig = this.defaultConfig): CodeToTextResult {
    const startTime = Date.now();
    
    // 关系转文本逻辑
    const sourceText = this.convertNaming(relationship.fromNodeId, config.namingConversion);
    const targetText = this.convertNaming(relationship.toNodeId, config.namingConversion);
    const relationshipText = this.convertNaming(relationship.type, config.namingConversion);
    
    let text = `${sourceText} ${relationshipText} ${targetText}`;
    
    // 添加关系特有信息
    if (relationship.properties.functionName) {
      text += ` via ${relationship.properties.functionName}`;
    }
    if (relationship.properties.condition) {
      text += ` when ${relationship.properties.condition}`;
    }
    
    text = this.cleanText(text, config.textCleaning);
    
    const endTime = Date.now();
    
    return {
      text,
      originalCode: relationship.properties.originalCode || '',
      stats: {
        originalLength: relationship.properties.originalCode?.length || 0,
        convertedLength: text.length,
        conversionTime: endTime - startTime
      },
      metadata: {
        language: relationship.language,
        codeType: 'relationship',
        conversionRules: this.getUsedRules(relationship, config)
      }
    };
  }
  
  convertBatch(items: (EntityQueryResult | RelationshipQueryResult)[], config: CodeToTextConfig = this.defaultConfig): CodeToTextResult[] {
    return items.map(item => {
      if ('entityType' in item) {
        return this.convertEntity(item, config);
      } else {
        return this.convertRelationship(item, config);
      }
    });
  }
  
  getSupportedRules(): string[] {
    return [
      'camel_to_natural',
      'snake_to_natural',
      'pascal_to_natural',
      'extract_function_signature',
      'extract_struct_fields',
      'extract_enum_constants',
      'clean_special_chars',
      'normalize_whitespace'
    ];
  }
  
  private convertNaming(name: string, config: CodeToTextConfig['namingConversion']): string {
    // 实现命名风格转换逻辑
    // 参考：inflection.humanize(inflection.underscore(chunk["name"]))
    let result = name;
    
    if (config.snakeToNatural && result.includes('_')) {
      result = result.replace(/_/g, ' ');
    }
    
    if (config.camelToNatural) {
      result = result.replace(/([A-Z])/g, ' $1').toLowerCase();
    }
    
    return result.trim();
  }
  
  private extractDescription(entity: EntityQueryResult, config: CodeToTextConfig['textAssembly']): string {
    // 从注释或文档字符串中提取描述
    if (entity.properties.docstring) {
      return entity.properties.docstring;
    }
    
    // 从注释中提取描述
    if (entity.properties.comment) {
      return this.cleanComment(entity.properties.comment);
    }
    
    return '';
  }
  
  private extractSignature(entity: EntityQueryResult, config: CodeToTextConfig['textAssembly']): string {
    switch (entity.entityType) {
      case EntityType.FUNCTION:
        return this.extractFunctionSignature(entity as FunctionEntity);
      case EntityType.STRUCT:
        return this.extractStructSignature(entity as TypeEntity);
      default:
        return entity.content;
    }
  }
  
  private extractFunctionSignature(func: FunctionEntity): string {
    let signature = '';
    if (func.returnType) {
      signature += func.returnType + ' ';
    }
    signature += func.name;
    if (func.parameters) {
      signature += '(' + func.parameters.map(p => p.type + ' ' + p.name).join(', ') + ')';
    }
    return signature;
  }
  
  private extractStructSignature(struct: TypeEntity): string {
    if (struct.fields) {
      return `struct with fields: ${struct.fields.map(f => f.type + ' ' + f.name).join(', ')}`;
    }
    return `struct ${struct.name}`;
  }
  
  private extractContext(entity: EntityQueryResult, config: CodeToTextConfig['textAssembly']): string {
    const context = [];
    if (entity.filePath) {
      context.push(`file ${entity.filePath.split('/').pop()}`);
    }
    if (entity.location) {
      context.push(`line ${entity.location.startLine}`);
    }
    return context.join(' ');
  }
  
  private cleanText(text: string, config: CodeToTextConfig['textCleaning']): string {
    let result = text;
    
    if (config.removeSpecialChars) {
      result = result.replace(/[^\w\s]/g, ' ');
    }
    
    if (config.normalizeWhitespace) {
      result = result.replace(/\s+/g, ' ').trim();
    }
    
    return result;
  }
  
  private cleanComment(comment: string): string {
    return comment.replace(/[/\*]+/g, '').trim();
  }
  
  private getUsedRules(item: EntityQueryResult | RelationshipQueryResult, config: CodeToTextConfig): string[] {
    const rules = [];
    
    if (config.namingConversion.camelToNatural) rules.push('camel_to_natural');
    if (config.namingConversion.snakeToNatural) rules.push('snake_to_natural');
    if (config.namingConversion.pascalToNatural) rules.push('pascal_to_natural');
    
    if ('entityType' in item) {
      switch (item.entityType) {
        case EntityType.FUNCTION:
          rules.push('extract_function_signature');
          break;
        case EntityType.STRUCT:
          rules.push('extract_struct_fields');
          break;
        case EntityType.ENUM:
          rules.push('extract_enum_constants');
          break;
      }
    }
    
    if (config.textCleaning.removeSpecialChars) rules.push('clean_special_chars');
    if (config.textCleaning.normalizeWhitespace) rules.push('normalize_whitespace');
    
    return rules;
  }
}
```

### 向量嵌入元数据结构

```typescript
/**
 * 向量嵌入配置接口
 */
interface EmbeddingConfig {
  /** 嵌入模型配置 */
  model: {
    /** 模型名称 */
    name: string;
    /** 模型版本 */
    version: string;
    /** 向量维度 */
    dimension: number;
    /** 最大序列长度 */
    maxSequenceLength: number;
  };
  
  /** 预处理配置 */
  preprocessing: {
    /** 是否启用分词 */
    enableTokenization: boolean;
    /** 是否启用截断 */
    enableTruncation: boolean;
    /** 是否启用填充 */
    enablePadding: boolean;
  };
  
  /** 后处理配置 */
  postprocessing: {
    /** 是否启用归一化 */
    enableNormalization: boolean;
    /** 归一化方法 */
    normalizationMethod: 'l2' | 'cosine' | 'none';
  };
}

/**
 * 向量嵌入结果接口
 */
interface EmbeddingResult {
  /** 嵌入向量 */
  vector: number[];
  /** 原始文本 */
  text: string;
  /** 嵌入元数据 */
  metadata: EmbeddingMetadata;
}

/**
 * 嵌入元数据接口
 */
interface EmbeddingMetadata {
  /** 嵌入模型信息 */
  model: {
    name: string;
    version: string;
    dimension: number;
  };
  
  /** 处理信息 */
  processing: {
    /** 处理时间（毫秒） */
    processingTime: number;
    /** 文本长度 */
    textLength: number;
    /** token数量 */
    tokenCount: number;
    /** 是否被截断 */
    wasTruncated: boolean;
  };
  
  /** 源数据信息 */
  source: {
    /** 源数据类型 */
    sourceType: 'entity' | 'relationship';
    /** 源数据ID */
    sourceId: string;
    /** 文件路径 */
    filePath: string;
    /** 语言类型 */
    language: string;
  };
  
  /** 质量指标 */
  quality: {
    /** 置信度分数 */
    confidence: number;
    /** 相似度分数（如果有参考） */
    similarity?: number;
    /** 质量标签 */
    qualityLabel: 'high' | 'medium' | 'low';
  };
}

/**
 * 向量嵌入器接口
 */
interface EmbeddingProcessor {
  /**
   * 生成文本的向量嵌入
   */
  embed(text: string, config?: EmbeddingConfig): Promise<EmbeddingResult>;
  
  /**
   * 批量生成向量嵌入
   */
  embedBatch(texts: string[], config?: EmbeddingConfig): Promise<EmbeddingResult[]>;
  
  /**
   * 计算两个向量的相似度
   */
  calculateSimilarity(vector1: number[], vector2: number[]): number;
  
  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[];
}
```

### 统一的嵌入处理流程

```typescript
/**
 * 统一的嵌入处理流程
 */
class EmbeddingPipeline {
  constructor(
    private codeToTextConverter: CodeToTextConverter,
    private embeddingProcessor: EmbeddingProcessor
  ) {}
  
  /**
   * 处理实体查询结果
   */
  async processEntity(
    entity: EntityQueryResult,
    textConfig?: CodeToTextConfig,
    embeddingConfig?: EmbeddingConfig
  ): Promise<EmbeddingResult> {
    // 1. 代码转文本
    const textResult = this.codeToTextConverter.convertEntity(entity, textConfig);
    
    // 2. 生成向量嵌入
    const embeddingResult = await this.embeddingProcessor.embed(
      textResult.text,
      embeddingConfig
    );
    
    // 3. 更新元数据
    embeddingResult.metadata.source = {
      sourceType: 'entity',
      sourceId: entity.id,
      filePath: entity.filePath,
      language: entity.language
    };
    
    return embeddingResult;
  }
  
  /**
   * 处理关系查询结果
   */
  async processRelationship(
    relationship: RelationshipQueryResult,
    textConfig?: CodeToTextConfig,
    embeddingConfig?: EmbeddingConfig
  ): Promise<EmbeddingResult> {
    // 1. 代码转文本
    const textResult = this.codeToTextConverter.convertRelationship(relationship, textConfig);
    
    // 2. 生成向量嵌入
    const embeddingResult = await this.embeddingProcessor.embed(
      textResult.text,
      embeddingConfig
    );
    
    // 3. 更新元数据
    embeddingResult.metadata.source = {
      sourceType: 'relationship',
      sourceId: relationship.id,
      filePath: relationship.location.filePath,
      language: relationship.language
    };
    
    return embeddingResult;
  }
  
  /**
   * 批量处理
   */
  async processBatch(
    items: (EntityQueryResult | RelationshipQueryResult)[],
    textConfig?: CodeToTextConfig,
    embeddingConfig?: EmbeddingConfig
  ): Promise<EmbeddingResult[]> {
    // 1. 批量代码转文本
    const textResults = this.codeToTextConverter.convertBatch(items, textConfig);
    
    // 2. 批量生成向量嵌入
    const texts = textResults.map(result => result.text);
    const embeddingResults = await this.embeddingProcessor.embedBatch(texts, embeddingConfig);
    
    // 3. 更新元数据
    embeddingResults.forEach((result, index) => {
      const item = items[index];
      result.metadata.source = {
        sourceType: 'entityType' in item ? 'entity' : 'relationship',
        sourceId: item.id,
        filePath: 'filePath' in item ? item.filePath : item.location.filePath,
        language: item.language
      };
    });
    
    return embeddingResults;
  }
}
```

### 设计优势

1. **基于成熟方案**：参考Qdrant的代码预处理方案，经过验证
2. **模块化设计**：代码转文本和向量嵌入分离，便于独立优化
3. **配置灵活**：支持多种转换和嵌入配置
4. **元数据丰富**：保留完整的处理过程和质量信息
5. **批量处理**：支持高效的批量处理流程