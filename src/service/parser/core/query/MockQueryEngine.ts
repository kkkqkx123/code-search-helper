import Parser from 'tree-sitter';
import { TreeSitterQueryEngine, QueryEngineFactory } from './TreeSitterQueryEngine';

/**
 * 简化查询引擎
 * 为常见用例提供简单易用的接口
 */
export class SimpleQueryEngine {
  private static queryEngine = QueryEngineFactory.getInstance();

  /**
   * 查找函数
   */
  static async findFunctions(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'functions', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找类
   */
  static async findClasses(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'classes', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找导入
   */
  static async findImports(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'imports', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找导出
   */
  static async findExports(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'exports', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找方法
   */
  static async findMethods(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'methods', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找接口
   */
  static async findInterfaces(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'interfaces', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找类型定义
   */
  static async findTypes(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'types', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找属性
   */
  static async findProperties(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'properties', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 查找变量
   */
  static async findVariables(ast: Parser.SyntaxNode, language: string): Promise<Parser.SyntaxNode[]> {
    const queryEngine = QueryEngineFactory.getInstance();
    const result = await queryEngine.executeQuery(ast, 'variables', language);
    return result.matches.map(match => match.node);
  }

  /**
   * 批量查找多种类型的节点
   */
  static async findMultiple(
    ast: Parser.SyntaxNode, 
    language: string, 
    types: string[]
  ): Promise<Map<string, Parser.SyntaxNode[]>> {
    const queryEngine = QueryEngineFactory.getInstance();
    const results = new Map<string, Parser.SyntaxNode[]>();
    
    for (const type of types) {
      try {
        const result = await queryEngine.executeQuery(ast, type, language);
        results.set(type, result.matches.map(match => match.node));
      } catch (error) {
        // 如果某个类型不支持，跳过它
        results.set(type, []);
      }
    }
    
    return results;
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
    return this.queryEngine.getPerformanceStats();
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    this.queryEngine.clearCache();
  }
}