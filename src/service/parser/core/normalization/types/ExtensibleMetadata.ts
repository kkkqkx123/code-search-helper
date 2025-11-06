/**
 * 可扩展元数据系统
 * 提供灵活的元数据管理和构建功能
 */

import { RelationshipCategory, RelationshipType } from './RelationshipTypes';

/**
 * 可扩展的元数据接口
 */
export interface ExtensibleMetadata {
  [key: string]: any;
  
  // 核心元数据字段
  language: string;
  complexity: number;
  dependencies: string[];
  modifiers: string[];
  
  // 可选的扩展字段
  relationships?: RelationshipMetadata[];
  symbols?: SymbolMetadata[];
  performance?: PerformanceMetadata;
  annotations?: AnnotationMetadata[];
  calls?: CallMetadata[];
  creations?: CreationMetadata[];
  dataFlows?: DataFlowMetadata[];
  controlFlows?: ControlFlowMetadata[];
  lifecycles?: LifecycleMetadata[];
  concurrencies?: ConcurrencyMetadata[];
  dependencyMetadata?: DependencyMetadata[];
  inheritances?: InheritanceMetadata[];
  references?: ReferenceMetadata[];
}

/**
 * 关系元数据接口
 */
export interface RelationshipMetadata {
  /** 关系类型 */
  type: RelationshipType;
  /** 关系类别 */
  category: RelationshipCategory;
  /** 源节点ID */
  fromNodeId: string;
  /** 目标节点ID */
  toNodeId: string;
  /** 关系强度 */
  strength?: number;
  /** 关系权重 */
  weight?: number;
  /** 额外属性 */
  [key: string]: any;
}

/**
 * 符号元数据接口
 */
export interface SymbolMetadata {
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  symbolType: string;
  /** 作用域 */
  scope: string;
  /** 文件路径 */
  filePath: string;
  /** 位置信息 */
  location: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  /** 是否导出 */
  isExported?: boolean;
  /** 参数列表（函数/方法） */
  parameters?: string[];
  /** 返回类型 */
  returnType?: string;
  /** 额外属性 */
  [key: string]: any;
}

/**
 * 性能元数据接口
 */
export interface PerformanceMetadata {
  /** 处理时间（毫秒） */
  processingTime: number;
  /** 内存使用（字节） */
  memoryUsage: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 处理的节点数量 */
  nodeCount: number;
  /** 处理阶段 */
  phase: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 注解元数据接口
 */
export interface AnnotationMetadata {
  /** 注解类型 */
  annotationType: 'struct_tag' | 'comment' | 'directive';
  /** 注解种类 */
  annotationKind: 'struct_tag' | 'json_tag' | 'xml_tag' | 'sql_tag' | 'validation' | 'doc' | 'directive';
  /** 目标 */
  target: string;
  /** 注解值 */
  annotationValue: string;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 调用元数据接口
 */
export interface CallMetadata {
  /** 调用名称 */
  callName: string;
  /** 调用类型 */
  callType: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'builtin' | 'goroutine';
  /** 调用上下文 */
  callContext: {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
    isGoroutine: boolean;
  };
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 创建元数据接口
 */
export interface CreationMetadata {
  /** 创建类型 */
  creationType: 'composite_literal' | 'make_call' | 'new_call' | 'function_literal' | 'goroutine';
  /** 创建种类 */
  creationKind: 'struct_instance' | 'slice' | 'map' | 'channel' | 'function' | 'goroutine_instance';
  /** 目标 */
  target: string;
  /** 创建详情 */
  creationDetails: any;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 数据流元数据接口
 */
export interface DataFlowMetadata {
  /** 数据流类型 */
  flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' | 'channel_operation';
  /** 数据类型 */
  dataType?: string;
  /** 数据流路径 */
  flowPath: string[];
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 控制流元数据接口
 */
export interface ControlFlowMetadata {
  /** 控制流类型 */
  controlFlowType: 'conditional' | 'loop' | 'exception' | 'callback' | 'select' | 'switch' | 'jump';
  /** 控制流目标 */
  controlFlowTargets?: string[];
  /** 条件表达式 */
  condition?: string;
  /** 循环变量 */
  loopVariable?: string;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 生命周期元数据接口
 */
export interface LifecycleMetadata {
  /** 生命周期类型 */
  lifecycleType: 'instantiates' | 'initializes' | 'destroys' | 'manages' | 'allocates' | 'releases';
  /** 资源类型 */
  resourceType?: string;
  /** 清理机制 */
  cleanupMechanism?: string;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 并发元数据接口
 */
export interface ConcurrencyMetadata {
  /** 并发类型 */
  concurrencyType: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'waits' | 'coordinates';
  /** 同步机制 */
  synchronizationMechanism?: string;
  /** 共享资源 */
  sharedResources?: string[];
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 依赖元数据接口
 */
export interface DependencyMetadata {
  /** 依赖类型 */
  dependencyType: 'import' | 'package' | 'qualified_identifier';
  /** 依赖路径 */
  dependencyPath?: string;
  /** 是否为标准库 */
  isStandardLibrary?: boolean;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 继承元数据接口
 */
export interface InheritanceMetadata {
  /** 继承类型 */
  inheritanceType: 'extends' | 'implements' | 'interface_inheritance' | 'struct_embedding';
  /** 父类型 */
  parentType?: string;
  /** 继承深度 */
  inheritanceDepth?: number;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 引用元数据接口
 */
export interface ReferenceMetadata {
  /** 引用类型 */
  referenceType: 'read' | 'write' | 'declaration' | 'usage';
  /** 引用上下文 */
  referenceContext?: string;
  /** 是否为定义 */
  isDefinition?: boolean;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 元数据构建器类
 */
export class MetadataBuilder {
  protected metadata: ExtensibleMetadata;

  constructor() {
    this.metadata = {
      language: '',
      complexity: 1,
      dependencies: [],
      modifiers: []
    };
  }

  /**
   * 设置语言
   */
  setLanguage(language: string): this {
    this.metadata.language = language;
    return this;
  }

  /**
   * 设置复杂度
   */
  setComplexity(complexity: number): this {
    this.metadata.complexity = complexity;
    return this;
  }

  /**
   * 添加依赖项
   */
  addDependency(dependency: string): this {
    if (!this.metadata.dependencies) {
      this.metadata.dependencies = [];
    }
    this.metadata.dependencies.push(dependency);
    return this;
  }

  /**
   * 添加修饰符
   */
  addModifier(modifier: string): this {
    if (!this.metadata.modifiers) {
      this.metadata.modifiers = [];
    }
    this.metadata.modifiers.push(modifier);
    return this;
  }

  /**
   * 添加关系元数据
   */
  addRelationship(relationship: RelationshipMetadata): this {
    if (!this.metadata.relationships) {
      this.metadata.relationships = [];
    }
    this.metadata.relationships.push(relationship);
    return this;
  }

  /**
   * 添加符号元数据
   */
  addSymbol(symbol: SymbolMetadata): this {
    if (!this.metadata.symbols) {
      this.metadata.symbols = [];
    }
    this.metadata.symbols.push(symbol);
    return this;
  }

  /**
   * 添加性能元数据
   */
  setPerformance(performance: PerformanceMetadata): this {
    this.metadata.performance = performance;
    return this;
  }

  /**
   * 添加注解元数据
   */
  addAnnotation(annotation: AnnotationMetadata): this {
    if (!this.metadata.annotations) {
      this.metadata.annotations = [];
    }
    this.metadata.annotations.push(annotation);
    return this;
  }

  /**
   * 添加调用元数据
   */
  addCall(call: CallMetadata): this {
    if (!this.metadata.calls) {
      this.metadata.calls = [];
    }
    this.metadata.calls.push(call);
    return this;
  }

  /**
   * 添加创建元数据
   */
  addCreation(creation: CreationMetadata): this {
    if (!this.metadata.creations) {
      this.metadata.creations = [];
    }
    this.metadata.creations.push(creation);
    return this;
  }

  /**
   * 添加数据流元数据
   */
  addDataFlow(dataFlow: DataFlowMetadata): this {
    if (!this.metadata.dataFlows) {
      this.metadata.dataFlows = [];
    }
    this.metadata.dataFlows.push(dataFlow);
    return this;
  }

  /**
   * 添加控制流元数据
   */
  addControlFlow(controlFlow: ControlFlowMetadata): this {
    if (!this.metadata.controlFlows) {
      this.metadata.controlFlows = [];
    }
    this.metadata.controlFlows.push(controlFlow);
    return this;
  }

  /**
   * 添加生命周期元数据
   */
  addLifecycle(lifecycle: LifecycleMetadata): this {
    if (!this.metadata.lifecycles) {
      this.metadata.lifecycles = [];
    }
    this.metadata.lifecycles.push(lifecycle);
    return this;
  }

  /**
   * 添加并发元数据
   */
  addConcurrency(concurrency: ConcurrencyMetadata): this {
    if (!this.metadata.concurrencies) {
      this.metadata.concurrencies = [];
    }
    this.metadata.concurrencies.push(concurrency);
    return this;
  }

  /**
   * 添加依赖元数据
   */
  addDependencyMetadata(dependency: DependencyMetadata): this {
    if (!this.metadata.dependencies) {
      this.metadata.dependencies = [];
    }
    this.metadata.dependencies.push(dependency.dependencyPath || '');
    return this;
  }

  /**
   * 添加继承元数据
   */
  addInheritance(inheritance: InheritanceMetadata): this {
    if (!this.metadata.inheritances) {
      this.metadata.inheritances = [];
    }
    this.metadata.inheritances.push(inheritance);
    return this;
  }

  /**
   * 添加引用元数据
   */
  addReference(reference: ReferenceMetadata): this {
    if (!this.metadata.references) {
      this.metadata.references = [];
    }
    this.metadata.references.push(reference);
    return this;
  }

  /**
   * 添加自定义字段
   */
  addCustomField(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * 批量添加自定义字段
   */
  addCustomFields(fields: Record<string, any>): this {
    Object.assign(this.metadata, fields);
    return this;
  }

  /**
   * 构建元数据
   */
  build(): ExtensibleMetadata {
    return { ...this.metadata };
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this.metadata = {
      language: '',
      complexity: 1,
      dependencies: [],
      modifiers: []
    };
    return this;
  }

  /**
   * 从现有元数据创建构建器
   */
  static from(metadata: ExtensibleMetadata): MetadataBuilder {
    const builder = new MetadataBuilder();
    builder.metadata = { ...metadata };
    return builder;
  }
}

/**
 * 元数据工具类
 */
export class MetadataUtils {
  /**
   * 合并两个元数据对象
   */
  static merge(base: ExtensibleMetadata, override: ExtensibleMetadata): ExtensibleMetadata {
    const merged: ExtensibleMetadata = { ...base };

    // 合并数组字段
    const arrayFields = [
      'dependencies', 'modifiers', 'relationships', 'symbols',
      'annotations', 'calls', 'creations', 'dataFlows', 'controlFlows',
      'lifecycles', 'concurrencies', 'inheritances', 'references'
    ];

    for (const field of arrayFields) {
      if (override[field] && Array.isArray(override[field])) {
        merged[field] = [...(base[field] || []), ...override[field]];
      }
    }

    // 合并其他字段
    for (const key in override) {
      if (!arrayFields.includes(key) && override[key] !== undefined) {
        merged[key] = override[key];
      }
    }

    return merged;
  }

  /**
   * 验证元数据完整性
   */
  static validate(metadata: ExtensibleMetadata): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata.language) {
      errors.push('Language is required');
    }

    if (typeof metadata.complexity !== 'number' || metadata.complexity < 1) {
      errors.push('Complexity must be a number greater than or equal to 1');
    }

    if (!Array.isArray(metadata.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    if (!Array.isArray(metadata.modifiers)) {
      errors.push('Modifiers must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 克隆元数据
   */
  static clone(metadata: ExtensibleMetadata): ExtensibleMetadata {
    return JSON.parse(JSON.stringify(metadata));
  }

  /**
   * 获取元数据统计信息
   */
  static getStats(metadata: ExtensibleMetadata): Record<string, number> {
    const stats: Record<string, number> = {
      dependencies: metadata.dependencies?.length || 0,
      modifiers: metadata.modifiers?.length || 0,
      relationships: metadata.relationships?.length || 0,
      symbols: metadata.symbols?.length || 0,
      annotations: metadata.annotations?.length || 0,
      calls: metadata.calls?.length || 0,
      creations: metadata.creations?.length || 0,
      dataFlows: metadata.dataFlows?.length || 0,
      controlFlows: metadata.controlFlows?.length || 0,
      lifecycles: metadata.lifecycles?.length || 0,
      concurrencies: metadata.concurrencies?.length || 0,
      inheritances: metadata.inheritances?.length || 0,
      references: metadata.references?.length || 0
    };

    return stats;
  }
}