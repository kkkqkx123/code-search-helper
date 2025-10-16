import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';
import Cpp from 'tree-sitter-cpp';
import { TreeSitterUtils } from '../../utils/TreeSitterUtils';
import { LRUCache } from '../../../../utils/LRUCache';
import { ConfigService } from '../../../../config/ConfigService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { TYPES } from '../../../../types';
import { TreeSitterLanguageDetector } from '../language-detection/TreeSitterLanguageDetector';
import { languageExtensionMap } from '../../utils';

export interface ParserLanguage {
  name: string;
  parser: any;
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

@injectable()
export class TreeSitterCoreService {
  private parsers: Map<string, ParserLanguage> = new Map();
  private initialized: boolean = false;
  private astCache: LRUCache<string, Parser.Tree> = new LRUCache(500);
  private nodeCache: LRUCache<string, Parser.SyntaxNode[]> = new LRUCache(1000);
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

  constructor() {
    this.languageDetector = new TreeSitterLanguageDetector();
    this.initializeParsers();
  }

  private initializeParsers(): void {
    try {
      // 使用公共的扩展名映射来获取支持的扩展名
      const supportedExtensions = this.extensionMap.getAllSupportedLanguages();

      // Initialize TypeScript parser
      const tsParser = new Parser();
      tsParser.setLanguage(TypeScript.typescript as any);
      this.parsers.set('typescript', {
        name: 'TypeScript',
        parser: tsParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('typescript'),
        supported: true,
      });

      // Initialize JavaScript parser
      const jsParser = new Parser();
      jsParser.setLanguage(JavaScript as any);
      this.parsers.set('javascript', {
        name: 'JavaScript',
        parser: jsParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('javascript'),
        supported: true,
      });

      // Initialize Python parser
      const pythonParser = new Parser();
      pythonParser.setLanguage(Python as any);
      this.parsers.set('python', {
        name: 'Python',
        parser: pythonParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('python'),
        supported: true,
      });

      // Initialize Java parser
      const javaParser = new Parser();
      javaParser.setLanguage(Java as any);
      this.parsers.set('java', {
        name: 'Java',
        parser: javaParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('java'),
        supported: true,
      });

      // Initialize Go parser
      const goParser = new Parser();
      goParser.setLanguage(Go as any);
      this.parsers.set('go', {
        name: 'Go',
        parser: goParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('go'),
        supported: true,
      });

      // Initialize Rust parser
      const rustParser = new Parser();
      rustParser.setLanguage(Rust as any);
      this.parsers.set('rust', {
        name: 'Rust',
        parser: rustParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('rust'),
        supported: true,
      });

      // Initialize C++ parser
      const cppParser = new Parser();
      cppParser.setLanguage(Cpp as any);
      this.parsers.set('cpp', {
        name: 'C++',
        parser: cppParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('cpp'),
        supported: true,
      });

      // Initialize C parser
      const cParser = new Parser();
      cParser.setLanguage(Cpp as any); // C parser is part of C++ grammar
      this.parsers.set('c', {
        name: 'C',
        parser: cParser,
        fileExtensions: this.extensionMap.getExtensionsByLanguage('c'),
        supported: true,
      });

      // Add C# support
      this.parsers.set('csharp', {
        name: 'C#',
        parser: null, // Will be implemented later
        fileExtensions: this.extensionMap.getExtensionsByLanguage('csharp'),
        supported: false,
      });

      // Add Scala support
      this.parsers.set('scala', {
        name: 'Scala',
        parser: null, // Will be implemented later
        fileExtensions: this.extensionMap.getExtensionsByLanguage('scala'),
        supported: false,
      });

      this.initialized = true;
      console.log('Tree-sitter parsers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Tree-sitter parsers:', error);
      this.initialized = false;
    }
  }

  getSupportedLanguages(): ParserLanguage[] {
    return this.languageDetector.getSupportedLanguages(this.parsers);
  }

  detectLanguage(filePath: string, content?: string): ParserLanguage | null {
    return this.languageDetector.detectLanguageByParserConfig(filePath, this.parsers, content);
  }

  async parseCode(code: string, language: string): Promise<ParseResult> {
    const startTime = Date.now();

    try {
      const parserLang = this.parsers.get(language.toLowerCase());
      if (!parserLang || !parserLang.supported) {
        throw new Error(`Unsupported language: ${language}`);
      }

      // Generate cache key
      const cacheKey = `${language.toLowerCase()}:${this.hashCode(code)}`;

      // Check AST cache
      let tree = this.astCache.get(cacheKey);
      let fromCache = false;

      if (tree) {
        this.cacheStats.hits++;
        fromCache = true;
      } else {
        this.cacheStats.misses++;
        const parser = parserLang.parser;
        tree = parser.parse(code);
        if (!tree) {
          throw new Error('Failed to parse code - parser returned undefined');
        }
        this.astCache.set(cacheKey, tree);
      }

      return {
        ast: tree.rootNode,
        language: parserLang,
        parseTime: Date.now() - startTime,
        success: true,
        fromCache,
      };
    } catch (error) {
      console.error(`Failed to parse ${language} code:`, error);
      return {
        ast: {} as Parser.SyntaxNode,
        language: this.parsers.get(language.toLowerCase()) || {
          name: language,
          parser: new Parser(),
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

  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    return this.parseCode(content, language.name.toLowerCase());
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return TreeSitterUtils.getNodeText(node, sourceCode);
  }

  getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return TreeSitterUtils.getNodeLocation(node);
  }

  findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    // Generate cache key for this query
    const cacheKey = `${this.getNodeHash(ast)}:${type}`;

    // Check node cache
    let cachedNodes = this.nodeCache.get(cacheKey);
    if (cachedNodes) {
      this.cacheStats.hits++;
      return cachedNodes;
    }

    this.cacheStats.misses++;
    const nodes = TreeSitterUtils.findNodeByType(ast, type);
    this.nodeCache.set(cacheKey, nodes);
    return nodes;
  }

  /**
   * Query the syntax tree using a tree-sitter query pattern
   * @param ast The syntax tree to query
   * @param pattern The query pattern in S-expression format
   * @returns Array of query matches
   */
  queryTree(
    ast: Parser.SyntaxNode,
    pattern: string
  ): Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }> {
    try {
      // Get the tree from the AST node
      const tree = (ast as any).tree;
      if (!tree) {
        throw new Error('Cannot determine tree from AST node');
      }

      // Get the language from the tree
      const language = tree.language;
      if (!language) {
        throw new Error('Cannot determine language from tree');
      }

      // Create a query from the pattern and language
      const query = new Parser.Query(language, pattern);
      const matches = query.matches(ast);

      // Transform matches to the expected format
      return matches.map(match => ({
        captures: match.captures.map(capture => ({
          name: capture.name,
          node: capture.node
        }))
      }));
    } catch (error) {
      console.error('Failed to query tree:', error);
      return [];
    }
  }

  // 批量节点查询优化
  findNodesByTypes(ast: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const cacheKey = `${this.getNodeHash(ast)}:${types.join(',')}`;

    // Check node cache
    let cachedNodes = this.nodeCache.get(cacheKey);
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
    this.nodeCache.set(cacheKey, results);
    return results;
  }

  // 获取缓存统计信息
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.cacheStats,
      totalRequests: total,
      hitRate: `${hitRate}%`,
      astCacheSize: this.astCache.size(),
      nodeCacheSize: this.nodeCache.size(),
    };
  }

  // 获取性能统计信息
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      cacheStats: this.getCacheStats()
    };
  }

  // 清除缓存
  clearCache(): void {
    this.astCache.clear();
    this.nodeCache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
  }

  // 计算代码哈希值
  private hashCode(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // 计算节点哈希值
  private getNodeHash(node: Parser.SyntaxNode): string {
    return `${node.type}:${node.startIndex}:${node.endIndex}`;
  }

  extractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
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
      // C# specific function types
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration',
      'operator_declaration',
      'conversion_operator_declaration',
      // Scala specific function types
      'function_definition',
      'function_declaration',
      'method_definition',
      'anonymous_function'
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

  extractClasses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
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
      // C# specific class types
      'class_declaration',
      'interface_declaration',
      'struct_declaration',
      'enum_declaration',
      'delegate_declaration',
      // Scala specific class types
      'class_definition',
      'trait_definition',
      'object_definition',
      'case_class_definition'
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

  extractImports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    return TreeSitterUtils.extractImports(ast, sourceCode);
  }

  getNodeName(node: Parser.SyntaxNode): string {
    return TreeSitterUtils.getNodeName(node);
  }

  extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return TreeSitterUtils.extractImportNodes(ast);
  }

  extractExports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
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
   * 获取支持的语言扩展名映射
   * @returns 语言到扩展名的映射
   */
  getLanguageExtensionMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();

    this.parsers.forEach((parser, language) => {
      if (parser.supported) {
        map.set(language, parser.fileExtensions);
      }
    });

    return map;
  }

  /**
   * 检查语言是否支持
   * @param language 语言名称
   * @returns 是否支持
   */
  isLanguageSupported(language: string): boolean {
    return this.languageDetector.isLanguageSupported(language, this.parsers);
  }
}