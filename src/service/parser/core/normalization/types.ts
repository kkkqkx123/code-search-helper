/**
 * 查询结果标准化转换相关的类型定义
 */

import Parser from 'tree-sitter';

/**
 * 标准化查询结果接口
 */
export interface StandardizedQueryResult {
  /** 结构类型 */
  type: 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' | 'config-item' | 'section' | 'key' | 'value' | 'array' | 'table' | 'dependency' | 'type-def' |
        'data-flow' | 'parameter-flow' | 'return-flow' | 
        'exception-flow' | 'callback-flow' | 
        'semantic-relationship' | 'lifecycle-event' | 'concurrency-primitive';
  
  /** 结构名称 */
  name: string;
  
  /** 起始行号（1-based） */
  startLine: number;
  
  /** 结束行号（1-based） */
  endLine: number;
  
  /** 结构内容 */
  content: string;
  
  /** 元数据信息 */
  metadata: {
    /** 编程语言 */
    language: string;
    
    /** 复杂度评分 */
    complexity: number;
    
    /** 依赖项列表 */
    dependencies: string[];
    
    /** 修饰符列表 */
    modifiers: string[];
    
    /** 额外的语言特定信息 */
    extra?: Record<string, any>;
  };
}

/**
 * 查询结果标准化器接口
 */
export interface IQueryResultNormalizer {
  /**
   * 标准化查询结果
   * @param ast Tree-sitter AST节点
   * @param language 编程语言
   * @param queryTypes 查询类型列表（可选，如果不提供则自动发现）
   * @returns 标准化的查询结果数组
   */
  normalize(
    ast: Parser.SyntaxNode, 
    language: string, 
    queryTypes?: string[]
  ): Promise<StandardizedQueryResult[]>;
  
  /**
   * 获取指定语言支持的查询类型
   * @param language 编程语言
   * @returns 查询类型数组
   */
  getSupportedQueryTypes(language: string): Promise<string[]>;
  
  /**
   * 映射节点类型到标准类型
   * @param nodeType Tree-sitter节点类型
   * @param language 编程语言
   * @returns 标准类型
   */
  mapNodeType(nodeType: string, language: string): string;
}

/**
 * 语言适配器接口
 */
export interface ILanguageAdapter {
  /**
   * 标准化查询结果
   * @param queryResults 原始查询结果
   * @param queryType 查询类型
   * @param language 编程语言
   * @returns 标准化的查询结果数组
   */
  normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]>;
  
  /**
   * 获取支持的查询类型
   * @returns 查询类型数组
   */
  getSupportedQueryTypes(): string[];
  
  /**
   * 映射节点类型
   * @param nodeType Tree-sitter节点类型
   * @returns 标准类型
   */
  mapNodeType(nodeType: string): string;
  
  /**
   * 提取结构名称
   * @param result 查询结果
   * @returns 结构名称
   */
  extractName(result: any): string;
  
  /**
   * 提取结构内容
   * @param result 查询结果
   * @returns 结构内容
   */
  extractContent(result: any): string;
  
  /**
   * 计算复杂度
   * @param result 查询结果
   * @returns 复杂度评分
   */
  calculateComplexity(result: any): number;
  
  /**
   * 提取依赖项
   * @param result 查询结果
   * @returns 依赖项列表
   */
  extractDependencies(result: any): string[];
  
  /**
   * 提取修饰符
   * @param result 查询结果
   * @returns 修饰符列表
   */
  extractModifiers(result: any): string[];
}

/**
 * 查询类型映射配置
 */
export interface QueryTypeMapping {
  /** 标准类型名称 */
  standardType: string;
  
  /** 对应的Tree-sitter节点类型 */
  nodeTypes: string[];
  
  /** 适用的语言 */
  languages: string[];
  
  /** 优先级（数值越小优先级越高） */
  priority: number;
}

/**
 * 标准化配置选项
 */
export interface NormalizationOptions {
  /** 是否启用缓存 */
  enableCache?: boolean;
  
  /** 缓存大小限制 */
  cacheSize?: number;
  
  /** 缓存项TTL（毫秒） */
  cacheTTL?: number;
  
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  
  /** 自定义查询类型映射 */
  customTypeMappings?: QueryTypeMapping[];
  
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * 标准化统计信息
 */
export interface NormalizationStats {
  /** 处理的节点总数 */
  totalNodes: number;
  
  /** 成功标准化的节点数 */
  successfulNormalizations: number;
  
  /** 失败的标准化次数 */
  failedNormalizations: number;
  
  /** 处理时间（毫秒） */
  processingTime: number;
  
  /** 缓存命中率 */
  cacheHitRate: number;
  
  /** 按类型分组的统计 */
  typeStats: Record<string, number>;
}
/**
 * 适配器选项接口
 */
export interface AdapterOptions {
  /** 是否启用去重 */
  enableDeduplication?: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用错误恢复 */
  enableErrorRecovery?: boolean;
  /** 是否启用缓存 */
  enableCaching?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 自定义类型映射 */
  customTypeMappings?: Record<string, string>;
}

/**
 * 查询结果元数据接口
 */
export interface QueryResultMetadata {
  /** 编程语言 */
  language: string;
  /** 复杂度评分 */
  complexity: number;
  /** 依赖项列表 */
  dependencies: string[];
  /** 修饰符列表 */
  modifiers: string[];
  /** 数据流相关 */
  dataFlowSources?: string[];
  dataFlowTargets?: string[];
  dataFlowType?: 'assignment' | 'parameter' | 'return';
  /** 控制流相关 */
  controlFlowType?: 'conditional' | 'loop' | 'exception' | 'callback';
  controlFlowTargets?: string[];
  /** 语义关系相关 */
  semanticType?: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  semanticTargets?: string[];
  /** 生命周期相关 */
  lifecycleType?: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  lifecycleTargets?: string[];
  /** 并发相关 */
  concurrencyType?: 'synchronizes' | 'locks' | 'communicates' | 'races';
  concurrencyTargets?: string[];
  /** 额外的语言特定信息 */
  [key: string]: any;
}

/**
 * 语言查询映射接口
 */
export interface LanguageQueryMapping {
  [queryFile: string]: string[];
}

/**
 * 语言映射接口
 */
export interface LanguageMappings {
  [language: string]: LanguageQueryMapping;
}

/**
 * 适配器性能统计接口
 */
export interface AdapterPerformanceStats {
  /** 缓存大小 */
  cacheSize: number;
  /** 支持的语言数量 */
  supportedLanguages: number;
  /** 已配置的语言数量 */
  configuredLanguages: number;
  /** 按语言分组的统计 */
  languageStats: Record<string, {
    count: number;
    adapters: string[];
  }>;
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  /** 缓存大小 */
  size: number;
  /** 缓存中的语言列表 */
  languages: string[];
  /** 缓存条目详情 */
  entries: Array<{
    language: string;
    count: number;
  }>;
}

/**
 * 配置语言标准类型
 */
export type ConfigStandardType = 
  | 'config-item'    // 配置项
  | 'section'        // 配置节
  | 'key'           // 键
  | 'value'         // 值
  | 'array'         // 数组
  | 'table'         // 表/对象
  | 'dependency'    // 依赖项
  | 'type-def';     // 类型定义

/**
 * 配置语言适配器选项接口
 */
export interface ConfigAdapterOptions {
  /** 是否启用去重 */
  enableDeduplication?: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用错误恢复 */
  enableErrorRecovery?: boolean;
  /** 是否启用缓存 */
  enableCaching?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 自定义类型映射 */
  customTypeMappings?: Record<string, string>;
  /** 是否启用配置路径解析 */
  enableConfigPathParsing?: boolean;
  /** 是否启用数据类型推断 */
  enableDataTypeInference?: boolean;
}

/**
 * 配置语言特有的元数据接口
 */
export interface ConfigMetadata {
  /** 编程语言 */
  language: string;
  /** 复杂度评分 */
  complexity: number;
  /** 依赖项列表 */
  dependencies: string[];
  /** 修饰符列表 */
  modifiers: string[];
  /** 数据类型 */
  dataType: string;
  /** 默认值 */
  defaultValue?: any;
  /** 验证规则 */
  validationRules: string[];
  /** 是否必需 */
  isRequired: boolean;
  /** 配置路径 */
  configPath: string;
  /** 配置描述 */
  description?: string;
  /** 嵌套深度 */
  nestingDepth: number;
  /** 额外的语言特定信息 */
  [key: string]: any;
}

/**
 * 配置语言查询结果接口
 */
export interface ConfigQueryResult extends StandardizedQueryResult {
  /** 配置语言特有的类型 */
  type: ConfigStandardType;
  /** 配置语言特有的元数据 */
  metadata: ConfigMetadata;
}