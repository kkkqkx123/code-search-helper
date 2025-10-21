import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { TreeSitterUtils } from '../../utils/TreeSitterUtils';
import { LRUCache } from '../../../../utils/LRUCache';
import { ConfigService } from '../../../../config/ConfigService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { TYPES } from '../../../../types';
import { TreeSitterLanguageDetector } from '../language-detection/TreeSitterLanguageDetector';
import { languageExtensionMap } from '../../utils';
import { QueryManager } from '../query/QueryManager';
import { QueryRegistryImpl } from '../query/QueryRegistry';
import { DynamicParserManager, DynamicParserLanguage, DynamicParseResult } from './DynamicParserManager';

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
 * Tree-sitter 核心服务 - 重构版本
 * 使用 DynamicParserManager 实现按需加载，移除硬编码语言解析器依赖
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
  private languageDetector: TreeSitterLanguageDetector;
  private extensionMap = languageExtensionMap;
  private useQueryLanguage: boolean = true; // 混合模式开关
  private queryRegistry = QueryRegistryImpl;
  private querySystemInitialized = false;
  private logger = new LoggerService();
  private errorHandler: ErrorHandlerService;

  constructor() {
    this.languageDetector = new TreeSitterLanguageDetector();
    this.dynamicManager = new DynamicParserManager();
    this.errorHandler = new ErrorHandlerService(this.logger);
    this.initializeQueryManager();
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
  detectLanguage(filePath: string, content?: string): ParserLanguage | null {
    // 首先尝试使用动态管理器检测
    const detectedLanguage = this.dynamicManager.detectLanguage(filePath, content);
    if (detectedLanguage) {
      const supportedLanguages = this.getSupportedLanguages();
      return supportedLanguages.find(lang => lang.name.toLowerCase() === detectedLanguage) || null;
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
    const language = this.detectLanguage(filePath, content);
    if (!language) {
      throw new Error(`不支持的文件类型: ${filePath}`);
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
   * 按类型查找节点
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
    const nodes = TreeSitterUtils.findNodeByType(ast, type);
    
    // 缓存结果
    if (this.dynamicManager['nodeCache']) {
      this.dynamicManager['nodeCache'].set(cacheKey, nodes);
    }
    
    return nodes;
  }

  /**
   * 查询语法树
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

      // 创建查询
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
   * 提取函数
   */
  async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用回退机制');
        return this.legacyExtractFunctions(ast);
      }

      // 使用动态管理器提取
      return await this.dynamicManager.extractFunctions(ast, lang);
    } catch (error) {
      this.logger.error('函数提取失败:', error);
      return this.legacyExtractFunctions(ast);
    }
  }

  /**
   * 提取类
   */
  async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用回退机制');
        return this.legacyExtractClasses(ast);
      }

      // 使用动态管理器提取
      return await this.dynamicManager.extractClasses(ast, lang);
    } catch (error) {
      this.logger.error('类提取失败:', error);
      return this.legacyExtractClasses(ast);
    }
  }

  /**
   * 提取导入
   */
  extractImports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    return TreeSitterUtils.extractImports(ast, sourceCode);
  }

  /**
   * 获取节点名称
   */
  getNodeName(node: Parser.SyntaxNode): string {
    return TreeSitterUtils.getNodeName(node);
  }

  /**
   * 提取导入节点
   */
  extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return TreeSitterUtils.extractImportNodes(ast);
  }

  /**
   * 提取导出
   */
  async extractExports(ast: Parser.SyntaxNode, sourceCode?: string, language?: string): Promise<string[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用回退机制');
        return this.legacyExtractExports(ast, sourceCode);
      }

      // 使用动态管理器提取
      return await this.dynamicManager.extractExports(ast, sourceCode, lang);
    } catch (error) {
      this.logger.error('导出提取失败:', error);
      return this.legacyExtractExports(ast, sourceCode);
    }
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
   * 初始化查询管理器
   */
  private async initializeQueryManager(): Promise<void> {
    try {
      await QueryManager.initialize();
      this.logger.info('QueryManager初始化成功');
    } catch (error) {
      this.logger.warn('QueryManager初始化失败，将使用硬编码实现:', error);
      this.useQueryLanguage = false;
    }
  }

  /**
   * 异步初始化查询系统
   */
  private async initializeQuerySystem(): Promise<void> {
    try {
      await this.queryRegistry.initialize();
      this.querySystemInitialized = true;
      this.logger.info('查询系统初始化完成');
    } catch (error) {
      this.logger.error('查询系统初始化失败:', error);
      // 即使初始化失败，服务仍可运行（使用回退机制）
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
  private legacyExtractExports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    this.logger.warn('使用回退机制提取导出');
    const exports: string[] = [];

    if (!sourceCode) {
      return exports;
    }

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
        const exportText = this.getNodeText(node, sourceCode);
        if (exportText.trim().length > 0) {
          exports.push(exportText);
        }
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
   * 获取性能统计信息
   */
  getPerformanceStats() {
    const dynamicStats = this.dynamicManager.getPerformanceStats();
    
    return {
      ...this.performanceStats,
      cacheStats: this.getCacheStats(),
      dynamicManagerStats: dynamicStats,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.dynamicManager.clearCache();
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
   * 启用查询语言模式
   */
  enableQueryLanguage(): void {
    this.useQueryLanguage = true;
  }

  /**
   * 禁用查询语言模式（回退到硬编码实现）
   */
  disableQueryLanguage(): void {
    this.useQueryLanguage = false;
  }

  /**
   * 获取当前模式状态
   */
  isUsingQueryLanguage(): boolean {
    return this.useQueryLanguage;
  }

  /**
   * 获取查询缓存统计信息
   */
  getQueryCacheStats() {
    return QueryManager.getCacheStats();
  }

  /**
   * 清除查询缓存
   */
  clearQueryCache(): void {
    QueryManager.clearCache();
  }

  /**
   * 检查查询语言是否支持指定语言的指定查询类型
   */
  isQuerySupported(language: string, queryType: string): boolean {
    return QueryManager.isSupported(language.toLowerCase(), queryType);
  }

  /**
   * 获取支持查询语言的语言列表
   */
  getQuerySupportedLanguages(): string[] {
    return QueryManager.getSupportedLanguages();
  }

  /**
   * 获取查询系统状态
   */
  getQuerySystemStatus() {
    return {
      initialized: this.querySystemInitialized,
      stats: this.queryRegistry.getStats(),
      dynamicManagerStatus: this.dynamicManager.getQuerySystemStatus()
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
}