// 注意：此接口已废弃，关系提取现在通过标准化模块和关系元数据处理器处理

// 扩展的调用关系
export interface CallRelationship {
  callerId: string;
  calleeId: string;
  callName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  callType: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
  // 新增：调用上下文信息
  callContext?: {
    isChained: boolean; // 是否为链式调用的一部分
    chainDepth?: number; // 链式调用的深度
    isAsync: boolean; // 是否为异步调用
  };
  // 新增：解析后的符号信息
  resolvedSymbol?: Symbol;
}

// 扩展的继承关系
export interface InheritanceRelationship {
  parentId: string;
  childId: string;
  inheritanceType: 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct';
  location: {
    filePath: string;
    lineNumber: number;
  };
  // 新增：解析后的符号信息
  resolvedParentSymbol?: Symbol;
  resolvedChildSymbol?: Symbol;
}

// 扩展的依赖关系
export interface DependencyRelationship {
  sourceId: string;
  targetId: string;
  dependencyType: 'import' | 'export' | 'type_dependency' | 'namespace' | 'include';
  target: string;
  location: {
    filePath: string;
    lineNumber: number;
  };
  // 新增：导入的具体符号
  importedSymbols?: string[];
  // 新增：解析后的符号信息
  resolvedTargetSymbol?: Symbol;
}

// 新增：引用关系
export interface ReferenceRelationship {
  sourceId: string;
  targetId: string;
  referenceType: 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'class' | 'interface' | 'enum' | 'namespace';
  referenceName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  // 新增：解析后的符号信息
  resolvedSymbol?: Symbol;
}

// 新增：创建关系
export interface CreationRelationship {
  sourceId: string;
  targetId: string;
  creationType: 'instantiation' | 'factory' | 'dependency_injection';
  targetName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  // 新增：解析后的符号信息
  resolvedTargetSymbol?: Symbol;
}

// 新增：注解/装饰关系
export interface AnnotationRelationship {
  sourceId: string;
  targetId: string;
  annotationType: 'decorator' | 'annotation' | 'attribute' | 'type_annotation';
  annotationName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  // 新增：注解参数
  parameters?: Record<string, any>;
  // 新增：解析后的符号信息
  resolvedAnnotationSymbol?: Symbol;
}

// 新增：数据流关系
export interface DataFlowRelationship {
  sourceId: string;
  targetId: string;
  flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access';
  dataType?: string;
  flowPath: string[]; // 数据流路径
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

// 新增：控制流关系
export interface ControlFlowRelationship {
  sourceId: string;
  targetId: string;
  flowType: 'conditional' | 'loop' | 'exception' | 'callback' | 'async_await';
  condition?: string; // 条件表达式
  isExceptional: boolean;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  resolvedSymbol?: Symbol;
}

// 新增：语义关系
export interface SemanticRelationship {
  sourceId: string;
  targetId: string;
  semanticType: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  pattern?: string; // 设计模式名称
  metadata: Record<string, any>;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  resolvedSourceSymbol?: Symbol;
  resolvedTargetSymbol?: Symbol;
}

// 新增：生命周期关系
export interface LifecycleRelationship {
  sourceId: string;
  targetId: string;
  lifecycleType: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  lifecyclePhase: 'creation' | 'setup' | 'teardown' | 'maintenance';
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  resolvedTargetSymbol?: Symbol;
}

// 新增：并发关系
export interface ConcurrencyRelationship {
  sourceId: string;
  targetId: string;
  concurrencyType: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'awaits';
  synchronizationMechanism?: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  resolvedSymbol?: Symbol;
}

// 扩展的关系提取结果
export interface RelationshipExtractionResult {
  callRelationships: CallRelationship[];
  inheritanceRelationships: InheritanceRelationship[];
  dependencyRelationships: DependencyRelationship[];
  // 新增的关系类型
  referenceRelationships: ReferenceRelationship[];
  creationRelationships: CreationRelationship[];
  annotationRelationships: AnnotationRelationship[];
  // 扩展的关系类型
  dataFlowRelationships: DataFlowRelationship[];
  controlFlowRelationships: ControlFlowRelationship[];
  semanticRelationships: SemanticRelationship[];
  lifecycleRelationships: LifecycleRelationship[];
  concurrencyRelationships: ConcurrencyRelationship[];
}

// 扩展的关系提取器接口
/**
 * @deprecated 此接口已废弃，关系提取现在通过标准化模块和关系元数据处理器处理
 */
export interface ILanguageRelationshipExtractor {
  extractCallRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<CallRelationship[]>;
  
  extractInheritanceRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<InheritanceRelationship[]>;
  
  extractDependencyRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<DependencyRelationship[]>;
  
  // 新增的关系提取方法
  extractReferenceRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<ReferenceRelationship[]>;
  
  extractCreationRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<CreationRelationship[]>;
  
  extractAnnotationRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<AnnotationRelationship[]>;
  
  // 扩展的关系提取方法
  extractDataFlowRelationships(
    ast: any,
    filePath: string
  ): Promise<DataFlowRelationship[]>;
  
  extractControlFlowRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<ControlFlowRelationship[]>;
  
  extractSemanticRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<SemanticRelationship[]>;
  
  extractLifecycleRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<LifecycleRelationship[]>;
  
  extractConcurrencyRelationships(
    ast: any,
    filePath: string,
    symbolResolver: any
  ): Promise<ConcurrencyRelationship[]>;
  
  getSupportedLanguage(): string;
  
  // 新增：支持的关系类型
  getSupportedRelationshipTypes(): string[];
}