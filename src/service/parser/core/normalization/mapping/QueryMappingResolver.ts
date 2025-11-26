import {
  QueryMapping,
  MappingConfig,
  RelationshipResult,
  EntityResult,
  MappingResult,
  MappingResolverOptions,
  MappingResolverStats,
  MappingValidationResult,
  MappingValidationError,
  QueryPatternType,
  SupportedLanguage,
  QueryType,
  IMappingResolver
} from './types';
import { ASTProcessor } from './ASTProcessor';

/**
 * 通用查询映射解析器
 * 提供跨语言的统一映射解析逻辑
 */
export class QueryMappingResolver implements IMappingResolver {
  private static mappingCache = new Map<string, QueryMapping[]>();
  private static options: MappingResolverOptions = {
    enableCache: true,
    debug: false,
    cacheSizeLimit: 1000,
    enablePerformanceMonitoring: false
  };

  private static stats: MappingResolverStats = {
    cacheSize: 0,
    cacheKeys: [],
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageProcessingTime: 0
  };

  private language: SupportedLanguage;
  private performanceTimes: number[] = [];
  private astProcessor: ASTProcessor;

  constructor(language: SupportedLanguage) {
    this.language = language;
    this.astProcessor = new ASTProcessor();
  }

  /**
   * 配置映射解析器选项
   */
  static configure(options: MappingResolverOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 根据查询结果解析关系和实体
   */
  async resolve(queryResults: any[], queryType: QueryType): Promise<MappingResult> {
    const startTime = QueryMappingResolver.options.enablePerformanceMonitoring ? Date.now() : 0;

    try {
      QueryMappingResolver.stats.totalQueries++;

      const mappings = await this.getMappings(queryType);
      const result: MappingResult = {
        relationships: [],
        entities: [],
        processedCount: queryResults.length,
        mappedCount: 0,
        errors: []
      };

      for (const queryResult of queryResults) {
        try {
          const mappedResult = this.processQueryResult(queryResult, mappings);
          result.relationships.push(...mappedResult.relationships);
          result.entities.push(...mappedResult.entities);
          result.mappedCount += mappedResult.relationships.length + mappedResult.entities.length;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors?.push(`处理查询结果时出错: ${errorMessage}`);

          if (QueryMappingResolver.options.debug) {
            console.error('处理查询结果出错:', error, queryResult);
          }
        }
      }

      if (QueryMappingResolver.options.enablePerformanceMonitoring) {
        const processingTime = Date.now() - startTime;
        this.updatePerformanceStats(processingTime);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (QueryMappingResolver.options.debug) {
        console.error('映射解析失败:', error);
      }

      return {
        relationships: [],
        entities: [],
        processedCount: queryResults.length,
        mappedCount: 0,
        errors: [`映射解析失败: ${errorMessage}`]
      };
    }
  }

  /**
   * 处理单个查询结果
   */
  private processQueryResult(queryResult: any, mappings: QueryMapping[]): MappingResult {
    const result: MappingResult = {
      relationships: [],
      entities: [],
      processedCount: 1,
      mappedCount: 0
    };

    for (const mapping of mappings) {
      if (this.matchesQueryPattern(queryResult, mapping)) {
        try {
          // 使用ASTProcessor处理映射
          const processedResult = this.astProcessor.process(queryResult, mapping, this.language);

          if (processedResult) {
            if (this.isRelationshipResult(processedResult)) {
              result.relationships.push(processedResult as RelationshipResult);
            } else if (this.isEntityResult(processedResult)) {
              result.entities.push(processedResult as EntityResult);
            }
            result.mappedCount++;
          }
        } catch (error) {
          if (QueryMappingResolver.options.debug) {
            console.error(`处理映射结果失败 (${mapping.queryPattern}):`, error);
          }
        }
      }
    }

    return result;
  }

  /**
   * 获取映射配置（带缓存）
   */
  private async getMappings(queryType: QueryType): Promise<QueryMapping[]> {
    const cacheKey = `${this.language}:${queryType}`;

    if (QueryMappingResolver.options.enableCache && QueryMappingResolver.mappingCache.has(cacheKey)) {
      QueryMappingResolver.stats.cacheHits++;
      return QueryMappingResolver.mappingCache.get(cacheKey)!;
    }

    QueryMappingResolver.stats.cacheMisses++;
    const mappings = await this.loadMappings(queryType);

    if (QueryMappingResolver.options.enableCache) {
      this.addToCache(cacheKey, mappings);
    }

    return mappings;
  }

  /**
   * 添加到缓存，考虑缓存大小限制
   */
  private addToCache(key: string, mappings: QueryMapping[]): void {
    const cacheSizeLimit = QueryMappingResolver.options.cacheSizeLimit || 1000;
    if (QueryMappingResolver.mappingCache.size >= cacheSizeLimit) {
      // 移除最旧的缓存项（简单的LRU实现）
      const firstKey = QueryMappingResolver.mappingCache.keys().next().value;
      if (firstKey) {
        QueryMappingResolver.mappingCache.delete(firstKey);
      }
    }

    QueryMappingResolver.mappingCache.set(key, mappings);
    this.updateCacheStats();
  }

  /**
   * 更新缓存统计信息
   */
  private updateCacheStats(): void {
    QueryMappingResolver.stats.cacheSize = QueryMappingResolver.mappingCache.size;
    QueryMappingResolver.stats.cacheKeys = Array.from(QueryMappingResolver.mappingCache.keys());
  }

  /**
   * 加载映射配置
   */
  private async loadMappings(queryType: QueryType): Promise<QueryMapping[]> {
    try {
      const mappingModule = await import(`./${this.language}/${queryType}`);
      const config: MappingConfig = mappingModule.default ||
        mappingModule[`${queryType.toUpperCase()}_MAPPINGS`] ||
        mappingModule[`${queryType}_MAPPINGS`];

      if (!config || !config.mappings) {
        if (QueryMappingResolver.options.debug) {
          console.warn(`未找到 ${this.language}.${queryType} 的映射配置`);
        }
        return [];
      }

      return config.mappings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    } catch (error) {
      if (QueryMappingResolver.options.debug) {
        console.warn(`加载 ${this.language}.${queryType} 映射配置失败:`, error);
      }
      return [];
    }
  }

  /**
   * 检查查询结果是否匹配模式
   */
  private matchesQueryPattern(result: any, mapping: QueryMapping): boolean {
    const captures = result.captures || [];
    const captureNames = captures.map((c: any) => c.name);

    // 检查是否有匹配的捕获组
    const patternWithoutAt = mapping.queryPattern.replace('@', '');

    // 检查捕获组名称匹配
    const hasMatchingCapture = captureNames.some((name: string) =>
      name.includes(patternWithoutAt) ||
      patternWithoutAt.includes(name)
    );

    // 检查节点文本匹配
    const hasMatchingText = captures.some((capture: any) =>
      capture.node &&
      capture.node.text &&
      capture.node.text.includes(patternWithoutAt)
    );

    return hasMatchingCapture || hasMatchingText;
  }

  /**
   * 提取额外的捕获组信息
   */
  private extractAdditionalCaptures(
    captures: any[],
    captureConfig: any
  ): Record<string, any> {
    const additionalInfo: Record<string, any> = {};
    const excludedKeys = ['source', 'target', 'entityType'];

    for (const capture of captures) {
      if (!excludedKeys.includes(capture.name) &&
        !Object.values(captureConfig).includes(capture.name)) {
        additionalInfo[capture.name] = capture.node?.text || capture.text;
      }
    }

    return additionalInfo;
  }

  /**
   * 验证映射配置
   */
  validateMapping(config: MappingConfig): MappingValidationResult {
    const errors: MappingValidationError[] = [];
    const warnings: string[] = [];

    // 验证必需字段
    if (!config.mappings || !Array.isArray(config.mappings)) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: '映射配置必须包含 mappings 数组'
      });
      return { isValid: false, errors, warnings };
    }

    // 验证每个映射
    for (let i = 0; i < config.mappings.length; i++) {
      const mapping = config.mappings[i];
      const mappingErrors = this.validateSingleMapping(mapping, i);
      errors.push(...mappingErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证单个映射配置
   */
  private validateSingleMapping(mapping: QueryMapping, index: number): MappingValidationError[] {
    const errors: MappingValidationError[] = [];

    // 检查必需字段
    if (!mapping.queryPattern) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: '映射必须包含 queryPattern',
        location: { field: 'queryPattern' }
      });
    }

    if (!mapping.patternType) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: '映射必须包含 patternType',
        location: { field: 'patternType' }
      });
    }

    if (!mapping.captures) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: '映射必须包含 captures',
        location: { field: 'captures' }
      });
    }

    // 根据模式类型验证特定字段
    if (mapping.patternType === QueryPatternType.RELATIONSHIP) {
      if (!mapping.captures.source) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: '关系模式必须包含 source 捕获组',
          location: { field: 'captures.source' }
        });
      }

      if (!mapping.relationship) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: '关系模式必须包含 relationship 定义',
          location: { field: 'relationship' }
        });
      }
    } else if (mapping.patternType === QueryPatternType.ENTITY) {
      if (!mapping.captures.entityType) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: '实体模式必须包含 entityType 捕获组',
          location: { field: 'captures.entityType' }
        });
      }

      if (!mapping.entity) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: '实体模式必须包含 entity 定义',
          location: { field: 'entity' }
        });
      }
    }

    return errors;
  }

  /**
   * 获取可用的查询类型
   */
  getAvailableQueryTypes(): QueryType[] {
    // 这里应该从映射目录中动态获取，暂时返回硬编码列表
    return [
      'lifecycle', 'dependency', 'inheritance', 'call', 'data-flow',
      'control-flow', 'concurrency', 'semantic', 'creation', 'reference',
      'annotation', 'functions', 'variables', 'structs', 'preprocessor',
      'call-expressions', 'function-annotations'
    ];
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    QueryMappingResolver.mappingCache.clear();
    this.updateCacheStats();
  }

  /**
   * 获取统计信息
   */
  getStats(): MappingResolverStats {
    return { ...QueryMappingResolver.stats };
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(processingTime: number): void {
    this.performanceTimes.push(processingTime);

    // 保持最近100次的性能数据
    if (this.performanceTimes.length > 100) {
      this.performanceTimes.shift();
    }

    const averageTime = this.performanceTimes.reduce((sum, time) => sum + time, 0) / this.performanceTimes.length;
    QueryMappingResolver.stats.averageProcessingTime = averageTime;
  }

  /**
   * 静态方法：解析关系（向后兼容）
   */
  static async resolveRelationships(
    queryResults: any[],
    queryType: string,
    language: string
  ): Promise<RelationshipResult[]> {
    const resolver = new QueryMappingResolver(language as SupportedLanguage);

    try {
      const result = await resolver.resolve(queryResults, queryType as QueryType);
      return result.relationships;
    } catch {
      return [];
    }
  }

  /**
   * 类型检查方法
   */
  private isRelationshipResult(item: any): item is RelationshipResult {
    return item && typeof item === 'object' && 'source' in item && 'target' in item;
  }

  private isEntityResult(item: any): item is EntityResult {
    return item && typeof item === 'object' && 'id' in item && 'type' in item;
  }
}