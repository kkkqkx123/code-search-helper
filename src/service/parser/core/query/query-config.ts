/**
 * 动态查询配置系统
 * 支持运行时配置更新、验证和性能优化
 */

import { languageMappingManager } from '../../config/LanguageMappingManager';
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/LRUCache';

/**
 * 查询类型配置接口
 */
export interface QueryTypeConfig {
  /** 查询类型名称 */
  name: string;
  
  /** 查询类型描述 */
  description: string;
  
  /** 相关的Tree-sitter节点类型 */
  nodeTypes: string[];
  
  /** 查询优先级（数字越小优先级越高） */
  priority: number;
  
  /** 是否为核心查询类型 */
  isCore: boolean;
  
  /** 支持的语言列表（空数组表示支持所有语言） */
  supportedLanguages: string[];
  
  /** 查询类型分类 */
  category: 'structure' | 'behavior' | 'type' | 'import' | 'export' | 'flow' | 'custom';
  
  /** 依赖的其他查询类型 */
  dependencies: string[];
  
  /** 查询类型标签 */
  tags: string[];
}

/**
 * 复合查询配置接口
 */
export interface CompoundQueryConfig {
  /** 复合查询名称 */
  name: string;
  
  /** 复合查询描述 */
  description: string;
  
  /** 包含的查询类型列表 */
  queryTypes: string[];
  
  /** 查询合并策略 */
  mergeStrategy: 'union' | 'intersection' | 'sequence';
  
  /** 支持的语言列表 */
  supportedLanguages: string[];
}

/**
 * 查询配置验证结果
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  isValid: boolean;
  
  /** 错误信息列表 */
  errors: string[];
  
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 动态查询配置管理器
 */
export class QueryConfigManager {
  private static instance: QueryConfigManager;
  private queryTypes: Map<string, QueryTypeConfig> = new Map();
  public compoundQueries: Map<string, CompoundQueryConfig> = new Map();
  private languageQueryTypes: Map<string, Set<string>> = new Map();
  private queryTypeCache: LRUCache<string, string[]>;
  private logger: LoggerService;
  private initialized = false;

  private constructor() {
    this.logger = new LoggerService();
    this.queryTypeCache = new LRUCache<string, string[]>(100);
    this.initializeDefaultConfigs();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): QueryConfigManager {
    if (!QueryConfigManager.instance) {
      QueryConfigManager.instance = new QueryConfigManager();
    }
    return QueryConfigManager.instance;
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaultConfigs(): void {
    // 核心查询类型配置
    const coreQueryTypes: QueryTypeConfig[] = [
      {
        name: 'functions',
        description: '函数定义和声明',
        nodeTypes: [
          'function_definition', 'function_declaration', 'function_declarator',
          'method_definition', 'method_declaration', 'func_literal',
          'local_function_definition', 'arrow_function', 'function_expression'
        ],
        priority: 1,
        isCore: true,
        supportedLanguages: [],
        category: 'structure',
        dependencies: [],
        tags: ['core', 'structure', 'behavior']
      },
      {
        name: 'classes',
        description: '类定义和结构体',
        nodeTypes: [
          'class_declaration', 'class_definition', 'struct_specifier',
          'struct_item', 'union_specifier', 'enum_specifier',
          'interface_type', 'struct_type', 'interface_declaration',
          'type_declaration', 'type_definition', 'abstract_class_declaration'
        ],
        priority: 2,
        isCore: true,
        supportedLanguages: [],
        category: 'structure',
        dependencies: [],
        tags: ['core', 'structure', 'type']
      },
      {
        name: 'methods',
        description: '类方法定义',
        nodeTypes: [
          'method_definition', 'method_declaration', 'method_spec',
          'function_definition_statement', 'method_invocation'
        ],
        priority: 3,
        isCore: true,
        supportedLanguages: [],
        category: 'behavior',
        dependencies: ['classes'],
        tags: ['core', 'behavior', 'structure']
      },
      {
        name: 'imports',
        description: '导入语句和依赖',
        nodeTypes: [
          'import_statement', 'import_declaration', 'use_declaration',
          'preproc_include', 'require_statement', 'import_expression'
        ],
        priority: 4,
        isCore: true,
        supportedLanguages: [],
        category: 'import',
        dependencies: [],
        tags: ['core', 'import', 'dependency']
      },
      {
        name: 'exports',
        description: '导出语句和公开接口',
        nodeTypes: [
          'export_statement', 'export_declaration', 'export_default_declaration',
          'export_clause'
        ],
        priority: 5,
        isCore: true,
        supportedLanguages: [],
        category: 'export',
        dependencies: [],
        tags: ['core', 'export', 'interface']
      },
      {
        name: 'variables',
        description: '变量声明和赋值',
        nodeTypes: [
          'variable_declaration', 'var_declaration', 'let_declaration',
          'assignment_expression', 'local_variable_declaration',
          'variable_assignment', 'declaration', 'const_declaration',
          'identifier'
        ],
        priority: 6,
        isCore: true,
        supportedLanguages: [],
        category: 'structure',
        dependencies: [],
        tags: ['core', 'structure', 'data']
      },
      {
        name: 'types',
        description: '类型定义和别名',
        nodeTypes: [
          'type_declaration', 'type_definition', 'type_alias_declaration',
          'typedef', 'type_annotation', 'generic_type', 'type_identifier'
        ],
        priority: 7,
        isCore: true,
        supportedLanguages: [],
        category: 'type',
        dependencies: [],
        tags: ['core', 'type', 'structure']
      },
      {
        name: 'interfaces',
        description: '接口定义和协议',
        nodeTypes: [
          'interface_declaration', 'interface_definition', 'trait_item',
          'interface_type', 'protocol_declaration'
        ],
        priority: 8,
        isCore: true,
        supportedLanguages: [],
        category: 'type',
        dependencies: [],
        tags: ['core', 'type', 'interface']
      },
      {
        name: 'properties',
        description: '属性和字段定义',
        nodeTypes: [
          'field_declaration', 'property_definition', 'public_field_definition',
          'property_declaration', 'member_declaration', 'property_identifier'
        ],
        priority: 9,
        isCore: true,
        supportedLanguages: [],
        category: 'structure',
        dependencies: ['classes'],
        tags: ['core', 'structure', 'data']
      },
      {
        name: 'controlFlow',
        description: '控制流语句',
        nodeTypes: [
          'if_statement', 'for_statement', 'while_statement', 'do_statement',
          'switch_statement', 'try_statement', 'catch_clause', 'finally_clause',
          'conditional_expression', 'ternary_expression'
        ],
        priority: 10,
        isCore: false,
        supportedLanguages: [],
        category: 'flow',
        dependencies: [],
        tags: ['flow', 'control']
      },
      {
        name: 'expression',
        description: '表达式和运算',
        nodeTypes: [
          'binary_expression', 'unary_expression', 'call_expression',
          'member_expression', 'assignment_expression', 'update_expression',
          'new_expression', 'await_expression'
        ],
        priority: 11,
        isCore: false,
        supportedLanguages: [],
        category: 'behavior',
        dependencies: [],
        tags: ['expression', 'behavior']
      },
      {
        name: 'decorator',
        description: '装饰器和注解',
        nodeTypes: [
          'decorator', 'annotation', 'attribute'
        ],
        priority: 12,
        isCore: false,
        supportedLanguages: ['typescript', 'python', 'java', 'csharp'],
        category: 'custom',
        dependencies: ['functions', 'classes'],
        tags: ['decorator', 'annotation', 'metadata']
      }
    ];

    // 注册核心查询类型
    for (const config of coreQueryTypes) {
      this.registerQueryType(config);
    }

    // 注册复合查询类型
    this.registerCompoundQuery({
      name: 'functions-types',
      description: '函数和类型的组合查询',
      queryTypes: ['functions', 'types'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'classes-functions',
      description: '类和函数的组合查询',
      queryTypes: ['classes', 'functions'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'methods-variables',
      description: '方法和变量的组合查询',
      queryTypes: ['methods', 'variables'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'constructors-properties',
      description: '构造函数和属性的组合查询',
      queryTypes: ['methods', 'properties'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'control-flow-patterns',
      description: '控制流模式查询',
      queryTypes: ['controlFlow'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'expressions-control-flow',
      description: '表达式和控制流的组合查询',
      queryTypes: ['expression', 'controlFlow'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'types-decorators',
      description: '类型和装饰器的组合查询',
      queryTypes: ['types', 'decorator'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'variables-imports',
      description: '变量和导入的组合查询',
      queryTypes: ['variables', 'imports'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.initialized = true;
    this.logger.info(`QueryConfigManager 初始化完成，注册了 ${this.queryTypes.size} 种查询类型`);
  }

  /**
   * 注册查询类型
   */
  registerQueryType(config: QueryTypeConfig): void {
    const validation = this.validateQueryTypeConfig(config);
    if (!validation.isValid) {
      throw new Error(`无效的查询类型配置: ${validation.errors.join(', ')}`);
    }

    this.queryTypes.set(config.name, config);
    
    // 更新语言查询类型映射
    for (const language of this.getSupportedLanguagesForQueryType(config)) {
      if (!this.languageQueryTypes.has(language)) {
        this.languageQueryTypes.set(language, new Set());
      }
      this.languageQueryTypes.get(language)!.add(config.name);
    }

    // 清除相关缓存
    this.queryTypeCache.clear();
    
    this.logger.debug(`注册查询类型: ${config.name}`);
  }

  /**
   * 注册复合查询
   */
  registerCompoundQuery(config: CompoundQueryConfig): void {
    const validation = this.validateCompoundQueryConfig(config);
    if (!validation.isValid) {
      throw new Error(`无效的复合查询配置: ${validation.errors.join(', ')}`);
    }

    this.compoundQueries.set(config.name, config);
    this.logger.debug(`注册复合查询: ${config.name}`);
  }

  /**
   * 获取查询类型配置
   */
  getQueryTypeConfig(name: string): QueryTypeConfig | undefined {
    return this.queryTypes.get(name);
  }

  /**
   * 获取复合查询配置
   */
  getCompoundQueryConfig(name: string): CompoundQueryConfig | undefined {
    return this.compoundQueries.get(name);
  }

  /**
   * 获取所有查询类型
   */
  getAllQueryTypes(): string[] {
    return Array.from(this.queryTypes.keys());
  }

  /**
   * 获取核心查询类型
   */
  getCoreQueryTypes(): string[] {
    return Array.from(this.queryTypes.values())
      .filter(config => config.isCore)
      .map(config => config.name)
      .sort((a, b) => {
        const priorityA = this.queryTypes.get(a)!.priority;
        const priorityB = this.queryTypes.get(b)!.priority;
        return priorityA - priorityB;
      });
  }

  /**
   * 获取指定语言支持的查询类型
   */
  getQueryTypesForLanguage(language: string): string[] {
    const cacheKey = `language:${language}`;
    
    // 检查缓存
    const cached = this.queryTypeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const supportedTypes: string[] = [];
    
    for (const [name, config] of this.queryTypes) {
      if (this.isQueryTypeSupportedForLanguage(config, language)) {
        supportedTypes.push(name);
      }
    }

    // 按优先级排序
    supportedTypes.sort((a, b) => {
      const priorityA = this.queryTypes.get(a)!.priority;
      const priorityB = this.queryTypes.get(b)!.priority;
      return priorityA - priorityB;
    });

    // 缓存结果
    this.queryTypeCache.set(cacheKey, supportedTypes);
    
    return supportedTypes;
  }

  /**
   * 获取指定分类的查询类型
   */
  getQueryTypesByCategory(category: QueryTypeConfig['category']): string[] {
    return Array.from(this.queryTypes.values())
      .filter(config => config.category === category)
      .map(config => config.name)
      .sort((a, b) => {
        const priorityA = this.queryTypes.get(a)!.priority;
        const priorityB = this.queryTypes.get(b)!.priority;
        return priorityA - priorityB;
      });
  }

  /**
   * 获取查询类型的节点类型映射
   */
  getQueryTypePatterns(queryType: string): string[] {
    const config = this.queryTypes.get(queryType);
    return config ? config.nodeTypes : [];
  }

  /**
   * 检查查询类型是否支持指定语言
   */
  private isQueryTypeSupportedForLanguage(config: QueryTypeConfig, language: string): boolean {
    // 如果支持的语言列表为空，表示支持所有语言
    if (config.supportedLanguages.length === 0) {
      return true;
    }
    
    return config.supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * 获取查询类型支持的语言列表
   */
  private getSupportedLanguagesForQueryType(config: QueryTypeConfig): string[] {
    if (config.supportedLanguages.length === 0) {
      // 如果没有指定支持的语言，返回所有支持的语言
      return languageMappingManager.getAllSupportedLanguages();
    }
    
    return config.supportedLanguages;
  }

  /**
   * 验证查询类型配置
   */
  private validateQueryTypeConfig(config: QueryTypeConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需字段
    if (!config.name || config.name.trim() === '') {
      errors.push('查询类型名称不能为空');
    }

    if (!config.description || config.description.trim() === '') {
      warnings.push('建议提供查询类型描述');
    }

    if (!config.nodeTypes || config.nodeTypes.length === 0) {
      errors.push('节点类型列表不能为空');
    }

    if (config.priority < 0) {
      errors.push('优先级不能为负数');
    }

    // 检查依赖的查询类型是否存在
    for (const dependency of config.dependencies) {
      if (!this.queryTypes.has(dependency)) {
        warnings.push(`依赖的查询类型 "${dependency}" 不存在`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证复合查询配置
   */
  private validateCompoundQueryConfig(config: CompoundQueryConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需字段
    if (!config.name || config.name.trim() === '') {
      errors.push('复合查询名称不能为空');
    }

    if (!config.queryTypes || config.queryTypes.length === 0) {
      errors.push('查询类型列表不能为空');
    }

    // 检查查询类型是否存在
    for (const queryType of config.queryTypes) {
      if (!this.queryTypes.has(queryType)) {
        errors.push(`查询类型 "${queryType}" 不存在`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.queryTypeCache.clear();
    this.logger.debug('查询配置缓存已清除');
  }

  /**
   * 获取配置统计信息
   */
  getStats() {
    const categoryStats: Record<string, number> = {};
    
    for (const config of this.queryTypes.values()) {
      categoryStats[config.category] = (categoryStats[config.category] || 0) + 1;
    }

    return {
      totalQueryTypes: this.queryTypes.size,
      totalCompoundQueries: this.compoundQueries.size,
      coreQueryTypes: this.getCoreQueryTypes().length,
      categoryStats,
      cacheSize: this.queryTypeCache.size(),
      supportedLanguages: this.languageQueryTypes.size
    };
  }
}

// 导出单例实例
export const queryConfigManager = QueryConfigManager.getInstance();

// 向后兼容的常量导出
export const COMMON_QUERY_TYPES = queryConfigManager.getCoreQueryTypes();
export const BASIC_QUERY_TYPES = ['functions', 'classes'] as const;
export const DEFAULT_QUERY_TYPES = ['functions', 'classes', 'methods', 'imports', 'variables'] as const;
export const COMMON_LANGUAGES = [...languageMappingManager.getAllSupportedLanguages()] as const;

// 动态生成的复合查询类型
export const COMPOUND_QUERY_TYPES = Array.from(queryConfigManager.compoundQueries.values())
  .map(config => ({
    file: config.name,
    queries: config.queryTypes
  }));

// 动态生成的查询模式映射
export const QUERY_PATTERNS: Record<string, string[]> = {};
for (const queryType of queryConfigManager.getAllQueryTypes()) {
  QUERY_PATTERNS[queryType] = queryConfigManager.getQueryTypePatterns(queryType);
}