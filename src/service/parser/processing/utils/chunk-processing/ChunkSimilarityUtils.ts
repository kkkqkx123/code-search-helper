import { CodeChunk } from '../../../splitting';
import { ContentHashIDGenerator } from '../ContentHashIDGenerator';
import { BaseChunkProcessor } from '../base/BaseChunkProcessor';
import { SimilarityUtils } from '../similarity/SimilarityUtils';

/**
 * 代码块相似性检测工具类
 * 提供检测和处理代码块相似性的方法
 */
export class ChunkSimilarityUtils extends BaseChunkProcessor {
  /**
   * 检查两个块是否可以合并
   */
  static canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk, similarityThreshold: number): boolean {
    // 检查相似度
    if (!SimilarityUtils.isSimilar(chunk1.content, chunk2.content, similarityThreshold)) {
      return false;
    }

    // 检查位置关系（相邻或重叠）
    const start1 = chunk1.metadata.startLine;
    const end1 = chunk1.metadata.endLine;
    const start2 = chunk2.metadata.startLine;
    const end2 = chunk2.metadata.endLine;

    // 相邻：块2紧接在块1后面
    const isAdjacent = start2 === end1 + 1;

    // 重叠：两个块有重叠区域
    const isOverlapping = start2 <= end1 && start1 <= end2;

    return isAdjacent || isOverlapping;
  }

  /**
   * 合并两个块
   */
  static mergeTwoChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    const startLine = Math.min(chunk1.metadata.startLine, chunk2.metadata.startLine);
    const endLine = Math.max(chunk1.metadata.endLine, chunk2.metadata.endLine);

    // 合并内容（处理重叠情况）
    let mergedContent: string;

    if (chunk1.metadata.startLine <= chunk2.metadata.startLine) {
      // chunk1在前
      mergedContent = this.mergeContents(chunk1.content, chunk2.content, chunk1.metadata.startLine, chunk2.metadata.startLine);
    } else {
      // chunk2在前
      mergedContent = this.mergeContents(chunk2.content, chunk1.content, chunk2.metadata.startLine, chunk1.metadata.startLine);
    }

    return {
      content: mergedContent,
      metadata: {
        startLine,
        endLine,
        language: chunk1.metadata.language,
        filePath: chunk1.metadata.filePath,
        type: chunk1.metadata.type || chunk2.metadata.type || 'merged',
        complexity: Math.max(chunk1.metadata.complexity || 0, chunk2.metadata.complexity || 0)
      }
    };
  }

  /**
   * 智能合并内容（处理重叠）
   */
  static mergeContents(content1: string, content2: string, startLine1: number, startLine2: number): string {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // 计算重叠行数
    const overlapLines = Math.max(0, startLine1 + lines1.length - startLine2);

    if (overlapLines <= 0) {
      // 没有重叠，简单拼接
      return content1 + '\n' + content2;
    }

    // 有重叠，需要智能合并
    const nonOverlapLines1 = lines1.slice(0, -overlapLines);
    const mergedLines = [...nonOverlapLines1, ...lines2];

    return mergedLines.join('\n');
  }

  /**
   * 检查是否为重复块
   */
  static isDuplicateChunk(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 使用基类的重复检查方法
    return BaseChunkProcessor.isDuplicateChunk(chunk1, chunk2);
  }

  /**
   * 智能重叠控制 - 检查新的重叠块是否与已有块过于相似
   */
  static shouldCreateOverlap(
    newChunk: CodeChunk,
    existingChunks: CodeChunk[],
    similarityThreshold: number
 ): boolean {
    // 生成新块的内容哈希
    const newChunkHash = ContentHashIDGenerator.getContentHashPrefix(newChunk.content);

    // 检查是否已经存在相同内容的块
    for (const existingChunk of existingChunks) {
      const existingHash = ContentHashIDGenerator.getContentHashPrefix(existingChunk.content);

      // 如果内容哈希相同，说明内容基本相同
      if (newChunkHash === existingHash) {
        return false; // 跳过这个重叠块
      }

      // 检查相似度
      if (SimilarityUtils.isSimilar(newChunk.content, existingChunk.content, similarityThreshold)) {
        return false; // 跳过过于相似的重叠块
      }
    }

    return true;
 }
}