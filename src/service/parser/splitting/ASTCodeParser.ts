import { injectable, inject, optional } from 'inversify';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { TreeSitterCoreService, ParseResult } from '../core/parse/TreeSitterCoreService';
import { CodeChunk, SnippetChunk } from '../types';
import { TYPES } from '../../../types';
import { createHash } from 'crypto';
import path from 'path';

export interface ParsedFile {
  id: string;
  filePath: string;
  relativePath: string;
  language: string;
  content: string;
  chunks: CodeChunk[];
  hash: string;
  size: number;
  parseTime: number;
  metadata: {
    functions: number;
    classes: number;
    imports: string[];
    exports: string[];
    linesOfCode: number;
    snippets: number;
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
  addOverlap?: boolean; // New option for adding overlap between chunks
}

@injectable()
export class ASTCodeParser {
  private treeSitterService: TreeSitterService;
  private defaultOptions: Required<ChunkingOptions>;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject('ChunkingOptions') @optional() options?: ChunkingOptions
  ) {
    this.treeSitterService = treeSitterService;
    this.defaultOptions = {
      maxChunkSize: options?.maxChunkSize ?? 1000,
      overlapSize: options?.overlapSize ?? 200,
      preserveFunctionBoundaries: options?.preserveFunctionBoundaries ?? true,
      preserveClassBoundaries: options?.preserveClassBoundaries ?? true,
      includeComments: options?.includeComments ?? false,
      minChunkSize: options?.minChunkSize ?? 100,
      extractSnippets: options?.extractSnippets ?? true,
      addOverlap: options?.addOverlap ?? false, // Default to false for backward compatibility
    };
  }

  async parseFile(
    filePath: string,
    content: string,
    options?: ChunkingOptions
  ): Promise<ParsedFile> {
    const startTime = Date.now();
    const hash = this.generateHash(content);
    const mergedOptions = { ...this.defaultOptions, ...options };

    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim().length > 0).length;

    let language = 'unknown';
    let snippetCount = 0;

    // Try to parse with TreeSitterService if available
    try {
      const parseResult = await this.treeSitterService.parseFile(filePath, content);
      language = parseResult.language.name.toLowerCase();

      if (parseResult.success) {
        // Extract syntax-aware chunks
        const syntaxAwareChunks = await this.createSyntaxAwareChunks(
          content,
          parseResult,
          mergedOptions
        );
        chunks.push(...syntaxAwareChunks);

        // Extract snippets if enabled
        if (mergedOptions.extractSnippets) {
          const snippets = this.treeSitterService.extractSnippets(parseResult.ast, content);
          chunks.push(...snippets);
          snippetCount = snippets.length;
        }
      }
    } catch (error) {
      // Fall back to generic chunking if TreeSitterService fails
      console.warn('TreeSitterService failed, falling back to generic chunking:', error);
    }

    // If no chunks were created, use generic chunking
    if (chunks.length === 0) {
      const genericChunks = this.createGenericChunks(content, mergedOptions);
      chunks.push(...genericChunks);
    }

    // Add overlap between chunks if requested
    if (mergedOptions.addOverlap && chunks.length > 1) {
      const overlappedChunks = this.addOverlapToChunks(chunks, content, mergedOptions.overlapSize || 200);
      chunks.splice(0, chunks.length, ...overlappedChunks);
    }

    const parsedFile: ParsedFile = {
      id: this.generateFileId(filePath, hash),
      filePath,
      relativePath: path.relative(process.cwd(), filePath),
      language,
      content,
      chunks,
      hash,
      size: content.length,
      parseTime: Date.now() - startTime,
      metadata: {
        functions: 0,
        classes: 0,
        imports: [],
        exports: [],
        linesOfCode,
        snippets: snippetCount,
      },
    };

    return parsedFile;
  }

  private async createSyntaxAwareChunks(
    content: string,
    parseResult: ParseResult,
    options: Required<ChunkingOptions>
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // Extract function chunks
    if (options.preserveFunctionBoundaries) {
      const functionChunks = this.createFunctionChunks(content, parseResult, options);
      chunks.push(...functionChunks);
    }

    // Extract class chunks
    if (options.preserveClassBoundaries) {
      const classChunks = this.createClassChunks(content, parseResult, options);
      chunks.push(...classChunks);
    }

    return chunks;
  }

  private createFunctionChunks(
    content: string,
    parseResult: ParseResult,
    options: Required<ChunkingOptions>
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const functions = this.treeSitterService.extractFunctions(parseResult.ast);

    // Early return if no functions found
    if (!functions || functions.length === 0) {
      return chunks;
    }

    for (const funcNode of functions) {
      const funcContent = this.treeSitterService.getNodeText(funcNode, content);
      const location = this.treeSitterService.getNodeLocation(funcNode);

      const chunk: CodeChunk = {
        id: this.generateChunkId(funcContent, location.startLine),
        content: funcContent,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: funcNode.startIndex,
        endByte: funcNode.endIndex,
        type: 'function',
        functionName: this.extractFunctionName(funcNode, content),
        imports: [],
        exports: [],
        metadata: {
          parameters: this.extractParameters(funcNode, content),
          returnType: this.extractReturnType(funcNode, content),
          complexity: this.calculateComplexity(funcContent),
        },
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private createClassChunks(
    content: string,
    parseResult: ParseResult,
    options: Required<ChunkingOptions>
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const classes = this.treeSitterService.extractClasses(parseResult.ast);

    // Early return if no classes found
    if (!classes || classes.length === 0) {
      return chunks;
    }

    for (const classNode of classes) {
      const classContent = this.treeSitterService.getNodeText(classNode, content);
      const location = this.treeSitterService.getNodeLocation(classNode);

      const chunk: CodeChunk = {
        id: this.generateChunkId(classContent, location.startLine),
        content: classContent,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: classNode.startIndex,
        endByte: classNode.endIndex,
        type: 'class',
        className: this.extractClassName(classNode, content),
        imports: [],
        exports: [],
        metadata: {
          methods: this.extractMethods(classNode, content).length,
          properties: this.extractProperties(classNode, content).length,
          inheritance: this.extractInheritance(classNode, content),
          complexity: this.calculateComplexity(classContent),
        },
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private createGenericChunks(content: string, options: Required<ChunkingOptions>): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      if (currentChunk.join('\n').length >= options.maxChunkSize || i === lines.length - 1) {
        const chunkContent = currentChunk.join('\n');

        // Create chunk if it meets minimum size OR if it's the last chunk and we have no chunks yet
        if (
          chunkContent.length >= options.minChunkSize ||
          (i === lines.length - 1 && chunks.length === 0)
        ) {
          const chunk: CodeChunk = {
            id: this.generateChunkId(chunkContent, currentLine),
            content: chunkContent,
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            startByte: content.indexOf(chunkContent),
            endByte: content.indexOf(chunkContent) + chunkContent.length,
            type: 'generic',
            imports: [],
            exports: [],
            metadata: {
              lineCount: currentChunk.length,
              complexity: this.calculateComplexity(chunkContent),
            },
          };

          chunks.push(chunk);
        }

        currentChunk = [];
        currentLine = i + 1;
      }
    }

    return chunks;
  }

  private enrichChunks(chunks: CodeChunk[], parseResult: ParseResult): CodeChunk[] {
    // Enrich chunks with additional metadata from the parse result
    return chunks.map(chunk => {
      // Add imports and exports if available
      if (chunk.type === 'function' || chunk.type === 'class') {
        return {
          ...chunk,
          imports: this.treeSitterService.extractImports(parseResult.ast),
          exports: this.treeSitterService.extractExports(parseResult.ast),
        };
      }
      return chunk;
    });
  }

  private extractFunctionName(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.treeSitterService.getNodeText(nameNode, content) : 'anonymous';
  }

  private extractClassName(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.treeSitterService.getNodeText(nameNode, content) : 'anonymous';
  }

  private extractParameters(node: any, content: string): string[] {
    const paramsNode = node.childForFieldName('parameters');
    if (!paramsNode) return [];

    const params: string[] = [];
    for (const child of paramsNode.children) {
      if (child.type === 'identifier' || child.type === 'parameter') {
        params.push(this.treeSitterService.getNodeText(child, content));
      }
    }
    return params;
  }

  private extractReturnType(node: any, content: string): string {
    const typeNode = node.childForFieldName('return_type');
    return typeNode ? this.treeSitterService.getNodeText(typeNode, content) : 'unknown';
  }

  private extractMethods(node: any, content: string): any[] {
    return this.treeSitterService.findNodeByType(node, 'method_definition');
  }

  private extractProperties(node: any, content: string): any[] {
    return this.treeSitterService.findNodeByType(node, 'property_declaration');
  }

  private extractInheritance(node: any, content: string): string[] {
    const inheritance: string[] = [];
    const extendsNode = node.childForFieldName('extends');
    const implementsNode = node.childForFieldName('implements');

    if (extendsNode) {
      inheritance.push(this.treeSitterService.getNodeText(extendsNode, content));
    }

    if (implementsNode) {
      inheritance.push(this.treeSitterService.getNodeText(implementsNode, content));
    }

    return inheritance;
  }

  private calculateComplexity(code: string): number {
    // Pre-compile regex patterns for better performance
    const complexityIndicators = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\btry\b/g,
      /\bcatch\b/g,
      /\?\./g,
      /\|\|/g,
      /&&/g,
    ];

    let complexity = 1;

    // Early return for empty or very short code
    if (!code || code.length < 10) {
      return complexity;
    }

    // Use a single pass with a combined regex for better performance
    const combinedPattern = /\b(if|else|for|while|switch|case|try|catch)\b|\?\.|&&|\|\|/g;
    let match;

    while ((match = combinedPattern.exec(code)) !== null) {
      complexity++;
    }

    return complexity;
  }

  private generateHash(content: string): string {
    // Use a faster hash for performance testing
    return createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  private generateFileId(filePath: string, hash: string): string {
    // Cache file path hashes to avoid recomputation
    const pathHash = createHash('md5').update(filePath).digest('hex').substring(0, 8);
    return `file_${pathHash}_${hash.substring(0, 8)}`;
  }

  private generateChunkId(content: string, startLine: number): string {
    // Use a simpler hash for chunks to improve performance
    const contentHash = createHash('md5').update(content).digest('hex').substring(0, 8);
    return `chunk_${startLine}_${contentHash}`;
  }

  /**
   * Add overlap between chunks to maintain context
   * @param chunks The chunks to add overlap to
   * @param content The original content
   * @param overlapSize The number of lines to overlap
   * @returns Chunks with overlap added
   */
  private addOverlapToChunks(chunks: CodeChunk[], content: string, overlapSize: number): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const lines = content.split('\n');
    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // For all chunks except the last one, add overlap from the next chunk
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];

        // Calculate the overlap lines
        const overlapStartLine = Math.max(
          nextChunk.startLine,
          chunk.endLine - overlapSize + 1
        );
        const overlapEndLine = chunk.endLine;

        if (overlapStartLine <= overlapEndLine && overlapStartLine > 0) {
          // Get overlapping content
          const overlapContent = lines.slice(overlapStartLine - 1, overlapEndLine).join('\n');

          // Create a new chunk with overlap
          const overlappedChunk: CodeChunk = {
            ...chunk,
            content: chunk.content + '\n' + overlapContent,
            endLine: overlapEndLine,
            endByte: chunk.endByte + overlapContent.length + 1, // +1 for newline
            id: this.generateChunkId(chunk.content + '\n' + overlapContent, chunk.startLine),
            metadata: {
              ...chunk.metadata,
              complexity: this.calculateComplexity(chunk.content + '\n' + overlapContent)
            }
          };

          overlappedChunks.push(overlappedChunk);
        } else {
          overlappedChunks.push(chunk);
        }
      } else {
        overlappedChunks.push(chunk);
      }
    }

    return overlappedChunks;
  }
}
