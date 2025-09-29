import Parser from 'tree-sitter';
import { CodeChunk } from '../types';

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
 * Tree-sitter查询引擎
 */
export class TreeSitterQueryEngine {
  private patterns: Map<string, QueryPattern> = new Map();
  private cache: Map<string, QueryResult> = new Map();

  constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * 初始化默认查询模式
   */
  private initializeDefaultPatterns(): void {
    // TypeScript/JavaScript 函数查询
    this.addPattern({
      name: 'function_declaration',
      description: 'Find function declarations',
      pattern: `(function_declaration
        name: (identifier) @function.name
        body: (block) @function.body
      ) @function`,
      languages: ['typescript', 'javascript'],
      captures: {
        'function': '整个函数',
        'function.name': '函数名称',
        'function.body': '函数体'
      }
    });

    // TypeScript/JavaScript 类查询
    this.addPattern({
      name: 'class_declaration',
      description: 'Find class declarations',
      pattern: `(class_declaration
        name: (identifier) @class.name
        body: (class_body) @class.body
      ) @class`,
      languages: ['typescript', 'javascript'],
      captures: {
        'class': '整个类',
        'class.name': '类名称',
        'class.body': '类体'
      }
    });

    // Python 函数查询
    this.addPattern({
      name: 'python_function',
      description: 'Find Python function definitions',
      pattern: `(function_definition
        name: (identifier) @function.name
        body: (block) @function.body
      ) @function`,
      languages: ['python'],
      captures: {
        'function': '整个函数',
        'function.name': '函数名称',
        'function.body': '函数体'
      }
    });

    // Python 类查询
    this.addPattern({
      name: 'python_class',
      description: 'Find Python class definitions',
      pattern: `(class_definition
        name: (identifier) @class.name
        body: (block) @class.body
      ) @class`,
      languages: ['python'],
      captures: {
        'class': '整个类',
        'class.name': '类名称',
        'class.body': '类体'
      }
    });

    // 控制结构查询
    this.addPattern({
      name: 'control_structures',
      description: 'Find control structures',
      pattern: `[
        (if_statement) @if
        (for_statement) @for
        (while_statement) @while
        (switch_statement) @switch
      ]`,
      languages: ['typescript', 'javascript', 'java', 'c', 'cpp'],
      captures: {
        'if': 'if语句',
        'for': 'for循环',
        'while': 'while循环',
        'switch': 'switch语句'
      }
    });

    // 错误处理查询
    this.addPattern({
      name: 'error_handling',
      description: 'Find error handling structures',
      pattern: `(try_statement
        body: (block) @try.body
        (catch_clause
          parameter: (catch_parameter) @catch.param
          body: (block) @catch.body
        )? @catch
        (finally_clause
          body: (block) @finally.body
        )? @finally
      ) @try`,
      languages: ['typescript', 'javascript', 'java', 'c', 'cpp'],
      captures: {
        'try': 'try语句',
        'try.body': 'try块',
        'catch': 'catch子句',
        'catch.param': 'catch参数',
        'catch.body': 'catch块',
        'finally': 'finally子句',
        'finally.body': 'finally块'
      }
    });
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
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 执行查询（这里使用模拟实现，实际应该使用tree-sitter的Query API）
      const matches = this.executeQueryPattern(ast, pattern);

      const result: QueryResult = {
        matches,
        executionTime: Date.now() - startTime,
        success: true
      };

      // 缓存结果
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      return {
        matches: [],
        executionTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 批量执行查询
   */
  async executeMultipleQueries(
    ast: Parser.SyntaxNode,
    patternNames: string[],
    language: string
  ): Promise<Map<string, QueryResult>> {
    const results = new Map<string, QueryResult>();

    for (const patternName of patternNames) {
      const result = await this.executeQuery(ast, patternName, language);
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
    this.cache.clear();
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(ast: Parser.SyntaxNode, patternName: string, language: string): string {
    const nodeHash = this.hashNode(ast);
    return `${nodeHash}:${patternName}:${language}`;
  }

  /**
   * 执行查询模式（模拟实现）
   */
  private executeQueryPattern(ast: Parser.SyntaxNode, pattern: QueryPattern): QueryMatch[] {
    // 这里应该使用真正的tree-sitter Query API
    // 目前使用模拟实现

    const matches: QueryMatch[] = [];

    // 简化的模式匹配逻辑
    const targetTypes = this.extractTargetTypesFromPattern(pattern.pattern);

    // 遍历AST查找匹配的节点
    this.traverseAST(ast, (node) => {
      if (targetTypes.has(node.type)) {
        const captures = this.extractCaptures(node, pattern);
        const location = this.getNodeLocation(node);

        matches.push({
          node,
          captures,
          location
        });
      }
    });

    return matches;
  }

  /**
   * 从查询模式中抽取目标类型
   */
  private extractTargetTypesFromPattern(pattern: string): Set<string> {
    const types = new Set<string>();

    // 简化的类型抽取
    const typeRegex = /\((\w+(?:\.[\w-]+)*)\s+/g;
    let match;

    while ((match = typeRegex.exec(pattern)) !== null) {
      types.add(match[1]);
    }

    return types;
  }

  /**
   * 遍历AST
   */
  private traverseAST(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.traverseAST(child, callback);
      }
    }
  }

  /**
   * 抽取捕获
   */
  private extractCaptures(node: Parser.SyntaxNode, pattern: QueryPattern): Record<string, Parser.SyntaxNode> {
    const captures: Record<string, Parser.SyntaxNode> = {};

    // 简化的捕获抽取逻辑
    for (const [captureName, description] of Object.entries(pattern.captures)) {
      if (captureName !== pattern.name) {
        captures[captureName] = node;
      }
    }

    return captures;
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
   * 计算节点哈希
   */
  private hashNode(node: Parser.SyntaxNode): string {
    return `${node.type}:${node.startIndex}:${node.endIndex}`;
  }
}

/**
 * 查询引擎工厂
 */
export class QueryEngineFactory {
  private static instance: TreeSitterQueryEngine;

  static getInstance(): TreeSitterQueryEngine {
    if (!this.instance) {
      this.instance = new TreeSitterQueryEngine();
    }
    return this.instance;
  }
}