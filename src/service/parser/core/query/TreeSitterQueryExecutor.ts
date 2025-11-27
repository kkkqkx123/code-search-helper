import Parser from 'tree-sitter';
import { QueryRegistryImpl } from './QueryRegistry';
import { LoggerService } from '../../../../utils/LoggerService';
import { QueryCache } from './QueryCache';
import { QueryPerformanceMonitor } from './QueryPerformanceMonitor';
import { LANGUAGE_QUERY_MAPPINGS } from '../normalization/QueryTypeMappings';

/**
 * Tree-sitter查询模式定义
 */
export interface QueryPattern {
  /** 查询名称 */
  name: string;

  /** 查询描述 */
  description: string;

  /** S-expression查询模式 */
  pattern: string;

  /** 适用的语言 */
  languages: string[];

  /** 捕获名称映射 */
  captures: Record<string, string>;

  /** 额外的匹配条件 */
  conditions?: QueryCondition[];
}

/**
 * 查询条件
 */
export interface QueryCondition {
  /** 条件类型 */
  type: 'length' | 'complexity' | 'nesting' | 'custom';

  /** 条件参数 */
  params: Record<string, any>;
}

/**
 * 查询结果
 */
export interface QueryResult {
  /** 匹配的节点 */
  matches: QueryMatch[];

  /** 查询执行时间 */
  executionTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: string;
}

/**
 * 查询匹配
 */
export interface QueryMatch {
  /** 匹配的节点 */
  node: Parser.SyntaxNode;

  /** 捕获的节点 */
  captures: Record<string, Parser.SyntaxNode>;

  /** 匹配的位置信息 */
  location: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
}

/**
 * Tree-sitter查询引擎 - 优化版本
 * 使用原生tree-sitter Query API，集成缓存和性能监控
 */
export class TreeSitterQueryEngine {
  private patterns: Map<string, QueryPattern> = new Map();
  private queryRegistry = QueryRegistryImpl;
  private logger = new LoggerService();
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * 异步初始化
   */
  private async initialize(): Promise<void> {
    try {
      // 使用全局初始化管理器避免重复初始化
      const success = await QueryRegistryImpl.initialize();
      if (success) {
        await this.loadPatternsFromRegistry();
        this.initialized = true;
        this.logger.info('TreeSitterQueryEngine 初始化完成');
      } else {
        this.logger.warn('TreeSitterQueryEngine 初始化失败: 全局查询系统初始化失败');
      }
    } catch (error) {
      this.logger.error('TreeSitterQueryEngine 初始化失败:', error);
    }
  }

  /**
   * 从注册表加载模式
   */
  private async loadPatternsFromRegistry(): Promise<void> {
    const languages = this.queryRegistry.getSupportedLanguages();

    for (const language of languages) {
      const patternTypes = this.queryRegistry.getQueryTypesForLanguage(language);

      for (const patternType of patternTypes) {
        try {
          const patternString = await this.queryRegistry.getPattern(language, patternType);
          if (patternString) {
            this.addPatternFromString(patternType, patternString, language);
          }
        } catch (error) {
          this.logger.warn(`加载模式 ${language}.${patternType} 失败:`, error);
        }
      }
    }
  }

  /**
   * 从字符串添加模式
   */
  private addPatternFromString(name: string, patternString: string, language: string): void {
    const pattern: QueryPattern = {
      name: `${language}_${name}`,
      description: `Auto-generated pattern for ${language}.${name}`,
      pattern: patternString,
      languages: [language],
      captures: this.extractCapturesFromPattern(patternString)
    };

    this.patterns.set(pattern.name, pattern);
  }

  /**
   * 从模式字符串中提取捕获
   */
  private extractCapturesFromPattern(pattern: string): Record<string, string> {
    const captures: Record<string, string> = {};
    const captureRegex = /@([\w\.]+)/g;
    let match;

    while ((match = captureRegex.exec(pattern)) !== null) {
      const captureName = match[1];
      captures[captureName] = captureName.replace(/\./g, ' ');
    }

    return captures;
  }

  /**
   * 添加查询模式
   */
  addPattern(pattern: QueryPattern): void {
    this.patterns.set(pattern.name, pattern);
  }

  /**
   * 执行查询
   */
  async executeQuery(
    ast: Parser.SyntaxNode,
    patternName: string,
    language: string
  ): Promise<QueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const fullPatternName = `${language}_${patternName}`;
      return await this.executeQueryInternal(ast, fullPatternName, language);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`${language}_${patternName}_error`, executionTime);

      return {
        matches: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 内部查询执行
   */
  private async executeQueryInternal(
    ast: Parser.SyntaxNode,
    patternName: string,
    language: string
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const pattern = this.patterns.get(patternName);
      if (!pattern) {
        throw new Error(`Query pattern '${patternName}' not found`);
      }

      if (!pattern.languages.includes(language)) {
        throw new Error(`Pattern '${patternName}' does not support language '${language}'`);
      }

      // 检查缓存
      const cacheKey = this.generateCacheKey(ast, patternName, language);
      const cached = QueryCache.getResult(cacheKey);
      if (cached) {
        QueryPerformanceMonitor.recordCacheHit(true);
        return cached;
      }

      QueryPerformanceMonitor.recordCacheHit(false);

      // 执行查询 - 使用原生tree-sitter Query API
      const matches = await this.executeQueryPattern(ast, pattern, language);

      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`${language}_${patternName}`, executionTime);

      const result: QueryResult = {
        matches,
        executionTime,
        success: true
      };

      // 缓存结果
      QueryCache.setResult(cacheKey, result);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      QueryPerformanceMonitor.recordQuery(`${language}_${patternName}_error`, executionTime);

      return {
        matches: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 批量执行查询 - 优化版本，使用并行查询
   */
  async executeMultipleQueries(
    ast: Parser.SyntaxNode,
    patternNames: string[],
    language: string
  ): Promise<Map<string, QueryResult>> {
    const results = new Map<string, QueryResult>();

    // 使用并行查询提升性能
    const queryPromises = patternNames.map(async (patternName) => {
      const result = await this.executeQuery(ast, patternName, language);
      return { patternName, result };
    });

    const queryResults = await Promise.all(queryPromises);

    // 将结果存入Map
    for (const { patternName, result } of queryResults) {
      results.set(patternName, result);
    }

    return results;
  }

  /**
   * 获取所有支持的模式
   */
  getSupportedPatterns(language?: string): QueryPattern[] {
    const patterns = Array.from(this.patterns.values());

    if (language) {
      return patterns.filter(pattern => pattern.languages.includes(language));
    }

    return patterns;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    QueryCache.clearCache();
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    const allCacheStats = QueryCache.getAllStats();
    const resultCacheStats = allCacheStats.resultCache || { hits: 0, misses: 0, evictions: 0, sets: 0, size: 0, memoryUsage: 0 };

    return {
      queryMetrics: QueryPerformanceMonitor.getMetrics(),
      querySummary: QueryPerformanceMonitor.getSummary(),
      systemMetrics: QueryPerformanceMonitor.getSystemMetrics(),
      cacheStats: QueryCache.getStats(),
      engineCacheSize: resultCacheStats.size,
      allCacheStats: allCacheStats
    };
  }

  /**
   * 生成缓存键 - 优化版本，考虑AST内容而不仅仅是引用
   */
  private generateCacheKey(ast: Parser.SyntaxNode, patternName: string, language: string): string {
    return QueryCache.forTreeSitterQuery(ast, patternName, language);
  }

  /**
   * 执行查询模式（使用原生tree-sitter Query API）
   */
  private async executeQueryPattern(ast: Parser.SyntaxNode, pattern: QueryPattern, language: string): Promise<QueryMatch[]> {
    try {
      // 获取语言对象，首先尝试从AST的tree属性中获取
      let languageObj = (ast.tree as any)?.language;

      // 如果无法从AST获取语言对象，尝试使用DynamicParserManager获取
      if (!languageObj) {
        try {
          // 导入DynamicParserManager来获取解析器
          const { DynamicParserManager } = await import('../parse/DynamicParserManager');
          // 创建简单的内存缓存服务用于临时使用
          const tempCacheService = {
            getFromCache: () => undefined,
            setCache: () => {},
            deleteFromCache: () => false,
            clearAllCache: () => {},
            getCacheStats: () => ({ totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0 }),
            cleanupExpiredEntries: () => {},
            isGraphCacheHealthy: () => true,
            checkMemoryUsage: () => {},
            aggressiveCleanup: () => {},
            startCleanupInterval: () => {},
            evictEntries: () => {},
            getGraphStatsCache: () => undefined,
            setGraphStatsCache: () => {},
            cacheGraphData: async () => {},
            getGraphData: async () => null,
            hasKey: () => false,
            getKeys: () => [],
            getSize: () => 0,
            updateConfig: () => {},
            stopCleanupInterval: () => {},
            forceCleanup: () => {},
            getPerformanceMetrics: () => ({ totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0, averageTTL: 0, expiredEntries: 0, memoryUsage: 0 }),
            preloadCache: () => {},
            getKeysByPattern: () => [],
            deleteByPattern: () => 0,
            getDatabaseSpecificCache: async () => null,
            setDatabaseSpecificCache: async () => {},
            invalidateDatabaseCache: async () => {},
            cacheNebulaGraphData: async () => {},
            getNebulaGraphData: async () => null,
            cacheVectorData: async () => {},
            getVectorData: async () => null
          } as any;
          const dynamicManager = new DynamicParserManager(tempCacheService);
          const parser = await dynamicManager.getParser(language);
          if (parser) {
            // 从解析器获取语言对象
            languageObj = parser.getLanguage();
          } else {
            this.logger.warn(`无法获取解析器 ${language}，跳过查询`);
            return [];
          }
        } catch (error) {
          this.logger.warn(`无法获取语言对象 ${language}，跳过查询:`, error);
          return [];
        }
      }

      const query = QueryCache.getQuery(languageObj, pattern.pattern);
      const matches = query.matches(ast);

      return matches.map(match => ({
        node: match.captures[0]?.node,
        captures: match.captures.reduce((acc, capture) => {
          acc[capture.name] = capture.node;
          return acc;
        }, {} as Record<string, Parser.SyntaxNode>),
        location: this.getNodeLocation(match.captures[0]?.node)
      }));
    } catch (error) {
      this.logger.error('查询执行失败:', error);
      // 重新抛出错误以便上层处理
      throw error;
    }
  }

  /**
   * 获取节点位置
   */
  private getNodeLocation(node: Parser.SyntaxNode): QueryMatch['location'] {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  /**
   * 执行图索引查询
   */
  async executeGraphQueries(ast: Parser.SyntaxNode, language: string): Promise<Map<string, QueryResult>> {
    // 获取图索引查询类型
    const graphQueryTypes = this.getGraphQueryTypes(language);

    // 执行查询
    const results = new Map<string, QueryResult>();
    for (const queryType of graphQueryTypes) {
      const result = await this.executeQuery(ast, queryType, language);
      results.set(queryType, result);
    }

    return results;
  }

  /**
   * 获取图索引查询类型
   */
  private getGraphQueryTypes(language: string): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    if (!mapping) {
      return [];
    }

    // 返回图索引相关的查询类型
    return Object.keys(mapping).filter(key => key.startsWith('graph-'));
  }
}

