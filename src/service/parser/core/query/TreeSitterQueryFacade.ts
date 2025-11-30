import Parser from 'tree-sitter';
import { 
  TreeSitterQueryEngine, 
  MixedQueryResult,
  QueryExecutionOptions,
  EntityQueryResult,
  RelationshipQueryResult
} from './TreeSitterQueryExecutor';
import { QueryCache } from './QueryCache';
import { EntityType, RelationshipType } from './types';

/**
 * 简化查询引擎门面
 * 为常见用例提供简单易用的接口
 */
export class TreeSitterQueryFacade {
  private static queryEngine: TreeSitterQueryEngine;
  
  /**
   * 获取或创建TreeSitterQueryEngine的单例实例
   * @returns TreeSitterQueryEngine实例
   */
  private static getOrCreateEngine(): TreeSitterQueryEngine {
    if (!this.queryEngine) {
      this.queryEngine = new TreeSitterQueryEngine();
    }
    return this.queryEngine;
  }
  
  /**
   * 重置单例实例（主要用于测试）
   */
  static resetInstance(): void {
    this.queryEngine = null as any;
  }
  
  /**
   * 检查实例是否已初始化
   * @returns 是否已初始化
   */
  static isInitialized(): boolean {
    return this.queryEngine !== undefined;
  }

  // 缓存键前缀，避免与其他引擎冲突
  private static readonly CACHE_PREFIX = 'simple:';
  private static readonly BATCH_CACHE_PREFIX = 'batch:';

  /**
   * 生成缓存键
   */
  private static generateCacheKey(ast: Parser.SyntaxNode, queryType: string, language: string): string {
    return QueryCache.forSimpleQuery(ast, queryType, language);
  }

  /**
   * 生成批量查询缓存键
   */
  private static generateBatchCacheKey(ast: Parser.SyntaxNode, types: string[], language: string): string {
    return QueryCache.forBatchQuery(ast, types, language);
  }

  /**
   * 执行实体查询 - 返回类型化的实体结果
   * @param ast AST节点
   * @param entityType 实体类型
   * @param language 语言
   * @param options 查询选项
   * @returns 实体查询结果数组
   */
  static async executeEntityQuery(
    ast: Parser.SyntaxNode,
    entityType: EntityType,
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<EntityQueryResult[]> {
    // 检查AST是否有效
    if (!ast) {
      return [];
    }

    return await this.getOrCreateEngine().executeEntityQuery(ast, entityType, language, options);
  }

  /**
   * 执行关系查询 - 返回类型化的关系结果
   * @param ast AST节点
   * @param relationshipType 关系类型
   * @param language 语言
   * @param options 查询选项
   * @returns 关系查询结果数组
   */
  static async executeRelationshipQuery(
    ast: Parser.SyntaxNode,
    relationshipType: RelationshipType,
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<RelationshipQueryResult[]> {
    // 检查AST是否有效
    if (!ast) {
      return [];
    }

    return await this.getOrCreateEngine().executeRelationshipQuery(ast, relationshipType, language, options);
  }

  /**
   * 执行混合查询 - 返回实体和关系的组合结果
   * @param ast AST节点
   * @param queryTypes 查询类型数组
   * @param language 语言
   * @param options 查询选项
   * @returns 混合查询结果
   */
  static async executeMixedQuery(
    ast: Parser.SyntaxNode,
    queryTypes: string[],
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<MixedQueryResult> {
    // 检查AST是否有效
    if (!ast) {
      return {
        entities: [],
        relationships: [],
        executionTime: 0,
        success: false,
        error: 'Invalid AST provided'
      };
    }

    return await this.getOrCreateEngine().executeMixedQuery(ast, queryTypes, language, options);
  }

  /**
   * 批量执行实体查询
   * @param ast AST节点
   * @param entityTypes 实体类型数组
   * @param language 语言
   * @param options 查询选项
   * @returns 实体类型到结果数组的映射
   */
  static async executeMultipleEntityQueries(
    ast: Parser.SyntaxNode,
    entityTypes: EntityType[],
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<Map<EntityType, EntityQueryResult[]>> {
    // 检查AST是否有效
    if (!ast) {
      return new Map();
    }

    return await this.getOrCreateEngine().executeMultipleEntityQueries(ast, entityTypes, language, options);
  }

  /**
   * 批量执行关系查询
   * @param ast AST节点
   * @param relationshipTypes 关系类型数组
   * @param language 语言
   * @param options 查询选项
   * @returns 关系类型到结果数组的映射
   */
  static async executeMultipleRelationshipQueries(
    ast: Parser.SyntaxNode,
    relationshipTypes: RelationshipType[],
    language: string,
    options: QueryExecutionOptions = {}
  ): Promise<Map<RelationshipType, RelationshipQueryResult[]>> {
    // 检查AST是否有效
    if (!ast) {
      return new Map();
    }

    return await this.getOrCreateEngine().executeMultipleRelationshipQueries(ast, relationshipTypes, language, options);
  }

  /**
   * 查找函数 - 简化方法
   */
  static async findFunctions(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.FUNCTION, language);
  }

  /**
   * 查找类型定义 - 简化方法
   */
  static async findTypes(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.TYPE_DEFINITION, language);
  }

  /**
   * 查找变量 - 简化方法
   */
  static async findVariables(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.VARIABLE, language);
  }

  /**
   * 查找预处理器 - 简化方法
   */
  static async findPreprocessors(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.PREPROCESSOR, language);
  }

  /**
   * 查找注解 - 简化方法
   */
  static async findAnnotations(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.ANNOTATION, language);
  }

  /**
   * 查找类 - 简化方法
   */
  static async findClasses(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.TYPE_DEFINITION, language);
  }

  /**
   * 查找导入 - 简化方法
   */
  static async findImports(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.INCLUDE, language) as Promise<any>;
  }

  /**
   * 查找导出 - 简化方法
   */
  static async findExports(ast: Parser.SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.executeEntityQuery(ast, EntityType.FUNCTION, language);
  }

  /**
   * 查找调用关系 - 简化方法
   */
  static async findCalls(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.CALL, language);
  }

  /**
   * 查找数据流关系 - 简化方法
   */
  static async findDataFlow(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.ASSIGNMENT, language);
  }

  /**
   * 查找控制流关系 - 简化方法
   */
  static async findControlFlow(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.CONDITIONAL, language);
  }

  /**
   * 查找依赖关系 - 简化方法
   */
  static async findDependencies(ast: Parser.SyntaxNode, language: string): Promise<RelationshipQueryResult[]> {
    return this.executeRelationshipQuery(ast, RelationshipType.INCLUDE, language);
  }

  /**
   * 查找所有主要结构（函数、类型、变量）
   */
  static async findAllMainStructures(ast: Parser.SyntaxNode, language: string): Promise<{
    functions: EntityQueryResult[];
    types: EntityQueryResult[];
    variables: EntityQueryResult[];
  }> {
    // 检查AST是否有效
    if (!ast) {
      return {
        functions: [],
        types: [],
        variables: []
      };
    }

    const [functions, types, variables] = await Promise.all([
      this.findFunctions(ast, language),
      this.findTypes(ast, language),
      this.findVariables(ast, language)
    ]);

    return {
      functions,
      types,
      variables
    };
  }

  /**
   * 获取性能统计信息
   */
  static getPerformanceStats() {
    return this.getOrCreateEngine().getPerformanceStats();
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    this.getOrCreateEngine().clearCache();
    QueryCache.clearCache();
  }

  /**
   * 预热缓存 - 为常见的查询类型预加载结果
   */
  static async warmupCache(ast: Parser.SyntaxNode, language: string): Promise<void> {
    // 检查AST是否有效
    if (!ast) {
      return;
    }

    const commonEntityTypes = [EntityType.FUNCTION, EntityType.TYPE_DEFINITION, EntityType.VARIABLE];
    const commonRelationshipTypes = [RelationshipType.CALL, RelationshipType.ASSIGNMENT];

    // 并行预热所有常见查询类型
    const warmupPromises = [
      this.executeMultipleEntityQueries(ast, commonEntityTypes, language),
      this.executeMultipleRelationshipQueries(ast, commonRelationshipTypes, language)
    ];

    await Promise.all(warmupPromises);
  }
}