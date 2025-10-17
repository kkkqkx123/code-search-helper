import { ChunkOptimizer as ChunkOptimizerInterface, CodeChunk, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../..';
import { BaseChunkProcessor } from '../base/BaseChunkProcessor';

export class ChunkOptimizer extends BaseChunkProcessor implements ChunkOptimizerInterface {
  private options: Required<ChunkingOptions>;

  constructor(options?: ChunkingOptions) {
    super();
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  /**
   * 优化块大小
   * @param chunks 代码块数组
   * @param originalCode 原始代码（用于上下文）
   */
  optimize(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const optimizedChunks: CodeChunk[] = [];
    let currentChunk = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
      const nextChunk = chunks[i];

      // 检查是否应该合并
      const shouldMerge = this.shouldMerge(currentChunk, nextChunk);

      if (shouldMerge) {
        // 合并chunks
        currentChunk = this.merge(currentChunk, nextChunk);
      } else {
        // 添加当前chunk并开始新的
        optimizedChunks.push(currentChunk);
        currentChunk = nextChunk;
      }
    }

    // 添加最后一个chunk
    optimizedChunks.push(currentChunk);

    // 应用重叠
    if (this.options.addOverlap) {
      return this.addOverlapToChunks(optimizedChunks, originalCode);
    }

    return optimizedChunks;
  }

  /**
   * 检查是否应该合并两个块
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   */
  shouldMerge(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    const totalSize = chunk1.content.length + chunk2.content.length;

    // 大小检查
    if (totalSize > this.options.maxChunkSize) {
      return false;
    }

    // 类型兼容性检查
    if (chunk1.metadata.type !== chunk2.metadata.type) {
      // 不同类型通常不合并，除非是特殊组合
      const compatibleTypes = [
        ['function', 'generic'],
        ['class', 'generic'],
        ['import', 'generic']
      ];

      const typePair = [chunk1.metadata.type, chunk2.metadata.type].sort();
      const isCompatible = compatibleTypes.some(pair =>
        pair[0] === typePair[0] && pair[1] === typePair[1]
      );

      if (!isCompatible) {
        return false;
      }
    }

    // 对于函数和类类型，不进行合并以保持语义完整性
    if (chunk1.metadata.type === 'function' || chunk1.metadata.type === 'class') {
      return false;
    }

    // 复杂度检查
    const combinedComplexity = (chunk1.metadata.complexity || 0) + (chunk2.metadata.complexity || 0);
    if (combinedComplexity > 50) { // 复杂度阈值
      return false;
    }

    return true;
  }

  /**
   * 合并两个代码块
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   */
  merge(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    // 使用基类的合并方法
    return BaseChunkProcessor.mergeTwoChunks(chunk1, chunk2);
  }

  /**
   * 为代码块添加重叠内容
   * @param chunks 代码块数组
   * @param originalCode 原始代码
   */
  private addOverlapToChunks(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
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
  private extractOverlapContent(currentChunk: CodeChunk, nextChunk: CodeChunk, originalCode: string): string {
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
}