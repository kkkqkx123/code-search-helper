import Parser from 'tree-sitter';
import { LRUCache } from '../../../../utils/LRUCache';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { QueryManager } from '../query/QueryManager';
import { QueryRegistryImpl } from '../query/QueryRegistry';
import { languageExtensionMap } from '../../utils';
import { LanguageDetector } from '../language-detection/LanguageDetector';

export interface DynamicParserLanguage {
  name: string;
  parser?: Parser;
  fileExtensions: string[];
  supported: boolean;
  loader?: () => Promise<any>;
}

export interface DynamicParseResult {
  ast: Parser.SyntaxNode;
  language: DynamicParserLanguage;
  parseTime: number;
  success: boolean;
  error?: string;
  fromCache?: boolean;
}

/**
 * 动态解析器管理器 - 按需加载语言解析器，移除硬编码依赖
 */
export class DynamicParserManager {
  private parsers: Map<string, DynamicParserLanguage> = new Map();
  private parserCache: LRUCache<string, Parser> = new LRUCache(50);
  private astCache: LRUCache<string, Parser.Tree> = new LRUCache(500);
  private nodeCache: LRUCache<string, Parser.SyntaxNode[]> = new LRUCache(1000);
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
  private extensionMap = languageExtensionMap;
  private logger = new LoggerService();
  private errorHandler: ErrorHandlerService;
  private querySystemInitialized = false;
  private languageDetector: LanguageDetector;

  constructor() {
    this.errorHandler = new ErrorHandlerService(this.logger);
    this.languageDetector = new LanguageDetector();
    this.initializeLanguageLoaders();
    this.initializeQuerySystem();
  }

  /**
   * 初始化语言加载器配置
   */
  private initializeLanguageLoaders(): void {
    const supportedLanguages = this.extensionMap.getAllSupportedLanguages();

    // 配置动态导入加载器
    const languageLoaders: Record<string, () => Promise<any>> = {
      javascript: () => import('tree-sitter-javascript').then(m => m.default),
      typescript: () => import('tree-sitter-typescript').then(m => m.typescript),
      python: () => import('tree-sitter-python').then(m => m.default),
      java: () => import('tree-sitter-java').then(m => m.default),
      go: () => import('tree-sitter-go').then(m => m.default),
      rust: () => import('tree-sitter-rust').then(m => m.default),
      cpp: () => import('tree-sitter-cpp').then(m => m.default),
      c: () => import('tree-sitter-c').then(m => m.default),
      css: () => import('tree-sitter-css').then(m => m.default),
      html: () => import('tree-sitter-html').then(m => m.default),
      vue: () => import('tree-sitter-vue').then(m => m.default),
      tsx: () => import('tree-sitter-typescript').then(m => m.tsx),
    };

    // 初始化语言配置
    for (const language of supportedLanguages) {
      this.parsers.set(language, {
        name: this.getLanguageDisplayName(language),
        fileExtensions: this.extensionMap.getExtensionsByLanguage(language),
        supported: !!languageLoaders[language],
        loader: languageLoaders[language],
      });
    }

    // 特殊处理：C语言使用C++解析器
    if (this.parsers.has('cpp')) {
      this.parsers.set('c', {
        name: 'C',
        fileExtensions: this.extensionMap.getExtensionsByLanguage('c'),
        supported: true,
        loader: languageLoaders.cpp, // 使用C++解析器
      });
    }

    this.initialized = true;
    this.logger.info(`DynamicParserManager 初始化完成，支持 ${this.parsers.size} 种语言`);
  }

  /**
   * 异步初始化查询系统
   */
  private async initializeQuerySystem(): Promise<void> {
    try {
      await QueryManager.initialize();
      await QueryRegistryImpl.initialize();
      this.querySystemInitialized = true;
      this.logger.info('查询系统初始化完成');
    } catch (error) {
      this.logger.error('查询系统初始化失败:', error);
      // 即使初始化失败，服务仍可运行（使用回退机制）
    }
  }

  /**
   * 获取指定语言的解析器（按需加载）
   */
  async getParser(language: string): Promise<Parser | null> {
    const normalizedLanguage = language.toLowerCase();

    // 检查缓存
    if (this.parserCache.has(normalizedLanguage)) {
      this.cacheStats.hits++;
      return this.parserCache.get(normalizedLanguage)!;
    }

    this.cacheStats.misses++;

    const langConfig = this.parsers.get(normalizedLanguage);
    if (!langConfig || !langConfig.supported || !langConfig.loader) {
      this.logger.warn(`不支持的语言或缺少加载器: ${language}`);
      return null;
    }

    try {
      this.logger.debug(`动态加载 ${language} 解析器...`);
      const languageModule = await langConfig.loader();

      const parser = new Parser();
      parser.setLanguage(languageModule);

      // 缓存解析器
      this.parserCache.set(normalizedLanguage, parser);

      // 更新配置
      langConfig.parser = parser;

      this.logger.debug(`${language} 解析器加载成功`);
      return parser;
    } catch (error) {
      this.logger.error(`加载 ${language} 解析器失败:`, error);
      return null;
    }
  }

  /**
   * 解析代码
   */
  async parseCode(code: string, language: string): Promise<DynamicParseResult> {
    const startTime = Date.now();
    const normalizedLanguage = language.toLowerCase();

    try {
      const parser = await this.getParser(normalizedLanguage);
      if (!parser) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const langConfig = this.parsers.get(normalizedLanguage);
      if (!langConfig) {
        throw new Error(`不支持的语言: ${language}`);
      }

      // 生成缓存键
      const cacheKey = `${normalizedLanguage}:${this.hashCode(code)}`;

      // 检查AST缓存
      let tree = this.astCache.get(cacheKey);
      let fromCache = false;

      if (tree) {
        this.cacheStats.hits++;
        fromCache = true;
      } else {
        this.cacheStats.misses++;
        tree = parser.parse(code);
        if (!tree) {
          throw new Error('解析失败 - 解析器返回undefined');
        }
        this.astCache.set(cacheKey, tree);
      }

      // 更新性能统计
      const parseTime = Date.now() - startTime;
      this.updatePerformanceStats(parseTime);

      return {
        ast: tree.rootNode,
        language: langConfig,
        parseTime,
        success: true,
        fromCache,
      };
    } catch (error) {
      this.logger.error(`解析 ${language} 代码失败:`, error);

      return {
        ast: {} as Parser.SyntaxNode,
        language: this.parsers.get(normalizedLanguage) || {
          name: language,
          fileExtensions: [],
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
  async parseFile(filePath: string, content: string): Promise<DynamicParseResult> {
    const language = await this.detectLanguage(filePath, content);
    if (!language) {
      throw new Error(`不支持的文件类型: ${filePath}`);
    }

    return this.parseCode(content, language);
  }

  /**
   * 检测语言
   */
async detectLanguage(filePath: string, content?: string): Promise<string | null> {
    // 使用语言检测器进行智能检测
    const detectionResult = await this.languageDetector.detectLanguage(filePath, content);
    if (detectionResult.language) {
      return detectionResult.language;
    }

    return null;
  }

  /**
   * 从内容检测语言
   */
  private detectLanguageFromContent(content: string, filePath?: string): string | null {
    // 使用语言检测器进行内容检测
    const detectionResult = this.languageDetector.detectLanguageByContent(content);
    if (detectionResult.language && detectionResult.confidence > 0.5) {
      return detectionResult.language;
    }

    return null;
  }

  /**
   * 提取函数
   */
  async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    const lang = language || this.detectLanguageFromAST(ast);
    if (!lang) {
      this.logger.warn('无法检测语言，使用回退机制');
      return this.legacyExtractFunctions(ast);
    }

    try {
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }

      const functionQuery = await QueryRegistryImpl.getPattern(lang, 'functions');
      if (!functionQuery) {
        this.logger.warn(`未找到 ${lang} 语言的函数查询模式，使用回退机制`);
        return this.legacyExtractFunctions(ast);
      }

      const parser = await this.getParser(lang);
      if (!parser) {
        throw new Error(`无法获取 ${lang} 解析器`);
      }

      const results = QueryManager.executeQuery(ast, lang, 'functions', parser);
      const functions = results.flatMap(r => r.captures)
        .filter(c => c.name.includes('function') || c.name.includes('method'))
        .map(c => c.node);

      this.logger.debug(`提取到 ${functions.length} 个函数节点`);
      return functions;
    } catch (error) {
      this.logger.error('函数提取失败:', error);
      return this.legacyExtractFunctions(ast);
    }
  }

  /**
   * 提取类
   */
  async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    const lang = language || this.detectLanguageFromAST(ast);
    if (!lang) {
      this.logger.warn('无法检测语言，使用回退机制');
      return this.legacyExtractClasses(ast);
    }

    try {
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }

      const classQuery = await QueryRegistryImpl.getPattern(lang, 'classes');
      if (!classQuery) {
        this.logger.warn(`未找到 ${lang} 语言的类查询模式，使用回退机制`);
        return this.legacyExtractClasses(ast);
      }

      const parser = await this.getParser(lang);
      if (!parser) {
        throw new Error(`无法获取 ${lang} 解析器`);
      }

      const results = QueryManager.executeQuery(ast, lang, 'classes', parser);
      const classes = results.flatMap(r => r.captures)
        .filter(c => c.name.includes('class') ||
          c.name.includes('interface') ||
          c.name.includes('struct') ||
          c.name.includes('trait') ||
          c.name.includes('object'))
        .map(c => c.node);

      this.logger.debug(`提取到 ${classes.length} 个类节点`);
      return classes;
    } catch (error) {
      this.logger.error('类提取失败:', error);
      return this.legacyExtractClasses(ast);
    }
  }

  /**
   * 提取导出
   */
  async extractExports(ast: Parser.SyntaxNode, sourceCode?: string, language?: string): Promise<string[]> {
    const lang = language || this.detectLanguageFromAST(ast);
    if (!lang || !sourceCode) {
      return [];
    }

    try {
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }

      const exportQuery = await QueryRegistryImpl.getPattern(lang, 'exports');
      if (!exportQuery) {
        this.logger.warn(`未找到 ${lang} 语言的导出查询模式，使用回退机制`);
        return this.legacyExtractExports(ast, sourceCode);
      }

      const parser = await this.getParser(lang);
      if (!parser) {
        throw new Error(`无法获取 ${lang} 解析器`);
      }

      const results = QueryManager.executeQuery(ast, lang, 'exports', parser);
      const exports = results.flatMap(r => r.captures)
        .filter(c => c.name.includes('export'))
        .map(c => this.getNodeText(c.node, sourceCode))
        .filter(text => text.trim().length > 0);

      this.logger.debug(`提取到 ${exports.length} 个导出`);
      return exports;
    } catch (error) {
      this.logger.error('导出提取失败:', error);
      return this.legacyExtractExports(ast, sourceCode);
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
      };

      return languageMap[languageName] || languageName;
    }

    return null;
  }

  /**
   * 等待查询系统初始化
   */
  private async waitForQuerySystem(timeout = 5000): Promise<void> {
    const startTime = Date.now();

    while (!this.querySystemInitialized && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.querySystemInitialized) {
      throw new Error('查询系统初始化超时');
    }
  }

  /**
   * 回退机制：函数提取
   */
  private legacyExtractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
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
   * 获取节点文本
   */
  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.slice(node.startIndex, node.endIndex);
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): DynamicParserLanguage[] {
    return Array.from(this.parsers.values());
  }

  /**
   * 检查语言是否支持
   */
  isLanguageSupported(language: string): boolean {
    const langConfig = this.parsers.get(language.toLowerCase());
    return !!langConfig && langConfig.supported;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.cacheStats,
      totalRequests: total,
      hitRate: `${hitRate}%`,
      astCacheSize: this.astCache.size(),
      nodeCacheSize: this.nodeCache.size(),
      parserCacheSize: this.parserCache.size(),
    };
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      cacheStats: this.getCacheStats()
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.astCache.clear();
    this.nodeCache.clear();
    this.parserCache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    this.logger.info('DynamicParserManager 缓存已清除');
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
   * 计算代码哈希值
   */
  private hashCode(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取语言显示名称
   */
  private getLanguageDisplayName(language: string): string {
    const displayNames: Record<string, string> = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      go: 'Go',
      rust: 'Rust',
      cpp: 'C++',
      c: 'C',
      csharp: 'C#',
      swift: 'Swift',
      kotlin: 'Kotlin',
      ruby: 'Ruby',
      php: 'PHP',
      scala: 'Scala',
    };

    return displayNames[language] || language;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取查询系统状态
   */
  getQuerySystemStatus() {
    return {
      initialized: this.querySystemInitialized,
      stats: QueryRegistryImpl.getStats()
    };
  }
}