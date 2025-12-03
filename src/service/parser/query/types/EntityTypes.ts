/**
 * 通用实体类型定义
 * 专门针对实体查询优化，支持多语言扩展
 * 只包含基本的通用定义，不包含任何具体语言的定义
 */

/**
 * 基础实体类型枚举
 * 定义所有支持的通用实体类型分类
 */
export enum EntityType {
  // 预处理器相关实体
  PREPROCESSOR = 'preprocessor',
  
  // 类型定义实体
  TYPE_DEFINITION = 'type_definition',
  
  // 函数实体
  FUNCTION = 'function',
  
  // 变量实体
  VARIABLE = 'variable',
  
  // 注释和注解实体
  ANNOTATION = 'annotation'
}

/**
 * 基础位置信息接口
 */
export interface LocationInfo {
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
 * 基础EntityQueryResult接口
 * 专门针对实体查询优化的核心接口
 */
export interface EntityQueryResult {
  /** 唯一标识符，用于图数据库中的顶点ID */
  id: string;
  
  /** 实体类型（基于实体分类） */
  entityType: EntityType;
  
  /** 实体名称 */
  name: string;
  
  /** 查询优先级（来自实体查询模式） */
  priority: number;
  
  /** 位置信息 */
  location: LocationInfo;
  
  /** 实体内容（原始代码片段） */
  content: string;
  
  /** 文件路径 */
  filePath: string;
  
  /** 语言类型 */
  language: string;
  
  /** 扩展属性 */
  properties: Record<string, any>;
}

/**
 * 基础字段信息接口
 */
export interface FieldInfo {
  /** 字段名称 */
  name: string;
  /** 字段类型 */
  type: string;
  /** 字段位置 */
  location: {
    startLine: number;
    endLine: number;
  };
  /** 扩展属性 */
  properties?: Record<string, any>;
}

/**
 * 基础枚举常量信息接口
 */
export interface EnumConstant {
  /** 常量名称 */
  name: string;
  /** 常量值 */
  value?: string;
  /** 常量位置 */
  location: {
    startLine: number;
    endLine: number;
  };
  /** 扩展属性 */
  properties?: Record<string, any>;
}

/**
 * 基础参数信息接口
 */
export interface ParameterInfo {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: string;
  /** 参数位置 */
  location: {
    startLine: number;
    endLine: number;
  };
  /** 扩展属性 */
  properties?: Record<string, any>;
}

/**
 * 预处理器实体接口
 */
export interface PreprocessorEntity extends EntityQueryResult {
  entityType: EntityType.PREPROCESSOR;
  
  // 预处理器特有属性
  preprocType?: string;
  properties: {
    /** 预处理器类型特定的属性 */
    [key: string]: any;
  };
}

/**
 * 类型定义实体接口
 */
export interface TypeEntity extends EntityQueryResult {
  entityType: EntityType.TYPE_DEFINITION;
  
  // 类型定义特有属性
  fields?: FieldInfo[];
  enumConstants?: EnumConstant[];
  baseType?: string;
  properties: {
    /** 类型定义特定的属性 */
    [key: string]: any;
  };
}

/**
 * 函数实体接口
 */
export interface FunctionEntity extends EntityQueryResult {
  entityType: EntityType.FUNCTION;
  
  // 函数特有属性
  returnType?: string;
  parameters?: ParameterInfo[];
  properties: {
    /** 函数特定的属性 */
    [key: string]: any;
  };
}

/**
 * 变量实体接口
 */
export interface VariableEntity extends EntityQueryResult {
  entityType: EntityType.VARIABLE;
  
  // 变量特有属性
  variableType?: string;
  properties: {
    /** 变量特定的属性 */
    [key: string]: any;
  };
}

/**
 * 注解实体接口
 */
export interface AnnotationEntity extends EntityQueryResult {
  entityType: EntityType.ANNOTATION;
  
  // 注解特有属性
  annotationType?: string;
  properties: {
    /** 注解特定的属性 */
    [key: string]: any;
  };
}

/**
 * 通用实体查询结果联合类型
 */
export type GenericEntityQueryResult = 
  | PreprocessorEntity
  | TypeEntity
  | FunctionEntity
  | VariableEntity
  | AnnotationEntity;

/**
 * 实体类型工厂接口
 * 用于创建特定语言的实体类型
 */
export interface EntityTypeFactory {
  /** 获取语言特定的实体类型 */
  getLanguageSpecificTypes(): Record<string, string>;
  
  /** 创建语言特定的实体 */
  createLanguageSpecificEntity(
    baseType: EntityType,
    languageType: string,
    data: any
  ): EntityQueryResult;
  
  /** 获取实体类型的优先级 */
  getEntityTypePriority(entityType: string, languageType?: string): number;
}

/**
 * 实体类型注册表
 */
export class EntityTypeRegistry {
  private static instance: EntityTypeRegistry;
  private factories: Map<string, EntityTypeFactory> = new Map();
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): EntityTypeRegistry {
    if (!EntityTypeRegistry.instance) {
      EntityTypeRegistry.instance = new EntityTypeRegistry();
    }
    return EntityTypeRegistry.instance;
  }
  
  /**
   * 注册语言特定的实体类型工厂
   */
  registerFactory(language: string, factory: EntityTypeFactory): void {
    this.factories.set(language, factory);
  }
  
  /**
   * 获取语言特定的实体类型工厂
   */
  getFactory(language: string): EntityTypeFactory | undefined {
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