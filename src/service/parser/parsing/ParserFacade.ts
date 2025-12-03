import { injectable, inject } from 'inversify'
import Parser from 'tree-sitter'
import { LoggerService } from '../../../../utils/LoggerService'
import { TYPES } from '../../../../types'
import { ICacheService } from '../../../../infrastructure/caching/types'
import {
  QueryPriority,
  QueryOptions,
  QueryResult,
  EntityQueryResult,
  RelationshipQueryResult,
  EntityQueryResults,
  RelationshipQueryResults,
  CompleteQueryResults,
  PrioritizedQueryResults,
} from './QueryPriority'
import { DynamicParserManager } from './DynamicParserManager'
import { ParserQueryService } from './ParserQueryService'
import { ParserCacheService } from './ParserCacheService'

/**
 * 解析器外观（Facade）类
 * 统一的查询和解析接口，隐藏内部复杂性
 * 所有外部调用都应通过这个类进行
 */
@injectable()
export class ParserFacade {
  private logger = new LoggerService()
  private dynamicManager: DynamicParserManager
  private queryService: ParserQueryService
  private cacheService: ParserCacheService
  private initialized = false

  constructor(
    @inject(TYPES.CacheService) centralizedCache: ICacheService
  ) {
    this.cacheService = new ParserCacheService(centralizedCache)
    this.queryService = new ParserQueryService(centralizedCache)
    this.dynamicManager = new DynamicParserManager(centralizedCache)
    this.initialize()
  }

  /**
   * 初始化外观
   */
  private async initialize(): Promise<void> {
    try {
      // 等待动态管理器初始化
      await this.dynamicManager.waitForInitialization()
      this.initialized = true
      this.logger.info('ParserFacade 初始化完成')
    } catch (error) {
      this.logger.error('ParserFacade 初始化失败:', error)
      this.initialized = false
    }
  }

  /**
   * 等待初始化完成
   */
  async waitForInitialization(timeout = 10000): Promise<void> {
    const startTime = Date.now()
    while (!this.initialized && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!this.initialized) {
      throw new Error('ParserFacade 初始化超时')
    }
  }

  // ==================== 解析操作 ====================

  /**
   * 解析代码并返回AST
   */
  async parseCode(code: string, language: string): Promise<Parser.SyntaxNode> {
    const result = await this.dynamicManager.parseCode(code, language)
    if (!result.success) {
      throw new Error(`解析失败: ${result.error}`)
    }
    return result.ast
  }

  /**
   * 解析文件
   */
  async parseFile(filePath: string, content: string): Promise<Parser.SyntaxNode> {
    const result = await this.dynamicManager.parseFile(filePath, content)
    if (!result.success) {
      throw new Error(`文件解析失败: ${result.error}`)
    }
    return result.ast
  }

  /**
   * 检测文件语言
   */
  async detectLanguage(filePath: string, content?: string): Promise<string | null> {
    return this.dynamicManager.detectLanguage(filePath, content)
  }

  // ==================== 实体查询 ====================

  /**
   * 查找所有实体（宏、类型、函数、变量等）
   */
  async findAllEntities(
    ast: Parser.SyntaxNode,
    language: string,
    options?: QueryOptions
  ): Promise<EntityQueryResults> {
    const [macros, types, functions, variables] = await Promise.all([
      this.queryService.findMacros(ast, language),
      this.queryService.findTypes(ast, language),
      this.queryService.findFunctions(ast, language),
      this.queryService.findVariables(ast, language),
    ])

    return {
      macros,
      types,
      functions,
      variables,
      comments: [],
    }
  }

  /**
   * 查找宏定义（优先级 5）
   */
  async findMacros(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryService.findMacros(ast, language)
  }

  /**
   * 查找类型定义（优先级 4）
   */
  async findTypes(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryService.findTypes(ast, language)
  }

  /**
   * 查找函数定义（优先级 3）
   */
  async findFunctions(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryService.findFunctions(ast, language)
  }

  /**
   * 查找类定义（优先级 3）
   */
  async findClasses(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryService.findClasses(ast, language)
  }

  /**
   * 查找变量声明（优先级 1）
   */
  async findVariables(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryService.findVariables(ast, language)
  }

  /**
   * 查找导出声明（优先级 3）
   */
  async findExports(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryService.findExports(ast, language)
  }

  // ==================== 关系查询 ====================

  /**
   * 查找所有关系（调用、依赖、继承、控制流、数据流等）
   */
  async findAllRelationships(
    ast: Parser.SyntaxNode,
    language: string,
    options?: QueryOptions
  ): Promise<RelationshipQueryResults> {
    const [calls, dependencies, inheritance, controlFlow, dataFlow] = await Promise.all([
      this.queryService.findCallRelationships(ast, language),
      this.queryService.findDependencies(ast, language),
      this.queryService.findInheritance(ast, language),
      this.queryService.findControlFlow(ast, language),
      this.queryService.findDataFlow(ast, language),
    ])

    return {
      calls,
      dependencies,
      inheritance,
      dataFlow,
      controlFlow,
    }
  }

  /**
   * 查找函数调用关系（优先级 4）
   */
  async findCallRelationships(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.queryService.findCallRelationships(ast, language)
  }

  /**
   * 查找依赖关系（优先级 3）
   */
  async findDependencies(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.queryService.findDependencies(ast, language)
  }

  /**
   * 查找继承关系（优先级 2）
   */
  async findInheritance(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.queryService.findInheritance(ast, language)
  }

  /**
   * 查找控制流关系（优先级 4）
   */
  async findControlFlow(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.queryService.findControlFlow(ast, language)
  }

  /**
   * 查找数据流关系（优先级 3）
   */
  async findDataFlow(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.queryService.findDataFlow(ast, language)
  }

  // ==================== 综合查询 ====================

  /**
   * 执行完整的代码分析：解析 -> 提取实体 -> 识别关系
   */
  async analyzeCode(
    code: string,
    language: string,
    options?: QueryOptions
  ): Promise<CompleteQueryResults> {
    const startTime = Date.now()

    try {
      // 1. 解析代码
      const ast = await this.parseCode(code, language)

      // 2. 并行查询实体和关系
      const [entities, relationships] = await Promise.all([
        this.findAllEntities(ast, language, options),
        this.findAllRelationships(ast, language, options),
      ])

      // 3. 按优先级分组结果
      const prioritized = this.prioritizeResults(
        [...Object.values(entities).flat(), ...Object.values(relationships).flat()],
        options?.minPriority,
        options?.maxPriority
      )

      const executionTime = Date.now() - startTime

      return {
        entities,
        relationships,
        prioritized,
        totalResults: Object.values(entities).flat().length + Object.values(relationships).flat().length,
        executionTime,
      }
    } catch (error) {
      this.logger.error('代码分析失败:', error)
      throw error
    }
  }

  /**
   * 按优先级分组查询结果
   */
  private prioritizeResults(
    results: QueryResult[],
    minPriority?: QueryPriority,
    maxPriority?: QueryPriority
  ): PrioritizedQueryResults {
    const min = minPriority ?? QueryPriority.ANNOTATION
    const max = maxPriority ?? QueryPriority.CRITICAL

    const grouped: PrioritizedQueryResults = {
      [QueryPriority.CRITICAL]: [],
      [QueryPriority.HIGH]: [],
      [QueryPriority.MEDIUM]: [],
      [QueryPriority.LOW]: [],
      [QueryPriority.MINIMAL]: [],
      [QueryPriority.ANNOTATION]: [],
    }

    results.forEach(result => {
      const priority = result.metadata.priority
      if (priority >= min && priority <= max) {
        grouped[priority].push(result)
      }
    })

    return grouped
  }

  /**
   * 按优先级获取结果
   */
  getResultsByPriority(
    results: CompleteQueryResults,
    priority: QueryPriority
  ): QueryResult[] {
    return results.prioritized[priority]
  }

  /**
   * 获取高优先级结果（优先级 >= HIGH）
   */
  getHighPriorityResults(results: CompleteQueryResults): QueryResult[] {
    return [
      ...results.prioritized[QueryPriority.CRITICAL],
      ...results.prioritized[QueryPriority.HIGH],
    ]
  }

  // ==================== 缓存管理 ====================

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.cacheService.getCacheStatistics()
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    return {
      cache: this.cacheService.getPerformanceStatistics(),
      query: this.queryService.getQueryStats(),
      parser: this.dynamicManager.getPerformanceStats(),
    }
  }

  /**
   * 获取完整的统计信息
   */
  getCompleteStats() {
    return {
      cache: this.cacheService.getCompleteStats(),
      query: this.queryService.getQueryStats(),
      parser: this.dynamicManager.getPerformanceStats(),
      initialized: this.initialized,
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cacheService.clearAll()
    this.logger.info('ParserFacade 已清除所有缓存')
  }

  /**
   * 清除特定语言的缓存
   */
  clearLanguageCache(language: string): void {
    this.cacheService.clearLanguageCache(language)
    this.dynamicManager.clearCache()
  }

  // ==================== 支持信息 ====================

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages() {
    return this.dynamicManager.getSupportedLanguages()
  }

  /**
   * 检查语言是否支持
   */
  isLanguageSupported(language: string): boolean {
    return this.dynamicManager.isLanguageSupported(language)
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 获取查询系统状态
   */
  getQuerySystemStatus() {
    return {
      parserInitialized: this.dynamicManager.isInitialized(),
      querySystemInitialized: this.queryService.isQuerySystemInitialized(),
      facadeInitialized: this.initialized,
    }
  }

  // ==================== 内部访问（用于高级操作）====================

  /**
   * 获取动态管理器（用于低级操作）
   */
  getDynamicManager(): DynamicParserManager {
    return this.dynamicManager
  }

  /**
   * 获取查询服务（用于低级操作）
   */
  getQueryService(): ParserQueryService {
    return this.queryService
  }

  /**
   * 获取缓存服务（用于低级操作）
   */
  getCacheService(): ParserCacheService {
    return this.cacheService
  }
}
