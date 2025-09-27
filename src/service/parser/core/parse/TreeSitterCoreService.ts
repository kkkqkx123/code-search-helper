import { injectable } from 'inversify';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';
import Cpp from 'tree-sitter-cpp';
import { TreeSitterUtils } from '../../utils/TreeSitterUtils';
import { LRUCache } from '../../utils/LRUCache';

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

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    try {
      const createBasicParser = () => {
        return {
          parse: (code: string) => {
            const mockAST = this.createMockAST(code);
            // Return a proper tree structure
            return {
              rootNode: mockAST,
            };
          },
          setLanguage: () => { },
        };
      };

      this.parsers.set('typescript', {
        name: 'TypeScript',
        parser: createBasicParser(),
        fileExtensions: ['.ts', '.tsx'],
        supported: true,
      });

      this.parsers.set('javascript', {
        name: 'JavaScript',
        parser: createBasicParser(),
        fileExtensions: ['.js', '.jsx'],
        supported: true,
      });

      this.parsers.set('python', {
        name: 'Python',
        parser: createBasicParser(),
        fileExtensions: ['.py'],
        supported: true,
      });

      this.parsers.set('java', {
        name: 'Java',
        parser: createBasicParser(),
        fileExtensions: ['.java'],
        supported: true,
      });

      this.parsers.set('go', {
        name: 'Go',
        parser: createBasicParser(),
        fileExtensions: ['.go'],
        supported: true,
      });

      this.parsers.set('rust', {
        name: 'Rust',
        parser: createBasicParser(),
        fileExtensions: ['.rs'],
        supported: true,
      });

      this.parsers.set('cpp', {
        name: 'C++',
        parser: createBasicParser(),
        fileExtensions: ['.cpp', '.cc', '.cxx', '.c++', '.h', '.hpp'],
        supported: true,
      });

      this.parsers.set('c', {
        name: 'C',
        parser: createBasicParser(),
        fileExtensions: ['.c', '.h'],
        supported: true,
      });

      // Add C# support
      this.parsers.set('csharp', {
        name: 'C#',
        parser: createBasicParser(),
        fileExtensions: ['.cs'],
        supported: true,
      });

      // Add Scala support
      this.parsers.set('scala', {
        name: 'Scala',
        parser: createBasicParser(),
        fileExtensions: ['.scala'],
        supported: true,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tree-sitter parsers:', error);
      this.initialized = false;
    }
  }

  getSupportedLanguages(): ParserLanguage[] {
    return Array.from(this.parsers.values()).filter(lang => lang.supported);
  }

  detectLanguage(filePath: string): ParserLanguage | null {
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));

    for (const lang of this.parsers.values()) {
      if (lang.fileExtensions.includes(ext) && lang.supported) {
        return lang;
      }
    }

    return null;
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
      console.log(`Cache hit for ${type}: ${cachedNodes.length} nodes`);
      return cachedNodes;
    }

    this.cacheStats.misses++;
    const nodes = TreeSitterUtils.findNodeByType(ast, type);
    console.log(`Found ${nodes.length} nodes of type ${type}`);
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
      // Get the language from the AST
      const language = (ast as any).tree?.language || (ast as any).language;

      // Create a query from the pattern
      // Note: In a real implementation, we would use the actual tree-sitter Query class
      // For now, we'll implement a simple mock that mimics the expected behavior
      const matches: Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }> = [];

      // Parse the pattern to extract capture names
      const captureRegex = /\((\w+(?:\.[\w-]+)*)\s+@\s*(\w+)\)/g;
      const captures: Array<{ type: string; name: string }> = [];
      let match;

      while ((match = captureRegex.exec(pattern)) !== null) {
        captures.push({ type: match[1], name: match[2] });
      }

      // For each capture type, find nodes of that type
      for (const capture of captures) {
        const nodes = this.findNodeByType(ast, capture.type);
        for (const node of nodes) {
          // In a real implementation, we would match the pattern structure
          // For now, we'll just create a simple match
          if (matches.length === 0) {
            matches.push({ captures: [] });
          }
          matches[0].captures.push({ name: capture.name, node });
        }
      }

      return matches;
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

    const traverse = (node: any, depth: number = 0) => {
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
    const imports: string[] = [];

    if (!sourceCode) {
      return imports;
    }

    const importTypes = new Set([
      'import_statement',
      'import_clause',
      'import_specifier',
      'require',
      'import_from_statement',
      'import_alias',
    ]);

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (importTypes.has(node.type)) {
        const importText = this.getNodeText(node, sourceCode);
        if (importText.trim().length > 0) {
          imports.push(importText);
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return imports;
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

  private createMockAST(code: string): any {
    const lines = code.split('\n');

    const createNode = (
      type: string,
      text: string,
      startLine: number,
      endLine: number,
      children: any[] = []
    ): any => {
      // Find the actual start index in the code
      const startIndex = code.indexOf(text);
      const endIndex = startIndex + text.length;

      const node = {
        type,
        startPosition: { row: startLine, column: 0 },
        endPosition: { row: endLine, column: text.length },
        startIndex,
        endIndex,
        children,
        parent: null,
        text: text,
        childForFieldName: (fieldName: string) => {
          if (
            fieldName === 'name' &&
            (type === 'function_declaration' || type === 'class_declaration')
          ) {
            const nameMatch = text.match(/(?:function|class)\s+(\w+)/);
            if (nameMatch && nameMatch[1]) {
              return createNode('identifier', nameMatch[1], startLine, endLine);
            }
          }
          return null;
        },
        walk: () => {
          // Mock walk implementation
          return {
            currentNode: () => node,
            gotoFirstChild: () => false,
            gotoNextSibling: () => false,
            gotoParent: () => false,
          };
        },
      };

      // Set parent for children
      children.forEach(child => {
        child.parent = node;
      });

      return node;
    };

    const children: any[] = [];

    // Find control structures (if, for, while, etc.)
    // Look for if statements (more comprehensive pattern)
    const ifRegex = /\bif\s*\([^)]*\)\s*(\{[^}]*\}|[^\n;]*;?)/g;
    let ifMatch;
    while ((ifMatch = ifRegex.exec(code)) !== null) {
      const matchedText = ifMatch[0];
      const startLine = code.substring(0, ifMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found if_statement: ${matchedText}`);
      children.push(createNode('if_statement', matchedText, startLine, endLine, []));
    }

    // Look for else clauses (more comprehensive pattern)
    const elseRegex = /\belse\s*(\{[^}]*\}|[^\n;]*;?)/g;
    let elseMatch;
    while ((elseMatch = elseRegex.exec(code)) !== null) {
      const matchedText = elseMatch[0];
      const startLine = code.substring(0, elseMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found else_clause: ${matchedText}`);
      children.push(createNode('else_clause', matchedText, startLine, endLine, []));
    }

    // Look for for statements (including for...of, for...in)
    const forRegex = /\bfor\s*\([^)]*\)\s*(\{[^}]*\}|[^\n;]*;?)/g;
    let forMatch;
    while ((forMatch = forRegex.exec(code)) !== null) {
      const matchedText = forMatch[0];
      const startLine = code.substring(0, forMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found for_statement: ${matchedText}`);
      children.push(createNode('for_statement', matchedText, startLine, endLine, []));
    }

    // Look for while statements
    const whileRegex = /\bwhile\s*\([^)]*\)\s*(\{[^}]*\}|[^\n;]*;?)/g;
    let whileMatch;
    while ((whileMatch = whileRegex.exec(code)) !== null) {
      const matchedText = whileMatch[0];
      const startLine = code.substring(0, whileMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found while_statement: ${matchedText}`);
      children.push(createNode('while_statement', matchedText, startLine, endLine, []));
    }

    // Look for do-while statements
    const doWhileRegex = /\bdo\s*(\{[^}]*\}|[^\n;]*;?)\s*while\s*\([^)]*\);?/g;
    let doWhileMatch;
    while ((doWhileMatch = doWhileRegex.exec(code)) !== null) {
      const matchedText = doWhileMatch[0];
      const startLine = code.substring(0, doWhileMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found do_statement: ${matchedText}`);
      children.push(createNode('do_statement', matchedText, startLine, endLine, []));
    }

    // Look for switch statements
    const switchRegex = /\bswitch\s*\([^)]*\)\s*\{[^}]*\}/g;
    let switchMatch;
    while ((switchMatch = switchRegex.exec(code)) !== null) {
      const matchedText = switchMatch[0];
      const startLine = code.substring(0, switchMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found switch_statement: ${matchedText}`);
      children.push(createNode('switch_statement', matchedText, startLine, endLine, []));
    }

    // Find error handling structures (try, catch, throw)
    // Look for try-catch-finally blocks (more comprehensive pattern)
    const tryCatchFinallyRegex =
      /\btry\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{[^}]*\}\s*(?:finally\s*\{[^}]*\})?/g;
    let tryCatchFinallyMatch;
    while ((tryCatchFinallyMatch = tryCatchFinallyRegex.exec(code)) !== null) {
      const matchedText = tryCatchFinallyMatch[0];
      const startLine = code.substring(0, tryCatchFinallyMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found try_statement (try-catch-finally): ${matchedText}`);
      children.push(createNode('try_statement', matchedText, startLine, endLine, []));
    }

    // Look for try-catch blocks (more comprehensive pattern)
    const tryCatchRegex = /\btry\s*\{[^}]*\}[\s\S]*?catch\s*\([^)]*\)\s*\{[^}]*\}/g;
    let tryCatchMatch;
    while ((tryCatchMatch = tryCatchRegex.exec(code)) !== null) {
      const matchedText = tryCatchMatch[0];
      const startLine = code.substring(0, tryCatchMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found try_statement (try-catch): ${matchedText}`);
      children.push(createNode('try_statement', matchedText, startLine, endLine, []));
    }

    // Look for try statements (without catch/finally)
    const tryRegex = /\btry\s*\{[^}]*\}/g;
    let tryMatch;
    while ((tryMatch = tryRegex.exec(code)) !== null) {
      const matchedText = tryMatch[0];
      const startLine = code.substring(0, tryMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found try_statement (try only): ${matchedText}`);
      children.push(createNode('try_statement', matchedText, startLine, endLine, []));
    }

    // Look for throw statements (more comprehensive pattern)
    const throwRegex = /\bthrow\s+[^;\n]*;?/g;
    let throwMatch;
    while ((throwMatch = throwRegex.exec(code)) !== null) {
      const matchedText = throwMatch[0];
      const startLine = code.substring(0, throwMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found throw_statement: ${matchedText}`);
      children.push(createNode('throw_statement', matchedText, startLine, endLine, []));
    }

    // Find function call chains
    // Look for method chains (more comprehensive pattern)
    const methodChainRegex = /(\w+(?:\.\w+)*\([^)]*\)(?:\s*\.\s*\w+\([^)]*\))+)/g;
    let methodChainMatch;
    while ((methodChainMatch = methodChainRegex.exec(code)) !== null) {
      const matchedText = methodChainMatch[0];
      const startLine = code.substring(0, methodChainMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found call_expression (method chain): ${matchedText}`);
      children.push(createNode('call_expression', matchedText, startLine, endLine, []));
    }

    // Look for individual function calls (more comprehensive pattern)
    const functionCallRegex = /\w+(?:\.\w+)*\([^)]*\)/g;
    let functionCallMatch;
    while ((functionCallMatch = functionCallRegex.exec(code)) !== null) {
      const matchedText = functionCallMatch[0];
      const startLine = code.substring(0, functionCallMatch.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;
      // console.log(`Found call_expression (function call): ${matchedText}`);
      children.push(createNode('call_expression', matchedText, startLine, endLine, []));
    }
    const functionRegex =
      /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\s*\(|class\s+(\w+)|import\s+.*?from\s+['"`]([^'"`]+)['"`]|export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+))/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      const matchedText = match[0];
      const startLine = code.substring(0, match.index).split('\n').length - 1;
      const endLine = startLine + matchedText.split('\n').length - 1;

      let nodeType = 'function_declaration';

      if (match[1]) {
        nodeType = 'function_declaration';
      } else if (match[2]) {
        nodeType = 'function_expression';
      } else if (match[3]) {
        nodeType = 'class_declaration';
      } else if (match[4]) {
        nodeType = 'import_statement';
      } else if (match[5]) {
        nodeType = 'export_statement';
      }

      children.push(createNode(nodeType, matchedText, startLine, endLine, []));
    }

    // Find code snippets in comments
    const commentRegex = /\/\/.*?(?:@snippet|@code|@example|SNIPPET:|EXAMPLE:)/gi;
    let commentMatch;

    while ((commentMatch = commentRegex.exec(code)) !== null) {
      const matchedText = commentMatch[0];
      const startLine = code.substring(0, commentMatch.index).split('\n').length;
      const endLine = startLine;

      children.push(createNode('comment', matchedText, startLine, endLine, []));
    }

    // Also look for code blocks in multi-line comments
    const multiLineCommentRegex =
      /\/\*[\s\S]*?(?:@snippet|@code|@example|SNIPPET:|EXAMPLE:)[\s\S]*?\*\//gi;
    let multiLineCommentMatch;

    while ((multiLineCommentMatch = multiLineCommentRegex.exec(code)) !== null) {
      const matchedText = multiLineCommentMatch[0];
      const startLine = code.substring(0, multiLineCommentMatch.index).split('\n').length;
      const endLine = startLine + matchedText.split('\n').length - 1;

      children.push(createNode('comment', matchedText, startLine, endLine, []));
    }

    return createNode('program', code, 0, lines.length - 1, children);
  }
}
