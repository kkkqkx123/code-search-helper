import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { ICacheService } from '../../../../infrastructure/caching/types';
import { TYPES } from '../../../../types';
import { CacheKeyUtils } from '../../../../utils/cache/CacheKeyUtils';
import Parser from 'tree-sitter';

/**
 * 缓存统计信息
 */
export interface CacheStatistics {
  hits: number
  misses: number
  evictions: number
  totalRequests: number
  hitRate: string
  cacheSize?: number
}

/**
 * 性能统计信息
 */
export interface PerformanceStatistics {
  totalParseTime: number
  totalParseCount: number
  averageParseTime: number
  maxParseTime: number
  minParseTime: number
  totalQueryTime: number
  totalQueryCount: number
  averageQueryTime: number
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  parserCacheTTL: number      // 解析器缓存有效期（毫秒）
  astCacheTTL: number         // AST缓存有效期
  queryCacheTTL: number       // 查询结果缓存有效期
  nodeCacheSize: number       // 节点缓存最大条目数
}

/**
 * 解析器缓存管理服务
 * 集中管理所有与解析相关的缓存，包括：
 * - 解析器实例缓存
 * - AST树缓存
 * - 查询结果缓存
 * - 节点缓存
 */
@injectable()
export class ParserCacheService {
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  }

  private performanceStats = {
    totalParseTime: 0,
    totalParseCount: 0,
    averageParseTime: 0,
    maxParseTime: 0,
    minParseTime: Number.MAX_VALUE,
    totalQueryTime: 0,
    totalQueryCount: 0,
    averageQueryTime: 0,
  }

  private nodeCache: Map<string, Parser.SyntaxNode[]> = new Map()
  private queryCache: Map<string, any> = new Map()

  private cacheConfig: CacheConfig = {
    parserCacheTTL: 30 * 60 * 1000,      // 30分钟
    astCacheTTL: 10 * 60 * 1000,         // 10分钟
    queryCacheTTL: 5 * 60 * 1000,        // 5分钟
    nodeCacheSize: 1000,                 // 最多1000个节点
  }

  private logger = new LoggerService()

  constructor(
    @inject(TYPES.CacheService) private centralizedCache: ICacheService
  ) {
    this.logger.info('ParserCacheService 已初始化')
  }

  /**
   * 配置缓存参数
   */
  setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config }
    this.logger.info('缓存配置已更新:', this.cacheConfig)
  }

  // ==================== 解析器缓存 ====================

  /**
   * 获取缓存的解析器
   */
  getCachedParser(language: string): Parser | null {
    const cacheKey = this.generateParserCacheKey(language)
    const cached = this.centralizedCache.getFromCache<Parser>(cacheKey)
    
    if (cached) {
      this.cacheStats.hits++
      this.logger.debug(`解析器缓存命中: ${language}`)
      return cached
    }

    this.cacheStats.misses++
    return null
  }

  /**
   * 缓存解析器
   */
  cacheParser(language: string, parser: Parser): void {
    const cacheKey = this.generateParserCacheKey(language)
    this.centralizedCache.setCache(cacheKey, parser, this.cacheConfig.parserCacheTTL)
    this.logger.debug(`解析器已缓存: ${language}`)
  }

  // ==================== AST缓存 ====================

  /**
   * 获取缓存的AST
   */
  getCachedAST(language: string, code: string): Parser.Tree | null {
    const cacheKey = this.generateASTCacheKey(language, code)
    const cached = this.centralizedCache.getFromCache<Parser.Tree>(cacheKey)

    if (cached) {
      this.cacheStats.hits++
      this.logger.debug(`AST缓存命中: ${language}`)
      return cached
    }

    this.cacheStats.misses++
    return null
  }

  /**
   * 缓存AST
   */
  cacheAST(language: string, code: string, tree: Parser.Tree): void {
    const cacheKey = this.generateASTCacheKey(language, code)
    this.centralizedCache.setCache(cacheKey, tree, this.cacheConfig.astCacheTTL)
    this.logger.debug(`AST已缓存: ${language}`)
  }

  // ==================== 查询结果缓存 ====================

  /**
   * 获取缓存的查询结果
   */
  getCachedQueryResult(language: string, queryType: string, nodeHash: string): any | null {
    const cacheKey = this.generateQueryCacheKey(language, queryType, nodeHash)
    const cached = this.centralizedCache.getFromCache(cacheKey)

    if (cached) {
      this.cacheStats.hits++
      this.logger.debug(`查询结果缓存命中: ${queryType}@${language}`)
      return cached
    }

    this.cacheStats.misses++
    return null
  }

  /**
   * 缓存查询结果
   */
  cacheQueryResult(language: string, queryType: string, nodeHash: string, result: any): void {
    const cacheKey = this.generateQueryCacheKey(language, queryType, nodeHash)
    this.centralizedCache.setCache(cacheKey, result, this.cacheConfig.queryCacheTTL)
    this.logger.debug(`查询结果已缓存: ${queryType}@${language}`)
  }

  // ==================== 节点缓存 ====================

  /**
   * 获取缓存的节点
   */
  getCachedNodes(cacheKey: string): Parser.SyntaxNode[] | null {
    const cached = this.nodeCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached
    }
    this.cacheStats.misses++
    return null
  }

  /**
   * 缓存节点
   */
  cacheNodes(cacheKey: string, nodes: Parser.SyntaxNode[]): void {
    // 简单的LRU淘汰：超过大小限制时删除最旧的条目
    if (this.nodeCache.size >= this.cacheConfig.nodeCacheSize) {
      const firstKey = this.nodeCache.keys().next().value
      if (firstKey) {
        this.nodeCache.delete(firstKey)
        this.cacheStats.evictions++
      }
    }

    this.nodeCache.set(cacheKey, nodes)
  }

  // ==================== 缓存键生成 ====================

  /**
   * 生成解析器缓存键
   */
  generateParserCacheKey(language: string): string {
    return `parser:${language.toLowerCase()}`
  }

  /**
   * 生成AST缓存键
   */
  generateASTCacheKey(language: string, code: string): string {
    const codeHash = CacheKeyUtils.generateCacheKey(code)
    return `ast:${language.toLowerCase()}:${codeHash}`
  }

  /**
   * 生成查询缓存键
   */
  generateQueryCacheKey(language: string, queryType: string, nodeHash: string): string {
    return `query:${language.toLowerCase()}:${queryType}:${nodeHash}`
  }

  /**
   * 生成节点缓存键
   */
  generateNodeCacheKey(nodeHash: string, queryType: string): string {
    return `node:${nodeHash}:${queryType}`
  }

  /**
   * 计算节点哈希值
   */
  hashNode(node: Parser.SyntaxNode): string {
    return `${node.type}:${node.startIndex}:${node.endIndex}`
  }

  // ==================== 性能统计 ====================

  /**
   * 记录解析耗时
   */
  recordParseTime(parseTime: number): void {
    this.performanceStats.totalParseTime += parseTime
    this.performanceStats.totalParseCount++
    this.performanceStats.averageParseTime = 
      this.performanceStats.totalParseTime / this.performanceStats.totalParseCount
    this.performanceStats.maxParseTime = Math.max(this.performanceStats.maxParseTime, parseTime)
    this.performanceStats.minParseTime = Math.min(this.performanceStats.minParseTime, parseTime)
  }

  /**
   * 记录查询耗时
   */
  recordQueryTime(queryTime: number): void {
    this.performanceStats.totalQueryTime += queryTime
    this.performanceStats.totalQueryCount++
    this.performanceStats.averageQueryTime = 
      this.performanceStats.totalQueryTime / this.performanceStats.totalQueryCount
  }

  // ==================== 统计查询 ====================

  /**
   * 获取缓存统计信息
   */
  getCacheStatistics(): CacheStatistics {
    const total = this.cacheStats.hits + this.cacheStats.misses
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : '0.00'

    return {
      ...this.cacheStats,
      totalRequests: total,
      hitRate: `${hitRate}%`,
      cacheSize: this.nodeCache.size,
    }
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStatistics(): PerformanceStatistics {
    return { ...this.performanceStats }
  }

  /**
   * 获取完整的统计信息
   */
  getCompleteStats() {
    return {
      cache: this.getCacheStatistics(),
      performance: this.getPerformanceStatistics(),
      config: this.cacheConfig,
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.centralizedCache.deleteByPattern(/^(parser|ast|query)/)
    this.nodeCache.clear()
    this.queryCache.clear()
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 }
    this.logger.info('所有缓存已清除')
  }

  /**
   * 清除解析器缓存
   */
  clearParsers(): void {
    this.centralizedCache.deleteByPattern(/^parser:/)
    this.logger.info('解析器缓存已清除')
  }

  /**
   * 清除AST缓存
   */
  clearASTs(): void {
    this.centralizedCache.deleteByPattern(/^ast:/)
    this.logger.info('AST缓存已清除')
  }

  /**
   * 清除查询结果缓存
   */
  clearQueryResults(): void {
    this.centralizedCache.deleteByPattern(/^query:/)
    this.queryCache.clear()
    this.logger.info('查询结果缓存已清除')
  }

  /**
   * 清除节点缓存
   */
  clearNodes(): void {
    this.nodeCache.clear()
    this.logger.info('节点缓存已清除')
  }

  /**
   * 清除特定语言的缓存
   */
  clearLanguageCache(language: string): void {
    const pattern = new RegExp(`(parser|ast|query):${language.toLowerCase()}`)
    this.centralizedCache.deleteByPattern(pattern)
    this.logger.info(`${language} 的缓存已清除`)
  }

  /**
   * 获取缓存大小信息
   */
  getCacheSize(): {
    nodeCache: number
    queryCache: number
  } {
    return {
      nodeCache: this.nodeCache.size,
      queryCache: this.queryCache.size,
    }
  }
}
