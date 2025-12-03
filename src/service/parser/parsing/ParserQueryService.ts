import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { QueryRegistryImpl } from '../query/QueryRegistry';
import { TreeSitterQueryFacade } from '../query/TreeSitterQueryFacade';
import { FallbackExtractor } from '../../utils/FallbackExtractor';
import { TYPES } from '../../../../types';
import { ICacheService } from '../../../../infrastructure/caching/types';
import {
  QueryPriority,
  QueryMetadata,
  EntityQueryResult,
  RelationshipQueryResult,
  QueryResult,
  QueryOptions,
  EntityQueryResults,
  RelationshipQueryResults,
  CompleteQueryResults,
  QueryStats,
} from './QueryPriority'
import { ParserCacheService } from './ParserCacheService'

/**
 * 查询策略枚举
 */
enum QueryStrategy {
  OPTIMIZED = 1,     // 使用优化的查询系统
  STANDARD = 2,      // 使用标准Tree-sitter查询
  FALLBACK = 3       // 使用FallbackExtractor
}

/**
 * 系统状态
 */
interface SystemStatus {
  querySystemInitialized: boolean
  optimizedQueriesEnabled: boolean
  fallbackAvailable: boolean
}

/**
 * 解析器查询服务
 * 负责所有与AST查询相关的操作，包括实体提取和关系识别
 * 支持多种查询策略和优先级管理
 */
@injectable()
export class ParserQueryService {
  private logger = new LoggerService()
  private errorHandler: ErrorHandlerService
  private cacheService: ParserCacheService
  private querySystemInitialized = false
  private queryStats: QueryStats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0,
  }

  constructor(
    @inject(TYPES.CacheService) centralizedCache: ICacheService
  ) {
    this.errorHandler = new ErrorHandlerService(this.logger)
    this.cacheService = new ParserCacheService(centralizedCache)
    this.initializeQuerySystem()
  }

  /**
   * 初始化查询系统
   */
  private async initializeQuerySystem(): Promise<void> {
    try {
      const success = await QueryRegistryImpl.initialize()
      if (success) {
        this.querySystemInitialized = true
        this.logger.info('ParserQueryService 的查询系统初始化完成')
      } else {
        this.logger.warn('查询系统初始化失败，将使用回退机制')
      }
    } catch (error) {
      this.logger.error('查询系统初始化异常:', error)
    }
  }

  /**
   * 获取系统状态
   */
  private getSystemStatus(): SystemStatus {
    return {
      querySystemInitialized: this.querySystemInitialized,
      optimizedQueriesEnabled: true,
      fallbackAvailable: true,
    }
  }

  /**
   * 选择查询策略
   */
  private selectStrategy(language: string, queryType: string): QueryStrategy {
    const status = this.getSystemStatus()

    // 如果查询系统已初始化且支持该语言，使用优化策略
    if (status.querySystemInitialized && status.optimizedQueriesEnabled) {
      const isSupported = QueryRegistryImpl.isSupported(language.toLowerCase(), queryType)
      if (isSupported) {
        return QueryStrategy.OPTIMIZED
      }
    }

    // 次级使用标准Tree-sitter查询
    return QueryStrategy.STANDARD
  }

  /**
   * 等待查询系统初始化
   */
  private async waitForQuerySystem(timeout = 5000): Promise<void> {
    const startTime = Date.now()

    while (!this.querySystemInitialized && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (!this.querySystemInitialized) {
      this.logger.warn('等待查询系统初始化超时，将使用回退机制')
    }
  }

  // ==================== 实体查询 ====================

  /**
   * 查找宏定义 - 优先级 5
   */
  async findMacros(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, language, 'macros', QueryPriority.CRITICAL)
  }

  /**
   * 查找类型定义 - 优先级 4
   */
  async findTypes(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, language, 'types', QueryPriority.HIGH)
  }

  /**
   * 查找函数 - 优先级 3
   */
  async findFunctions(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, language, 'functions', QueryPriority.MEDIUM)
  }

  /**
   * 查找变量声明 - 优先级 1
   */
  async findVariables(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, language, 'variables', QueryPriority.MINIMAL)
  }

  /**
   * 查找类 - 优先级 3
   */
  async findClasses(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, language, 'classes', QueryPriority.MEDIUM)
  }

  /**
   * 查找导出 - 优先级 3
   */
  async findExports(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, language, 'exports', QueryPriority.MEDIUM)
  }

  /**
   * 执行实体查询的通用方法
   */
  private async executeEntityQuery(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<EntityQueryResult[]> {
    const startTime = Date.now()
    const normalizedLanguage = language.toLowerCase()

    try {
      // 1. 检查缓存
      const nodeHash = this.cacheService.hashNode(ast)
      const cacheKey = this.cacheService.generateQueryCacheKey(normalizedLanguage, queryType, nodeHash)
      const cached = this.cacheService.getCachedQueryResult(normalizedLanguage, queryType, nodeHash)

      if (cached) {
        this.queryStats.cacheHits++
        this.logger.debug(`查询缓存命中: ${queryType}@${language}`)
        return cached
      }

      this.queryStats.cacheMisses++

      // 2. 选择策略并执行查询
      const strategy = this.selectStrategy(normalizedLanguage, queryType)
      let results: EntityQueryResult[] = []

      switch (strategy) {
        case QueryStrategy.OPTIMIZED:
          results = await this.queryWithOptimized(ast, normalizedLanguage, queryType, priority)
          break
        case QueryStrategy.STANDARD:
          results = await this.queryWithStandard(ast, normalizedLanguage, queryType, priority)
          break
        default:
          results = await this.queryWithFallback(ast, normalizedLanguage, queryType, priority)
      }

      // 3. 缓存结果
      this.cacheService.cacheQueryResult(normalizedLanguage, queryType, nodeHash, results)

      // 4. 更新统计
      const executionTime = Date.now() - startTime
      this.updateQueryStats(executionTime, true)

      this.logger.debug(`实体查询完成: ${queryType}@${language}, 耗时 ${executionTime}ms, 结果数 ${results.length}`)

      return results
    } catch (error) {
      const executionTime = Date.now() - startTime
      this.updateQueryStats(executionTime, false)
      this.logger.error(`实体查询失败: ${queryType}@${language}`, error)
      return []
    }
  }

  // ==================== 关系查询 ====================

  /**
   * 查找函数调用关系 - 优先级 4
   */
  async findCallRelationships(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, language, 'calls', QueryPriority.HIGH)
  }

  /**
   * 查找依赖关系 - 优先级 3
   */
  async findDependencies(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, language, 'dependencies', QueryPriority.MEDIUM)
  }

  /**
   * 查找继承关系 - 优先级 2
   */
  async findInheritance(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, language, 'inheritance', QueryPriority.LOW)
  }

  /**
   * 查找控制流关系 - 优先级 4
   */
  async findControlFlow(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, language, 'control_flow', QueryPriority.HIGH)
  }

  /**
   * 查找数据流关系 - 优先级 3
   */
  async findDataFlow(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, language, 'data_flow', QueryPriority.MEDIUM)
  }

  /**
   * 执行关系查询的通用方法
   */
  private async executeRelationshipQuery(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<RelationshipQueryResult[]> {
    const startTime = Date.now()
    const normalizedLanguage = language.toLowerCase()

    try {
      // 1. 检查缓存
      const nodeHash = this.cacheService.hashNode(ast)
      const cached = this.cacheService.getCachedQueryResult(normalizedLanguage, queryType, nodeHash)

      if (cached) {
        this.queryStats.cacheHits++
        this.logger.debug(`关系查询缓存命中: ${queryType}@${language}`)
        return cached
      }

      this.queryStats.cacheMisses++

      // 2. 选择策略并执行查询
      const strategy = this.selectStrategy(normalizedLanguage, queryType)
      let results: RelationshipQueryResult[] = []

      switch (strategy) {
        case QueryStrategy.OPTIMIZED:
          results = await this.relationshipWithOptimized(ast, normalizedLanguage, queryType, priority)
          break
        case QueryStrategy.STANDARD:
          results = await this.relationshipWithStandard(ast, normalizedLanguage, queryType, priority)
          break
        default:
          results = await this.relationshipWithFallback(ast, normalizedLanguage, queryType, priority)
      }

      // 3. 缓存结果
      this.cacheService.cacheQueryResult(normalizedLanguage, queryType, nodeHash, results)

      // 4. 更新统计
      const executionTime = Date.now() - startTime
      this.updateQueryStats(executionTime, true)

      this.logger.debug(`关系查询完成: ${queryType}@${language}, 耗时 ${executionTime}ms, 结果数 ${results.length}`)

      return results
    } catch (error) {
      const executionTime = Date.now() - startTime
      this.updateQueryStats(executionTime, false)
      this.logger.error(`关系查询失败: ${queryType}@${language}`, error)
      return []
    }
  }

  // ==================== 优化查询实现 ====================

  private async queryWithOptimized(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<EntityQueryResult[]> {
    try {
      const results = await TreeSitterQueryFacade.findMultiple(ast, language, [queryType])
      const nodes = results.get(queryType) || []

      return nodes.map((node: Parser.SyntaxNode, index: any) => ({
        type: 'entity' as const,
        node,
        metadata: this.createMetadata('entity', queryType, priority, [language]),
        captures: [],
        name: this.extractNodeName(node),
      }))
    } catch (error) {
      this.logger.warn(`优化查询失败，将使用标准方法: ${queryType}`, error)
      throw error
    }
  }

  private async relationshipWithOptimized(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<RelationshipQueryResult[]> {
    try {
      const results = await TreeSitterQueryFacade.findMultiple(ast, language, [queryType])
      const nodes = results.get(queryType) || []

      return nodes.map((node: any) => ({
        type: 'relationship' as const,
        node,
        metadata: this.createMetadata('relationship', queryType, priority, [language]),
        captures: [],
        direction: 'from_to' as const,
      }))
    } catch (error) {
      this.logger.warn(`优化关系查询失败，将使用标准方法: ${queryType}`, error)
      throw error
    }
  }

  // ==================== 标准查询实现 ====================

  private async queryWithStandard(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<EntityQueryResult[]> {
    // 使用Tree-sitter的原生查询机制
    const nodes = FallbackExtractor.extractNodesByTypes(ast, new Set([this.mapQueryTypeToNodeType(queryType)]))

    return nodes.map(node => ({
      type: 'entity' as const,
      node,
      metadata: this.createMetadata('entity', queryType, priority, [language]),
      captures: [],
      name: this.extractNodeName(node),
    }))
  }

  private async relationshipWithStandard(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<RelationshipQueryResult[]> {
    // 关系查询使用回退机制
    return this.relationshipWithFallback(ast, language, queryType, priority)
  }

  // ==================== 回退实现 ====================

  private async queryWithFallback(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<EntityQueryResult[]> {
    let nodes: Parser.SyntaxNode[] = []

    switch (queryType) {
      case 'functions':
        nodes = FallbackExtractor.extractFunctions(ast, language)
        break
      case 'classes':
        nodes = FallbackExtractor.extractClasses(ast, language)
        break
      case 'variables':
        nodes = FallbackExtractor.extractVariables(ast, language) || []
        break
      default:
        nodes = FallbackExtractor.extractNodesByTypes(ast, new Set([queryType]))
    }

    return nodes.map(node => ({
      type: 'entity' as const,
      node,
      metadata: this.createMetadata('entity', queryType, priority, [language]),
      captures: [],
      name: this.extractNodeName(node),
    }))
  }

  private async relationshipWithFallback(
    ast: Parser.SyntaxNode,
    language: string,
    queryType: string,
    priority: QueryPriority
  ): Promise<RelationshipQueryResult[]> {
    // 关系查询的回退实现
    // TODO: 实现关系提取的回退逻辑
    this.logger.warn(`关系查询 ${queryType} 在${language}中无可用的回退实现`)
    return []
  }

  // ==================== 辅助方法 ====================

  /**
   * 创建查询元数据
   */
  private createMetadata(
    type: 'entity' | 'relationship',
    category: string,
    priority: QueryPriority,
    languages: string[]
  ): QueryMetadata {
    return {
      type,
      category: category as any,
      priority,
      languages,
      implemented: true,
    }
  }

  /**
   * 提取节点名称
   */
  private extractNodeName(node: Parser.SyntaxNode): string | undefined {
    return FallbackExtractor.getNodeName(node)
  }

  /**
   * 映射查询类型到节点类型
   */
  private mapQueryTypeToNodeType(queryType: string): string {
    const mapping: Record<string, string> = {
      functions: 'function_definition',
      classes: 'class_declaration',
      variables: 'variable_declarator',
      types: 'type_definition',
      macros: 'define',
    }
    return mapping[queryType] || queryType
  }

  /**
   * 更新查询统计
   */
  private updateQueryStats(executionTime: number, success: boolean): void {
    this.queryStats.totalQueries++
    if (success) {
      this.queryStats.successfulQueries++
    } else {
      this.queryStats.failedQueries++
    }
    this.queryStats.totalExecutionTime += executionTime
    this.queryStats.averageExecutionTime = this.queryStats.totalExecutionTime / this.queryStats.totalQueries
  }

  /**
   * 获取查询统计信息
   */
  getQueryStats(): QueryStats {
    return { ...this.queryStats }
  }

  /**
   * 获取缓存服务
   */
  getCacheService(): ParserCacheService {
    return this.cacheService
  }

  /**
   * 检查查询系统是否已初始化
   */
  isQuerySystemInitialized(): boolean {
    return this.querySystemInitialized
  }
}
