import Parser from 'tree-sitter';
import { TreeSitterQueryEngine, QueryResult } from './TreeSitterQueryEngine';
import { QueryEngineFactory } from './QueryEngineFactory';
import { QueryCache } from './QueryCache';
import { CacheKeyGenerator } from './CacheKeyGenerator';
import { GlobalQueryInitializer } from './GlobalQueryInitializer';

/**
 * 简化查询引擎
 * 为常见用例提供简单易用的接口
 */
export class SimpleQueryEngine {
  private static queryEngine = QueryEngineFactory.getInstance();
  
  // 缓存键前缀，避免与其他引擎冲突
  private static readonly CACHE_PREFIX = 'simple:';
  private static readonly BATCH_CACHE_PREFIX = 'batch:';

  /**
   * 生成缓存键
   */
  private static generateCacheKey(ast: Parser.SyntaxNode, queryType: string, language: string): string {
    return CacheKeyGenerator.forSimpleQuery(ast, queryType, language);
  }

  /**
   * 生成批量查询缓存键
   */
  private static generateBatchCacheKey(ast: Parser.SyntaxNode, types: string[], language: string): string {
    return CacheKeyGenerator.forBatchQuery(ast, types, language);
  }

  
  /**
   * 通用优化查询方法 - 减少重复代码和对象创建
   */
  private static async optimizedQuery(
    ast: Parser.SyntaxNode,
    queryType: string,
    language: string
  ): Promise<Parser.SyntaxNode[]> {
    // 检查AST是否有效
    if (!ast) {
      return [];
    }
    
    const cacheKey = this.CACHE_PREFIX + this.generateCacheKey(ast, queryType, language);
    
    // 检查缓存
    const cached = QueryCache.getResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.queryEngine.executeQuery(ast, queryType, language);
      
      // 直接提取节点，避免创建中间数组
      const nodes: Parser.SyntaxNode[] = new Array(result.matches.length);
      for (let i = 0; i < result.matches.length; i++) {
        nodes[i] = result.matches[i].node;
      }
      
      // 预缓存结果
      QueryCache.setResult(cacheKey, nodes);
      
      return nodes;
    } catch (error) {
      // 如果查询执行失败，返回空数组
      return [];
    }
  }

  /**
   * 查找函数 - 优化版本，带预缓存，减少对象创建
   */
  static async findFunctions(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'functions', language);
  }

  /**
   * 查找类 - 使用通用优化方法
   */
  static async findClasses(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'classes', language);
  }

  /**
   * 查找导入 - 使用通用优化方法
   */
  static async findImports(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'imports', language);
  }

  /**
   * 查找导出 - 使用通用优化方法
   */
  static async findExports(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'exports', language);
  }

  /**
   * 查找方法 - 使用通用优化方法
   */
  static async findMethods(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'methods', language);
  }

  /**
   * 查找接口 - 使用通用优化方法
   */
  static async findInterfaces(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'interfaces', language);
  }

  /**
   * 查找类型定义 - 使用通用优化方法
   */
  static async findTypes(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'types', language);
  }

  /**
   * 查找属性 - 使用通用优化方法
   */
  static async findProperties(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'properties', language);
  }

  /**
   * 查找变量 - 使用通用优化方法
   */
  static async findVariables(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    return this.optimizedQuery(ast, 'variables', language);
  }

  /**
   * 批量查找多种类型的节点 - 优化版本，使用轻量级数据结构
   */
 static async findMultiple(
    ast: Parser.SyntaxNode,
    language: string,
    types: string[]
  ): Promise<Map<string, Parser.SyntaxNode[]>> {
    // 检查AST是否有效
    if (!ast) {
      // 返回一个包含所有请求类型但都为空数组的Map
      const resultMap = new Map<string, Parser.SyntaxNode[]>();
      for (const type of types) {
        resultMap.set(type, []);
      }
      return resultMap;
    }
    
    const batchCacheKey = this.BATCH_CACHE_PREFIX + this.generateBatchCacheKey(ast, types, language);
    
    // 检查批量缓存
    const batchCached = QueryCache.getResult(batchCacheKey);
    if (batchCached) {
      return batchCached;
    }

    // 使用Map预分配容量
    const resultMap = new Map<string, Parser.SyntaxNode[]>();
    
    // 使用并行查询提升性能，同时利用单个查询的缓存
    const queryPromises = types.map(async (type) => {
      // 首先检查单个查询缓存
      const singleCacheKey = this.CACHE_PREFIX + this.generateCacheKey(ast, type, language);
      const singleCached = QueryCache.getResult(singleCacheKey);
      
      if (singleCached) {
        return { type, nodes: singleCached };
      }
      
      try {
        const result = await this.queryEngine.executeQuery(ast, type, language);
        
        // 直接提取节点，避免创建中间数组，预分配数组大小
        const nodes: Parser.SyntaxNode[] = new Array(result.matches.length);
        for (let i = 0; i < result.matches.length; i++) {
          nodes[i] = result.matches[i].node;
        }
        
        // 缓存单个查询结果
        QueryCache.setResult(singleCacheKey, nodes);
        
        return { type, nodes };
      } catch (error) {
        // 如果某个类型不支持，返回空数组
        return { type, nodes: [] };
      }
    });
    
    const queryResults = await Promise.all(queryPromises);
    
    // 填充Map
    for (let i = 0; i < queryResults.length; i++) {
      const { type, nodes } = queryResults[i];
      resultMap.set(type, nodes);
    }
    
    // 缓存批量查询结果
    QueryCache.setResult(batchCacheKey, resultMap);
    
    return resultMap;
 }

  /**
   * 查找所有主要结构（函数、类、导入、导出）
   */
 static async findAllMainStructures(ast: Parser.SyntaxNode, language: string): Promise<{
    functions: Parser.SyntaxNode[];
    classes: Parser.SyntaxNode[];
    imports: Parser.SyntaxNode[];
    exports: Parser.SyntaxNode[];
  }> {
    // 检查AST是否有效
    if (!ast) {
      return {
        functions: [],
        classes: [],
        imports: [],
        exports: []
      };
    }
    
    const results = await this.findMultiple(ast, language, ['functions', 'classes', 'imports', 'exports']);
    
    return {
      functions: results.get('functions') || [],
      classes: results.get('classes') || [],
      imports: results.get('imports') || [],
      exports: results.get('exports') || []
    };
 }

  /**
   * 获取性能统计信息
   */
  static getPerformanceStats() {
    const engineStats = this.queryEngine.getPerformanceStats();
    const allCacheStats = QueryCache.getAllStats();
    
    return {
      ...engineStats,
      allCacheStats: allCacheStats
    };
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    this.queryEngine.clearCache();
    QueryCache.clearCache();
  }

  /**
   * 预热缓存 - 为常见的查询类型预加载结果
   */
 static async warmupCache(ast: Parser.SyntaxNode, language: string): Promise<void> {
    // 检查AST是否有效
    if (!ast) {
      return; // 如果AST无效，直接返回，无需预热缓存
    }
    
    const commonTypes = ['functions', 'classes', 'imports', 'exports'];
    
    // 并行预热所有常见查询类型
    const warmupPromises = commonTypes.map(type =>
      this.findMultiple(ast, language, [type])
    );
    
    await Promise.all(warmupPromises);
 }

  /**
   * 执行详细查询 - 返回完整的QueryResult对象
   * @param ast AST节点
   * @param queryType 查询类型
   * @param language 语言
   * @returns 完整的QueryResult对象
   */
 static async executeQueryDetailed(
    ast: Parser.SyntaxNode,
    queryType: string,
    language: string
 ): Promise<QueryResult> {
    // 检查AST是否有效
    if (!ast) {
      return {
        matches: [],
        executionTime: 0,
        success: false,
        error: 'Invalid AST provided'
      };
    }
    
    const cacheKey = this.CACHE_PREFIX + this.generateCacheKey(ast, queryType, language);
    
    // 检查缓存
    const cached = QueryCache.getResult(cacheKey);
    if (cached && typeof cached === 'object' && 'matches' in cached) {
      return cached as QueryResult;
    }

    // 使用底层查询引擎执行查询
    const result = await this.queryEngine.executeQuery(ast, queryType, language);
    
    // 缓存完整结果
    QueryCache.setResult(cacheKey, result);
    
    return result;
 }

  /**
   * 批量详细查询 - 返回完整的QueryResult对象映射
   * @param ast AST节点
   * @param language 语言
   * @param types 查询类型数组
   * @returns QueryResult对象映射
   */
 static async executeMultipleDetailed(
    ast: Parser.SyntaxNode,
    language: string,
    types: string[]
  ): Promise<Map<string, QueryResult>> {
    // 检查AST是否有效
    if (!ast) {
      // 返回一个包含所有请求类型但都为错误结果的Map
      const resultMap = new Map<string, QueryResult>();
      for (const type of types) {
        resultMap.set(type, {
          matches: [],
          executionTime: 0,
          success: false,
          error: 'Invalid AST provided'
        });
      }
      return resultMap;
    }
    
    const batchCacheKey = this.BATCH_CACHE_PREFIX + this.generateBatchCacheKey(ast, types, language);
    
    // 检查批量缓存
    const batchCached = QueryCache.getResult(batchCacheKey);
    if (batchCached) {
      return batchCached;
    }

    const resultMap = new Map<string, QueryResult>();
    
    // 使用并行查询提升性能
    const queryPromises = types.map(async (type) => {
      // 首先检查单个查询缓存
      const singleCacheKey = this.CACHE_PREFIX + this.generateCacheKey(ast, type, language);
      const singleCached = QueryCache.getResult(singleCacheKey);
      
      if (singleCached && typeof singleCached === 'object' && 'matches' in singleCached) {
        return { type, result: singleCached as QueryResult };
      }
      
      try {
        const result = await this.queryEngine.executeQuery(ast, type, language);
        
        // 缓存单个查询结果
        QueryCache.setResult(singleCacheKey, result);
        
        return { type, result };
      } catch (error) {
        // 如果某个类型不支持，返回空结果
        return {
          type,
          result: {
            matches: [],
            executionTime: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        };
      }
    });
    
    const queryResults = await Promise.all(queryPromises);
    
    // 填充Map
    for (const { type, result } of queryResults) {
      resultMap.set(type, result);
    }
    
    // 缓存批量查询结果
    QueryCache.setResult(batchCacheKey, resultMap);
    
    return resultMap;
 }
}