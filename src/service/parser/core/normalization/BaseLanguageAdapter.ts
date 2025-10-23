/**
 * 基础语言适配器抽象类
 * 提供通用的标准化逻辑和模板方法
 */

import { ILanguageAdapter, StandardizedQueryResult } from './types';
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/LRUCache';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';

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
  /** 额外的语言特定信息 */
  [key: string]: any;
}

/**
 * 基础语言适配器抽象类
 * 实现通用的标准化逻辑，子类只需实现语言特定的方法
 */
export abstract class BaseLanguageAdapter implements ILanguageAdapter {
  protected logger: LoggerService;
  protected options: Required<AdapterOptions>;
  protected performanceMonitor?: PerformanceMonitor;
  protected cache?: LRUCache<string, StandardizedQueryResult[]>;

  constructor(options: AdapterOptions = {}) {
    this.logger = new LoggerService();
    this.options = {
      enableDeduplication: options.enableDeduplication ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      enableErrorRecovery: options.enableErrorRecovery ?? true,
      enableCaching: options.enableCaching ?? true,
      cacheSize: options.cacheSize ?? 100,
      customTypeMappings: options.customTypeMappings ?? {},
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
      this.logger.error(`Normalization failed for ${language}.${queryType}:`, error);
      
      if (this.options.enableErrorRecovery) {
        return this.fallbackNormalization(queryResults, queryType, language);
      }
      
      throw error;
    }
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
        this.logger.warn(`Failed to convert result for ${queryType}:`, error);
        hasErrors = true;
        
        if (!this.options.enableErrorRecovery) {
          throw error;
        }
      }
    }
    
    // 如果启用了错误恢复且有错误，但没有成功的结果，则使用fallback
    if (hasErrors && results.length === 0 && this.options.enableErrorRecovery) {
      // 这里我们不能直接调用fallbackNormalization，因为它需要原始queryResults
      // 所以我们抛出一个特殊错误，让上层处理
      throw new Error('All conversion attempts failed, fallback needed');
    }
    
    return results;
  }

  /**
   * 创建标准化结果
   */
  protected createStandardizedResult(result: any, queryType: string, language: string): StandardizedQueryResult {
    return {
      type: this.mapQueryTypeToStandardType(queryType),
      name: this.extractName(result),
      startLine: this.extractStartLine(result),
      endLine: this.extractEndLine(result),
      content: this.extractContent(result),
      metadata: this.createMetadata(result, language)
    };
  }

  /**
   * 创建元数据
   */
  protected createMetadata(result: any, language: string): QueryResultMetadata {
    const baseMetadata = {
      language,
      complexity: this.calculateComplexity(result),
      dependencies: this.extractDependencies(result),
      modifiers: this.extractModifiers(result)
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
        this.mergeMetadata(seen.get(key)!, result);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * 生成唯一键
   */
  protected generateUniqueKey(result: StandardizedQueryResult): string {
    return `${result.type}:${result.name}:${result.startLine}:${result.endLine}`;
  }

  /**
   * 合并元数据
   */
  protected mergeMetadata(existing: StandardizedQueryResult, newResult: StandardizedQueryResult): void {
    // 合并依赖项
    const mergedDependencies = [
      ...new Set([...existing.metadata.dependencies, ...newResult.metadata.dependencies])
    ];
    
    // 合并修饰符
    const mergedModifiers = [
      ...new Set([...existing.metadata.modifiers, ...newResult.metadata.modifiers])
    ];
    
    existing.metadata.dependencies = mergedDependencies;
    existing.metadata.modifiers = mergedModifiers;
    
    // 合并语言特定元数据
    Object.assign(existing.metadata, newResult.metadata);
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

  protected calculateBaseComplexity(result: any): number {
    let complexity = 1;
    const mainNode = result.captures?.[0]?.node;
    
    if (mainNode) {
      // 基于代码行数
      const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
      complexity += Math.floor(lineCount / 10);
      
      // 基于嵌套深度
      const nestingDepth = this.calculateNestingDepth(mainNode);
      complexity += nestingDepth;
    }
    
    return complexity;
  }

  protected calculateNestingDepth(node: any, currentDepth: number = 0): number {
    if (!node || !node.children) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    
    for (const child of node.children) {
      if (this.isBlockNode(child)) {
        const childDepth = this.calculateNestingDepth(child, currentDepth + 1);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }

    return maxDepth;
  }

  protected isBlockNode(node: any): boolean {
    const blockTypes = ['block', 'statement_block', 'class_body', 'interface_body', 'suite'];
    return blockTypes.includes(node.type);
  }

  protected extractBaseDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);
    
    return [...new Set(dependencies)];
  }

  protected findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        const text = child.text;
        if (text && text[0] === text[0].toUpperCase()) {
          dependencies.push(text);
        }
      }
      
      this.findTypeReferences(child, dependencies);
    }
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
      // 确保result不为null或undefined
      const safeResult = result || {};
      return {
        type: 'expression',
        name: `fallback_${index}`,
        startLine: this.extractStartLine(safeResult),
        endLine: this.extractEndLine(safeResult),
        content: this.extractContent(safeResult),
        metadata: {
          language,
          complexity: 1,
          dependencies: [],
          modifiers: []
        }
      };
    });
  }

  // 抽象方法 - 由子类实现
  abstract extractName(result: any): string;
  abstract extractLanguageSpecificMetadata(result: any): Record<string, any>;
  abstract getSupportedQueryTypes(): string[];
  abstract mapNodeType(nodeType: string): string;
  abstract mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression';
  abstract calculateComplexity(result: any): number;
  abstract extractDependencies(result: any): string[];
  abstract extractModifiers(result: any): string[];
}