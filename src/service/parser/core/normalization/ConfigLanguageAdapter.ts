/**
 * 配置语言适配器基类
 * 为TOML、YAML等配置语言提供通用的标准化逻辑
 */

import { ILanguageAdapter, StandardizedQueryResult } from './types';
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/LRUCache';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';

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
 * 配置语言适配器抽象基类
 * 为配置语言提供通用的标准化逻辑
 */
export abstract class ConfigLanguageAdapter implements ILanguageAdapter {
  protected logger: LoggerService;
  protected options: Required<ConfigAdapterOptions>;
  protected performanceMonitor?: PerformanceMonitor;
  protected cache?: LRUCache<string, StandardizedQueryResult[]>;

  constructor(options: ConfigAdapterOptions = {}) {
    this.logger = new LoggerService();
    this.options = {
      enableDeduplication: options.enableDeduplication ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      enableErrorRecovery: options.enableErrorRecovery ?? true,
      enableCaching: options.enableCaching ?? true,
      cacheSize: options.cacheSize ?? 100,
      customTypeMappings: options.customTypeMappings ?? {},
      enableConfigPathParsing: options.enableConfigPathParsing ?? true,
      enableDataTypeInference: options.enableDataTypeInference ?? true,
    };

    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor(this.logger);
    }

    if (this.options.enableCaching) {
      this.cache = new LRUCache(this.options.cacheSize, { enableStats: true });
    }
  }

  /**
   * 主标准化方法 - 模板方法模式
   */
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(queryResults, queryType, language);

    // 检查缓存
    if (this.cache?.has(cacheKey)) {
      this.performanceMonitor?.updateCacheHitRate(true);
      return this.cache.get(cacheKey)!;
    }

    try {
      // 1. 预处理查询结果
      const preprocessedResults = this.preprocessResults(queryResults);

      // 2. 转换为标准化结果
      const standardizedResults = this.convertToStandardizedResults(preprocessedResults, queryType, language);

      // 3. 后处理（去重、排序等）
      const finalResults = this.postProcessResults(standardizedResults);

      // 4. 缓存结果
      if (this.cache) {
        this.cache.set(cacheKey, finalResults);
      }

      // 5. 性能监控
      if (this.performanceMonitor) {
        this.performanceMonitor.recordQueryExecution(Date.now() - startTime);
        this.performanceMonitor.updateCacheHitRate(false);
      }

      return finalResults;
    } catch (error) {
      this.logger.error(`Config normalization failed for ${language}.${queryType}:`, error);

      if (this.options.enableErrorRecovery) {
        return this.fallbackNormalization(queryResults, queryType, language);
      }

      throw error;
    }
  }

  /**
   * 获取支持的查询类型
   */
  getSupportedQueryTypes(): string[] {
    return [
      'config-items',     // 配置项
      'sections',         // 配置节
      'keys',            // 键
      'values',          // 值
      'arrays',          // 数组
      'tables',          // 表/对象
      'dependencies',    // 依赖关系
      'types'            // 数据类型
    ];
  }

  /**
   * 预处理查询结果
   */
  protected preprocessResults(queryResults: any[]): any[] {
    return queryResults.filter(result =>
      result &&
      result.captures &&
      Array.isArray(result.captures) &&
      result.captures.length > 0 &&
      result.captures[0]?.node
    );
  }

  /**
   * 转换为标准化结果
   */
  protected convertToStandardizedResults(
    preprocessedResults: any[],
    queryType: string,
    language: string
  ): StandardizedQueryResult[] {
    const results: StandardizedQueryResult[] = [];
    let hasErrors = false;

    for (const result of preprocessedResults) {
      try {
        const standardizedResult = this.createStandardizedResult(result, queryType, language);
        results.push(standardizedResult);
      } catch (error) {
        this.logger.warn(`Failed to convert config result for ${queryType}:`, error);
        hasErrors = true;

        if (!this.options.enableErrorRecovery) {
          throw error;
        }
      }
    }

    // 如果启用了错误恢复且有错误，但没有成功的结果，则使用fallback
    if (hasErrors && results.length === 0 && this.options.enableErrorRecovery) {
      throw new Error('All config conversion attempts failed, fallback needed');
    }

    return results;
  }

  /**
  * 创建标准化结果
  */
  protected createStandardizedResult(result: any, queryType: string, language: string): StandardizedQueryResult {
    const type = this.mapQueryTypeToStandardType(queryType);
    const name = this.extractName(result);
    const startLine = this.extractStartLine(result);
    const endLine = this.extractEndLine(result);
    const content = this.extractContent(result);
    const metadata = this.createConfigMetadata(result, language);

    return {
      nodeId: this.generateNodeId(type, name, startLine, endLine, content, language),
      type,
      name,
      startLine,
      endLine,
      content,
      metadata
    };
  }

  /**
   * 创建配置元数据
   */
  protected createConfigMetadata(result: any, language: string): ConfigMetadata {
    const baseMetadata = {
      language,
      complexity: this.calculateComplexity(result),
      dependencies: this.extractDependencies(result),
      modifiers: this.extractModifiers(result),
      dataType: this.extractDataType(result),
      validationRules: this.extractValidationRules(result),
      isRequired: this.isRequired(result),
      configPath: this.extractConfigPath(result),
      nestingDepth: this.calculateNestingDepth(result)
    };

    const languageSpecificMetadata = this.extractLanguageSpecificMetadata(result);

    return {
      ...baseMetadata,
      ...languageSpecificMetadata
    };
  }

  /**
   * 后处理结果
   */
  protected postProcessResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
    let processedResults = results;

    // 1. 去重
    if (this.options.enableDeduplication) {
      processedResults = this.deduplicateResults(processedResults);
    }

    // 2. 按行号排序
    processedResults = processedResults.sort((a, b) => a.startLine - b.startLine);

    // 3. 过滤无效结果
    processedResults = processedResults.filter(result =>
      result &&
      result.name &&
      result.name !== 'unnamed' &&
      result.startLine > 0 &&
      result.endLine >= result.startLine
    );

    return processedResults;
  }

  /**
   * 智能去重
   */
  protected deduplicateResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
    const seen = new Map<string, StandardizedQueryResult>();

    for (const result of results) {
      const key = this.generateUniqueKey(result);

      if (!seen.has(key)) {
        seen.set(key, result);
      } else {
        this.mergeConfigMetadata(seen.get(key)!, result);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * 生成唯一键
   */
  protected generateUniqueKey(result: StandardizedQueryResult): string {
    const configPath = (result.metadata as ConfigMetadata).configPath || '';
    return `${result.type}:${result.name}:${configPath}:${result.startLine}:${result.endLine}`;
  }

  /**
   * 合并配置元数据
   */
  protected mergeConfigMetadata(existing: StandardizedQueryResult, newResult: StandardizedQueryResult): void {
    const existingMeta = existing.metadata as ConfigMetadata;
    const newMeta = newResult.metadata as ConfigMetadata;

    // 合并依赖项
    existingMeta.dependencies = [
      ...new Set([...existingMeta.dependencies, ...newMeta.dependencies])
    ];

    // 合并修饰符
    existingMeta.modifiers = [
      ...new Set([...existingMeta.modifiers, ...newMeta.modifiers])
    ];

    // 合并验证规则
    existingMeta.validationRules = [
      ...new Set([...existingMeta.validationRules, ...newMeta.validationRules])
    ];

    // 合并语言特定元数据
    Object.assign(existingMeta, newMeta);
  }

  // 通用工具方法
  protected extractStartLine(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    return (mainNode?.startPosition?.row || 0) + 1;
  }

  protected extractEndLine(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    return (mainNode?.endPosition?.row || 0) + 1;
  }

  public extractContent(result: any): string {
    const mainNode = result.captures?.[0]?.node;
    return mainNode?.text || '';
  }

  /**
   * 提取配置路径
   */
  protected extractConfigPath(result: any): string {
    if (!this.options.enableConfigPathParsing) {
      return '';
    }

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return '';
    }

    // 尝试从节点中提取配置路径
    return this.buildConfigPath(mainNode) || '';
  }

  /**
   * 构建配置路径
   */
  protected buildConfigPath(node: any): string | null {
    // 子类需要实现具体的路径构建逻辑
    return null;
  }

  /**
   * 提取数据类型
   */
  protected extractDataType(result: any): string {
    if (!this.options.enableDataTypeInference) {
      return 'unknown';
    }

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return 'unknown';
    }

    // 基于节点类型推断数据类型
    return this.inferDataType(mainNode);
  }

  /**
   * 推断数据类型
   */
  protected inferDataType(node: any): string {
    // 子类需要实现具体的数据类型推断逻辑
    return 'unknown';
  }

  /**
   * 提取验证规则
   */
  protected extractValidationRules(result: any): string[] {
    // 子类可以重写此方法来提取特定的验证规则
    return [];
  }

  /**
   * 检查是否必需
   */
  protected isRequired(result: any): boolean {
    // 子类可以重写此方法来检查配置项是否必需
    return false;
  }

  /**
   * 计算嵌套深度
   */
  protected calculateNestingDepth(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return 0;
    }

    return this.calculateNodeDepth(mainNode);
  }

  /**
   * 计算节点深度
   */
  protected calculateNodeDepth(node: any, currentDepth: number = 0): number {
    if (!node || !node.parent) {
      return currentDepth;
    }

    return this.calculateNodeDepth(node.parent, currentDepth + 1);
  }

  /**
  * 生成节点ID
  */
  protected generateNodeId(type: string, name: string, startLine: number, endLine: number, content: string, language: string): string {
    // 生成确定性的节点ID
    const contentHash = this.simpleHash(content);
    return `${language}:${type}:${name}:${startLine}:${endLine}:${contentHash}`;
  }

  /**
   * 生成缓存键
   */
  protected generateCacheKey(queryResults: any[], queryType: string, language: string): string {
    const resultHash = this.hashResults(queryResults);
    return `${language}:${queryType}:${resultHash}`;
  }

  /**
   * 哈希查询结果
   */
  protected hashResults(queryResults: any[]): string {
    const content = queryResults.map(r => r?.captures?.[0]?.node?.text || '').join('|');
    return this.simpleHash(content);
  }

  /**
   * 简单哈希函数
   */
  protected simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 降级标准化
   */
  protected fallbackNormalization(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    this.logger.warn(`Using fallback normalization for ${language}.${queryType}`);

    return queryResults.slice(0, 10).map((result, index) => {
      const safeResult = result || {};
      const type = 'config-item';
      const name = `fallback_config_${index}`;
      const startLine = this.extractStartLine(safeResult);
      const endLine = this.extractEndLine(safeResult);
      const content = this.extractContent(safeResult);
      const metadata = {
        language,
        complexity: 1,
        dependencies: [],
        modifiers: [],
        dataType: 'unknown',
        validationRules: [],
        isRequired: false,
        configPath: '',
        nestingDepth: 0
      };

      return {
        nodeId: this.generateNodeId(type, name, startLine, endLine, content, language),
        type,
        name,
        startLine,
        endLine,
        content,
        metadata
      };
    });
  }

  // 抽象方法 - 由子类实现
  abstract extractName(result: any): string;
  abstract extractLanguageSpecificMetadata(result: any): Record<string, any>;
  abstract mapNodeType(nodeType: string): string;
  abstract mapQueryTypeToStandardType(queryType: string): ConfigStandardType;
  abstract calculateComplexity(result: any): number;
  abstract extractDependencies(result: any): string[];
  abstract extractModifiers(result: any): string[];
}