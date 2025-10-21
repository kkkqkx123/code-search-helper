import Parser from 'tree-sitter';
import { CodeChunk } from '../types';
import { QueryRegistryImpl } from './QueryRegistry';
import { LoggerService } from '../../../../utils/LoggerService';

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
      await this.queryRegistry.initialize();
      await this.loadPatternsFromRegistry();
      this.initialized = true;
      this.logger.info('TreeSitterQueryEngine 初始化完成');
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
      return {
        matches: [],
        executionTime: Date.now() - startTime,
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
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 执行查询
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