import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk } from './Splitter';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { TYPES } from '../../../types';

// Simple fallback implementation for unsupported languages
class SimpleCodeSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize: number = 2500, chunkOverlap: number = 300) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  split(code: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let position = 0;

    while (position < code.length) {
      const endPosition = Math.min(position + this.chunkSize, code.length);
      const chunkContent = code.substring(position, endPosition);

      // Calculate line numbers
      const linesBefore = code.substring(0, position).split('\n').length;
      const chunkLines = chunkContent.split('\n').length;

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: linesBefore + 1,
          endLine: linesBefore + chunkLines,
          language: 'unknown'
        }
      });

      // Move position with overlap
      position = endPosition - this.chunkOverlap;
      if (position <= 0 || position >= code.length) break;
    }

    return chunks;
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
  }
}

@injectable()
export class ASTCodeSplitter implements Splitter {
  private chunkSize: number = 2500;
  private chunkOverlap: number = 300;
  private treeSitterService: TreeSitterService;
  private simpleFallback: SimpleCodeSplitter;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService
  ) {
    this.treeSitterService = treeSitterService;
    this.simpleFallback = new SimpleCodeSplitter(this.chunkSize, this.chunkOverlap);
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    try {
      // Try to parse with TreeSitterService
      const parseResult = await this.treeSitterService.parseCode(code, language);

      if (parseResult.success) {
        // Extract syntax-aware chunks
        const chunks = await this.createSyntaxAwareChunks(code, parseResult, language, filePath);
        return this.refineChunks(chunks, code);
      } else {
        // Fall back to simple splitting
        console.warn(`TreeSitterService failed for language ${language}, falling back to simple splitting:`, parseResult.error);
        this.simpleFallback.setChunkSize(this.chunkSize);
        this.simpleFallback.setChunkOverlap(this.chunkOverlap);
        return this.simpleFallback.split(code);
      }
    } catch (error) {
      // Fall back to simple splitting if TreeSitterService fails
      console.warn(`TreeSitterService failed with error: ${error}, falling back to simple splitting`);
      this.simpleFallback.setChunkSize(this.chunkSize);
      this.simpleFallback.setChunkOverlap(this.chunkOverlap);
      return this.simpleFallback.split(code);
    }
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
    this.simpleFallback.setChunkSize(chunkSize);
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
    this.simpleFallback.setChunkOverlap(chunkOverlap);
  }

  private async createSyntaxAwareChunks(
    content: string,
    parseResult: any,
    language: string,
    filePath?: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // Extract function chunks
    const functionChunks = this.createFunctionChunks(content, parseResult, language, filePath);
    chunks.push(...functionChunks);

    // Extract class chunks
    const classChunks = this.createClassChunks(content, parseResult, language, filePath);
    chunks.push(...classChunks);

    // If no chunks were created, use generic chunking
    if (chunks.length === 0) {
      const genericChunks = this.createGenericChunks(content, language, filePath);
      chunks.push(...genericChunks);
    }

    return chunks;
  }

  private createFunctionChunks(
    content: string,
    parseResult: any,
    language: string,
    filePath?: string
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
        content: funcContent,
        metadata: {
          startLine: location.startLine,
          endLine: location.endLine,
          language,
          filePath
        }
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private createClassChunks(
    content: string,
    parseResult: any,
    language: string,
    filePath?: string
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
        content: classContent,
        metadata: {
          startLine: location.startLine,
          endLine: location.endLine,
          language,
          filePath
        }
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private createGenericChunks(
    content: string,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      if (currentChunk.join('\n').length >= this.chunkSize || i === lines.length - 1) {
        const chunkContent = currentChunk.join('\n');

        // Create chunk if it meets minimum size OR if it's the last chunk
        if (chunkContent.length > 0) {
          const chunk: CodeChunk = {
            content: chunkContent,
            metadata: {
              startLine: currentLine,
              endLine: currentLine + currentChunk.length - 1,
              language,
              filePath
            }
          };

          chunks.push(chunk);
        }

        // Apply overlap for next chunk
        let overlapLines = 0;
        let overlapSize = 0;
        while (overlapSize < this.chunkOverlap && currentChunk.length > 0) {
          const line = currentChunk.pop();
          if (line) {
            overlapSize += line.length + 1; // +1 for newline
            overlapLines++;
          }
        }

        currentLine = i - overlapLines + 1;
      }
    }

    return chunks;
  }

  private async refineChunks(chunks: CodeChunk[], originalCode: string): Promise<CodeChunk[]> {
    // Split large chunks
    let refinedChunks: CodeChunk[] = [];
    for (const chunk of chunks) {
      if (chunk.content.length > this.chunkSize) {
        const splitChunks = this.splitLargeChunk(chunk);
        refinedChunks.push(...splitChunks);
      } else {
        refinedChunks.push(chunk);
      }
    }

    // Add overlap between chunks
    refinedChunks = this.addOverlap(refinedChunks, originalCode);

    return refinedChunks;
  }

  private splitLargeChunk(chunk: CodeChunk): CodeChunk[] {
    const splitChunks: CodeChunk[] = [];
    let position = 0;

    while (position < chunk.content.length) {
      const endPosition = Math.min(position + this.chunkSize, chunk.content.length);
      const chunkContent = chunk.content.substring(position, endPosition);

      // Adjust line numbers
      const linesInChunk = chunkContent.split('\n').length;
      const startLine = chunk.metadata.startLine +
        chunk.content.substring(0, position).split('\n').length - 1;

      splitChunks.push({
        content: chunkContent,
        metadata: {
          startLine: startLine,
          endLine: startLine + linesInChunk - 1,
          language: chunk.metadata.language,
          filePath: chunk.metadata.filePath
        }
      });

      // Move position with overlap
      position = endPosition - this.chunkOverlap;
      if (position <= 0 || position >= chunk.content.length) break;
    }

    return splitChunks;
  }

  private addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // For all chunks except the last one, add overlap from the next chunk
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapLines = Math.min(
          this.chunkOverlap,
          nextChunk.metadata.endLine - nextChunk.metadata.startLine + 1
        );

        // Get overlapping content
        const lines = originalCode.split('\n');
        const overlapStartLine = Math.max(
          nextChunk.metadata.startLine,
          chunk.metadata.endLine - overlapLines + 1
        );
        const overlapEndLine = chunk.metadata.endLine;

        if (overlapStartLine <= overlapEndLine) {
          const overlapContent = lines.slice(overlapStartLine - 1, overlapEndLine).join('\n');

          // Add overlap to current chunk
          const overlappedChunk: CodeChunk = {
            ...chunk,
            content: chunk.content + '\n' + overlapContent
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