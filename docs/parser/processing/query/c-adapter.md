现在我来分析具体的C语言适配器实现细节，基于现有的查询模式和标准化类型设计。

## C语言适配器实现细节分析

### 1. C语言适配器核心架构

```typescript
/**
 * C语言适配器
 * 负责将Tree-sitter查询结果转换为标准化的实体和关系
 */
export class CLanguageAdapter implements ILanguageAdapter {
  private readonly language = 'c';
  private entityMappers: Map<string, EntityMapper>;
  private relationshipMappers: Map<string, RelationshipMapper>;
  
  constructor() {
    this.initializeMappers();
  }
  
  /**
   * 标准化查询结果
   */
  async normalize(
    queryResults: any[], 
    queryType: string, 
    language: string
  ): Promise<StandardizedQueryResult[]> {
    if (language !== this.language) {
      throw new Error(`CLanguageAdapter does not support language: ${language}`);
    }
    
    // 根据查询类型分发到不同的处理器
    if (this.isEntityQuery(queryType)) {
      return this.normalizeEntities(queryResults, queryType);
    } else if (this.isRelationshipQuery(queryType)) {
      return this.normalizeRelationships(queryResults, queryType);
    }
    
    return [];
  }
}
```

### 2. 实体映射器设计

#### 2.1 基础实体映射器接口

```typescript
interface EntityMapper {
  /**
   * 将查询结果映射为标准化实体
   */
  map(queryResult: any, context: MappingContext): EntityQueryResult;
  
  /**
   * 支持的查询类型
   */
  getSupportedQueryTypes(): string[];
  
  /**
   * 提取实体名称
   */
  extractName(queryResult: any): string;
  
  /**
   * 提取实体内容
   */
  extractContent(queryResult: any, sourceCode: string): string;
  
  /**
   * 计算复杂度
   */
  calculateComplexity(queryResult: any): number;
}
```

#### 2.2 函数实体映射器

```typescript
class FunctionEntityMapper implements EntityMapper {
  getSupportedQueryTypes(): string[] {
    return ['entity.function', 'entity.function.prototype', 'entity.function.pointer'];
  }
  
  map(queryResult: any, context: MappingContext): FunctionEntity {
    const node = this.getMainNode(queryResult);
    const captures = queryResult.captures || {};
    
    // 提取基础信息
    const name = this.extractFunctionName(captures);
    const location = this.extractLocation(node);
    const content = this.extractContent(node, context.sourceCode);
    
    // 提取函数特有信息
    const returnType = this.extractReturnType(captures);
    const parameters = this.extractParameters(captures);
    const isPrototype = this.isPrototype(queryResult);
    const isPointer = this.isPointer(queryResult);
    
    // 生成统一ID
    const id = NodeIdGenerator.generateEntityId({
      id: '',
      entityType: EntityType.FUNCTION,
      name,
      location,
      content,
      filePath: context.filePath,
      language: context.language,
      priority: 3,
      properties: {}
    });
    
    return {
      id,
      entityType: EntityType.FUNCTION,
      name,
      priority: 3,
      location,
      content,
      filePath: context.filePath,
      language: context.language,
      properties: {
        returnType,
        parameters,
        isPrototype,
        isPointer,
        parameterCount: parameters.length,
        parameterTypes: parameters.map(p => p.type),
        complexity: this.calculateComplexity(queryResult),
        // 从查询结果中提取的额外信息
        functionBody: captures['function.body']?.text,
        signature: this.buildSignature(name, returnType, parameters)
      }
    };
  }
  
  private extractFunctionName(captures: any): string {
    return captures['function.name']?.text || captures['recursive.function.name']?.text || '';
  }
  
  private extractReturnType(captures: any): string {
    return captures['return.type']?.text || 'void';
  }
  
  private extractParameters(captures: any): ParameterInfo[] {
    const parameterList = captures['function.parameters'];
    if (!parameterList) return [];
    
    const parameters: ParameterInfo[] = [];
    // 解析参数列表，提取每个参数的类型和名称
    // 这里需要根据实际的AST结构进行解析
    return parameters;
  }
  
  private isPrototype(queryResult: any): boolean {
    return queryResult.queryType === 'entity.function.prototype';
  }
  
  private isPointer(queryResult: any): boolean {
    return queryResult.queryType === 'entity.function.pointer';
  }
  
  private calculateComplexity(queryResult: any): number {
    let complexity = 1.0;
    
    // 基于参数数量
    const parameterCount = this.extractParameters(queryResult.captures).length;
    complexity += parameterCount * 0.1;
    
    // 基于函数体大小
    const functionBody = queryResult.captures['function.body'];
    if (functionBody) {
      const bodyLines = functionBody.endPosition.row - functionBody.startPosition.row + 1;
      complexity += bodyLines * 0.05;
    }
    
    return complexity;
  }
  
  private buildSignature(name: string, returnType: string, parameters: ParameterInfo[]): string {
    const paramList = parameters.map(p => `${p.type} ${p.name}`).join(', ');
    return `${returnType} ${name}(${paramList})`;
  }
}
```

#### 2.3 结构体实体映射器

```typescript
class StructEntityMapper implements EntityMapper {
  getSupportedQueryTypes(): string[] {
    return ['entity.struct'];
  }
  
  map(queryResult: any, context: MappingContext): TypeEntity {
    const node = this.getMainNode(queryResult);
    const captures = queryResult.captures || {};
    
    // 提取基础信息
    const name = captures['type.name']?.text || '';
    const location = this.extractLocation(node);
    const content = this.extractContent(node, context.sourceCode);
    
    // 提取结构体特有信息
    const fields = this.extractFields(captures);
    const fieldCount = fields.length;
    const fieldTypes = fields.map(f => f.type);
    
    // 生成统一ID
    const id = NodeIdGenerator.generateEntityId({
      id: '',
      entityType: EntityType.STRUCT,
      name,
      location,
      content,
      filePath: context.filePath,
      language: context.language,
      priority: 4,
      properties: {}
    });
    
    return {
      id,
      entityType: EntityType.STRUCT,
      name,
      priority: 4,
      location,
      content,
      filePath: context.filePath,
      language: context.language,
      properties: {
        fields,
        fieldCount,
        fieldTypes,
        complexity: this.calculateComplexity(queryResult),
        // 结构体特有属性
        isOpaque: this.isOpaqueStruct(queryResult),
        hasNestedStructs: this.hasNestedStructs(fields)
      }
    };
  }
  
  private extractFields(captures: any): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const fieldNames = captures['field.name'] || [];
    const fieldTypes = captures['field.type'] || [];
    
    for (let i = 0; i < fieldNames.length; i++) {
      fields.push({
        name: fieldNames[i]?.text || '',
        type: fieldTypes[i]?.text || '',
        location: {
          startLine: fieldNames[i]?.startPosition?.row || 0,
          endLine: fieldNames[i]?.endPosition?.row || 0
        }
      });
    }
    
    return fields;
  }
  
  private calculateComplexity(queryResult: any): number {
    const fields = this.extractFields(queryResult.captures);
    let complexity = 1.0;
    
    // 基于字段数量
    complexity += fields.length * 0.1;
    
    // 基于嵌套结构
    const nestedStructs = fields.filter(f => 
      f.type.includes('struct') || f.type.includes('union')
    ).length;
    complexity += nestedStructs * 0.2;
    
    return complexity;
  }
  
  private isOpaqueStruct(queryResult: any): boolean {
    // 检查是否为不透明结构体（只有前向声明）
    const node = this.getMainNode(queryResult);
    return !node.childForFieldName('body');
  }
  
  private hasNestedStructs(fields: FieldInfo[]): boolean {
    return fields.some(f => 
      f.type.includes('struct') || f.type.includes('union')
    );
  }
}
```

### 3. 关系映射器设计

#### 3.1 基础关系映射器接口

```typescript
interface RelationshipMapper {
  /**
   * 将查询结果映射为标准化关系
   */
  map(queryResult: any, context: MappingContext): RelationshipQueryResult;
  
  /**
   * 支持的查询类型
   */
  getSupportedQueryTypes(): string[];
  
  /**
   * 提取源节点ID
   */
  extractSourceNodeId(queryResult: any, context: MappingContext): string;
  
  /**
   * 提取目标节点ID
   */
  extractTargetNodeId(queryResult: any, context: MappingContext): string;
  
  /**
   * 计算关系强度
   */
  calculateStrength(queryResult: any): number;
}
```

#### 3.2 函数调用关系映射器

```typescript
class CallRelationshipMapper implements RelationshipMapper {
  getSupportedQueryTypes(): string[] {
    return [
      'relationship.call',
      'relationship.call.pointer',
      'relationship.call.method',
      'relationship.call.recursive',
      'relationship.call.chained',
      'relationship.call.conditional',
      'relationship.call.callback',
      'relationship.call.macro'
    ];
  }
  
  map(queryResult: any, context: MappingContext): CallRelationship {
    const node = this.getMainNode(queryResult);
    const captures = queryResult.captures || {};
    
    // 提取基础信息
    const location = this.extractLocation(node);
    const relationshipType = this.mapQueryTypeToRelationshipType(queryResult.queryType);
    
    // 提取调用特有信息
    const functionName = this.extractFunctionName(captures);
    const arguments = this.extractArguments(captures);
    const isChained = this.isChainedCall(queryResult);
    const isRecursive = this.isRecursiveCall(queryResult);
    
    // 生成源节点和目标节点ID
    const fromNodeId = this.extractSourceNodeId(queryResult, context);
    const toNodeId = this.extractTargetNodeId(queryResult, context);
    
    // 生成统一ID
    const id = NodeIdGenerator.generateRelationshipId(
      fromNodeId,
      toNodeId,
      relationshipType,
      location.startLine
    );
    
    return {
      id,
      type: relationshipType,
      category: RelationshipCategory.CALL,
      fromNodeId,
      toNodeId,
      directed: true,
      strength: this.calculateStrength(queryResult),
      location,
      language: context.language,
      properties: {
        functionName,
        arguments,
        isChained,
        isRecursive,
        callDepth: this.calculateCallDepth(queryResult),
        // 调用特有属性
        objectName: captures['call.object']?.text,
        methodName: captures['call.method']?.text,
        isMacro: this.isMacroCall(queryResult),
        isConditional: this.isConditionalCall(queryResult)
      }
    };
  }
  
  private mapQueryTypeToRelationshipType(queryType: string): CallRelationshipType {
    const mapping: Record<string, CallRelationshipType> = {
      'relationship.call': CallRelationshipType.FUNCTION,
      'relationship.call.pointer': CallRelationshipType.FUNCTION_POINTER,
      'relationship.call.method': CallRelationshipType.METHOD,
      'relationship.call.recursive': CallRelationshipType.RECURSIVE,
      'relationship.call.chained': CallRelationshipType.CHAINED,
      'relationship.call.conditional': CallRelationshipType.CONDITIONAL,
      'relationship.call.callback': CallRelationshipType.CALLBACK,
      'relationship.call.macro': CallRelationshipType.MACRO
    };
    
    return mapping[queryType] || CallRelationshipType.FUNCTION;
  }
  
  private extractFunctionName(captures: any): string {
    return captures['call.function.name']?.text || 
           captures['call.function.pointer']?.text || 
           captures['chained.call.function']?.text || '';
  }
  
  private extractArguments(captures: any): string[] {
    const argumentNodes = captures['call.argument'] || [];
    return argumentNodes.map((arg: any) => arg.text || '');
  }
  
  private extractSourceNodeId(queryResult: any, context: MappingContext): string {
    // 源节点通常是调用者，需要从上下文中获取当前函数/作用域
    // 这里简化处理，实际需要根据上下文确定
    return `caller_${context.currentFunction || 'global'}`;
  }
  
  private extractTargetNodeId(queryResult: any, context: MappingContext): string {
    const functionName = this.extractFunctionName(queryResult.captures);
    return NodeIdGenerator.generateEntityId({
      id: '',
      entityType: EntityType.FUNCTION,
      name: functionName,
      location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
      content: '',
      filePath: context.filePath,
      language: context.language,
      priority: 3,
      properties: {}
    });
  }
  
  private calculateStrength(queryResult: any): number {
    let strength = 0.5; // 基础强度
    
    // 根据调用类型调整强度
    if (this.isRecursiveCall(queryResult)) {
      strength += 0.3; // 递归调用强度更高
    }
    
    if (this.isMacroCall(queryResult)) {
      strength -= 0.2; // 宏调用强度较低
    }
    
    if (this.isConditionalCall(queryResult)) {
      strength -= 0.1; // 条件调用强度较低
    }
    
    return Math.min(Math.max(strength, 0.1), 1.0);
  }
  
  private isChainedCall(queryResult: any): boolean {
    return queryResult.queryType === 'relationship.call.chained';
  }
  
  private isRecursiveCall(queryResult: any): boolean {
    return queryResult.queryType === 'relationship.call.recursive';
  }
  
  private isMacroCall(queryResult: any): boolean {
    return queryResult.queryType === 'relationship.call.macro';
  }
  
  private isConditionalCall(queryResult: any): boolean {
    return queryResult.queryType === 'relationship.call.conditional';
  }
  
  private calculateCallDepth(queryResult: any): number {
    // 计算调用链深度
    const captures = queryResult.captures;
    let depth = 1;
    
    // 检查是否有嵌套调用
    if (captures['chained.call.function']) {
      depth += 1;
    }
    
    return depth;
  }
}
```

#### 3.3 数据流关系映射器

```typescript
class DataFlowRelationshipMapper implements RelationshipMapper {
  getSupportedQueryTypes(): string[] {
    return [
      'data.flow.assignment',
      'data.flow.compound.assignment',
      'data.flow.parameter.passing',
      'data.flow.return.value',
      'data.flow.pointer.operation',
      'data.flow.type.conversion',
      'data.flow.conditional.operation',
      'data.flow.memory.operation',
      'data.flow.chained.access',
      'data.flow.macro.assignment',
      'data.flow.sizeof.operation'
    ];
  }
  
  map(queryResult: any, context: MappingContext): DataFlowRelationship {
    const node = this.getMainNode(queryResult);
    const captures = queryResult.captures || {};
    
    // 提取基础信息
    const location = this.extractLocation(node);
    const relationshipType = this.mapQueryTypeToRelationshipType(queryResult.queryType);
    
    // 提取数据流特有信息
    const sourceVariable = this.extractSourceVariable(captures);
    const targetVariable = this.extractTargetVariable(captures);
    const dataType = this.extractDataType(captures);
    const operator = this.extractOperator(captures);
    
    // 生成源节点和目标节点ID
    const fromNodeId = this.extractSourceNodeId(queryResult, context);
    const toNodeId = this.extractTargetNodeId(queryResult, context);
    
    // 生成统一ID
    const id = NodeIdGenerator.generateRelationshipId(
      fromNodeId,
      toNodeId,
      relationshipType,
      location.startLine
    );
    
    return {
      id,
      type: relationshipType,
      category: RelationshipCategory.DATA_FLOW,
      fromNodeId,
      toNodeId,
      directed: true,
      strength: this.calculateStrength(queryResult),
      location,
      language: context.language,
      properties: {
        sourceVariable,
        targetVariable,
        dataType,
        operator,
        flowPath: this.calculateFlowPath(queryResult, context),
        // 数据流特有属性
        isIndirect: this.isIndirectFlow(queryResult),
        flowDistance: this.calculateFlowDistance(queryResult),
        isCompound: this.isCompoundAssignment(queryResult)
      }
    };
  }
  
  private mapQueryTypeToRelationshipType(queryType: string): DataFlowRelationshipType {
    const mapping: Record<string, DataFlowRelationshipType> = {
      'data.flow.assignment': DataFlowRelationshipType.ASSIGNMENT,
      'data.flow.compound.assignment': DataFlowRelationshipType.COMPOUND_ASSIGNMENT,
      'data.flow.parameter.passing': DataFlowRelationshipType.PARAMETER_PASSING,
      'data.flow.return.value': DataFlowRelationshipType.RETURN_VALUE,
      'data.flow.pointer.operation': DataFlowRelationshipType.POINTER_OPERATION,
      'data.flow.type.conversion': DataFlowRelationshipType.TYPE_CONVERSION,
      'data.flow.conditional.operation': DataFlowRelationshipType.CONDITIONAL_OPERATION,
      'data.flow.memory.operation': DataFlowRelationshipType.MEMORY_OPERATION,
      'data.flow.chained.access': DataFlowRelationshipType.FIELD_ACCESS,
      'data.flow.macro.assignment': DataFlowRelationshipType.ASSIGNMENT,
      'data.flow.sizeof.operation': DataFlowRelationshipType.SIZEOF_OPERATION
    };
    
    return mapping[queryType] || DataFlowRelationshipType.ASSIGNMENT;
  }
  
  private extractSourceVariable(captures: any): string {
    return captures['source.variable']?.text || 
           captures['source.function']?.text || 
           captures['binary.left']?.text || '';
  }
  
  private extractTargetVariable(captures: any): string {
    return captures['target.variable']?.text || 
           captures['target.function']?.text || 
           captures['binary.right']?.text || '';
  }
  
  private extractDataType(captures: any): string {
    // 从类型信息中提取数据类型
    return captures['target.type']?.text || 'unknown';
  }
  
  private extractOperator(captures: any): string {
    return captures['compound.operator']?.text || '=';
  }
  
  private calculateFlowPath(queryResult: any, context: MappingContext): string[] {
    // 计算数据流路径
    const path: string[] = [];
    const captures = queryResult.captures;
    
    if (captures['source.variable']) {
      path.push(captures['source.variable'].text);
    }
    
    if (captures['target.variable']) {
      path.push(captures['target.variable'].text);
    }
    
    return path;
  }
  
  private isIndirectFlow(queryResult: any): boolean {
    // 检查是否为间接数据流（通过指针、引用等）
    const captures = queryResult.captures;
    return !!(captures['target.pointer'] || captures['source.pointer']);
  }
  
  private calculateFlowDistance(queryResult: any): number {
    // 计算数据流距离
    return 1; // 简化处理
  }
  
  private isCompoundAssignment(queryResult: any): boolean {
    return queryResult.queryType === 'data.flow.compound.assignment';
  }
  
  private calculateStrength(queryResult: any): number {
    let strength = 0.5;
    
    // 根据数据流类型调整强度
    if (this.isIndirectFlow(queryResult)) {
      strength += 0.2; // 间接数据流强度更高
    }
    
    if (this.isCompoundAssignment(queryResult)) {
      strength += 0.1; // 复合赋值强度稍高
    }
    
    return Math.min(Math.max(strength, 0.1), 1.0);
  }
}
```

### 4. 映射上下文管理

```typescript
interface MappingContext {
  /** 源代码 */
  sourceCode: string;
  
  /** 文件路径 */
  filePath: string;
  
  /** 语言 */
  language: string;
  
  /** 当前函数/作用域 */
  currentFunction?: string;
  
  /** 当前作用域层级 */
  scopeStack: string[];
  
  /** 符号表 */
  symbolTable: Map<string, SymbolInfo>;
  
  /** 配置选项 */
  options: MappingOptions;
}

interface MappingOptions {
  /** 是否包含调试信息 */
  includeDebugInfo: boolean;
  
  /** 是否计算复杂度 */
  calculateComplexity: boolean;
  
  /** 是否提取注释 */
  extractComments: boolean;
  
  /** 自定义映射规则 */
  customRules: CustomMappingRule[];
}
```

### 5. 适配器初始化和注册

```typescript
class CLanguageAdapter implements ILanguageAdapter {
  constructor() {
    this.initializeMappers();
  }
  
  private initializeMappers(): void {
    // 初始化实体映射器
    this.entityMappers.set('entity.preprocessor', new PreprocessorEntityMapper());
    this.entityMappers.set('entity.type', new TypeEntityMapper());
    this.entityMappers.set('entity.function', new FunctionEntityMapper());
    this.entityMappers.set('entity.variable', new VariableEntityMapper());
    this.entityMappers.set('comment.entity', new CommentEntityMapper());
    this.entityMappers.set('annotation.attribute', new AnnotationEntityMapper());
    
    // 初始化关系映射器
    this.relationshipMappers.set('relationship.call', new CallRelationshipMapper());
    this.relationshipMappers.set('data.flow', new DataFlowRelationshipMapper());
    this.relationshipMappers.set('control.flow', new ControlFlowRelationshipMapper());
    this.relationshipMappers.set('dependency', new DependencyRelationshipMapper());
    this.relationshipMappers.set('inheritance', new InheritanceRelationshipMapper());
    this.relationshipMappers.set('lifecycle', new LifecycleRelationshipMapper());
  }
  
  /**
   * 标准化实体查询结果
   */
  private async normalizeEntities(
    queryResults: any[], 
    queryType: string
  ): Promise<EntityQueryResult[]> {
    const mapper = this.entityMappers.get(queryType);
    if (!mapper) {
      throw new Error(`No entity mapper found for query type: ${queryType}`);
    }
    
    const entities: EntityQueryResult[] = [];
    const context = this.createMappingContext();
    
    for (const result of queryResults) {
      try {
        const entity = mapper.map(result, context);
        entities.push(entity);
      } catch (error) {
        console.warn(`Failed to map entity result:`, error);
        // 继续处理其他结果
      }
    }
    
    return entities;
  }
  
  /**
   * 标准化关系查询结果
   */
  private async normalizeRelationships(
    queryResults: any[], 
    queryType: string
  ): Promise<RelationshipQueryResult[]> {
    const mapper = this.relationshipMappers.get(queryType);
    if (!mapper) {
      throw new Error(`No relationship mapper found for query type: ${queryType}`);
    }
    
    const relationships: RelationshipQueryResult[] = [];
    const context = this.createMappingContext();
    
    for (const result of queryResults) {
      try {
        const relationship = mapper.map(result, context);
        relationships.push(relationship);
      } catch (error) {
        console.warn(`Failed to map relationship result:`, error);
        // 继续处理其他结果
      }
    }
    
    return relationships;
  }
  
  private createMappingContext(): MappingContext {
    return {
      sourceCode: '',
      filePath: '',
      language: this.language,
      scopeStack: [],
      symbolTable: new Map(),
      options: {
        includeDebugInfo: false,
        calculateComplexity: true,
        extractComments: true,
        customRules: []
      }
    };
  }
}
```

### 6. 性能优化策略

#### 6.1 缓存机制

```typescript
class CachedCLanguageAdapter extends CLanguageAdapter {
  private entityCache = new Map<string, EntityQueryResult>();
  private relationshipCache = new Map<string, RelationshipQueryResult>();
  
  async normalize(
    queryResults: any[], 
    queryType: string, 
    language: string
  ): Promise<StandardizedQueryResult[]> {
    const cacheKey = this.generateCacheKey(queryResults, queryType);
    
    // 检查缓存
    if (this.entityCache.has(cacheKey)) {
      return [this.entityCache.get(cacheKey)!];
    }
    
    // 执行标准化
    const results = await super.normalize(queryResults, queryType, language);
    
    // 缓存结果
    if (results.length > 0) {
      this.entityCache.set(cacheKey, results[0] as EntityQueryResult);
    }
    
    return results;
  }
  
  private generateCacheKey(queryResults: any[], queryType: string): string {
    // 生成基于查询结果的缓存键
    const hash = this.hashQueryResults(queryResults);
    return `${queryType}_${hash}`;
  }
}
```

#### 6.2 批量处理优化

```typescript
class BatchOptimizedCLanguageAdapter extends CLanguageAdapter {
  async normalizeBatch(
    batchItems: Array<{
      queryResults: any[];
      queryType: string;
      language: string;
    }>
  ): Promise<StandardizedQueryResult[][]> {
    // 按查询类型分组
    const groupedItems = this.groupByQueryType(batchItems);
    
    // 并行处理每个组
    const results = await Promise.all(
      groupedItems.map(group => this.processGroup(group))
    );
    
    return results;
  }
  
  private groupByQueryType(batchItems: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const item of batchItems) {
      const queryType = item.queryType;
      if (!groups.has(queryType)) {
        groups.set(queryType, []);
      }
      groups.get(queryType)!.push(item);
    }
    
    return groups;
  }
  
  private async processGroup(group: any[]): Promise<StandardizedQueryResult[]> {
    // 批量处理同一类型的查询结果
    const queryType = group[0].queryType;
    const allQueryResults = group.flatMap(item => item.queryResults);
    
    return this.normalize(allQueryResults, queryType, 'c');
  }
}
```

### 7. 错误处理和回退机制

```typescript
class RobustCLanguageAdapter extends CLanguageAdapter {
  async normalize(
    queryResults: any[], 
    queryType: string, 
    language: string
  ): Promise<StandardizedQueryResult[]> {
    try {
      return await super.normalize(queryResults, queryType, language);
    } catch (error) {
      console.warn(`Normalization failed for ${queryType}, falling back to raw results:`, error);
      
      // 回退到原始查询结果
      return this.fallbackToRawResults(queryResults, queryType);
    }
  }
  
  private fallbackToRawResults(queryResults: any[], queryType: string): StandardizedQueryResult[] {
    return queryResults.map(result => ({
      id: this.generateFallbackId(result),
      type: 'raw',
      name: this.extractFallbackName(result),
      priority: 0,
      startLine: 0,
      endLine: 0,
      content: this.extractFallbackContent(result),
      filePath: '',
      language: 'c',
      metadata: {
        originalQueryType: queryType,
        originalResult: result,
        fallbackReason: 'normalization_failed'
      }
    }));
  }
  
  private generateFallbackId(result: any): string {
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private extractFallbackName(result: any): string {
    return result.captures?.name?.[0]?.text || 'unknown';
  }
  
  private extractFallbackContent(result: any): string {
    return result.node?.text || '';
  }
}
```

这种C语言适配器实现提供了：

1. **完整的类型映射**: 支持所有C语言实体和关系类型
2. **高性能处理**: 通过缓存和批量处理优化性能
3. **错误恢复**: 提供回退机制确保系统稳定性
4. **可扩展性**: 模块化设计便于添加新的映射器
5. **类型安全**: 完整的TypeScript类型定义