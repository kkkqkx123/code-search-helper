import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { TreeSitterUtils } from '../../utils/TreeSitterUtils';
import { FallbackExtractor } from '../../utils/FallbackExtractor';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { LanguageDetector } from '../language-detection/LanguageDetector';
import { languageExtensionMap } from '../../utils';
import { QueryManager } from '../query/QueryManager';
import { QueryRegistryImpl } from '../query/QueryRegistry';
import { DynamicParserManager, DynamicParserLanguage, DynamicParseResult } from './DynamicParserManager';
import { TreeSitterQueryFacade } from '../query/TreeSitterQueryFacade';
import { TreeSitterQueryEngine } from '../query/TreeSitterQueryExecutor';
import { QueryEngineFactory } from '../query/QueryEngineFactory';
import { GlobalQueryInitializer } from '../query/GlobalQueryInitializer';

export interface ParserLanguage {
  name: string;
  parser?: any;
  fileExtensions: string[];
  supported: boolean;
}

export interface ParseResult {
  ast: Parser.SyntaxNode;
  language: ParserLanguage;
  parseTime: number;
  success: boolean;
  error?: string;
  fromCache?: boolean;
}

/**
 * Tree-sitter 核心服务 - 优化版本
 * 集成了新的查询系统和性能监控
 */
@injectable()
export class TreeSitterCoreService {
  private dynamicManager: DynamicParserManager;
  private initialized: boolean = false;
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private performanceStats = {
    totalParseTime: 0,
    totalParseCount: 0,
    averageParseTime: 0,
    maxParseTime: 0,
    minParseTime: Number.MAX_VALUE,
  };
  private languageDetector: LanguageDetector;
  private extensionMap = languageExtensionMap;
  private useOptimizedQueries: boolean = true; // 优化查询系统开关
  private queryRegistry = QueryRegistryImpl;
  private querySystemInitialized = false;
  private logger = new LoggerService();
  private errorHandler: ErrorHandlerService;
  private queryEngine: TreeSitterQueryEngine;

  constructor() {
    this.languageDetector = new LanguageDetector();
    this.dynamicManager = new DynamicParserManager();
    this.errorHandler = new ErrorHandlerService(this.logger);
    this.queryEngine = QueryEngineFactory.getInstance();

    // 异步初始化查询系统
    this.initializeQuerySystem();

    // 等待动态管理器初始化
    this.waitForInitialization();
  }

  /**
   * 等待初始化完成
   */
  private async waitForInitialization(): Promise<void> {
    const maxWaitTime = 10000; // 10秒超时
    const startTime = Date.now();

    while (!this.dynamicManager.isInitialized() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.dynamicManager.isInitialized()) {
      this.initialized = true;
      this.logger.info('TreeSitterCoreService 初始化完成');
    } else {
      this.logger.error('TreeSitterCoreService 初始化超时');
      this.initialized = false;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): ParserLanguage[] {
    const dynamicLanguages = this.dynamicManager.getSupportedLanguages();

    // 转换为旧的接口格式以保持向后兼容
    return dynamicLanguages.map(lang => ({
      name: lang.name,
      parser: lang.parser,
      fileExtensions: lang.fileExtensions,
      supported: lang.supported,
    }));
  }

  /**
   * 检测语言
   */
  async detectLanguage(filePath: string, content?: string): Promise<ParserLanguage | null> {
    // 使用核心语言检测器进行检测
    const detectionResult = await this.languageDetector.detectLanguage(filePath, content);
    if (detectionResult.language) {
      const supportedLanguages = this.getSupportedLanguages();
      const foundLanguage = supportedLanguages.find(lang =>
        lang.name.toLowerCase() === detectionResult.language?.toLowerCase()
      );

      if (foundLanguage) {
        return foundLanguage;
      }
    }

    // 回退到基于扩展名的检测方法
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (!extension) {
      return null;
    }

    const supportedLanguages = this.getSupportedLanguages();
    for (const lang of supportedLanguages) {
      if (lang.fileExtensions.includes(`.${extension}`)) {
        return lang;
      }
    }

    return null;
  }

  /**
   * 解析代码
   */
  async parseCode(code: string, language: string): Promise<ParseResult> {
    const startTime = Date.now();

    try {
      // 使用动态管理器解析
      const dynamicResult = await this.dynamicManager.parseCode(code, language);

      // 转换为旧的接口格式
      const result: ParseResult = {
        ast: dynamicResult.ast,
        language: {
          name: dynamicResult.language.name,
          parser: dynamicResult.language.parser,
          fileExtensions: dynamicResult.language.fileExtensions,
          supported: dynamicResult.language.supported,
        },
        parseTime: dynamicResult.parseTime,
        success: dynamicResult.success,
        error: dynamicResult.error,
        fromCache: dynamicResult.fromCache,
      };

      // 更新性能统计
      this.updatePerformanceStats(result.parseTime);

      return result;
    } catch (error) {
      this.logger.error(`解析 ${language} 代码失败:`, error);

      return {
        ast: {} as Parser.SyntaxNode,
        language: {
          name: language,
          fileExtensions: this.extensionMap.getExtensionsByLanguage(language),
          supported: false,
        },
        parseTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fromCache: false,
      };
    }
  }

  /**
   * 解析文件
   */
  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    // 首先检查文件扩展名是否受支持
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (!extension) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const supportedLanguages = this.getSupportedLanguages();
    let isExtensionSupported = false;
    for (const lang of supportedLanguages) {
      if (lang.fileExtensions.includes(`.${extension}`)) {
        isExtensionSupported = true;
        break;
      }
    }

    if (!isExtensionSupported) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const language = await this.detectLanguage(filePath, content);
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    return this.parseCode(content, language.name.toLowerCase());
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized && this.dynamicManager.isInitialized();
  }

  /**
   * 获取节点文本
   */
  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return TreeSitterUtils.getNodeText(node, sourceCode);
  }

  /**
   * 获取节点位置
   */
  getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return TreeSitterUtils.getNodeLocation(node);
  }

  /**
   * 按类型查找节点 - 保持同步特性，优先使用优化查询
   */
  findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    // 生成缓存键
    const cacheKey = `${this.getNodeHash(ast)}:${type}`;

    // 使用动态管理器的缓存机制
    const result = this.dynamicManager['nodeCache']?.get(cacheKey);
    if (result) {
      this.cacheStats.hits++;
      return result;
    }

    this.cacheStats.misses++;

    // 对于同步方法，使用 FallbackExtractor 作为主要实现
    // TreeSitterQueryFacade 主要用于异步查询场景
    const nodes = FallbackExtractor.extractNodesByTypes(ast, new Set([type]));

    // 缓存结果
    if (this.dynamicManager['nodeCache']) {
      this.dynamicManager['nodeCache'].set(cacheKey, nodes);
    }

    return nodes;
  }

  /**
   * 异步版本的按类型查找节点 - 优先使用 TreeSitterQueryFacade
   */
  async findNodeByTypeAsync(ast: Parser.SyntaxNode, type: string): Promise<Parser.SyntaxNode[]> {
    // 生成缓存键
    const cacheKey = `${this.getNodeHash(ast)}:${type}`;

    // 使用动态管理器的缓存机制
    const result = this.dynamicManager['nodeCache']?.get(cacheKey);
    if (result) {
      this.cacheStats.hits++;
      return result;
    }

    this.cacheStats.misses++;

    // 优先使用 TreeSitterQueryFacade
    const lang = this.detectLanguageFromAST(ast);
    if (this.useOptimizedQueries && this.querySystemInitialized && lang) {
      try {
        const queryResults = await TreeSitterQueryFacade.findMultiple(ast, lang, [type]);
        const nodes = queryResults.get(type) || [];

        // 缓存结果
        if (this.dynamicManager['nodeCache']) {
          this.dynamicManager['nodeCache'].set(cacheKey, nodes);
        }

        return nodes;
      } catch (error) {
        this.logger.warn('异步查询失败，回退到 FallbackExtractor:', error);
      }
    }

    // 回退到 FallbackExtractor
    const nodes = FallbackExtractor.extractNodesByTypes(ast, new Set([type]));

    // 缓存结果
    if (this.dynamicManager['nodeCache']) {
      this.dynamicManager['nodeCache'].set(cacheKey, nodes);
    }

    return nodes;
  }

  /**
   * 查询语法树 - 使用优化后的查询引擎
   */
  queryTree(
    ast: Parser.SyntaxNode,
    pattern: string
  ): Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }> {
    try {
      // 获取树和语言信息
      const tree = (ast as any).tree;
      if (!tree) {
        throw new Error('无法从AST节点确定树');
      }

      const language = tree.language;
      if (!language) {
        throw new Error('无法从树确定语言');
      }

      // 使用优化后的查询引擎
      const query = new Parser.Query(language, pattern);
      const matches = query.matches(ast);

      // 转换结果格式
      return matches.map(match => ({
        captures: match.captures.map(capture => ({
          name: capture.name,
          node: capture.node
        }))
      }));
    } catch (error) {
      this.logger.error('查询树失败:', error);
      return [];
    }
  }

  /**
   * 批量节点查询优化
   */
  findNodesByTypes(ast: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const cacheKey = `${this.getNodeHash(ast)}:${types.join(',')}`;

    // 检查缓存
    const cachedNodes = this.dynamicManager['nodeCache']?.get(cacheKey);
    if (cachedNodes) {
      this.cacheStats.hits++;
      return cachedNodes;
    }

    this.cacheStats.misses++;
    const results: Parser.SyntaxNode[] = [];

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (types.includes(node.type)) {
        results.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);

    // 缓存结果
    if (this.dynamicManager['nodeCache']) {
      this.dynamicManager['nodeCache'].set(cacheKey, results);
    }

    return results;
  }

  /**
   * 提取函数 - 使用优化后的查询系统
   */
  async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      let lang = language;

      // 如果没有提供语言参数，尝试从AST检测
      if (!lang) {
        const detectedLang = this.detectLanguageFromAST(ast);
        if (detectedLang) {
          lang = detectedLang;
        }
      }

      this.logger.debug(`使用语言参数: ${lang || '未知'}`);

      // 使用优化后的查询系统
      if (this.useOptimizedQueries && this.querySystemInitialized && lang) {
        try {
          const result = await TreeSitterQueryFacade.findFunctions(ast, lang);
          // 如果优化查询系统返回空结果，使用 FallbackExtractor
          if (result.length === 0) {
            this.logger.warn('优化查询系统返回空结果，使用 FallbackExtractor');
            return await FallbackExtractor.extractFunctions(ast, lang);
          }
          return result;
        } catch (error) {
          this.logger.warn('优化查询系统失败，使用 FallbackExtractor:', error);
          return await FallbackExtractor.extractFunctions(ast, lang);
        }
      }

      // 直接使用 FallbackExtractor（包含语言特定查询和回退机制）
      return await FallbackExtractor.extractFunctions(ast, lang);
    } catch (error) {
      this.logger.error('函数提取失败:', error);
      return await FallbackExtractor.extractFunctions(ast, language);
    }
  }

  /**
   * 提取类 - 使用优化后的查询系统
   */
  async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      let lang = language;

      // 如果没有提供语言参数，尝试从AST检测
      if (!lang) {
        const detectedLang = this.detectLanguageFromAST(ast);
        if (detectedLang) {
          lang = detectedLang;
        }
      }

      this.logger.debug(`使用语言参数: ${lang || '未知'}`);

      // 使用优化后的查询系统
      if (this.useOptimizedQueries && this.querySystemInitialized && lang) {
        try {
          const result = await TreeSitterQueryFacade.findClasses(ast, lang);
          // 如果优化查询系统返回空结果，使用 FallbackExtractor
          if (result.length === 0) {
            this.logger.warn('优化查询系统返回空结果，使用 FallbackExtractor');
            return await FallbackExtractor.extractClasses(ast, lang);
          }
          return result;
        } catch (error) {
          this.logger.warn('优化查询系统失败，使用 FallbackExtractor:', error);
          return await FallbackExtractor.extractClasses(ast, lang);
        }
      }

      // 直接使用 FallbackExtractor（包含语言特定查询和回退机制）
      return await FallbackExtractor.extractClasses(ast, lang);
    } catch (error) {
      this.logger.error('类提取失败:', error);
      return await FallbackExtractor.extractClasses(ast, language);
    }
  }

  /**
   * 提取导入 - 使用优化后的查询系统
   */
  async extractImports(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      let lang = language;

      // 如果没有提供语言参数，尝试从AST检测
      if (!lang) {
        const detectedLang = this.detectLanguageFromAST(ast);
        if (detectedLang) {
          lang = detectedLang;
        }
      }

      this.logger.debug(`使用语言参数: ${lang || '未知'}`);

      // 使用优化后的查询系统
      if (this.useOptimizedQueries && this.querySystemInitialized && lang) {
        try {
          const result = await TreeSitterQueryFacade.findImports(ast, lang);
          // 如果优化查询系统返回空结果，使用 FallbackExtractor
          if (result.length === 0) {
            this.logger.warn('优化查询系统返回空结果，使用 FallbackExtractor');
            return await FallbackExtractor.extractImports(ast, lang);
          }
          return result;
        } catch (error) {
          this.logger.warn('优化查询系统失败，使用 FallbackExtractor:', error);
          return await FallbackExtractor.extractImports(ast, lang);
        }
      }

      // 直接使用 FallbackExtractor（包含语言特定查询和回退机制）
      return await FallbackExtractor.extractImports(ast, lang);
    } catch (error) {
      this.logger.error('导入提取失败:', error);
      return await FallbackExtractor.extractImports(ast, language);
    }
  }

  /**
   * 提取导出 - 使用优化后的查询系统
   */
  async extractExports(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      let lang = language;

      // 如果没有提供语言参数，尝试从AST检测
      if (!lang) {
        const detectedLang = this.detectLanguageFromAST(ast);
        if (detectedLang) {
          lang = detectedLang;
        }
      }

      this.logger.debug(`使用语言参数: ${lang || '未知'}`);

      // 使用优化后的查询系统
      if (this.useOptimizedQueries && this.querySystemInitialized && lang) {
        try {
          const result = await TreeSitterQueryFacade.findExports(ast, lang);
          // 如果优化查询系统返回空结果，使用 FallbackExtractor
          if (result.length === 0) {
            this.logger.warn('优化查询系统返回空结果，使用 FallbackExtractor');
            return await FallbackExtractor.extractExports(ast, lang);
          }
          return result;
        } catch (error) {
          this.logger.warn('优化查询系统失败，使用 FallbackExtractor:', error);
          return await FallbackExtractor.extractExports(ast, lang);
        }
      }

      // 直接使用 FallbackExtractor（包含语言特定查询和回退机制）
      return await FallbackExtractor.extractExports(ast, lang);
    } catch (error) {
      this.logger.error('导出提取失败:', error);
      return await FallbackExtractor.extractExports(ast, language);
    }
  }

  /**
   * 将导出字符串转换为节点数组
   */
  private convertExportStringsToNodes(exportStrings: string[], ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const exportNodes: Parser.SyntaxNode[] = [];

    const exportTypes = new Set([
      'export_statement',
      'export_clause',
      'export_specifier',
      'export_default_declaration',
      'export_named_declaration',
      'export_all_declaration',
      'export_as_clause',
    ]);

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (exportTypes.has(node.type)) {
        const nodeText = this.getNodeText(node, '');
        if (exportStrings.some(exportStr => nodeText.includes(exportStr))) {
          exportNodes.push(node);
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return exportNodes;
  }

  /**
   * 获取节点名称
   */
  getNodeName(node: Parser.SyntaxNode): string {
    // 尝试从AST检测语言
    const language = this.detectLanguageFromAST(node);
    return FallbackExtractor.getNodeName(node, language || undefined);
  }

  /**
   * 提取导入节点 - 同步版本
   */
  extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return FallbackExtractor.extractImportNodes(ast);
  }

  /**
   * 提取导入节点 - 异步版本，优先使用 TreeSitterQueryFacade
   */
  async extractImportNodesAsync(ast: Parser.SyntaxNode): Promise<Parser.SyntaxNode[]> {
    const lang = this.detectLanguageFromAST(ast);

    // 优先使用优化后的查询系统
    if (this.useOptimizedQueries && this.querySystemInitialized && lang) {
      try {
        return await TreeSitterQueryFacade.findImports(ast, lang);
      } catch (error) {
        this.logger.warn('异步导入提取失败，回退到 FallbackExtractor:', error);
      }
    }

    // 回退到 FallbackExtractor
    return FallbackExtractor.extractImportNodes(ast);
  }

  /**
   * 获取语言扩展名映射
   */
  getLanguageExtensionMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const supportedLanguages = this.getSupportedLanguages();

    supportedLanguages.forEach(lang => {
      if (lang.supported) {
        map.set(lang.name.toLowerCase(), lang.fileExtensions);
      }
    });

    return map;
  }

  /**
   * 异步初始化查询系统
   */
  private async initializeQuerySystem(): Promise<void> {
    try {
      // 使用全局初始化管理器避免重复初始化
      const success = await GlobalQueryInitializer.initialize();
      if (success) {
        this.querySystemInitialized = true;
        this.logger.info('查询系统初始化完成');
      } else {
        this.logger.warn('查询系统初始化失败，使用回退机制');
        this.useOptimizedQueries = false;
      }
    } catch (error) {
      this.logger.error('查询系统初始化失败:', error);
      // 即使初始化失败，服务仍可运行（使用回退机制）
      this.useOptimizedQueries = false;
    }
  }

  /**
   * 从AST检测语言
   */
  private detectLanguageFromAST(ast: Parser.SyntaxNode): string | null {
    const tree = (ast as any).tree;
    if (tree && tree.language && tree.language.name) {
      const languageName = tree.language.name;
      const languageMap: Record<string, string> = {
        'typescript': 'typescript',
        'javascript': 'javascript',
        'python': 'python',
        'java': 'java',
        'go': 'go',
        'rust': 'rust',
        'cpp': 'cpp',
        'c': 'c',
        'c_sharp': 'csharp',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'ruby': 'ruby',
        'php': 'php',
        'scala': 'scala'
      };

      return languageMap[languageName] || languageName;
    }

    return null;
  }

  /**
   * 回退机制：函数提取
   */
  private legacyExtractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    this.logger.warn('使用回退机制提取函数');
    const functions: Parser.SyntaxNode[] = [];

    const functionTypes = new Set([
      'function_declaration',
      'function_definition',
      'method_definition',
      'arrow_function',
      'function_expression',
      'generator_function',
      'generator_function_declaration',
      'method_signature',
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration',
      'operator_declaration',
    ]);

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (functionTypes.has(node.type)) {
        functions.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return functions;
  }

  /**
   * 回退机制：类提取
   */
  private legacyExtractClasses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    this.logger.warn('使用回退机制提取类');
    const classes: Parser.SyntaxNode[] = [];

    const classTypes = new Set([
      'class_declaration',
      'class_definition',
      'class_expression',
      'interface_declaration',
      'interface_definition',
      'struct_definition',
      'enum_declaration',
      'type_alias_declaration',
      'trait_definition',
      'object_definition',
    ]);

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (classTypes.has(node.type)) {
        classes.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return classes;
  }

  /**
   * 回退机制：导出提取
   */
  private legacyExtractExports(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    this.logger.warn('使用回退机制提取导出');
    const exports: Parser.SyntaxNode[] = [];

    const exportTypes = new Set([
      'export_statement',
      'export_clause',
      'export_specifier',
      'export_default_declaration',
      'export_named_declaration',
      'export_all_declaration',
      'export_as_clause',
    ]);

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (exportTypes.has(node.type)) {
        exports.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return exports;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const dynamicStats = this.dynamicManager.getCacheStats();
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.cacheStats,
      totalRequests: total,
      hitRate: `${hitRate}%`,
      dynamicManagerStats: dynamicStats,
    };
  }

  /**
   * 获取性能统计信息 - 包含优化查询系统的统计
   */
  getPerformanceStats() {
    const dynamicStats = this.dynamicManager.getPerformanceStats();
    let queryEngineStats = null;

    if (this.useOptimizedQueries && this.querySystemInitialized) {
      queryEngineStats = this.queryEngine.getPerformanceStats();
    }

    return {
      ...this.performanceStats,
      cacheStats: this.getCacheStats(),
      dynamicManagerStats: dynamicStats,
      queryEngineStats,
      useOptimizedQueries: this.useOptimizedQueries,
      querySystemInitialized: this.querySystemInitialized,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.dynamicManager.clearCache();
    if (this.useOptimizedQueries && this.querySystemInitialized) {
      this.queryEngine.clearCache();
    }
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    this.logger.info('TreeSitterCoreService 缓存已清除');
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(parseTime: number): void {
    this.performanceStats.totalParseTime += parseTime;
    this.performanceStats.totalParseCount++;
    this.performanceStats.averageParseTime = this.performanceStats.totalParseTime / this.performanceStats.totalParseCount;
    this.performanceStats.maxParseTime = Math.max(this.performanceStats.maxParseTime, parseTime);
    this.performanceStats.minParseTime = Math.min(this.performanceStats.minParseTime, parseTime);
  }

  /**
   * 计算节点哈希值
   */
  private getNodeHash(node: Parser.SyntaxNode): string {
    return `${node.type}:${node.startIndex}:${node.endIndex}`;
  }

  /**
   * 检查语言是否支持
   */
  isLanguageSupported(language: string): boolean {
    return this.dynamicManager.isLanguageSupported(language);
  }

  /**
   * 启用优化查询系统
   */
  enableOptimizedQueries(): void {
    this.useOptimizedQueries = true;
    this.logger.info('优化查询系统已启用');
  }

  /**
   * 禁用优化查询系统（回退到动态管理器）
   */
  disableOptimizedQueries(): void {
    this.useOptimizedQueries = false;
    this.logger.info('优化查询系统已禁用，使用动态管理器');
  }

  /**
   * 获取当前查询系统状态
   */
  isUsingOptimizedQueries(): boolean {
    return this.useOptimizedQueries && this.querySystemInitialized;
  }

  /**
   * 获取查询缓存统计信息
   */
  getQueryCacheStats() {
    if (this.useOptimizedQueries && this.querySystemInitialized) {
      return this.queryEngine.getPerformanceStats();
    }
    return QueryManager.getCacheStats();
  }

  /**
   * 检查优化查询系统是否支持指定语言的指定查询类型
   */
  isQuerySupported(language: string, queryType: string): boolean {
    if (this.useOptimizedQueries && this.querySystemInitialized) {
      return QueryManager.isSupported(language.toLowerCase(), queryType);
    }
    return false;
  }

  /**
   * 获取支持优化查询系统的语言列表
   */
  getQuerySupportedLanguages(): string[] {
    if (this.useOptimizedQueries && this.querySystemInitialized) {
      return QueryManager.getSupportedLanguages();
    }
    return [];
  }

  /**
   * 获取查询系统状态
   */
  getQuerySystemStatus() {
    return {
      initialized: this.querySystemInitialized,
      useOptimizedQueries: this.useOptimizedQueries,
      stats: this.queryRegistry.getStats(),
      dynamicManagerStatus: this.dynamicManager.getQuerySystemStatus(),
      queryEngineStats: this.useOptimizedQueries ? this.queryEngine.getPerformanceStats() : null
    };
  }

  /**
   * 重新初始化查询系统
   */
  async reinitializeQuerySystem(): Promise<void> {
    this.querySystemInitialized = false;
    await this.initializeQuerySystem();
  }

  /**
   * 获取动态管理器实例（用于高级操作）
   */
  getDynamicManager(): DynamicParserManager {
    return this.dynamicManager;
  }

  /**
   * 获取查询引擎实例（用于高级操作）
   */
  getQueryEngine(): TreeSitterQueryEngine {
    return this.queryEngine;
  }
}