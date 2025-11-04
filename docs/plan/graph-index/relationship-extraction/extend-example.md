现在让我设计详细的扩展方案，包括接口扩展、实现策略和图数据库映射。

## 关系提取器扩展设计方案

### 1. 接口扩展设计

#### 1.1 扩展关系接口定义

```typescript
// 新增关系类型接口
export interface DataFlowRelationship {
  sourceId: string;
  targetId: string;
  flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access';
  dataType?: string;
  flowPath: string[]; // 数据流路径
  location: LocationInfo;
  resolvedSourceSymbol?: Symbol;
  resolvedTargetSymbol?: Symbol;
}

export interface ControlFlowRelationship {
  sourceId: string;
  targetId: string;
  flowType: 'conditional' | 'loop' | 'exception' | 'callback' | 'async_await';
  condition?: string; // 条件表达式
  isExceptional: boolean;
  location: LocationInfo;
  resolvedSymbol?: Symbol;
}

export interface SemanticRelationship {
  sourceId: string;
  targetId: string;
  semanticType: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  pattern?: string; // 设计模式名称
  metadata: Record<string, any>;
  location: LocationInfo;
  resolvedSourceSymbol?: Symbol;
  resolvedTargetSymbol?: Symbol;
}

export interface LifecycleRelationship {
  sourceId: string;
  targetId: string;
  lifecycleType: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  lifecyclePhase: 'creation' | 'setup' | 'teardown' | 'maintenance';
  location: LocationInfo;
  resolvedTargetSymbol?: Symbol;
}

export interface ConcurrencyRelationship {
  sourceId: string;
  targetId: string;
  concurrencyType: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'awaits';
  synchronizationMechanism?: string;
  location: LocationInfo;
  resolvedSymbol?: Symbol;
}
```

#### 1.2 扩展提取器接口

```typescript
export interface IEnhancedRelationshipExtractor extends ILanguageRelationshipExtractor {
  // 新增的关系提取方法
  extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]>;
  
  extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]>;
  
  extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<SemanticRelationship[]>;
  
  extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]>;
  
  extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]>;
  
  // 扩展支持的关系类型
  getSupportedRelationshipTypes(): string[];
}
```

### 2. 图数据库映射扩展

#### 2.1 扩展图关系类型枚举

```typescript
export enum GraphRelationshipType {
  // 现有关系类型
  CONTAINS = 'CONTAINS',
  IMPORTS = 'IMPORTS',
  CALLS = 'CALLS',
  INHERITS = 'INHERITS',
  IMPLEMENTS = 'IMPLEMENTS',
  USES = 'USES',
  DEFINES = 'DEFINES',
  
  // 新增关系类型
  // 数据流关系
  DATA_FLOWS_TO = 'DATA_FLOWS_TO',
  PARAMETER_PASSES_TO = 'PARAMETER_PASSES_TO',
  RETURNS_TO = 'RETURNS_TO',
  
  // 控制流关系
  CONTROLS = 'CONTROLS',
  HANDLES_EXCEPTION = 'HANDLES_EXCEPTION',
  CALLBACKS = 'CALLBACKS',
  AWAITS = 'AWAITS',
  
  // 语义关系
  OVERRIDES = 'OVERRIDES',
  OVERLOADS = 'OVERLOADS',
  DELEGATES_TO = 'DELEGATES_TO',
  OBSERVES = 'OBSERVES',
  CONFIGURES = 'CONFIGURES',
  
  // 生命周期关系
  INSTANTIATES = 'INSTANTIATES',
  INITIALIZES = 'INITIALIZES',
  DESTROYS = 'DESTROYS',
  MANAGES_LIFECYCLE = 'MANAGES_LIFECYCLE',
  
  // 并发关系
  SYNCHRONIZES_WITH = 'SYNCHRONIZES_WITH',
  LOCKS = 'LOCKS',
  COMMUNICATES_WITH = 'COMMUNICATES_WITH',
  RACES_WITH = 'RACES_WITH'
}
```

#### 2.2 关系映射策略

```typescript
export class RelationshipMappingStrategy {
  private readonly TYPE_MAPPING = {
    // 数据流关系映射
    'data_flow': GraphRelationshipType.DATA_FLOWS_TO,
    'parameter_flow': GraphRelationshipType.PARAMETER_PASSES_TO,
    'return_flow': GraphRelationshipType.RETURNS_TO,
    
    // 控制流关系映射
    'control_flow': GraphRelationshipType.CONTROLS,
    'exception_flow': GraphRelationshipType.HANDLES_EXCEPTION,
    'callback_flow': GraphRelationshipType.CALLBACKS,
    
    // 语义关系映射
    'overrides': GraphRelationshipType.OVERRIDES,
    'overloads': GraphRelationshipType.OVERLOADS,
    'delegates': GraphRelationshipType.DELEGATES_TO,
    'observes': GraphRelationshipType.OBSERVES,
    'configures': GraphRelationshipType.CONFIGURES,
    
    // 生命周期关系映射
    'instantiates': GraphRelationshipType.INSTANTIATES,
    'initializes': GraphRelationshipType.INITIALIZES,
    'destroys': GraphRelationshipType.DESTROYS,
    'manages': GraphRelationshipType.MANAGES_LIFECYCLE,
    
    // 并发关系映射
    'synchronizes': GraphRelationshipType.SYNCHRONIZES_WITH,
    'locks': GraphRelationshipType.LOCKS,
    'communicates': GraphRelationshipType.COMMUNICATES_WITH,
    'races': GraphRelationshipType.RACES_WITH
  };
  
  mapToGraphRelationship(relationship: any): GraphEdge {
    const graphType = this.TYPE_MAPPING[relationship.type] || GraphRelationshipType.USES;
    
    return {
      id: uuidv4(),
      type: graphType,
      sourceNodeId: relationship.sourceId,
      targetNodeId: relationship.targetId,
      properties: {
        ...relationship,
        extractedAt: new Date().toISOString(),
        confidence: this.calculateConfidence(relationship)
      }
    };
  }
}
```

### 3. 语言特定实现策略

#### 3.1 Python关系提取器扩展

```typescript
export class EnhancedPythonRelationshipExtractor extends PythonRelationshipExtractor 
  implements IEnhancedRelationshipExtractor {
  
  getSupportedRelationshipTypes(): string[] {
    return [
      ...super.getSupportedRelationshipTypes(),
      'data_flow', 'control_flow', 'semantic', 'lifecycle', 'concurrency'
    ];
  }
  
  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];
    
    // 提取变量赋值数据流
    const assignments = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].variableDeclaration
    );
    
    for (const assignment of assignments) {
      const dataFlowRelations = this.extractAssignmentDataFlow(
        assignment, filePath, symbolResolver
      );
      relationships.push(...dataFlowRelations);
    }
    
    // 提取函数参数传递数据流
    const functionCalls = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );
    
    for (const call of functionCalls) {
      const parameterFlows = this.extractParameterDataFlow(
        call, filePath, symbolResolver
      );
      relationships.push(...parameterFlows);
    }
    
    return relationships;
  }
  
  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];
    
    // 提取异常处理控制流
    const tryStatements = this.treeSitterService.findNodeByType(ast, 'try_statement');
    for (const tryStmt of tryStatements) {
      const exceptionFlows = this.extractExceptionControlFlow(
        tryStmt, filePath, symbolResolver
      );
      relationships.push(...exceptionFlows);
    }
    
    // 提取异步控制流
    const awaitExpressions = this.treeSitterService.findNodeByType(ast, 'await');
    for (const awaitExpr of awaitExpressions) {
      const asyncFlows = this.extractAsyncControlFlow(
        awaitExpr, filePath, symbolResolver
      );
      relationships.push(...asyncFlows);
    }
    
    return relationships;
  }
  
  // 其他实现方法...
}
```

#### 3.2 TypeScript关系提取器扩展

```typescript
export class EnhancedTypeScriptRelationshipExtractor extends TypeScriptRelationshipExtractor 
  implements IEnhancedRelationshipExtractor {
  
  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<SemanticRelationship[]> {
    const relationships: SemanticRelationship[] = [];
    
    // 提取方法重写关系
    const methodOverrides = this.extractMethodOverrides(ast, filePath, symbolResolver);
    relationships.push(...methodOverrides);
    
    // 提取装饰器观察者模式
    const decorators = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].decorator
    );
    
    for (const decorator of decorators) {
      const observerRelations = this.extractObserverPattern(
        decorator, filePath, symbolResolver
      );
      relationships.push(...observerRelations);
    }
    
    return relationships;
  }
  
  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    const relationships: LifecycleRelationship[] = [];
    
    // 提取类实例化关系
    const newExpressions = this.treeSitterService.findNodeByType(ast, 'new_expression');
    for (const newExpr of newExpressions) {
      const instantiationRelations = this.extractInstantiationRelations(
        newExpr, filePath, symbolResolver
      );
      relationships.push(...instantiationRelations);
    }
    
    return relationships;
  }
  
  // 其他实现方法...
}
```

### 4. 性能优化策略

#### 4.1 缓存策略
```typescript
export class RelationshipExtractionCache {
  private cache = new Map<string, any>();
  
  async getCachedRelationships(
    filePath: string,
    fileHash: string,
    relationshipType: string
  ): Promise<any[] | null> {
    const key = `${filePath}_${fileHash}_${relationshipType}`;
    return this.cache.get(key) || null;
  }
  
  async cacheRelationships(
    filePath: string,
    fileHash: string,
    relationshipType: string,
    relationships: any[]
  ): Promise<void> {
    const key = `${filePath}_${fileHash}_${relationshipType}`;
    this.cache.set(key, relationships);
  }
}
```

#### 4.2 批量处理策略
```typescript
export class BatchRelationshipProcessor {
  async processRelationshipsInBatches(
    extractors: IEnhancedRelationshipExtractor[],
    files: string[],
    batchSize: number = 10
  ): Promise<RelationshipExtractionResult[]> {
    const results: RelationshipExtractionResult[] = [];
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(file => this.processFile(file, extractors))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}
```