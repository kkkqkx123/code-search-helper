/**
 * 基础语言适配器抽象类
 * 提供通用的标准化逻辑和模板方法
 */

import { ILanguageAdapter, StandardizedQueryResult, SymbolInfo, SymbolTable } from '../../types';
type StandardType = StandardizedQueryResult['type'];
import { LoggerService } from '../../../../../../utils/LoggerService';
import { LRUCache } from '../../../../../../utils/cache/LRUCache';
import { PerformanceMonitor } from '../../../../../../infrastructure/monitoring/PerformanceMonitor';
import { InfrastructureConfigService } from '../../../../../../infrastructure/config/InfrastructureConfigService';
import { MetadataBuilder } from '../../utils/MetadataBuilder';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { CommentAdapterFactory } from '../../comments/adapters/AdapterFactory';
import { QueryResult as CommentQueryResult } from '../../comments/types';
import { RelationshipExtractorManager } from './RelationshipExtractorManager';
import Parser from 'tree-sitter';
import {
  extractStartLine,
  extractEndLine,
  extractContent,
  extractStartColumn,
  extractEndColumn,
  isRelationshipType,
  shouldCreateSymbolInfo,
  mapToSymbolType,
  determineScope,
  isFunctionScope,
  isClassScope,
  extractParameters,
  extractImportPath,
  preprocessResults,
  createStandardizedResult,
  createMetadataBuilder,
  generateUniqueKey,
  mergeMetadata,
  calculateNestingDepthIterative,
  isBlockNode,
  calculateNodeComplexity,
  getNodeCacheKey,
  findTypeReferences,
  hashResults,
  simpleHash
} from '../utils/QueryResultUtils';
import {
  deduplicateResults,
  postProcessResults,
  createErrorResult,
  fallbackNormalization as utilsFallbackNormalization
} from '../utils/PostProcessingUtils';

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
  protected relationshipExtractorManager?: RelationshipExtractorManager;
  protected symbolTable: SymbolTable | null = null;

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
      this.performanceMonitor = new PerformanceMonitor(this.logger, new InfrastructureConfigService(this.logger, {
        get: () => ({}),
        set: () => { },
        has: () => false,
        clear: () => { }
      } as any));
    }

    if (this.options.enableCaching) {
      this.cache = new LRUCache(this.options.cacheSize, { enableStats: true });
      this.complexityCache = new LRUCache(this.options.cacheSize, { enableStats: true });
    }

    // 初始化关系提取器管理器
    this.initializeRelationshipExtractorManager();
  }

  /**
   * 初始化关系提取器管理器
   */
  protected initializeRelationshipExtractorManager(): void {
    const language = this.getLanguage();
    if (language) {
      this.relationshipExtractorManager = new RelationshipExtractorManager(language);
    }
  }

  /**
   * 获取语言标识符
   */
  protected abstract getLanguage(): string;

  /**
   * 主标准化方法 - 增强的模板方法模式
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
      // 1. 初始化符号表和处理上下文
      this.initializeProcessingContext(language);

      // 2. 预处理查询结果
      const preprocessedResults = this.preprocessResults(queryResults);

      // 3. 使用增强的标准化流程
      const standardizedResults = await this.processResultsWithEnhancedFlow(
        preprocessedResults,
        queryType,
        language,
        startTime
      );

      // 4. 后处理（去重、排序等）
      const finalResults = this.postProcessResults(standardizedResults);

      // 5. 缓存结果
      if (this.cache) {
        this.cache.set(cacheKey, finalResults);
      }

      // 6. 性能监控
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
   * 初始化处理上下文
   */
  protected initializeProcessingContext(language: string): void {
    const filePath = this.generateFilePath(language);
    this.symbolTable = {
      filePath,
      globalScope: { symbols: new Map() },
      imports: new Map()
    };
  }

  /**
   * 生成文件路径
   */
  protected generateFilePath(language: string): string {
    const extension = this.getLanguageExtension();
    return `current_file.${extension}`;
  }

  /**
   * 获取语言扩展名
   */
  protected abstract getLanguageExtension(): string;

  /**
   * 增强的结果处理流程
   */
  protected async processResultsWithEnhancedFlow(
    preprocessedResults: any[],
    queryType: string,
    language: string,
    processingStartTime: number
  ): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    for (const result of preprocessedResults) {
      try {
        const standardizedResult = await this.processSingleResult(
          result,
          queryType,
          language,
          processingStartTime
        );
        results.push(standardizedResult);
      } catch (error) {
        this.logger.warn(`Failed to process result for ${queryType}:`, error);

        if (!this.options.enableErrorRecovery) {
          throw error;
        }

        // 创建错误结果
        const errorResult = this.createErrorResult(error, queryType, language);
        results.push(errorResult);
      }
    }

    return results;
  }

  /**
   * 处理单个结果
   */
  protected async processSingleResult(
    result: any,
    queryType: string,
    language: string,
    processingStartTime: number
  ): Promise<StandardizedQueryResult> {
    const standardType = this.mapQueryTypeToStandardType(queryType);
    const name = this.extractName(result);
    const content = this.extractContent(result);
    const complexity = this.calculateComplexity(result);
    const dependencies = this.extractDependencies(result);
    const modifiers = this.extractModifiers(result);
    const extra = this.extractLanguageSpecificMetadata(result);

    // 获取AST节点以生成确定性ID
    const astNode = result.captures?.[0]?.node;
    const nodeId = NodeIdGenerator.safeForAstNode(astNode, standardType, name);

    // 使用 MetadataBuilder 创建增强的元数据
    const builder = this.createMetadataBuilder(result, language)
      .setProcessingStartTime(processingStartTime)
      .addDependencies(dependencies)
      .addModifiers(modifiers)
      .addCustomFields(extra);

    // 如果是关系类型，添加关系元数据
    if (this.isRelationshipType(standardType)) {
      const relationshipMetadata = await this.extractRelationshipMetadata(result, standardType, astNode);
      if (relationshipMetadata) {
        builder.addCustomFields(relationshipMetadata);
      }
    }

    // 创建符号信息（如果需要）
    let symbolInfo: SymbolInfo | null = null;
    if (this.shouldCreateSymbolInfo(standardType)) {
      symbolInfo = this.createSymbolInfo(astNode, name, standardType, this.symbolTable!.filePath);
      if (this.symbolTable && symbolInfo) {
        this.symbolTable.globalScope.symbols.set(name, symbolInfo);
      }
    }

    return {
      nodeId,
      type: standardType,
      name,
      startLine: result.startLine || 1,
      endLine: result.endLine || 1,
      content,
      metadata: builder.build(),
      symbolInfo: symbolInfo || undefined
    };
  }

  /**
   * 检查是否为关系类型
   */
  protected isRelationshipType = isRelationshipType;

  /**
   * 提取关系元数据
   */
  protected async extractRelationshipMetadata(
    result: any,
    standardType: string,
    astNode: Parser.SyntaxNode | undefined
  ): Promise<any> {
    if (!astNode || !this.relationshipExtractorManager) {
      return null;
    }

    return await this.relationshipExtractorManager.extractMetadata(
      result,
      standardType,
      astNode,
      this.symbolTable
    );
  }

  /**
   * 判断是否应该创建符号信息
   */
  protected shouldCreateSymbolInfo = shouldCreateSymbolInfo;

  /**
   * 创建符号信息
   */
  protected createSymbolInfo(
    node: Parser.SyntaxNode | undefined,
    name: string,
    standardType: string,
    filePath: string
  ): SymbolInfo | null {
    if (!name || !node) return null;

    const symbolType = this.mapToSymbolType(standardType);

    const symbolInfo: SymbolInfo = {
      name,
      type: symbolType,
      filePath,
      location: {
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
      },
      scope: this.determineScope(node)
    };

    // 添加参数信息
    if (symbolType === 'function' || symbolType === 'method') {
      symbolInfo.parameters = this.extractParameters(node);
    }

    // 添加导入路径
    if (symbolType === 'import') {
      symbolInfo.sourcePath = this.extractImportPath(node);
    }

    return symbolInfo;
  }

  /**
   * 映射到符号类型
   */
  protected mapToSymbolType = mapToSymbolType;

  /**
   * 确定作用域
   */
  protected determineScope = determineScope;

  /**
   * 检查是否为函数作用域
   */
  protected isFunctionScope = isFunctionScope;

  /**
   * 检查是否为类作用域
   */
  protected isClassScope = isClassScope;

  /**
   * 提取参数
   */
  protected extractParameters = extractParameters;

  /**
   * 提取导入路径
   */
  protected extractImportPath = extractImportPath;

  /**
   * 创建错误结果
   */
  protected createErrorResult = createErrorResult;

  /**
   * 预处理查询结果
   */
  protected preprocessResults = preprocessResults;

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

    // 处理注释 - 只有当查询类型为注释相关时才处理
    if (queryType.includes('comment')) {
      try {
        const commentAdapter = CommentAdapterFactory.getAdapter(language);
        // 将原始的preprocessedResults转换为CommentQueryResult格式以供注释处理器使用
        const queryResults: CommentQueryResult[] = preprocessedResults.map(result => ({
          captures: result.captures || [],
          filePath: result.filePath // 保留文件路径信息
        }));
        // 从第一个查询结果中获取文件路径
        const filePath = queryResults[0]?.filePath || '';
        const commentResults = commentAdapter.processComments(results, queryResults, language, filePath);
        return commentResults;
      } catch (commentError) {
        this.logger.warn(`Comment processing failed for ${language}:`, commentError);
        // 如果注释处理失败，返回原有的结果
        return results;
      }
    }

    return results;
  }

  /**
   * 创建标准化结果
   */
  /**
   * 创建标准化结果
   */
  protected createStandardizedResult(result: any, queryType: string, language: string): StandardizedQueryResult {
    return createStandardizedResult(
      result,
      queryType,
      language,
      this.mapQueryTypeToStandardType.bind(this),
      this.extractName.bind(this),
      this.extractDependencies.bind(this),
      this.extractModifiers.bind(this),
      this.extractLanguageSpecificMetadata.bind(this),
      this.calculateComplexity.bind(this)
    );
  }

  /**
   * 创建增强的元数据构建器
   */
  protected createMetadataBuilder(result: any, language: string): MetadataBuilder {
    return createMetadataBuilder(
      result,
      language,
      this.calculateComplexity.bind(this),
      this.extractDependencies.bind(this),
      this.extractModifiers.bind(this),
      this.extractLanguageSpecificMetadata.bind(this)
    );
  }

  /**
   * 提取起始列号
   */
  protected extractStartColumn = extractStartColumn;

  /**
   * 提取结束列号
   */
  protected extractEndColumn = extractEndColumn;

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
    return postProcessResults(results, this.options.enableDeduplication);
  }

  /**
   * 智能去重
   */
  protected deduplicateResults = deduplicateResults;

  /**
   * 生成唯一键
   */
  protected generateUniqueKey = generateUniqueKey;

  /**
   * 合并元数据
   */
  protected mergeMetadata = mergeMetadata;

  // 通用工具方法
  // 通用工具方法 - 现在使用工具函数
  protected extractStartLine = extractStartLine;

  protected extractEndLine = extractEndLine;

  public extractContent = extractContent;

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
  protected calculateNestingDepthIterative = calculateNestingDepthIterative;

  protected isBlockNode = isBlockNode;

  /**
   * 计算节点结构复杂度
   * 考虑：块节点数量、嵌套模式复杂度
   */
  private calculateNodeComplexity = calculateNodeComplexity;

  /**
    * 生成节点缓存键
    */
  private getNodeCacheKey = getNodeCacheKey;

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

  protected findTypeReferences = findTypeReferences;

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
  protected hashResults = hashResults;

  /**
   * 简单哈希函数
   */
  protected simpleHash = simpleHash;

  /**
   * 降级标准化
   */
  protected fallbackNormalization(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    return utilsFallbackNormalization(queryResults, queryType, language);
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

  // 高级关系提取方法 - 默认实现，委托给关系提取器管理器
  async extractDataFlowRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractDataFlowRelationships(result);
  }

  async extractControlFlowRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractControlFlowRelationships(result);
  }

  async extractSemanticRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractSemanticRelationships(result);
  }

  async extractLifecycleRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractLifecycleRelationships(result);
  }

  async extractConcurrencyRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractConcurrencyRelationships(result);
  }

  async extractCallRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractCallRelationships(result);
  }

  async extractAnnotationRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'comment' | 'jsdoc' | 'directive' | 'decorator' | 'type_annotation' | 'docstring' | 'struct_tag';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractAnnotationRelationships(result);
  }

  async extractCreationRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'object_instance' | 'array' | 'function' | 'class_instance' | 'promise' | 'instantiation' | 'function_object' | 'comprehension' | 'generator' | 'closure' | 'struct_instance' | 'slice' | 'map' | 'channel' | 'function' | 'goroutine_instance';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractCreationRelationships(result);
  }

  async extractDependencyRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'import' | 'export' | 'require' | 'dynamic_import' | 'from_import' | 'relative_import' | 'wildcard_import' | 'package' | 'qualified_identifier';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractDependencyRelationships(result);
  }

  async extractInheritanceRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct' | 'class_inheritance' | 'interface_implementation' | 'mixin' | 'protocol';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractInheritanceRelationships(result);
  }

  async extractReferenceRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage' | 'attribute' | 'import';
  }>> {
    if (!this.relationshipExtractorManager) return [];
    return await this.relationshipExtractorManager.extractReferenceRelationships(result);
  }
}