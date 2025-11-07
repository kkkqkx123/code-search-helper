import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { TreeSitterCoreService, ParserLanguage, ParseResult } from './TreeSitterCoreService';
import { CodeStructureService } from '../structure/CodeStructureService';

// Re-export for backward compatibility
export type { ParserLanguage, ParseResult };
export type SyntaxNode = Parser.SyntaxNode;
import { TYPES } from '../../../../types';
import { CodeChunk } from '../../types';

@injectable()
export class TreeSitterService {
  private structureService: CodeStructureService;

  constructor(
    @inject(TYPES.TreeSitterCoreService)
    private readonly coreService: TreeSitterCoreService
  ) {
    this.structureService = new CodeStructureService(coreService);
  }

  getSupportedLanguages(): ParserLanguage[] {
    return this.coreService.getSupportedLanguages();
  }

  async detectLanguage(filePath: string): Promise<ParserLanguage | null> {
    return await this.coreService.detectLanguage(filePath);
  }

  async parseCode(code: string, language: string): Promise<ParseResult> {
    return this.coreService.parseCode(code, language);
  }

  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    return this.coreService.parseFile(filePath, content);
  }

  async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    // 委托给CodeStructureService处理
    return this.structureService.extractFunctions(ast, language);
  }

  async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    // 委托给CodeStructureService处理
    return this.structureService.extractClasses(ast, language);
  }

  extractImports(ast: Parser.SyntaxNode, sourceCode?: string): Parser.SyntaxNode[] {
    // 委托给CodeStructureService处理
    return this.structureService.extractImportNodes(ast);
  }

  extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 委托给CodeStructureService处理
    return this.structureService.extractImportNodes(ast);
  }

  async extractExports(ast: Parser.SyntaxNode, sourceCode?: string): Promise<Parser.SyntaxNode[]> {
    // 委托给CodeStructureService处理
    return this.structureService.extractExports(ast);
  }

  isInitialized(): boolean {
    return this.coreService.isInitialized();
  }

  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return this.coreService.getNodeText(node, sourceCode);
  }

  getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return this.coreService.getNodeLocation(node);
  }

  getNodeName(node: Parser.SyntaxNode): string {
    return this.coreService.getNodeName(node);
  }

  findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    return this.coreService.findNodeByType(ast, type);
  }

  findNodesByTypes(ast: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    return this.coreService.findNodesByTypes(ast, types);
  }

  queryTree(
    ast: Parser.SyntaxNode,
    pattern: string
  ): Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }> {
    return this.coreService.queryTree(ast, pattern);
  }
}