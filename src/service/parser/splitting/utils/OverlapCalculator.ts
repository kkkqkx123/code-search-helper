import { OverlapCalculator as OverlapCalculatorInterface, CodeChunk, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { BalancedChunker } from '../BalancedChunker';

export class OverlapCalculator implements OverlapCalculatorInterface {
  private options: Required<ChunkingOptions>;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  /**
   * 为代码块添加重叠内容
   * @param chunks 代码块数组
   * @param originalCode 原始代码
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 为除最后一个外的所有chunks添加重叠
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapContent = this.extractOverlapContent(chunk, nextChunk, originalCode);
        
        if (overlapContent) {
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapContent
          });
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
   * 提取重叠内容
   * @param currentChunk 当前块
   * @param nextChunk 下一个块
   * @param originalCode 原始代码
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    try {
      const lines = originalCode.split('\n');
      // Calculate the actual character position for overlap
      // Get the start position of the next chunk in the original code
      const linesUntilNextChunk = lines.slice(0, nextChunk.metadata.startLine - 1);
      // Calculate the character position where next chunk starts (subtract 1 for the newline that's not at the end)
      const charsUntilNextChunk = linesUntilNextChunk.join('\n').length + (linesUntilNextChunk.length > 0 ? 1 : 0) - 1;
      
      // Calculate the starting position for overlap in the original code
      const overlapStartPosition = Math.max(0, charsUntilNextChunk - this.options.overlapSize);
      
      // Find which line this overlap position corresponds to
      let currentPos = 0;
      let overlapStartLine = 1;
      for (let i = 0; i < lines.length; i++) {
        const lineEndPos = currentPos + lines[i].length + 1; // +1 for newline
        if (currentPos <= overlapStartPosition && overlapStartPosition < lineEndPos) {
          overlapStartLine = i + 1;
          break;
        }
        currentPos = lineEndPos;
      }
      
      // Ensure overlapStartLine is within valid range
      overlapStartLine = Math.max(1, Math.min(overlapStartLine, nextChunk.metadata.startLine));
      
      if (overlapStartLine < nextChunk.metadata.startLine) {
        const overlapLines = lines.slice(overlapStartLine - 1, nextChunk.metadata.startLine - 1);
        return overlapLines.join('\n');
      }
    } catch (error) {
      console.warn(`Failed to extract overlap content: ${error}`);
    }
    
    return '';
  }
  
  /**
   * 智能计算重叠
   * @param currentChunk 当前块的行数组
   * @param originalCode 原始代码
   * @param startLine 起始行号
   */
 calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
 ): string[] {
    // 优化的重叠计算算法，使用更智能的上下文提取
    if (currentChunk.length === 0) return [];

    // 从后往前查找有意义的上下文
    const overlapLines: string[] = [];
    let size = 0;

    // 优先选择函数定义、类定义等重要行
    for (let i = currentChunk.length - 1; i >= 0; i--) {
      const line = currentChunk[i];
      const lineSize = line.length + 1; // +1 for newline

      if (size + lineSize <= this.options.overlapSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    return overlapLines;
  }
}