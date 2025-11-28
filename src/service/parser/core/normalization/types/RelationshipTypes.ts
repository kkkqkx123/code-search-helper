/**
 * 通用关系类型定义
 * 专门针对关系查询优化，支持多语言扩展
 * 只包含基本的通用定义，不包含任何具体语言的定义
 */

/**
 * 关系类别枚举（语言无关）
 */
export enum RelationshipCategory {
  CALL = 'call',
  DATA_FLOW = 'data_flow',
  CONTROL_FLOW = 'control_flow',
  DEPENDENCY = 'dependency',
  INHERITANCE = 'inheritance',
  LIFECYCLE = 'lifecycle',
  SEMANTIC = 'semantic',
  REFERENCE = 'reference',
  ANNOTATION = 'annotation'
}

/**
 * 基础关系类型枚举
 * 定义所有支持的通用关系类型分类
 */
export enum RelationshipType {
  // 调用关系
  CALL = 'call',
  METHOD_CALL = 'method_call',
  FUNCTION_POINTER_CALL = 'function_pointer_call',
  RECURSIVE_CALL = 'recursive_call',
  
  // 数据流关系
  ASSIGNMENT = 'assignment',
  PARAMETER_PASSING = 'parameter_passing',
  RETURN_VALUE = 'return_value',
  TYPE_CONVERSION = 'type_conversion',
  
  // 控制流关系
  CONDITIONAL = 'conditional',
  LOOP = 'loop',
  JUMP = 'jump',
  
  // 依赖关系
  INCLUDE = 'include',
  TYPE_REFERENCE = 'type_reference',
  FUNCTION_REFERENCE = 'function_reference',
  VARIABLE_REFERENCE = 'variable_reference',
  
  // 继承关系
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  COMPOSITION = 'composition',
  
  // 生命周期关系
  INITIALIZATION = 'initialization',
  CLEANUP = 'cleanup',
  
  // 语义关系
  ERROR_HANDLING = 'error_handling',
  RESOURCE_MANAGEMENT = 'resource_management',
  
  // 引用关系
  REFERENCE = 'reference',
  
  // 注解关系
  ANNOTATION = 'annotation'
}

/**
 * 基础位置信息接口
 */
export interface RelationshipLocationInfo {
  /** 文件路径 */
  filePath: string;
  /** 开始行号 */
  startLine: number;
  /** 开始列号 */
  startColumn: number;
  /** 结束行号 */
  endLine: number;
  /** 结束列号 */
  endColumn: number;
}

/**
 * 基础RelationshipQueryResult接口
 * 专门针对关系查询优化的核心接口
 */
export interface RelationshipQueryResult {
  /** 唯一标识符，用于图数据库中的边ID */
  id: string;
  
  /** 关系类型 */
  type: RelationshipType;
  
  /** 关系类别 */
  category: RelationshipCategory;
  
  /** 源节点ID */
  fromNodeId: string;
  
  /** 目标节点ID */
  toNodeId: string;
  
  /** 关系方向（true: from->to, false: undirected） */
  directed: boolean;
  
  /** 关系强度（0-1，可选） */
  strength?: number;
  
  /** 关系权重（可选） */
  weight?: number;
  
  /** 位置信息 */
  location: RelationshipLocationInfo;
  
  /** 语言类型 */
  language: string;
  
  /** 扩展属性 */
  properties: Record<string, any>;
}

/**
 * 调用关系接口
 */
export interface CallRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.CALL;
  type: RelationshipType.CALL | RelationshipType.METHOD_CALL | RelationshipType.FUNCTION_POINTER_CALL | RelationshipType.RECURSIVE_CALL;
  
  // 调用关系特有属性
  properties: {
    /** 调用关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 数据流关系接口
 */
export interface DataFlowRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.DATA_FLOW;
  type: RelationshipType.ASSIGNMENT | RelationshipType.PARAMETER_PASSING | RelationshipType.RETURN_VALUE | RelationshipType.TYPE_CONVERSION;
  
  // 数据流关系特有属性
  properties: {
    /** 数据流关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 控制流关系接口
 */
export interface ControlFlowRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.CONTROL_FLOW;
  type: RelationshipType.CONDITIONAL | RelationshipType.LOOP | RelationshipType.JUMP;
  
  // 控制流关系特有属性
  properties: {
    /** 控制流关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 依赖关系接口
 */
export interface DependencyRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.DEPENDENCY;
  type: RelationshipType.INCLUDE | RelationshipType.TYPE_REFERENCE | RelationshipType.FUNCTION_REFERENCE | RelationshipType.VARIABLE_REFERENCE;
  
  // 依赖关系特有属性
  properties: {
    /** 依赖关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 继承关系接口
 */
export interface InheritanceRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.INHERITANCE;
  type: RelationshipType.EXTENDS | RelationshipType.IMPLEMENTS | RelationshipType.COMPOSITION;
  
  // 继承关系特有属性
  properties: {
    /** 继承关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 生命周期关系接口
 */
export interface LifecycleRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.LIFECYCLE;
  type: RelationshipType.INITIALIZATION | RelationshipType.CLEANUP;
  
  // 生命周期关系特有属性
  properties: {
    /** 生命周期关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 语义关系接口
 */
export interface SemanticRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.SEMANTIC;
  type: RelationshipType.ERROR_HANDLING | RelationshipType.RESOURCE_MANAGEMENT;
  
  // 语义关系特有属性
  properties: {
    /** 语义关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 引用关系接口
 */
export interface ReferenceRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.REFERENCE;
  type: RelationshipType.REFERENCE;
  
  // 引用关系特有属性
  properties: {
    /** 引用关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 注解关系接口
 */
export interface AnnotationRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.ANNOTATION;
  type: RelationshipType.ANNOTATION;
  
  // 注解关系特有属性
  properties: {
    /** 注解关系特定的属性 */
    [key: string]: any;
  };
}

/**
 * 通用关系查询结果联合类型
 */
export type GenericRelationshipQueryResult = 
  | CallRelationship
  | DataFlowRelationship
  | ControlFlowRelationship
  | DependencyRelationship
  | InheritanceRelationship
  | LifecycleRelationship
  | SemanticRelationship
  | ReferenceRelationship
  | AnnotationRelationship;

/**
 * 关系类型工厂接口
 * 用于创建特定语言的关系类型
 */
export interface RelationshipTypeFactory {
  /** 获取语言特定的关系类型 */
  getLanguageSpecificTypes(): Record<string, RelationshipType>;
  
  /** 创建语言特定的关系 */
  createLanguageSpecificRelationship(
    baseType: RelationshipType,
    languageType: string,
    data: any
  ): RelationshipQueryResult;
  
  /** 获取关系类型的优先级 */
  getRelationshipTypePriority(relationshipType: string, languageType?: string): number;
}

/**
 * 关系类型注册表
 */
export class RelationshipTypeRegistry {
  private static instance: RelationshipTypeRegistry;
  private factories: Map<string, RelationshipTypeFactory> = new Map();
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): RelationshipTypeRegistry {
    if (!RelationshipTypeRegistry.instance) {
      RelationshipTypeRegistry.instance = new RelationshipTypeRegistry();
    }
    return RelationshipTypeRegistry.instance;
  }
  
  /**
   * 注册语言特定的关系类型工厂
   */
  registerFactory(language: string, factory: RelationshipTypeFactory): void {
    this.factories.set(language, factory);
  }
  
  /**
   * 获取语言特定的关系类型工厂
   */
  getFactory(language: string): RelationshipTypeFactory | undefined {
    return this.factories.get(language);
  }
  
  /**
   * 获取所有已注册的语言
   */
  getRegisteredLanguages(): string[] {
    return Array.from(this.factories.keys());
  }
  
  /**
   * 检查语言是否已注册
   */
  isLanguageRegistered(language: string): boolean {
    return this.factories.has(language);
  }
}

/**
 * 关系类型映射工具
 */
export class RelationshipTypeMapping {
  /**
   * 根据关系类型获取关系类别
   */
  static getCategory(type: RelationshipType): RelationshipCategory {
    switch (type) {
      case RelationshipType.CALL:
      case RelationshipType.METHOD_CALL:
      case RelationshipType.FUNCTION_POINTER_CALL:
      case RelationshipType.RECURSIVE_CALL:
        return RelationshipCategory.CALL;
        
      case RelationshipType.ASSIGNMENT:
      case RelationshipType.PARAMETER_PASSING:
      case RelationshipType.RETURN_VALUE:
      case RelationshipType.TYPE_CONVERSION:
        return RelationshipCategory.DATA_FLOW;
        
      case RelationshipType.CONDITIONAL:
      case RelationshipType.LOOP:
      case RelationshipType.JUMP:
        return RelationshipCategory.CONTROL_FLOW;
        
      case RelationshipType.INCLUDE:
      case RelationshipType.TYPE_REFERENCE:
      case RelationshipType.FUNCTION_REFERENCE:
      case RelationshipType.VARIABLE_REFERENCE:
        return RelationshipCategory.DEPENDENCY;
        
      case RelationshipType.EXTENDS:
      case RelationshipType.IMPLEMENTS:
      case RelationshipType.COMPOSITION:
        return RelationshipCategory.INHERITANCE;
        
      case RelationshipType.INITIALIZATION:
      case RelationshipType.CLEANUP:
        return RelationshipCategory.LIFECYCLE;
        
      case RelationshipType.ERROR_HANDLING:
      case RelationshipType.RESOURCE_MANAGEMENT:
        return RelationshipCategory.SEMANTIC;
        
      case RelationshipType.REFERENCE:
        return RelationshipCategory.REFERENCE;
        
      case RelationshipType.ANNOTATION:
        return RelationshipCategory.ANNOTATION;
        
      default:
        throw new Error(`Unknown relationship type: ${type}`);
    }
  }
  
  /**
   * 检查关系类型是否属于指定类别
   */
  static isTypeOfCategory(type: RelationshipType, category: RelationshipCategory): boolean {
    return this.getCategory(type) === category;
  }
  
  /**
   * 获取指定类别的所有关系类型
   */
  static getTypesByCategory(category: RelationshipCategory): RelationshipType[] {
    return Object.values(RelationshipType).filter(type => 
      this.getCategory(type) === category
    );
  }
}