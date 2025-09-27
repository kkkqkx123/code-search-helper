import { injectable, inject } from 'inversify';
import { ConfigService } from '../../../../config/ConfigService';
import { LoggerService } from '../../../../core/LoggerService';
import { ErrorHandlerService } from '../../../../core/ErrorHandlerService';
import { TreeSitterService } from './TreeSitterService';
import { ASTCodeParser } from '../../splitting/ASTCodeParser';
import { TYPES } from '../../../../types';

export interface ParseResult {
  filePath: string;
  language: string;
  ast: any;
  functions: any[];
  classes: any[];
  imports: any[];
  exports: any[];
  metadata: Record<string, any>;
}

export interface ParseOptions {
  includeComments?: boolean;
  includeAST?: boolean;
  maxDepth?: number;
  focus?: 'functions' | 'classes' | 'imports' | 'all';
}

@injectable()
export class ParserService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private treeSitterService: TreeSitterService;
  private smartCodeParser: ASTCodeParser;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.ASTCodeParser) smartCodeParser: ASTCodeParser
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.treeSitterService = treeSitterService;
    this.smartCodeParser = smartCodeParser;
  }

  async parseFile(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    this.logger.info('Parsing file', { filePath, options });

    try {
      // Read file content
      const fs = await import('fs').then(m => m.promises);
      const content = await fs.readFile(filePath, 'utf-8');

      // Determine the best parser for this file
      const language = this.detectLanguage(filePath);

      let result: ParseResult;

      const parserLanguage = this.treeSitterService.detectLanguage(filePath);
      if (parserLanguage) {
        const parseResult = await this.treeSitterService.parseFile(filePath, content);
        result = {
          filePath,
          language: parseResult.language.name,
          ast: parseResult.ast,
          functions: this.treeSitterService.extractFunctions(parseResult.ast),
          classes: this.treeSitterService.extractClasses(parseResult.ast),
          imports: this.treeSitterService.extractImports(parseResult.ast, content),
          exports: this.treeSitterService.extractExports(parseResult.ast, content),
          metadata: {
            parseMethod: 'tree-sitter',
            parserVersion: (parseResult.language as any)?.version || 'unknown',
          },
        };
      } else {
        const parsedFile = await this.smartCodeParser.parseFile(filePath, content, options);
        result = {
          filePath,
          language: parsedFile.language,
          ast: {} as any,
          functions: [],
          classes: [],
          imports: parsedFile.metadata.imports,
          exports: parsedFile.metadata.exports,
          metadata: {
            parseMethod: 'smart-parser',
            parserVersion: '1.0.0',
          },
        };
      }

      this.logger.debug('File parsed successfully', {
        filePath,
        language,
        functionCount: result.functions.length,
        classCount: result.classes.length,
      });

      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to parse file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'ParserService', operation: 'parseFile' }
      );
      throw error;
    }
  }

  async parseFiles(filePaths: string[], options: ParseOptions = {}): Promise<ParseResult[]> {
    this.logger.info('Parsing multiple files', { fileCount: filePaths.length, options });

    const results: ParseResult[] = [];
    const errors: string[] = [];

    // Parse files in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);

      const batchPromises = batch.map(async filePath => {
        try {
          return await this.parseFile(filePath, options);
        } catch (error) {
          const errorMsg = `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is ParseResult => result !== null));
    }

    if (errors.length > 0) {
      this.logger.warn('Some files failed to parse', {
        totalFiles: filePaths.length,
        successCount: results.length,
        errorCount: errors.length,
      });
    }

    return results;
  }

  async extractFunctions(filePath: string): Promise<any[]> {
    try {
      const result = await this.parseFile(filePath, { focus: 'functions' });
      return result.functions;
    } catch (error) {
      this.logger.error('Failed to extract functions', { filePath, error });
      return [];
    }
  }

  async extractClasses(filePath: string): Promise<any[]> {
    try {
      const result = await this.parseFile(filePath, { focus: 'classes' });
      return result.classes;
    } catch (error) {
      this.logger.error('Failed to extract classes', { filePath, error });
      return [];
    }
  }

  async extractImports(filePath: string): Promise<any[]> {
    try {
      const result = await this.parseFile(filePath, { focus: 'imports' });
      return result.imports;
    } catch (error) {
      this.logger.error('Failed to extract imports', { filePath, error });
      return [];
    }
  }

  async getLanguageStats(filePaths: string[]): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};

    for (const filePath of filePaths) {
      const language = this.detectLanguage(filePath);
      stats[language] = (stats[language] || 0) + 1;
    }

    return stats;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sh: 'shell',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      sql: 'sql',
    };

    return languageMap[ext || ''] || 'unknown';
  }

  getSupportedLanguages(): string[] {
    const treeSitterLanguages = this.treeSitterService
      .getSupportedLanguages()
      .map(lang => lang.name.toLowerCase());
    // SmartCodeParser doesn't have a method for this, so we'll return an empty array for now
    const smartParserLanguages: string[] = [];

    return [...new Set([...treeSitterLanguages, ...smartParserLanguages])];
  }

  async validateSyntax(filePath: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      await this.parseFile(filePath, { includeComments: true });
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  /**
   * 查询AST节点 - 使用类XPath语法
   */
  async queryAST(filePath: string, query: string): Promise<any[]> {
    try {
      const parseResult = await this.parseFile(filePath, { includeAST: true });
      if (!parseResult.ast) {
        return [];
      }

      // 这里可以实现类似XPath的查询逻辑
      // 简化实现：按节点类型查询
      const nodeType = query.replace('//', '');
      return this.findNodesByType(parseResult.ast, nodeType);
    } catch (error) {
      this.logger.error('Failed to query AST', { filePath, query, error });
      return [];
    }
  }

  /**
   * 按类型查找AST节点
   */
  private findNodesByType(ast: any, nodeType: string): any[] {
    const results: any[] = [];

    function traverse(node: any) {
      if (node && node.type === nodeType) {
        results.push(node);
      }

      if (node && node.children) {
        node.children.forEach(traverse);
      }
    }

    traverse(ast);
    return results;
  }

  /**
   * 获取AST的简化表示
   */
  async getASTSummary(filePath: string): Promise<{
    filePath: string;
    nodeCount: number;
    depth: number;
    nodeTypes: Record<string, number>;
  }> {
    try {
      const parseResult = await this.parseFile(filePath, { includeAST: true });
      if (!parseResult.ast) {
        return {
          filePath,
          nodeCount: 0,
          depth: 0,
          nodeTypes: {},
        };
      }

      let nodeCount = 0;
      let maxDepth = 0;
      const nodeTypes: Record<string, number> = {};

      function analyze(node: any, currentDepth: number): void {
        if (!node) return;

        nodeCount++;
        maxDepth = Math.max(maxDepth, currentDepth);

        const type = node.type || 'unknown';
        nodeTypes[type] = (nodeTypes[type] || 0) + 1;

        if (node.children) {
          node.children.forEach((child: any) => analyze(child, currentDepth + 1));
        }
      }

      analyze(parseResult.ast, 0);

      return {
        filePath,
        nodeCount,
        depth: maxDepth,
        nodeTypes,
      };
    } catch (error) {
      this.logger.error('Failed to get AST summary', { filePath, error });
      throw error;
    }
  }

  /**
   * 比较两个文件的AST差异
   */
  async compareASTs(
    filePath1: string,
    filePath2: string
  ): Promise<{
    areIdentical: boolean;
    differences: Array<{
      type: 'added' | 'removed' | 'modified';
      path: string;
      details: string;
    }>;
  }> {
    try {
      const [ast1, ast2] = await Promise.all([
        this.parseFile(filePath1, { includeAST: true }),
        this.parseFile(filePath2, { includeAST: true }),
      ]);

      // 简化比较：比较函数和类的数量
      const funcDiff = Math.abs(ast1.functions.length - ast2.functions.length);
      const classDiff = Math.abs(ast1.classes.length - ast2.classes.length);

      const differences: Array<{
        type: 'added' | 'removed' | 'modified';
        path: string;
        details: string;
      }> = [];

      if (funcDiff > 0) {
        differences.push({
          type: 'modified',
          path: 'functions',
          details: `Function count difference: ${funcDiff}`,
        });
      }

      if (classDiff > 0) {
        differences.push({
          type: 'modified',
          path: 'classes',
          details: `Class count difference: ${classDiff}`,
        });
      }

      return {
        areIdentical: differences.length === 0,
        differences,
      };
    } catch (error) {
      this.logger.error('Failed to compare ASTs', { filePath1, filePath2, error });
      throw error;
    }
  }

  /**
   * 在AST中搜索特定模式的节点
   */
  async searchInAST(
    filePath: string,
    pattern: {
      type?: string;
      name?: string;
      contains?: string;
    }
  ): Promise<any[]> {
    try {
      const parseResult = await this.parseFile(filePath, { includeAST: true });
      if (!parseResult.ast) {
        return [];
      }

      const results: any[] = [];

      function search(node: any): void {
        if (!node) return;

        let matches = true;

        if (pattern.type && node.type !== pattern.type) {
          matches = false;
        }

        if (pattern.name && node.name !== pattern.name) {
          matches = false;
        }

        if (pattern.contains && node.text && !node.text.includes(pattern.contains)) {
          matches = false;
        }

        if (matches) {
          results.push(node);
        }

        if (node.children) {
          node.children.forEach(search);
        }
      }

      search(parseResult.ast);
      return results;
    } catch (error) {
      this.logger.error('Failed to search in AST', { filePath, pattern, error });
      return [];
    }
  }
}
