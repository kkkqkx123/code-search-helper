/**
 * 类型映射工具
 * 提供通用的类型映射和转换功能
 */

import { RelationshipType, RelationshipCategory } from '../types/RelationshipTypes';

/**
 * 类型映射配置接口
 */
export interface TypeMappingConfig {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 默认映射值 */
  defaultValue?: string;
}

/**
 * 类型映射条目接口
 */
export interface TypeMappingEntry<T = string> {
  /** 源类型 */
  sourceType: string;
  /** 目标类型 */
  targetType: T;
  /** 优先级 */
  priority: number;
  /** 适用语言 */
  languages: string[];
  /** 映射规则 */
  rule?: (source: string) => T;
  /** 条件 */
  condition?: (source: string, context?: any) => boolean;
}

/**
 * 类型映射器类
 */
export class TypeMapper<T = string> {
  private mappings: Map<string, TypeMappingEntry<T>[]> = new Map();
  private config: TypeMappingConfig;
  private cache: Map<string, T> = new Map();
  private debugMode: boolean;

  constructor(config: TypeMappingConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 1000,
      debug: config.debug ?? false,
      defaultValue: config.defaultValue
    };
    this.debugMode = this.config.debug;
  }

  /**
   * 添加类型映射
   */
  addMapping(
    sourceType: string,
    targetType: T,
    options: {
      priority?: number;
      languages?: string[];
      rule?: (source: string) => T;
      condition?: (source: string, context?: any) => boolean;
    } = {}
  ): this {
    const entry: TypeMappingEntry<T> = {
      sourceType,
      targetType,
      priority: options.priority ?? 100,
      languages: options.languages ?? ['*'],
      rule: options.rule,
      condition: options.condition
    };

    if (!this.mappings.has(sourceType)) {
      this.mappings.set(sourceType, []);
    }

    const entries = this.mappings.get(sourceType)!;
    entries.push(entry);

    // 按优先级排序
    entries.sort((a, b) => a.priority - b.priority);

    this.logDebug(`Mapping added: ${sourceType} -> ${targetType}`, entry);
    return this;
  }

  /**
   * 批量添加类型映射
   */
  addMappings(mappings: Array<{
    sourceType: string;
    targetType: T;
    priority?: number;
    languages?: string[];
    rule?: (source: string) => T;
    condition?: (source: string, context?: any) => boolean;
  }>): this {
    for (const mapping of mappings) {
      this.addMapping(
        mapping.sourceType,
        mapping.targetType,
        {
          priority: mapping.priority,
          languages: mapping.languages,
          rule: mapping.rule,
          condition: mapping.condition
        }
      );
    }
    return this;
  }

  /**
   * 移除类型映射
   */
  removeMapping(sourceType: string, targetType: T): boolean {
    const entries = this.mappings.get(sourceType);
    if (!entries) {
      return false;
    }

    const initialLength = entries.length;
    const filteredEntries = entries.filter(entry => entry.targetType !== targetType);
    
    if (filteredEntries.length !== initialLength) {
      this.mappings.set(sourceType, filteredEntries);
      this.logDebug(`Mapping removed: ${sourceType} -> ${targetType}`);
      return true;
    }

    return false;
  }

  /**
   * 映射类型
   */
  mapType(sourceType: string, language: string = '*', context?: any): T | undefined {
    // 生成缓存键
    const cacheKey = `${sourceType}:${language}:${JSON.stringify(context)}`;
    
    // 检查缓存
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      this.logDebug(`Type mapping cache hit: ${sourceType}`, {
        language,
        result: this.cache.get(cacheKey)
      });
      return this.cache.get(cacheKey);
    }

    // 查找映射
    const entries = this.mappings.get(sourceType);
    if (!entries || entries.length === 0) {
      this.logDebug(`No mappings found for type: ${sourceType}`);
      const result = this.config.defaultValue as T | undefined;
      if (this.config.enableCache) {
        this.manageCacheSize();
        this.cache.set(cacheKey, result!);
      }
      return result;
    }

    // 过滤和排序映射条目
    const filteredEntries = entries
      .filter(entry => 
        entry.languages.includes('*') || 
        entry.languages.includes(language) ||
        entry.languages.some(lang => language.startsWith(lang + '.')) // 支持语言版本匹配
      )
      .filter(entry => 
        !entry.condition || entry.condition(sourceType, context)
      );

    if (filteredEntries.length === 0) {
      this.logDebug(`No matching mappings found for type: ${sourceType} in language: ${language}`);
      const result = this.config.defaultValue as T | undefined;
      if (this.config.enableCache) {
        this.manageCacheSize();
        this.cache.set(cacheKey, result!);
      }
      return result;
    }

    // 按优先级排序
    filteredEntries.sort((a, b) => a.priority - b.priority);

    // 应用规则或返回目标类型
    const entry = filteredEntries[0];
    let result: T;

    if (entry.rule) {
      try {
        result = entry.rule(sourceType);
      } catch (error) {
        this.logError(`Rule execution failed for type: ${sourceType}`, error as Error);
        result = entry.targetType;
      }
    } else {
      result = entry.targetType;
    }

    // 存储到缓存
    if (this.config.enableCache) {
      this.manageCacheSize();
      this.cache.set(cacheKey, result);
    }

    this.logDebug(`Type mapped: ${sourceType} -> ${result}`, {
      language,
      priority: entry.priority
    });

    return result;
  }

  /**
   * 批量映射类型
   */
  mapTypes(sourceTypes: string[], language: string = '*', context?: any): Array<{ source: string; target: T | undefined }> {
    return sourceTypes.map(sourceType => ({
      source: sourceType,
      target: this.mapType(sourceType, language, context)
    }));
  }

  /**
   * 获取所有映射
   */
  getAllMappings(): Map<string, TypeMappingEntry<T>[]> {
    return new Map(this.mappings);
  }

  /**
   * 获取特定源类型的映射
   */
  getMappingsForType(sourceType: string): TypeMappingEntry<T>[] {
    return this.mappings.get(sourceType) || [];
  }

  /**
   * 检查是否存在映射
   */
  hasMapping(sourceType: string): boolean {
    return this.mappings.has(sourceType) && this.mappings.get(sourceType)!.length > 0;
  }

  /**
   * 清空特定类型的映射
   */
  clearMappingsForType(sourceType: string): boolean {
    const removed = this.mappings.delete(sourceType);
    if (removed) {
      this.logDebug(`Mappings cleared for type: ${sourceType}`);
    }
    return removed;
  }

  /**
   * 清空所有映射
   */
  clearAllMappings(): void {
    this.mappings.clear();
    this.clearCache();
    this.logDebug('All mappings cleared');
  }

  /**
   * 管理缓存大小
   */
  private manageCacheSize(): void {
    if (this.cache.size >= this.config.cacheSize!) {
      // 简单的LRU：删除第一个元素
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logDebug('Type mapping cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize!
    };
  }

  /**
   * 获取映射统计
   */
  getStats(): {
    totalMappings: number;
    uniqueSourceTypes: number;
    cacheStats: { size: number; maxSize: number };
    config: TypeMappingConfig;
  } {
    let totalMappings = 0;
    for (const entries of this.mappings.values()) {
      totalMappings += entries.length;
    }

    return {
      totalMappings,
      uniqueSourceTypes: this.mappings.size,
      cacheStats: this.getCacheStats(),
      config: { ...this.config }
    };
  }

  /**
   * 导出映射配置
   */
  exportConfig(): Array<{
    sourceType: string;
    targetType: T;
    priority: number;
    languages: string[];
  }> {
    const exported: Array<{
      sourceType: string;
      targetType: T;
      priority: number;
      languages: string[];
    }> = [];

    for (const [sourceType, entries] of this.mappings) {
      for (const entry of entries) {
        exported.push({
          sourceType,
          targetType: entry.targetType,
          priority: entry.priority,
          languages: [...entry.languages]
        });
      }
    }

    return exported;
  }

  /**
   * 导入映射配置
   */
  importConfig(config: Array<{
    sourceType: string;
    targetType: T;
    priority?: number;
    languages?: string[];
  }>): void {
    this.clearAllMappings();

    for (const mapping of config) {
      this.addMapping(
        mapping.sourceType,
        mapping.targetType,
        {
          priority: mapping.priority,
          languages: mapping.languages
        }
      );
    }

    this.logDebug('Configuration imported', {
      mappings: config.length
    });
  }

  /**
   * 验证映射配置
   */
  validateConfig(config: Array<{
    sourceType: string;
    targetType: T;
    priority?: number;
    languages?: string[];
  }>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const mapping of config) {
      if (!mapping.sourceType) {
        errors.push('Source type is required');
      }
      if (mapping.priority !== undefined && mapping.priority < 0) {
        errors.push('Priority must be a non-negative number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 合并另一个映射器的配置
   */
  merge(other: TypeMapper<T>): this {
    const otherConfig = other.exportConfig();
    
    for (const mapping of otherConfig) {
      this.addMapping(
        mapping.sourceType,
        mapping.targetType,
        {
          priority: mapping.priority,
          languages: mapping.languages
        }
      );
    }

    this.logDebug('Mapper merged', {
      mappings: otherConfig.length
    });

    return this;
  }

  /**
   * 克隆映射器
   */
  clone(): TypeMapper<T> {
    const cloned = new TypeMapper<T>(this.config);
    const config = this.exportConfig();
    cloned.importConfig(config);
    return cloned;
  }

  /**
   * 记录调试信息
   */
  private logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[TypeMapper] ${message}`, data);
    }
  }

  /**
   * 记录错误信息
   */
  private logError(message: string, error?: Error): void {
    console.error(`[TypeMapper] ${message}`, error);
  }

  /**
   * 记录警告信息
   */
  private logWarning(message: string, data?: any): void {
    console.warn(`[TypeMapper] ${message}`, data);
  }
}

/**
 * 节点类型映射器
 */
export class NodeTypeMapper extends TypeMapper<string> {
  constructor(config: TypeMappingConfig = {}) {
    super(config);
  }

  /**
   * 添加标准节点类型映射
   */
  addStandardMappings(language: string): this {
    const standardMappings = [
      // 函数相关
      { sourceType: 'function_declaration', targetType: 'function' },
      { sourceType: 'method_declaration', targetType: 'method' },
      { sourceType: 'func_literal', targetType: 'lambda' },
      { sourceType: 'function_type', targetType: 'type' },
      
      // 类型相关
      { sourceType: 'type_declaration', targetType: 'class' },
      { sourceType: 'struct_type', targetType: 'struct' },
      { sourceType: 'interface_type', targetType: 'interface' },
      { sourceType: 'type_alias', targetType: 'type' },
      { sourceType: 'type_identifier', targetType: 'type' },
      { sourceType: 'field_declaration', targetType: 'field' },
      { sourceType: 'field_identifier', targetType: 'field' },
      
      // 导入相关
      { sourceType: 'import_declaration', targetType: 'import' },
      { sourceType: 'import_spec', targetType: 'import' },
      { sourceType: 'package_clause', targetType: 'package' },
      
      // 变量相关
      { sourceType: 'var_declaration', targetType: 'variable' },
      { sourceType: 'var_spec', targetType: 'variable' },
      { sourceType: 'const_declaration', targetType: 'constant' },
      { sourceType: 'const_spec', targetType: 'constant' },
      { sourceType: 'assignment_statement', targetType: 'assignment' },
      { sourceType: 'short_var_declaration', targetType: 'assignment' },
      { sourceType: 'parameter_declaration', targetType: 'parameter' },
      
      // 控制流
      { sourceType: 'if_statement', targetType: 'control_flow' },
      { sourceType: 'for_statement', targetType: 'control_flow' },
      { sourceType: 'return_statement', targetType: 'control_flow' },
      { sourceType: 'break_statement', targetType: 'control_flow' },
      { sourceType: 'continue_statement', targetType: 'control_flow' },
      
      // 表达式
      { sourceType: 'call_expression', targetType: 'call' },
      { sourceType: 'selector_expression', targetType: 'selector' },
      { sourceType: 'composite_literal', targetType: 'literal' },
      { sourceType: 'binary_expression', targetType: 'binary' },
      { sourceType: 'unary_expression', targetType: 'unary' },
      
      // 字面量
      { sourceType: 'string_literal', targetType: 'string' },
      { sourceType: 'int_literal', targetType: 'literal' },
      { sourceType: 'float_literal', targetType: 'literal' },
      { sourceType: 'true', targetType: 'literal' },
      { sourceType: 'false', targetType: 'literal' },
      { sourceType: 'nil', targetType: 'literal' }
    ];

    // 为每种映射添加语言前缀
    const prefixedMappings = standardMappings.map(mapping => ({
      ...mapping,
      languages: [language]
    }));

    return this.addMappings(prefixedMappings);
  }
}

/**
 * 查询类型映射器
 */
export class QueryTypeMapper extends TypeMapper<string> {
  constructor(config: TypeMappingConfig = {}) {
    super(config);
  }

  /**
   * 添加标准查询类型映射
   */
  addStandardMappings(language: string): this {
    const standardMappings = [
      // 实体类型
      { sourceType: 'functions', targetType: 'function' },
      { sourceType: 'methods', targetType: 'method' },
      { sourceType: 'types', targetType: 'class' },
      { sourceType: 'variables', targetType: 'variable' },
      { sourceType: 'constants', targetType: 'constant' },
      { sourceType: 'imports', targetType: 'import' },
      
      // 关系类型
      { sourceType: 'calls', targetType: 'call' },
      { sourceType: 'references', targetType: 'reference' },
      { sourceType: 'inheritance', targetType: 'inheritance' },
      { sourceType: 'dependencies', targetType: 'dependency' },
      
      // 控制流类型
      { sourceType: 'control_flow', targetType: 'control-flow' },
      { sourceType: 'conditional', targetType: 'control-flow' },
      { sourceType: 'loop', targetType: 'control-flow' },
      
      // 数据流类型
      { sourceType: 'data_flow', targetType: 'data-flow' },
      { sourceType: 'assignments', targetType: 'data-flow' },
      { sourceType: 'parameters', targetType: 'data-flow' }
    ];

    // 为每种映射添加语言前缀
    const prefixedMappings = standardMappings.map(mapping => ({
      ...mapping,
      languages: [language]
    }));

    return this.addMappings(prefixedMappings);
  }
}

/**
 * 关系类型映射器
 */
export class RelationshipTypeMapper extends TypeMapper<RelationshipType> {
  constructor(config: TypeMappingConfig = {}) {
    super(config);
  }

  /**
   * 添加标准关系类型映射
   */
  addStandardMappings(language: string): this {
    const standardMappings = [
      // 数据流关系
      { sourceType: 'variable_assignment', targetType: 'assignment' as RelationshipType },
      { sourceType: 'parameter_passing', targetType: 'parameter' as RelationshipType },
      { sourceType: 'return_value', targetType: 'return' as RelationshipType },
      { sourceType: 'field_access', targetType: 'field_access' as RelationshipType },
      
      // 控制流关系
      { sourceType: 'conditional', targetType: 'conditional' as RelationshipType },
      { sourceType: 'loop', targetType: 'loop' as RelationshipType },
      { sourceType: 'exception', targetType: 'exception' as RelationshipType },
      { sourceType: 'callback', targetType: 'callback' as RelationshipType },
      
      // 语义关系
      { sourceType: 'implements', targetType: 'implements' as RelationshipType },
      { sourceType: 'extends', targetType: 'extends' as RelationshipType },
      { sourceType: 'overrides', targetType: 'overrides' as RelationshipType },
      
      // 生命周期关系
      { sourceType: 'instantiates', targetType: 'instantiates' as RelationshipType },
      { sourceType: 'destroys', targetType: 'destroys' as RelationshipType },
      
      // 并发关系
      { sourceType: 'synchronizes', targetType: 'synchronizes' as RelationshipType },
      { sourceType: 'communicates', targetType: 'communicates' as RelationshipType }
    ];

    // 为每种映射添加语言前缀
    const prefixedMappings = standardMappings.map(mapping => ({
      ...mapping,
      languages: [language]
    }));

    return this.addMappings(prefixedMappings);
  }
}

/**
 * 全局类型映射器实例
 */
export const globalNodeTypeMapper = new NodeTypeMapper();
export const globalQueryTypeMapper = new QueryTypeMapper();
export const globalRelationshipTypeMapper = new RelationshipTypeMapper();

/**
 * 便捷函数：映射节点类型
 */
export function mapNodeType(sourceType: string, language: string = '*'): string | undefined {
  return globalNodeTypeMapper.mapType(sourceType, language);
}

/**
 * 便捷函数：映射查询类型
 */
export function mapQueryType(sourceType: string, language: string = '*'): string | undefined {
  return globalQueryTypeMapper.mapType(sourceType, language);
}

/**
 * 便捷函数：映射关系类型
 */
export function mapRelationshipType(sourceType: string, language: string = '*'): RelationshipType | undefined {
  return globalRelationshipTypeMapper.mapType(sourceType, language);
}