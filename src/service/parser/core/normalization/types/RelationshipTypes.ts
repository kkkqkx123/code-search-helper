/**
 * 关系类型定义
 * 定义了所有支持的关系类型和分类
 */

/**
 * 关系类别枚举
 */
export enum RelationshipCategory {
  DATA_FLOW = 'data-flow',
  CONTROL_FLOW = 'control-flow',
  SEMANTIC = 'semantic',
  LIFECYCLE = 'lifecycle',
  CONCURRENCY = 'concurrency',
  ANNOTATION = 'annotation',
  CALL = 'call',
  CREATION = 'creation',
  DEPENDENCY = 'dependency',
  INHERITANCE = 'inheritance',
  REFERENCE = 'reference'
}

/**
 * 数据流关系类型
 */
export type DataFlowRelationshipType = 
  | 'assignment' 
  | 'parameter' 
  | 'return' 
  | 'field_access' 
  | 'channel_operation';

/**
 * 控制流关系类型
 */
export type ControlFlowRelationshipType = 
  | 'conditional' 
  | 'loop' 
  | 'exception' 
  | 'callback' 
  | 'select' 
  | 'switch' 
  | 'jump';

/**
 * 语义关系类型
 */
export type SemanticRelationshipType = 
  | 'overrides' 
  | 'overloads' 
  | 'delegates' 
  | 'observes' 
  | 'configures' 
  | 'implements' 
  | 'decorates' 
  | 'composes';

/**
 * 生命周期关系类型
 */
export type LifecycleRelationshipType = 
  | 'instantiates' 
  | 'initializes' 
  | 'destroys' 
  | 'manages' 
  | 'allocates' 
  | 'releases';

/**
 * 并发关系类型
 */
export type ConcurrencyRelationshipType = 
  | 'synchronizes' 
  | 'locks' 
  | 'communicates' 
  | 'races' 
  | 'waits' 
  | 'coordinates';

/**
 * 注解关系类型
 */
export type AnnotationRelationshipType = 
  | 'struct_tag' 
  | 'comment' 
  | 'directive';

/**
 * 调用关系类型
 */
export type CallRelationshipType = 
  | 'function' 
  | 'method' 
  | 'constructor' 
  | 'static' 
  | 'callback' 
  | 'builtin' 
  | 'goroutine';

/**
 * 创建关系类型
 */
export type CreationRelationshipType = 
  | 'struct_instance' 
  | 'slice' 
  | 'map' 
  | 'channel' 
  | 'function' 
  | 'goroutine_instance';

/**
 * 依赖关系类型
 */
export type DependencyRelationshipType = 
  | 'import' 
  | 'package' 
  | 'qualified_identifier';

/**
 * 继承关系类型
 */
export type InheritanceRelationshipType = 
  | 'extends' 
  | 'implements' 
  | 'interface_inheritance' 
  | 'struct_embedding';

/**
 * 引用关系类型
 */
export type ReferenceRelationshipType = 
  | 'read' 
  | 'write' 
  | 'declaration' 
  | 'usage';

/**
 * 统一的关系类型联合
 */
export type RelationshipType = 
  | DataFlowRelationshipType
  | ControlFlowRelationshipType
  | SemanticRelationshipType
  | LifecycleRelationshipType
  | ConcurrencyRelationshipType
  | AnnotationRelationshipType
  | CallRelationshipType
  | CreationRelationshipType
  | DependencyRelationshipType
  | InheritanceRelationshipType
  | ReferenceRelationshipType;

/**
 * 基础关系接口
 */
export interface BaseRelationship {
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  type: RelationshipType;
  /** 关系类别 */
  category: RelationshipCategory;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 强类型关系接口
 */
export interface TypedRelationship<T extends RelationshipType = RelationshipType> extends BaseRelationship {
  /** 具体的关系类型 */
  type: T;
  /** 关系类别 */
  category: RelationshipCategory;
}

/**
 * 关系提取结果接口
 */
export interface RelationshipResult {
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  type: RelationshipType;
  /** 关系类别 */
  category: RelationshipCategory;
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 位置信息 */
  location?: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 关系类型映射工具
 */
export class RelationshipTypeMapping {
  /**
   * 根据关系类型获取关系类别
   */
  static getCategory(type: RelationshipType): RelationshipCategory {
    if (this.isDataFlowType(type)) return RelationshipCategory.DATA_FLOW;
    if (this.isControlFlowType(type)) return RelationshipCategory.CONTROL_FLOW;
    if (this.isSemanticType(type)) return RelationshipCategory.SEMANTIC;
    if (this.isLifecycleType(type)) return RelationshipCategory.LIFECYCLE;
    if (this.isConcurrencyType(type)) return RelationshipCategory.CONCURRENCY;
    if (this.isAnnotationType(type)) return RelationshipCategory.ANNOTATION;
    if (this.isCallType(type)) return RelationshipCategory.CALL;
    if (this.isCreationType(type)) return RelationshipCategory.CREATION;
    if (this.isDependencyType(type)) return RelationshipCategory.DEPENDENCY;
    if (this.isInheritanceType(type)) return RelationshipCategory.INHERITANCE;
    if (this.isReferenceType(type)) return RelationshipCategory.REFERENCE;
    
    return RelationshipCategory.SEMANTIC; // 默认类别
  }

  /**
   * 检查是否为数据流关系类型
   */
  static isDataFlowType(type: RelationshipType): type is DataFlowRelationshipType {
    return ['assignment', 'parameter', 'return', 'field_access', 'channel_operation'].includes(type);
  }

  /**
   * 检查是否为控制流关系类型
   */
  static isControlFlowType(type: RelationshipType): type is ControlFlowRelationshipType {
    return ['conditional', 'loop', 'exception', 'callback', 'select', 'switch', 'jump'].includes(type);
  }

  /**
   * 检查是否为语义关系类型
   */
  static isSemanticType(type: RelationshipType): type is SemanticRelationshipType {
    return ['overrides', 'overloads', 'delegates', 'observes', 'configures', 'implements', 'decorates', 'composes'].includes(type);
  }

  /**
   * 检查是否为生命周期关系类型
   */
  static isLifecycleType(type: RelationshipType): type is LifecycleRelationshipType {
    return ['instantiates', 'initializes', 'destroys', 'manages', 'allocates', 'releases'].includes(type);
  }

  /**
   * 检查是否为并发关系类型
   */
  static isConcurrencyType(type: RelationshipType): type is ConcurrencyRelationshipType {
    return ['synchronizes', 'locks', 'communicates', 'races', 'waits', 'coordinates'].includes(type);
  }

  /**
   * 检查是否为注解关系类型
   */
  static isAnnotationType(type: RelationshipType): type is AnnotationRelationshipType {
    return ['struct_tag', 'comment', 'directive'].includes(type);
  }

  /**
   * 检查是否为调用关系类型
   */
  static isCallType(type: RelationshipType): type is CallRelationshipType {
    return ['function', 'method', 'constructor', 'static', 'callback', 'builtin', 'goroutine'].includes(type);
  }

  /**
   * 检查是否为创建关系类型
   */
  static isCreationType(type: RelationshipType): type is CreationRelationshipType {
    return ['struct_instance', 'slice', 'map', 'channel', 'function', 'goroutine_instance'].includes(type);
  }

  /**
   * 检查是否为依赖关系类型
   */
  static isDependencyType(type: RelationshipType): type is DependencyRelationshipType {
    return ['import', 'package', 'qualified_identifier'].includes(type);
  }

  /**
   * 检查是否为继承关系类型
   */
  static isInheritanceType(type: RelationshipType): type is InheritanceRelationshipType {
    return ['extends', 'implements', 'interface_inheritance', 'struct_embedding'].includes(type);
  }

  /**
   * 检查是否为引用关系类型
   */
  static isReferenceType(type: RelationshipType): type is ReferenceRelationshipType {
    return ['read', 'write', 'declaration', 'usage'].includes(type);
  }

  /**
   * 获取所有关系类型
   */
  static getAllTypes(): RelationshipType[] {
    return [
      // 数据流
      'assignment', 'parameter', 'return', 'field_access', 'channel_operation',
      // 控制流
      'conditional', 'loop', 'exception', 'callback', 'select', 'switch', 'jump',
      // 语义
      'overrides', 'overloads', 'delegates', 'observes', 'configures', 'implements', 'decorates', 'composes',
      // 生命周期
      'instantiates', 'initializes', 'destroys', 'manages', 'allocates', 'releases',
      // 并发
      'synchronizes', 'locks', 'communicates', 'races', 'waits', 'coordinates',
      // 注解
      'struct_tag', 'comment', 'directive',
      // 调用
      'function', 'method', 'constructor', 'static', 'callback', 'builtin', 'goroutine',
      // 创建
      'struct_instance', 'slice', 'map', 'channel', 'function', 'goroutine_instance',
      // 依赖
      'import', 'package', 'qualified_identifier',
      // 继承
      'extends', 'implements', 'interface_inheritance', 'struct_embedding',
      // 引用
      'read', 'write', 'declaration', 'usage'
    ];
  }

  /**
   * 按类别获取关系类型
   */
  static getTypesByCategory(category: RelationshipCategory): RelationshipType[] {
    return this.getAllTypes().filter(type => this.getCategory(type) === category);
  }
}