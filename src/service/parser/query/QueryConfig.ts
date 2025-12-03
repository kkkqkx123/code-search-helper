/**
 * 简化的查询配置系统
 * 支持运行时配置更新、验证和性能优化
 * 使用新的实体和关系类型定义体系
 */

import { languageMappingManager } from '../config/LanguageMappingManager';
import { LoggerService } from '../../../utils/LoggerService';
import {
  EntityType,
  RelationshipCategory,
  RelationshipType,
  EntityTypeRegistry,
  RelationshipTypeRegistry,
  EntityQueryBuilderFactory,
  RelationshipQueryBuilderFactory
} from './types/index';

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
  category: 'entity' | 'relationship' | 'structure' | 'behavior' | 'type' | 'import' | 'export' | 'flow' | 'custom';

  /** 关联的实体类型（如果适用） */
  entityTypes?: EntityType[];

  /** 关联的关系类型（如果适用） */
  relationshipTypes?: RelationshipType[];

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
 * 简化的查询配置管理器
 */
export class QueryConfigManager {
  private static instance: QueryConfigManager;
  private queryTypes: Map<string, QueryTypeConfig> = new Map();
  private compoundQueries: Map<string, CompoundQueryConfig> = new Map();
  private logger: LoggerService;
  private initialized = false;
  private entityRegistry: EntityTypeRegistry;
  private relationshipRegistry: RelationshipTypeRegistry;

  private constructor() {
    this.logger = new LoggerService();
    this.entityRegistry = EntityTypeRegistry.getInstance();
    this.relationshipRegistry = RelationshipTypeRegistry.getInstance();
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
    // 核心实体查询类型配置
    const entityQueryTypes: QueryTypeConfig[] = [
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
        category: 'entity',
        entityTypes: [EntityType.FUNCTION],
        dependencies: [],
        tags: ['core', 'entity', 'function']
      },
      {
        name: 'types',
        description: '类型定义和别名',
        nodeTypes: [
          'type_declaration', 'type_definition', 'type_alias_declaration',
          'typedef', 'type_annotation', 'generic_type', 'type_identifier',
          'class_declaration', 'class_definition', 'struct_specifier',
          'struct_item', 'union_specifier', 'enum_specifier',
          'interface_type', 'struct_type', 'interface_declaration'
        ],
        priority: 2,
        isCore: true,
        supportedLanguages: [],
        category: 'entity',
        entityTypes: [EntityType.TYPE_DEFINITION],
        dependencies: [],
        tags: ['core', 'entity', 'type']
      },
      {
        name: 'variables',
        description: '变量声明和赋值',
        nodeTypes: [
          'variable_declaration', 'var_declaration', 'let_declaration',
          'assignment_expression', 'local_variable_declaration',
          'variable_assignment', 'declaration', 'const_declaration',
          'identifier', 'field_declaration', 'property_definition'
        ],
        priority: 3,
        isCore: true,
        supportedLanguages: [],
        category: 'entity',
        entityTypes: [EntityType.VARIABLE],
        dependencies: [],
        tags: ['core', 'entity', 'variable']
      },
      {
        name: 'preprocessors',
        description: '预处理器指令和宏定义',
        nodeTypes: [
          'preproc_include', 'preproc_def', 'preproc_function_def',
          'preproc_if', 'preproc_ifdef', 'preproc_else', 'preproc_endif'
        ],
        priority: 4,
        isCore: true,
        supportedLanguages: ['c', 'cpp'],
        category: 'entity',
        entityTypes: [EntityType.PREPROCESSOR],
        dependencies: [],
        tags: ['core', 'entity', 'preprocessor']
      },
      {
        name: 'annotations',
        description: '注解和注释',
        nodeTypes: [
          'decorator', 'annotation', 'attribute', 'comment'
        ],
        priority: 5,
        isCore: true,
        supportedLanguages: ['typescript', 'python', 'java', 'csharp'],
        category: 'entity',
        entityTypes: [EntityType.ANNOTATION],
        dependencies: [],
        tags: ['core', 'entity', 'annotation']
      }
    ];

    // 核心关系查询类型配置
    const relationshipQueryTypes: QueryTypeConfig[] = [
      {
        name: 'calls',
        description: '函数调用关系',
        nodeTypes: [
          'call_expression', 'function_call', 'method_call',
          'function_invocation', 'method_invocation'
        ],
        priority: 1,
        isCore: true,
        supportedLanguages: [],
        category: 'relationship',
        relationshipTypes: [RelationshipType.CALL, RelationshipType.METHOD_CALL],
        dependencies: ['functions'],
        tags: ['core', 'relationship', 'call']
      },
      {
        name: 'dataFlow',
        description: '数据流关系',
        nodeTypes: [
          'assignment_expression', 'parameter_declaration', 'return_statement',
          'binary_expression', 'unary_expression'
        ],
        priority: 2,
        isCore: true,
        supportedLanguages: [],
        category: 'relationship',
        relationshipTypes: [RelationshipType.ASSIGNMENT, RelationshipType.PARAMETER_PASSING, RelationshipType.RETURN_VALUE],
        dependencies: ['functions', 'variables'],
        tags: ['core', 'relationship', 'dataflow']
      },
      {
        name: 'controlFlow',
        description: '控制流关系',
        nodeTypes: [
          'if_statement', 'for_statement', 'while_statement', 'do_statement',
          'switch_statement', 'try_statement', 'catch_clause', 'finally_clause',
          'conditional_expression', 'ternary_expression', 'goto_statement'
        ],
        priority: 3,
        isCore: true,
        supportedLanguages: [],
        category: 'relationship',
        relationshipTypes: [RelationshipType.CONDITIONAL, RelationshipType.LOOP, RelationshipType.JUMP],
        dependencies: [],
        tags: ['core', 'relationship', 'controlflow']
      },
      {
        name: 'dependencies',
        description: '依赖关系',
        nodeTypes: [
          'import_statement', 'import_declaration', 'use_declaration',
          'preproc_include', 'require_statement', 'import_expression'
        ],
        priority: 4,
        isCore: true,
        supportedLanguages: [],
        category: 'relationship',
        relationshipTypes: [RelationshipType.INCLUDE, RelationshipType.TYPE_REFERENCE, RelationshipType.FUNCTION_REFERENCE],
        dependencies: [],
        tags: ['core', 'relationship', 'dependency']
      },
      {
        name: 'inheritance',
        description: '继承关系',
        nodeTypes: [
          'class_declaration', 'interface_declaration', 'extends_clause',
          'implements_clause', 'struct_specifier', 'inheritance_specifier'
        ],
        priority: 5,
        isCore: true,
        supportedLanguages: [],
        category: 'relationship',
        relationshipTypes: [RelationshipType.EXTENDS, RelationshipType.IMPLEMENTS, RelationshipType.COMPOSITION],
        dependencies: ['types'],
        tags: ['core', 'relationship', 'inheritance']
      }
    ];

    // 注册所有查询类型
    for (const config of [...entityQueryTypes, ...relationshipQueryTypes]) {
      this.registerQueryType(config);
    }

    // 注册复合查询类型
    this.registerCompoundQuery({
      name: 'entity-relationships',
      description: '实体和关系的组合查询',
      queryTypes: ['functions', 'types', 'variables', 'calls', 'dataFlow'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'function-analysis',
      description: '函数分析组合查询',
      queryTypes: ['functions', 'calls', 'dataFlow', 'controlFlow'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'type-analysis',
      description: '类型分析组合查询',
      queryTypes: ['types', 'inheritance', 'dependencies'],
      mergeStrategy: 'union',
      supportedLanguages: []
    });

    this.registerCompoundQuery({
      name: 'dependency-analysis',
      description: '依赖分析组合查询',
      queryTypes: ['dependencies', 'references', 'inheritance'],
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
   * 获取实体查询类型
   */
  getEntityQueryTypes(): string[] {
    return Array.from(this.queryTypes.values())
      .filter(config => config.category === 'entity')
      .map(config => config.name)
      .sort((a, b) => {
        const priorityA = this.queryTypes.get(a)!.priority;
        const priorityB = this.queryTypes.get(b)!.priority;
        return priorityA - priorityB;
      });
  }

  /**
   * 获取关系查询类型
   */
  getRelationshipQueryTypes(): string[] {
    return Array.from(this.queryTypes.values())
      .filter(config => config.category === 'relationship')
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
   * 获取查询类型关联的实体类型
   */
  getQueryTypeEntityTypes(queryType: string): EntityType[] {
    const config = this.queryTypes.get(queryType);
    return config?.entityTypes || [];
  }

  /**
   * 获取查询类型关联的关系类型
   */
  getQueryTypeRelationshipTypes(queryType: string): RelationshipType[] {
    const config = this.queryTypes.get(queryType);
    return config?.relationshipTypes || [];
  }

  /**
   * 检查查询类型是否支持指定语言
   */
  private isQueryTypeSupportedForLanguage(config: QueryTypeConfig, language: string): boolean {
    if (!config.supportedLanguages || config.supportedLanguages.length === 0) {
      return true;
    }
    return config.supportedLanguages.includes(language.toLowerCase());
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

    // 验证实体类型
    if (config.entityTypes) {
      for (const entityType of config.entityTypes) {
        if (!Object.values(EntityType).includes(entityType)) {
          warnings.push(`未知的实体类型: ${entityType}`);
        }
      }
    }

    // 验证关系类型
    if (config.relationshipTypes) {
      for (const relationshipType of config.relationshipTypes) {
        if (!Object.values(RelationshipType).includes(relationshipType)) {
          warnings.push(`未知的关系类型: ${relationshipType}`);
        }
      }
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
      entityQueryTypes: this.getEntityQueryTypes().length,
      relationshipQueryTypes: this.getRelationshipQueryTypes().length,
      categoryStats,
      registeredEntityFactories: this.entityRegistry.getRegisteredLanguages().length,
      registeredRelationshipFactories: this.relationshipRegistry.getRegisteredLanguages().length
    };
  }
}

// 导出单例实例
export const queryConfigManager = QueryConfigManager.getInstance();

// 向后兼容的常量导出
export const COMMON_QUERY_TYPES = queryConfigManager.getCoreQueryTypes();
export const ENTITY_QUERY_TYPES = queryConfigManager.getEntityQueryTypes();
export const RELATIONSHIP_QUERY_TYPES = queryConfigManager.getRelationshipQueryTypes();
export const BASIC_QUERY_TYPES = ['functions', 'types'] as const;
export const DEFAULT_QUERY_TYPES = ['functions', 'types', 'variables', 'calls', 'dataFlow'] as const;
export const COMMON_LANGUAGES = [...languageMappingManager.getAllSupportedLanguages()] as const;

/**
 * 获取所有复合查询配置
 */
function getAllCompoundQueries(): CompoundQueryConfig[] {
  const queries: CompoundQueryConfig[] = [];
  const compoundNames = ['entity-relationships', 'function-analysis', 'type-analysis', 'dependency-analysis'];
  for (const name of compoundNames) {
    const config = queryConfigManager.getCompoundQueryConfig(name);
    if (config) {
      queries.push(config);
    }
  }
  return queries;
}

// 动态生成的复合查询类型
export const COMPOUND_QUERY_TYPES = getAllCompoundQueries()
  .map(config => ({
    file: config.name,
    queries: config.queryTypes
  }));

// 动态生成的查询模式映射
export const QUERY_PATTERNS: Record<string, string[]> = {};
for (const queryType of queryConfigManager.getAllQueryTypes()) {
  QUERY_PATTERNS[queryType] = queryConfigManager.getQueryTypeEntityTypes(queryType).map(type => type.toString());
}

// 导出构建器工厂
export { EntityQueryBuilderFactory, RelationshipQueryBuilderFactory };