import { injectable } from 'inversify';
import { CodeChunk } from '../types';

export interface RefinementOptions {
  maxChunkSize: number;
  overlapSize: number;
  addOverlap: boolean;
}

@injectable()
export class ChunkRefinementService {
  /**
   * Refine chunks by splitting large chunks and adding overlap if requested
   * @param chunks The chunks to refine
   * @param options Refinement options
   * @returns Refined chunks
   */
  refineChunks(chunks: CodeChunk[], options: RefinementOptions): CodeChunk[] {
    // Split large chunks
    let refinedChunks = this.splitLargeChunks(chunks, options.maxChunkSize);

    // Add overlap between chunks if requested
    if (options.addOverlap) {
      refinedChunks = this.addOverlap(refinedChunks, options.overlapSize);
    }

    return refinedChunks;
  }

  /**
   * Split large chunks that exceed the maximum chunk size
   * @param chunks The chunks to split
   * @param maxChunkSize The maximum chunk size
   * @returns Chunks with large chunks split
   */
  splitLargeChunks(chunks: CodeChunk[], maxChunkSize: number): CodeChunk[] {
    const splitChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length > maxChunkSize) {
        // Split the large chunk into smaller chunks
        const lines = chunk.content.split('\n');
        let currentChunkLines: string[] = [];
        let currentLineCount = 0;

        for (const line of lines) {
          currentChunkLines.push(line);
          currentLineCount += line.length + 1; // +1 for newline character

          if (currentLineCount >= maxChunkSize) {
            // Create a new chunk
            const newChunkContent = currentChunkLines.join('\n');
            const newChunk: CodeChunk = {
              ...chunk,
              content: newChunkContent,
              endLine: chunk.startLine + currentChunkLines.length - 1,
              endByte: chunk.startByte + newChunkContent.length,
              id: this.generateChunkId(newChunkContent, chunk.startLine),
              metadata: {
                ...chunk.metadata,
                lineCount: currentChunkLines.length,
                complexity: this.calculateComplexity(newChunkContent)
              }
            };

            splitChunks.push(newChunk);

            // Reset for next chunk
            currentChunkLines = [];
            currentLineCount = 0;
          }
        }

        // Handle remaining lines
        if (currentChunkLines.length > 0) {
          const newChunkContent = currentChunkLines.join('\n');
          const newChunk: CodeChunk = {
            ...chunk,
            content: newChunkContent,
            endLine: chunk.startLine + currentChunkLines.length - 1,
            endByte: chunk.startByte + newChunkContent.length,
            id: this.generateChunkId(newChunkContent, chunk.startLine),
            metadata: {
              ...chunk.metadata,
              lineCount: currentChunkLines.length,
              complexity: this.calculateComplexity(newChunkContent)
            }
          };

          splitChunks.push(newChunk);
        }
      } else {
        splitChunks.push(chunk);
      }
    }

    return splitChunks;
  }

  /**
   * Add overlap between chunks
   * @param chunks The chunks to add overlap to
   * @param overlapSize The size of the overlap
   * @returns Chunks with overlap added
   */
  addOverlap(chunks: CodeChunk[], overlapSize: number): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

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
          const lines = chunk.content.split('\n');
          const overlapLines = lines.slice(Math.max(0, lines.length - overlapSize));
          const overlapContent = overlapLines.join('\n');

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

  /**
   * Calculate the complexity of a code chunk
   * @param code The code to calculate complexity for
   * @returns The complexity score
   */
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

  /**
   * Generate a unique ID for a chunk
   * @param content The chunk content
   * @param startLine The start line of the chunk
   * @returns A unique chunk ID
   */
  private generateChunkId(content: string, startLine: number): string {
    // Simple hash function for generating chunk IDs
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Use a simpler hash for chunks to improve performance
    const contentHash = Math.abs(hash).toString(36).substring(0, 8);
    return `chunk_${startLine}_${contentHash}`;
  }
}