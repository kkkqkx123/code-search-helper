/**
 * 基础语言适配器抽象类
 * 提供通用的标准化逻辑和模板方法
 */

import { ILanguageAdapter, StandardizedQueryResult } from './types';
import { ExtensibleMetadata } from './types/ExtensibleMetadata';
type StandardType = StandardizedQueryResult['type'];
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/cache/LRUCache';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { MetadataBuilder } from './utils/MetadataBuilder';
import { ContentHashUtils } from '../../../../utils/cache/ContentHashUtils';

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
  private complexityCache?: LRUCache<string, number>;

  constructor(options: AdapterOptions = {}) {
    this.logger = new LoggerService();
    this.options = {
      enableDeduplication: options.enableDeduplication ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      enableErrorRecovery: options.enableErrorRecovery ?? true,
      enableCaching: options.enableCaching ?? true,
      cacheSize: options.cacheSize ?? 10,  // 修复：恢复默认缓存大小为100
      customTypeMappings: options.customTypeMappings ?? {},
    };

    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor(this.logger);
    }

    if (this.options.enableCaching) {
      this.cache = new LRUCache(this.options.cacheSize, { enableStats: true });
      this.complexityCache = new LRUCache(this.options.cacheSize, { enableStats: true });
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
    const astNode = result.captures?.[0]?.node;
    const nodeId = NodeIdGenerator.safeForAstNode(astNode, queryType, this.extractName(result) || 'unknown');

    // Use MetadataBuilder to create enhanced metadata
    const metadataBuilder = this.createMetadataBuilder(result, language);

    return {
      nodeId,
      type: this.mapQueryTypeToStandardType(queryType),
      name: this.extractName(result),
      startLine: this.extractStartLine(result),
      endLine: this.extractEndLine(result),
      content: this.extractContent(result),
      metadata: metadataBuilder.build()
    };
  }

  /**
   * 创建增强的元数据构建器
   */
  protected createMetadataBuilder(result: any, language: string): MetadataBuilder {
    const builder = new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(this.calculateComplexity(result))
      .addDependencies(this.extractDependencies(result))
      .addModifiers(this.extractModifiers(result))
      .setLocation(result.filePath || '', this.extractStartLine(result), this.extractStartColumn(result) || 0)
      .setRange(
        this.extractStartLine(result),
        this.extractEndLine(result),
        this.extractStartColumn(result) || 0,
        this.extractEndColumn(result) || 0
      )
      .setCodeSnippet(this.extractContent(result));

    const languageSpecificMetadata = this.extractLanguageSpecificMetadata(result);

    // Add language-specific metadata as custom fields
    builder.addCustomFields(languageSpecificMetadata);

    return builder;
  }

  /**
   * 提取起始列号
   */
  protected extractStartColumn(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    return mainNode?.startPosition?.column || 0;
  }

  /**
   * 提取结束列号
   */
  protected extractEndColumn(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    return mainNode?.endPosition?.column || 0;
  }

  /**
   * 创建元数据
   */
  protected createMetadata(result: any, language: string): QueryResultMetadata {
    const builder = new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(this.calculateComplexity(result))
      .addDependencies(this.extractDependencies(result))
      .addModifiers(this.extractModifiers(result));

    const languageSpecificMetadata = this.extractLanguageSpecificMetadata(result);

    // Add language-specific metadata as custom fields
    builder.addCustomFields(languageSpecificMetadata);

    return builder.build();
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
    // Use MetadataBuilder to properly merge metadata
    const existingBuilder = MetadataBuilder.fromComplete(existing.metadata);
    const newBuilder = MetadataBuilder.fromComplete(newResult.metadata);

    // Merge the metadata using the builder's merge method
    existingBuilder.merge(newBuilder);

    // Update the existing result with merged metadata
    existing.metadata = existingBuilder.build();
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
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) return 1;

    // 使用缓存避免重复计算
    const cacheKey = this.getNodeCacheKey(mainNode);
    if (this.complexityCache?.has(cacheKey)) {
      return this.complexityCache.get(cacheKey)!;
    }

    let complexity = 1;

    // 优化的行数计算
    const lineCount = Math.max(1, this.extractEndLine(result) - this.extractStartLine(result) + 1);
    complexity += Math.min(Math.floor(lineCount / 15), 5); // 每15行增加1点复杂度，最多5点

    // 使用迭代而非递归的深度计算
    const nestingDepth = this.calculateNestingDepthIterative(mainNode);
    complexity += Math.min(nestingDepth, 8); // 限制最大深度贡献，最多8点

    // 节点复杂度因素
    const nodeComplexity = this.calculateNodeComplexity(mainNode);
    complexity += Math.min(nodeComplexity, 6); // 限制节点复杂度贡献，最多6点

    // 总体复杂度限制在1-25之间
    complexity = Math.max(1, Math.min(complexity, 25));

    // 缓存结果
    if (this.complexityCache) {
      this.complexityCache.set(cacheKey, complexity);
    }

    return complexity;
  }

  protected calculateNestingDepth(node: any, currentDepth: number = 0): number {
    // 使用新的迭代方法来计算嵌套深度
    return this.calculateNestingDepthIterative(node);
  }

  /**
   * 使用广度优先迭代算法计算嵌套深度
   * 替代原有的递归实现，避免栈溢出
   */
  protected calculateNestingDepthIterative(startNode: any): number {
    if (!startNode || !startNode.children) {
      return 0;
    }

    let maxDepth = 0;
    const queue: Array<{ node: any, depth: number }> = [];
    queue.push({ node: startNode, depth: 0 });

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      maxDepth = Math.max(maxDepth, depth);

      if (node.children && depth < 15) { // 设置合理的深度上限
        for (const child of node.children) {
          if (this.isBlockNode(child)) {
            queue.push({ node: child, depth: depth + 1 });
          }
        }
      }
    }

    return maxDepth;
  }

  protected isBlockNode(node: any): boolean {
    const blockTypes = [
      'block', 'statement_block', 'class_body', 'interface_body', 'suite',
      'function_definition', 'method_definition', 'class_definition',
      'if_statement', 'for_statement', 'while_statement',
      'switch_statement', 'try_statement', 'catch_clause',
      'object_expression', 'array_expression'
    ];

    return blockTypes.includes(node.type);
  }

  /**
   * 计算节点结构复杂度
   * 考虑：块节点数量、嵌套模式复杂度
   */
  private calculateNodeComplexity(node: any): number {
    let nodeScore = 0;
    let blockNodeCount = 0;

    // 使用迭代方式统计块节点数量
    const nodeQueue: any[] = [node];
    const visited = new Set<any>();

    while (nodeQueue.length > 0) {
      const currentNode = nodeQueue.shift()!;

      if (visited.has(currentNode)) {
        continue;
      }
      visited.add(currentNode);

      if (this.isBlockNode(currentNode)) {
        blockNodeCount++;
      }

      if (currentNode.children) {
        for (const child of currentNode.children) {
          if (!visited.has(child)) {
            nodeQueue.push(child);
          }
        }
      }
    }

    // 基于块节点数量的复杂度加成
    if (blockNodeCount > 20) {
      nodeScore += 3;
    } else if (blockNodeCount > 10) {
      nodeScore += 2;
    } else if (blockNodeCount > 5) {
      nodeScore += 1;
    }

    return nodeScore;
  }

  /**
    * 生成节点缓存键
    */
  private getNodeCacheKey(node: any): string {
    if (node.id) {
      return `${node.type}:${node.id}`;
    }
    if (node.startPosition && node.endPosition) {
      return `${node.type}:${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}`;
    }
    return `${node.type}:${Math.random().toString(36).substr(2, 9)}`;
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
    return ContentHashUtils.generateContentHash(str);
  }

  /**
   * 降级标准化
   */
  protected fallbackNormalization(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    this.logger.warn(`Using fallback normalization for ${language}.${queryType}`);

    return queryResults.slice(0, 10).map((result, index) => {
      // 确保result不为null或undefined
      const safeResult = result || {};
      const nodeId = NodeIdGenerator.forFallback(language, `result_${index}`);
      const builder = new MetadataBuilder()
        .setLanguage(language)
        .setComplexity(1)
        .addDependencies([])
        .addModifiers([])
        .setFlag('isFallback', true)  // 添加标记表示这是降级的结果
        .setTimestamp('fallbackTime', Date.now()); // 添加时间戳

      return {
        nodeId,
        type: 'expression',
        name: `fallback_${index}`,
        startLine: this.extractStartLine(safeResult),
        endLine: this.extractEndLine(safeResult),
        content: this.extractContent(safeResult),
        metadata: builder.build()
      };
    });
  }

  // 抽象方法 - 由子类实现
  abstract extractName(result: any): string;
  abstract extractLanguageSpecificMetadata(result: any): Record<string, any>;
  abstract getSupportedQueryTypes(): string[];
  abstract mapNodeType(nodeType: string): string;
  abstract mapQueryTypeToStandardType(queryType: string): StandardType;
  abstract calculateComplexity(result: any): number;
  abstract extractDependencies(result: any): string[];
  abstract extractModifiers(result: any): string[];

  // 高级关系提取方法 - 可选实现
  extractDataFlowRelationships?(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }>;

  extractControlFlowRelationships?(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }>;

  extractSemanticRelationships?(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }>;

  extractLifecycleRelationships?(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }>;

  extractConcurrencyRelationships?(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }>;
}