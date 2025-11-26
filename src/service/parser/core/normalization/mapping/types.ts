/**
 * 查询映射类型定义
 * 定义了查询模式到关系/实体映射的接口和类型
 */

/**
 * 映射优先级枚举
 * 用于控制映射规则的匹配顺序，解决冲突问题
 */
export enum MappingPriority {
  CRITICAL = 100,  // 关键：核心语言构造（如基本函数定义、变量定义）
  HIGH = 80,       // 高：重要语言特性（如函数原型、结构体定义）
  MEDIUM = 60,     // 中：一般语言特性（如静态变量、枚举）
  LOW = 40,        // 低：辅助特性（如函数指针、常量）
  MINIMAL = 20     // 最低：扩展特性（如作用域管理、资源清理）
}

/**
 * 查询模式类型枚举
 */
export enum QueryPatternType {
  ENTITY = 'entity',
  RELATIONSHIP = 'relationship',
  SHARED = 'shared'
}

/**
 * 查询映射配置接口
 */
export interface QueryMapping {
  /** 查询模式标识符 */
  queryPattern: string;
  /** 查询模式类型 */
  patternType: QueryPatternType;
  /** 捕获组映射配置 */
  captures: {
    /** 源节点捕获组（关系模式必需） */
    source?: string;
    /** 目标节点捕获组（关系模式必需） */
    target?: string;
    /** 实体类型捕获组（实体模式必需） */
    entityType?: string;
    /** 可选的额外捕获组 */
    [key: string]: string | undefined;
  };
  /** 关系定义（关系模式必需） */
  relationship?: {
    /** 关系类型 */
    type: string;
    /** 关系类别 */
    category: string;
    /** 关系元数据 */
    metadata?: Record<string, any>;
  };
  /** 实体定义（实体模式必需） */
  entity?: {
    /** 实体类型 */
    type: string;
    /** 实体类别 */
    category: string;
    /** 实体元数据 */
    metadata?: Record<string, any>;
  };
  /** 可选的自定义处理函数名 */
  customProcessor?: string;
  /** 可选的处理器配置 */
  processorConfig?: Record<string, any>;
  /** 映射优先级（使用 MappingPriority 枚举，数字越大优先级越高） */
  priority?: number;
  /** 映射描述 */
  description?: string;
}

/**
 * 映射配置集合
 */
export interface MappingConfig {
  /** 映射配置数组 */
  mappings: QueryMapping[];
  /** 支持的语言 */
  language: string;
  /** 查询类型 */
  queryType: string;
}

/**
 * 关系结果接口
 */
export interface RelationshipResult {
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  type: string;
  /** 关系类别 */
  category: string;
  /** 关系元数据 */
  metadata?: Record<string, any>;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 实体结果接口
 */
export interface EntityResult {
  /** 节点ID */
  id: string;
  /** 实体类型 */
  type: string;
  /** 实体类别 */
  category: string;
  /** 实体名称 */
  name: string;
  /** 实体元数据 */
  metadata?: Record<string, any>;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 映射解析结果接口
 */
export interface MappingResult {
  /** 关系结果数组 */
  relationships: RelationshipResult[];
  /** 实体结果数组 */
  entities: EntityResult[];
  /** 处理的查询结果数量 */
  processedCount: number;
  /** 成功映射的数量 */
  mappedCount: number;
  /** 错误信息 */
  errors?: string[];
}

/**
 * 映射解析器选项
 */
export interface MappingResolverOptions {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 自定义映射目录 */
  customMappingDir?: string;
  /** 缓存大小限制 */
  cacheSizeLimit?: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
}

/**
 * 映射解析器统计信息
 */
export interface MappingResolverStats {
  /** 缓存大小 */
  cacheSize: number;
  /** 缓存键列表 */
  cacheKeys: string[];
  /** 总查询次数 */
  totalQueries: number;
  /** 缓存命中次数 */
  cacheHits: number;
  /** 缓存未命中次数 */
  cacheMisses: number;
  /** 平均处理时间（毫秒） */
  averageProcessingTime: number;
}

/**
 * 映射验证错误接口
 */
export interface MappingValidationError {
  /** 错误类型 */
  type: 'MISSING_REQUIRED_FIELD' | 'INVALID_PATTERN' | 'INVALID_CAPTURE' | 'INVALID_RELATIONSHIP' | 'INVALID_ENTITY';
  /** 错误消息 */
  message: string;
  /** 相关的映射配置 */
  mapping?: QueryMapping;
  /** 错误位置 */
  location?: {
    line?: number;
    column?: number;
    field?: string;
  };
}

/**
 * 映射验证结果接口
 */
export interface MappingValidationResult {
  /** 是否验证通过 */
  isValid: boolean;
  /** 错误列表 */
  errors: MappingValidationError[];
  /** 警告列表 */
  warnings: string[];
}

/**
 * 支持的语言列表
 */
export type SupportedLanguage = 'c' | 'cpp' | 'java' | 'python' | 'javascript' | 'typescript' | 'go' | 'rust';

/**
 * 查询类型列表
 */
export type QueryType =
  | 'lifecycle'
  | 'dependency'
  | 'inheritance'
  | 'call'
  | 'data-flow'
  | 'control-flow'
  | 'concurrency'
  | 'semantic'
  | 'creation'
  | 'reference'
  | 'annotation'
  | 'functions'
  | 'variables'
  | 'structs'
  | 'preprocessor'
  | 'call-expressions'
  | 'function-annotations';

/**
 * 映射注册表接口
 */
export interface MappingRegistry {
  /** 语言 */
  language: SupportedLanguage;
  /** 查询类型到映射配置的映射 */
  mappings: Record<QueryType, MappingConfig>;
  /** 可用的查询类型列表 */
  availableQueryTypes: QueryType[];
  /** 注册时间 */
  registeredAt: Date;
}

/**
 * 映射解析器工厂接口
 */
export interface IMappingResolverFactory {
  /** 创建指定语言的映射解析器 */
  createResolver(language: SupportedLanguage): IMappingResolver;
  /** 获取支持的语言列表 */
  getSupportedLanguages(): SupportedLanguage[];
  /** 注册新的映射配置 */
  registerMapping(language: SupportedLanguage, queryType: QueryType, config: MappingConfig): void;
}

/**
 * 映射解析器接口
 */
export interface IMappingResolver {
  /** 解析查询结果 */
  resolve(queryResults: any[], queryType: QueryType): Promise<MappingResult>;
  /** 验证映射配置 */
  validateMapping(config: MappingConfig): MappingValidationResult;
  /** 获取可用的查询类型 */
  getAvailableQueryTypes(): QueryType[];
  /** 清除缓存 */
  clearCache(): void;
  /** 获取统计信息 */
  getStats(): MappingResolverStats;
}