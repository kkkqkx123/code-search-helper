基于现有的VectorTypes.ts和Qdrant的payload过滤功能，我来设计向量索引相关的类型和接口定义，重点关注如何利用Qdrant的payload过滤查询结果。

## 向量索引类型设计（基于Qdrant Payload过滤）

### 核心设计原则

1. **Qdrant Payload兼容**：设计符合Qdrant payload数据类型的结构
2. **高效过滤**：利用payload过滤功能实现精确的代码搜索
3. **多维度索引**：支持按实体类型、关系类型、文件路径等多维度过滤
4. **类型安全**：确保payload字段类型与Qdrant支持的数据类型匹配

### Qdrant兼容的Payload数据类型

```typescript
/**
 * Qdrant Payload数据类型定义
 * 基于Qdrant官方文档支持的数据类型
 */

/**
 * 整数类型（64位整数）
 */
interface PayloadInteger {
  type: 'integer';
  value: number; // -9223372036854775808 到 9223372036854775807
}

/**
 * 浮点数类型（64位浮点数）
 */
interface PayloadFloat {
  type: 'float';
  value: number;
}

/**
 * 布尔值类型
 */
interface PayloadBool {
  type: 'bool';
  value: boolean;
}

/**
 * 关键字类型（字符串）
 */
interface PayloadKeyword {
  type: 'keyword';
  value: string;
}

/**
 * 数组类型（同类型多个值）
 */
interface PayloadArray<T> {
  type: 'array';
  itemType: 'integer' | 'float' | 'bool' | 'keyword';
  values: T[];
}

/**
 * 联合类型，表示所有支持的payload数据类型
 */
type PayloadValue = 
  | PayloadInteger
  | PayloadFloat
  | PayloadBool
  | PayloadKeyword
  | PayloadArray<number>
  | PayloadArray<boolean>
  | PayloadArray<string>;
```

### 代码搜索专用的Payload结构

```typescript
/**
 * 实体向量Payload结构
 */
interface EntityVectorPayload {
  /** 基础信息 */
  id: string;
  type: 'entity';
  content: string;
  
  /** 实体分类信息（用于过滤） */
  entityType: PayloadKeyword;           // 实体类型：function, struct, enum, etc.
  entitySubType: PayloadKeyword;         // 实体子类型：function_definition, function_prototype, etc.
  priority: PayloadInteger;              // 查询优先级
  
  /** 位置信息（用于范围过滤） */
  startLine: PayloadInteger;             // 起始行号
  endLine: PayloadInteger;               // 结束行号
  startColumn: PayloadInteger;           // 起始列号
  endColumn: PayloadInteger;             // 结束列号
  
  /** 文件信息（用于过滤） */
  filePath: PayloadKeyword;              // 文件路径
  fileName: PayloadKeyword;              // 文件名
  fileExtension: PayloadKeyword;         // 文件扩展名
  directory: PayloadKeyword;             // 目录路径
  
  /** 语言信息（用于过滤） */
  language: PayloadKeyword;              // 编程语言
  languageVersion: PayloadKeyword;       // 语言版本
  
  /** 复杂度信息（用于范围过滤） */
  complexity: PayloadFloat;              // 复杂度评分
  lineCount: PayloadInteger;             // 代码行数
  nestingLevel: PayloadInteger;          // 嵌套层级
  
  /** 函数特有信息 */
  functionName?: PayloadKeyword;         // 函数名
  returnType?: PayloadKeyword;           // 返回类型
  parameterCount: PayloadInteger;        // 参数数量
  parameterTypes: PayloadArray<string>;  // 参数类型列表
  
  /** 结构体特有信息 */
  structName?: PayloadKeyword;           // 结构体名
  fieldCount: PayloadInteger;            // 字段数量
  fieldTypes: PayloadArray<string>;      // 字段类型列表
  
  /** 枚举特有信息 */
  enumName?: PayloadKeyword;             // 枚举名
  constantCount: PayloadInteger;         // 常量数量
  
  /** 变量特有信息 */
  variableType?: PayloadKeyword;         // 变量类型
  isStatic: PayloadBool;                 // 是否为静态变量
  isExtern: PayloadBool;                 // 是否为外部变量
  isGlobal: PayloadBool;                 // 是否为全局变量
  
  /** 依赖信息 */
  dependencies: PayloadArray<string>;    // 依赖列表
  includeCount: PayloadInteger;          // 包含文件数量
  
  /** 注解信息 */
  hasAnnotation: PayloadBool;            // 是否有注解
  annotationTypes: PayloadArray<string>; // 注解类型列表
  
  /** 时间戳信息 */
  createdAt: PayloadInteger;             // 创建时间戳
  updatedAt: PayloadInteger;             // 更新时间戳
  
  /** 质量指标 */
  qualityScore: PayloadFloat;            // 质量评分
  confidence: PayloadFloat;              // 置信度
  
  /** 自定义标签 */
  tags: PayloadArray<string>;            // 自定义标签
  
  /** 项目信息 */
  projectId: PayloadKeyword;             // 项目ID
  moduleName: PayloadKeyword;            // 模块名
}

/**
 * 关系向量Payload结构
 */
interface RelationshipVectorPayload {
  /** 基础信息 */
  id: string;
  type: 'relationship';
  content: string;
  
  /** 关系分类信息（用于过滤） */
  relationshipType: PayloadKeyword;      // 关系类型：calls, data_flow, etc.
  relationshipCategory: PayloadKeyword;  // 关系类别：call, data_flow, etc.
  relationshipSubType: PayloadKeyword;   // 关系子类型：function_call, recursive_call, etc.
  
  /** 节点信息（用于过滤） */
  fromNodeId: PayloadKeyword;            // 源节点ID
  toNodeId: PayloadKeyword;              // 目标节点ID
  fromEntityType: PayloadKeyword;        // 源节点实体类型
  toEntityType: PayloadKeyword;          // 目标节点实体类型
  
  /** 位置信息（用于范围过滤） */
  startLine: PayloadInteger;             // 起始行号
  endLine: PayloadInteger;               // 结束行号
  startColumn: PayloadInteger;           // 起始列号
  endColumn: PayloadInteger;             // 结束列号
  
  /** 文件信息（用于过滤） */
  filePath: PayloadKeyword;              // 文件路径
  fileName: PayloadKeyword;              // 文件名
  directory: PayloadKeyword;             // 目录路径
  
  /** 语言信息（用于过滤） */
  language: PayloadKeyword;              // 编程语言
  
  /** 关系强度信息（用于范围过滤） */
  strength: PayloadFloat;                // 关系强度
  weight: PayloadFloat;                  // 关系权重
  confidence: PayloadFloat;              // 置信度
  
  /** 调用关系特有信息 */
  callDepth: PayloadInteger;             // 调用深度
  argumentCount: PayloadInteger;         // 参数数量
  isRecursive: PayloadBool;              // 是否为递归调用
  isChained: PayloadBool;                // 是否为链式调用
  
  /** 数据流关系特有信息 */
  dataType: PayloadKeyword;              // 数据类型
  flowDistance: PayloadInteger;          // 流距离
  isIndirect: PayloadBool;               // 是否为间接数据流
  
  /** 控制流关系特有信息 */
  controlFlowType: PayloadKeyword;       // 控制流类型
  conditionComplexity: PayloadFloat;     // 条件复杂度
  loopDepth: PayloadInteger;             // 循环深度
  
  /** 依赖关系特有信息 */
  dependencyType: PayloadKeyword;        // 依赖类型
  isSystemDependency: PayloadBool;       // 是否为系统依赖
  dependencyDistance: PayloadInteger;    // 依赖距离
  
  /** 继承关系特有信息 */
  inheritanceDepth: PayloadInteger;      // 继承深度
  isMultipleInheritance: PayloadBool;    // 是否为多重继承
  
  /** 时间戳信息 */
  createdAt: PayloadInteger;             // 创建时间戳
  updatedAt: PayloadInteger;             // 更新时间戳
  
  /** 项目信息 */
  projectId: PayloadKeyword;             // 项目ID
  moduleName: PayloadKeyword;            // 模块名
}

/**
 * 统一的向量Payload类型
 */
type CodeVectorPayload = EntityVectorPayload | RelationshipVectorPayload;
```

### Qdrant过滤器类型定义

```typescript
/**
 * Qdrant过滤器条件
 * 基于Qdrant官方文档的过滤器API
 */

/**
 * 基础过滤器接口
 */
interface BaseFilter {
  /** 过滤器键（payload字段名） */
  key: string;
}

/**
 * 值匹配过滤器
 */
interface ValueFilter extends BaseFilter {
  /** 匹配值 */
  value: any;
}

/**
 * 范围过滤器
 */
interface RangeFilter extends BaseFilter {
  /** 范围条件 */
  range: {
    gt?: number;    // 大于
    gte?: number;   // 大于等于
    lt?: number;    // 小于
    lte?: number;   // 小于等于
  };
}

/**
 * 包含过滤器（用于数组字段）
 */
interface InFilter extends BaseFilter {
  /** 包含的值列表 */
  values: any[];
}

/**
 * 文本匹配过滤器
 */
interface TextMatchFilter extends BaseFilter {
  /** 匹配文本 */
  text: string;
}

/**
 * 逻辑过滤器
 */
interface LogicalFilter {
  /** 逻辑操作符 */
  must?: FilterCondition[];      // AND条件
  should?: FilterCondition[];    // OR条件
  must_not?: FilterCondition[];  // NOT条件
}

/**
 * 过滤条件联合类型
 */
type FilterCondition = 
  | ValueFilter
  | RangeFilter
  | InFilter
  | TextMatchFilter
  | LogicalFilter;

/**
 * 代码搜索过滤器构建器
 */
class CodeSearchFilterBuilder {
  private conditions: FilterCondition[] = [];
  
  /**
   * 按实体类型过滤
   */
  byEntityType(entityType: string): this {
    this.conditions.push({
      key: 'entityType.value',
      value: entityType
    });
    return this;
  }
  
  /**
   * 按关系类型过滤
   */
  byRelationshipType(relationshipType: string): this {
    this.conditions.push({
      key: 'relationshipType.value',
      value: relationshipType
    });
    return this;
  }
  
  /**
   * 按文件路径过滤
   */
  byFilePath(filePath: string): this {
    this.conditions.push({
      key: 'filePath.value',
      value: filePath
    });
    return this;
  }
  
  /**
   * 按目录过滤
   */
  byDirectory(directory: string): this {
    this.conditions.push({
      key: 'directory.value',
      value: directory
    });
    return this;
  }
  
  /**
   * 按语言过滤
   */
  byLanguage(language: string): this {
    this.conditions.push({
      key: 'language.value',
      value: language
    });
    return this;
  }
  
  /**
   * 按行号范围过滤
   */
  byLineRange(startLine: number, endLine: number): this {
    this.conditions.push({
      key: 'startLine.value',
      range: {
        gte: startLine,
        lte: endLine
      }
    });
    return this;
  }
  
  /**
   * 按复杂度范围过滤
   */
  byComplexityRange(minComplexity: number, maxComplexity: number): this {
    this.conditions.push({
      key: 'complexity.value',
      range: {
        gte: minComplexity,
        lte: maxComplexity
      }
    });
    return this;
  }
  
  /**
   * 按函数名过滤
   */
  byFunctionName(functionName: string): this {
    this.conditions.push({
      key: 'functionName.value',
      value: functionName
    });
    return this;
  }
  
  /**
   * 按参数数量过滤
   */
  byParameterCount(count: number): this {
    this.conditions.push({
      key: 'parameterCount.value',
      value: count
    });
    return this;
  }
  
  /**
   * 按参数类型过滤
   */
  byParameterTypes(parameterTypes: string[]): this {
    this.conditions.push({
      key: 'parameterTypes.values',
      values: parameterTypes
    });
    return this;
  }
  
  /**
   * 按标签过滤
   */
  byTags(tags: string[]): this {
    this.conditions.push({
      key: 'tags.values',
      values: tags
    });
    return this;
  }
  
  /**
   * 按项目ID过滤
   */
  byProjectId(projectId: string): this {
    this.conditions.push({
      key: 'projectId.value',
      value: projectId
    });
    return this;
  }
  
  /**
   * 按模块过滤
   */
  byModule(moduleName: string): this {
    this.conditions.push({
      key: 'moduleName.value',
      value: moduleName
    });
    return this;
  }
  
  /**
   * 按是否为静态变量过滤
   */
  byIsStatic(isStatic: boolean): this {
    this.conditions.push({
      key: 'isStatic.value',
      value: isStatic
    });
    return this;
  }
  
  /**
   * 按是否为递归调用过滤
   */
  byIsRecursive(isRecursive: boolean): this {
    this.conditions.push({
      key: 'isRecursive.value',
      value: isRecursive
    });
    return this;
  }
  
  /**
   * 按关系强度过滤
   */
  byStrengthRange(minStrength: number, maxStrength: number): this {
    this.conditions.push({
      key: 'strength.value',
      range: {
        gte: minStrength,
        lte: maxStrength
      }
    });
    return this;
  }
  
  /**
   * 添加AND条件组
   */
  and(conditions: FilterCondition[]): this {
    this.conditions.push({
      must: conditions
    });
    return this;
  }
  
  /**
   * 添加OR条件组
   */
  or(conditions: FilterCondition[]): this {
    this.conditions.push({
      should: conditions
    });
    return this;
  }
  
  /**
   * 添加NOT条件组
   */
  not(conditions: FilterCondition[]): this {
    this.conditions.push({
      must_not: conditions
    });
    return this;
  }
  
  /**
   * 构建过滤器
   */
  build(): FilterCondition {
    if (this.conditions.length === 0) {
      throw new Error('No filter conditions specified');
    }
    
    if (this.conditions.length === 1) {
      return this.conditions[0];
    }
    
    return {
      must: this.conditions
    };
  }
  
  /**
   * 重置构建器
   */
  reset(): this {
    this.conditions = [];
    return this;
  }
}
```

### 向量索引操作接口

```typescript
/**
 * 向量索引操作接口
 */
interface VectorIndexOperations {
  /**
   * 创建实体向量点
   */
  createEntityVector(
    entity: EntityQueryResult, 
    embedding: number[]
  ): Promise<VectorPoint>;
  
  /**
   * 创建关系向量点
   */
  createRelationshipVector(
    relationship: RelationshipQueryResult, 
    embedding: number[]
  ): Promise<VectorPoint>;
  
  /**
   * 批量创建向量点
   */
  createVectors(vectors: VectorPoint[]): Promise<BatchResult>;
  
  /**
   * 搜索向量
   */
  searchVectors(
    queryVector: number[],
    filter?: FilterCondition,
    limit?: number,
    scoreThreshold?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 按实体类型搜索
   */
  searchByEntityType(
    queryVector: number[],
    entityType: string,
    limit?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 按关系类型搜索
   */
  searchByRelationshipType(
    queryVector: number[],
    relationshipType: string,
    limit?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 按文件路径搜索
   */
  searchByFilePath(
    queryVector: number[],
    filePath: string,
    limit?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 按复杂度范围搜索
   */
  searchByComplexityRange(
    queryVector: number[],
    minComplexity: number,
    maxComplexity: number,
    limit?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 按函数名搜索
   */
  searchByFunctionName(
    queryVector: number[],
    functionName: string,
    limit?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 复合条件搜索
   */
  searchWithComplexFilter(
    queryVector: number[],
    filterBuilder: CodeSearchFilterBuilder,
    limit?: number
  ): Promise<SearchResult[]>;
  
  /**
   * 删除向量点
   */
  deleteVector(vectorId: string): Promise<boolean>;
  
  /**
   * 批量删除向量点
   */
  deleteVectors(vectorIds: string[]): Promise<BatchResult>;
  
  /**
   * 更新向量点
   */
  updateVector(vectorId: string, updates: Partial<VectorPoint>): Promise<VectorPoint>;
  
  /**
   * 获取向量点
   */
  getVector(vectorId: string): Promise<VectorPoint | null>;
  
  /**
   * 获取向量统计信息
   */
  getVectorStats(): Promise<VectorStats>;
}
```

### Payload转换工具

```typescript
/**
 * Payload转换工具
 */
class PayloadConverter {
  /**
   * 将实体查询结果转换为EntityVectorPayload
   */
  static entityToPayload(entity: EntityQueryResult, embedding: number[]): EntityVectorPayload {
    const basePayload = {
      id: entity.id,
      type: 'entity' as const,
      content: entity.content,
      
      // 基础信息
      entityType: { type: 'keyword' as const, value: entity.entityType },
      entitySubType: { type: 'keyword' as const, value: this.getEntitySubType(entity) },
      priority: { type: 'integer' as const, value: entity.priority },
      
      // 位置信息
      startLine: { type: 'integer' as const, value: entity.location.startLine },
      endLine: { type: 'integer' as const, value: entity.location.endLine },
      startColumn: { type: 'integer' as const, value: entity.location.startColumn },
      endColumn: { type: 'integer' as const, value: entity.location.endColumn },
      
      // 文件信息
      filePath: { type: 'keyword' as const, value: entity.filePath },
      fileName: { type: 'keyword' as const, value: entity.filePath.split('/').pop() || '' },
      fileExtension: { type: 'keyword' as const, value: entity.filePath.split('.').pop() || '' },
      directory: { type: 'keyword' as const, value: entity.filePath.substring(0, entity.filePath.lastIndexOf('/')) },
      
      // 语言信息
      language: { type: 'keyword' as const, value: entity.language },
      languageVersion: { type: 'keyword' as const, value: '1.0' }, // 默认版本
      
      // 复杂度信息
      complexity: { type: 'float' as const, value: this.calculateComplexity(entity) },
      lineCount: { type: 'integer' as const, value: entity.location.endLine - entity.location.startLine + 1 },
      nestingLevel: { type: 'integer' as const, value: entity.properties.nestingLevel || 0 },
      
      // 依赖信息
      dependencies: { type: 'array' as const, itemType: 'keyword' as const, values: entity.properties.dependencies || [] },
      includeCount: { type: 'integer' as const, value: entity.properties.includeCount || 0 },
      
      // 注解信息
      hasAnnotation: { type: 'bool' as const, value: !!(entity.properties.annotation || entity.properties.comment) },
      annotationTypes: { type: 'array' as const, itemType: 'keyword' as const, values: this.getAnnotationTypes(entity) },
      
      // 时间戳信息
      createdAt: { type: 'integer' as const, value: Date.now() },
      updatedAt: { type: 'integer' as const, value: Date.now() },
      
      // 质量指标
      qualityScore: { type: 'float' as const, value: this.calculateQualityScore(entity) },
      confidence: { type: 'float' as const, value: 0.8 }, // 默认置信度
      
      // 自定义标签
      tags: { type: 'array' as const, itemType: 'keyword' as const, values: entity.properties.tags || [] },
      
      // 项目信息
      projectId: { type: 'keyword' as const, value: entity.properties.projectId || 'default' },
      moduleName: { type: 'keyword' as const, value: entity.properties.moduleName || 'default' }
    };
    
    // 添加实体特有信息
    return this.addEntitySpecificFields(basePayload, entity);
  }
  
  /**
   * 将关系查询结果转换为RelationshipVectorPayload
   */
  static relationshipToPayload(relationship: RelationshipQueryResult, embedding: number[]): RelationshipVectorPayload {
    return {
      id: relationship.id,
      type: 'relationship',
      content: relationship.properties.description || `${relationship.fromNodeId} -> ${relationship.toNodeId}`,
      
      // 关系分类信息
      relationshipType: { type: 'keyword' as const, value: relationship.type },
      relationshipCategory: { type: 'keyword' as const, value: relationship.category },
      relationshipSubType: { type: 'keyword' as const, value: this.getRelationshipSubType(relationship) },
      
      // 节点信息
      fromNodeId: { type: 'keyword' as const, value: relationship.fromNodeId },
      toNodeId: { type: 'keyword' as const, value: relationship.toNodeId },
      fromEntityType: { type: 'keyword' as const, value: relationship.properties.fromEntityType || 'unknown' },
      toEntityType: { type: 'keyword' as const, value: relationship.properties.toEntityType || 'unknown' },
      
      // 位置信息
      startLine: { type: 'integer' as const, value: relationship.location.startLine },
      endLine: { type: 'integer' as const, value: relationship.location.endLine },
      startColumn: { type: 'integer' as const, value: relationship.location.startColumn },
      endColumn: { type: 'integer' as const, value: relationship.location.endColumn },
      
      // 文件信息
      filePath: { type: 'keyword' as const, value: relationship.location.filePath },
      fileName: { type: 'keyword' as const, value: relationship.location.filePath.split('/').pop() || '' },
      directory: { type: 'keyword' as const, value: relationship.location.filePath.substring(0, relationship.location.filePath.lastIndexOf('/')) },
      
      // 语言信息
      language: { type: 'keyword' as const, value: relationship.language },
      
      // 关系强度信息
      strength: { type: 'float' as const, value: relationship.strength || 0.5 },
      weight: { type: 'float' as const, value: relationship.weight || 1.0 },
      confidence: { type: 'float' as const, value: 0.8 }, // 默认置信度
      
      // 调用关系特有信息
      callDepth: { type: 'integer' as const, value: relationship.properties.callDepth || 1 },
      argumentCount: { type: 'integer' as const, value: relationship.properties.argumentCount || 0 },
      isRecursive: { type: 'bool' as const, value: relationship.properties.isRecursive || false },
      isChained: { type: 'bool' as const, value: relationship.properties.isChained || false },
      
      // 数据流关系特有信息
      dataType: { type: 'keyword' as const, value: relationship.properties.dataType || 'unknown' },
      flowDistance: { type: 'integer' as const, value: relationship.properties.flowDistance || 1 },
      isIndirect: { type: 'bool' as const, value: relationship.properties.isIndirect || false },
      
      // 控制流关系特有信息
      controlFlowType: { type: 'keyword' as const, value: relationship.properties.controlFlowType || 'unknown' },
      conditionComplexity: { type: 'float' as const, value: relationship.properties.conditionComplexity || 0.0 },
      loopDepth: { type: 'integer' as const, value: relationship.properties.loopDepth || 1 },
      
      // 依赖关系特有信息
      dependencyType: { type: 'keyword' as const, value: relationship.properties.dependencyType || 'unknown' },
      isSystemDependency: { type: 'bool' as const, value: relationship.properties.isSystemDependency || false },
      dependencyDistance: { type: 'integer' as const, value: relationship.properties.dependencyDistance || 1 },
      
      // 继承关系特有信息
      inheritanceDepth: { type: 'integer' as const, value: relationship.properties.inheritanceDepth || 1 },
      isMultipleInheritance: { type: 'bool' as const, value: relationship.properties.isMultipleInheritance || false },
      
      // 时间戳信息
      createdAt: { type: 'integer' as const, value: Date.now() },
      updatedAt: { type: 'integer' as const, value: Date.now() },
      
      // 项目信息
      projectId: { type: 'keyword' as const, value: relationship.properties.projectId || 'default' },
      moduleName: { type: 'keyword' as const, value: relationship.properties.moduleName || 'default' }
    };
  }
  
  private static getEntitySubType(entity: EntityQueryResult): string {
    // 根据实体类型和属性确定子类型
    switch (entity.entityType) {
      case EntityType.FUNCTION:
        if (entity.properties.isPrototype) return 'function_prototype';
        if (entity.properties.isPointer) return 'function_pointer';
        return 'function_definition';
      case EntityType.STRUCT:
        return 'struct_definition';
      case EntityType.VARIABLE:
        if (entity.properties.isArray) return 'array_variable';
        if (entity.properties.isPointer) return 'pointer_variable';
        return 'simple_variable';
      default:
        return `${entity.entityType}_default`;
    }
  }
  
  private static getRelationshipSubType(relationship: RelationshipQueryResult): string {
    // 根据关系类型和属性确定子类型
    return `${relationship.category}_${relationship.type}`;
  }
  
  private static calculateComplexity(entity: EntityQueryResult): number {
    // 简单的复杂度计算逻辑
    let complexity = 1.0;
    
    // 根据实体类型调整复杂度
    switch (entity.entityType) {
      case EntityType.FUNCTION:
        complexity += (entity.properties.parameterCount || 0) * 0.1;
        complexity += (entity.properties.nestingLevel || 0) * 0.2;
        break;
      case EntityType.STRUCT:
        complexity += (entity.properties.fieldCount || 0) * 0.1;
        break;
      case EntityType.ENUM:
        complexity += (entity.properties.constantCount || 0) * 0.05;
        break;
    }
    
    return complexity;
  }
  
  private static calculateQualityScore(entity: EntityQueryResult): number {
    // 简单的质量评分逻辑
    let score = 0.5; // 基础分数
    
    // 有注释加分
    if (entity.properties.comment || entity.properties.docstring) {
      score += 0.2;
    }
    
    // 命名规范加分
    if (this.isGoodNaming(entity.name)) {
      score += 0.1;
    }
    
    // 有类型注解加分
    if (entity.properties.hasTypeAnnotation) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }
  
  private static isGoodNaming(name: string): boolean {
    // 简单的命名规范检查
    return /^[a-z][a-zA-Z0-9_]*$/.test(name) || /^[A-Z][A-Z0-9_]*$/.test(name);
  }
  
  private static getAnnotationTypes(entity: EntityQueryResult): string[] {
    const types: string[] = [];
    
    if (entity.properties.annotation) types.push('annotation');
    if (entity.properties.comment) types.push('comment');
    if (entity.properties.directive) types.push('directive');
    
    return types;
  }
  
  private static addEntitySpecificFields(basePayload: any, entity: EntityQueryResult): EntityVectorPayload {
    // 根据实体类型添加特有字段
    switch (entity.entityType) {
      case EntityType.FUNCTION:
        return {
          ...basePayload,
          functionName: { type: 'keyword' as const, value: entity.name },
          returnType: { type: 'keyword' as const, value: entity.properties.returnType || 'void' },
          parameterCount: { type: 'integer' as const, value: entity.properties.parameterCount || 0 },
          parameterTypes: { 
            type: 'array' as const, 
            itemType: 'keyword' as const, 
            values: entity.properties.parameterTypes || [] 
          }
        } as EntityVectorPayload;
        
      case EntityType.STRUCT:
        return {
          ...basePayload,
          structName: { type: 'keyword' as const, value: entity.name },
          fieldCount: { type: 'integer' as const, value: entity.properties.fieldCount || 0 },
          fieldTypes: { 
            type: 'array' as const, 
            itemType: 'keyword' as const, 
            values: entity.properties.fieldTypes || [] 
          }
        } as EntityVectorPayload;
        
      case EntityType.VARIABLE:
        return {
          ...basePayload,
          variableType: { type: 'keyword' as const, value: entity.properties.variableType || 'unknown' },
          isStatic: { type: 'bool' as const, value: entity.properties.isStatic || false },
          isExtern: { type: 'bool' as const, value: entity.properties.isExtern || false },
          isGlobal: { type: 'bool' as const, value: entity.properties.isGlobal || false }
        } as EntityVectorPayload;
        
      default:
        return basePayload as EntityVectorPayload;
    }
  }
}
```

### 设计优势

1. **Qdrant兼容性**：完全符合Qdrant的payload数据类型要求
2. **高效过滤**：利用payload过滤功能实现精确的多维度代码搜索
3. **类型安全**：确保所有payload字段类型与Qdrant支持的数据类型匹配
4. **灵活构建**：提供过滤器构建器，支持复杂的复合条件查询
5. **性能优化**：通过合理的payload结构设计，提高过滤和搜索性能