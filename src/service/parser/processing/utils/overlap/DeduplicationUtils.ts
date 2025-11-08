import { CodeChunk } from '../../core/types/ResultTypes';
import { ContentHashIDGenerator } from '../ContentHashIDGenerator';
import { ChunkSimilarityUtils } from '../chunk-processing/ChunkSimilarityUtils';

/**
 * 智能去重工具类
 */
export class DeduplicationUtils {
  private processedChunks: Map<string, CodeChunk>;
  private overlapHistory: Map<string, string[]>;

  constructor() {
    this.processedChunks = new Map();
    this.overlapHistory = new Map();
  }

  /**
   * 智能重复检测 - 检查是否应该判定为重复块
   * 这是统一的重复检查入口点
   */
  static shouldSkipDuplicate(chunk: CodeChunk, nextChunk: CodeChunk): boolean {
    return this.isDuplicateChunk(chunk, nextChunk);
  }

  /**
   * 统一的重复块检测方法
   * 提供全面的重复检测逻辑
   */
  static isDuplicateChunk(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 1. 内容哈希快速检测
    const chunk1Hash = ContentHashIDGenerator.getContentHashPrefix(chunk1.content);
    const chunk2Hash = ContentHashIDGenerator.getContentHashPrefix(chunk2.content);

    if (chunk1Hash === chunk2Hash) {
      return true; // 内容完全相同，判定为重复块
    }

    // 2. 位置关系检查
    const start1 = chunk1.metadata.startLine;
    const end1 = chunk1.metadata.endLine;
    const start2 = chunk2.metadata.startLine;
    const end2 = chunk2.metadata.endLine;

    // 如果两个块完全重叠，判定为重复块
    if (start1 === start2 && end1 === end2) {
      return true;
    }

    // 3. 节点ID检查（如果有AST节点信息）
    if (chunk1.metadata.nodeIds && chunk2.metadata.nodeIds) {
      const hasCommonNodes = chunk1.metadata.nodeIds.some((id: string) =>
        chunk2.metadata.nodeIds!.includes(id)
      );
      if (hasCommonNodes) {
        return true;
      }
    }

    // 4. 基础内容检查
    return chunk1.content === chunk2.content;
  }

  /**
   * 记录重叠历史
   */
  static recordOverlapHistory(
    position: string,
    overlapContent: string,
    overlapHistory: Map<string, string[]>
  ): void {
    const contentHash = ContentHashIDGenerator.getContentHashPrefix(overlapContent);

    if (!overlapHistory.has(position)) {
      overlapHistory.set(position, []);
    }

    const history = overlapHistory.get(position)!;
    history.push(contentHash);

    // 限制历史记录大小，避免内存泄漏
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 检查重叠内容是否过于重复
   */
  static isOverlapTooRepetitive(
    overlapContent: string,
    position: string,
    overlapHistory: Map<string, string[]>
  ): boolean {
    const history = overlapHistory.get(position);
    if (!history || history.length === 0) {
      return false;
    }

    const currentHash = ContentHashIDGenerator.getContentHashPrefix(overlapContent);

    // 检查最近3次重叠是否有重复
    const recentHistory = history.slice(-3);
    const repeatCount = recentHistory.filter(hash => hash === currentHash).length;

    // 如果最近3次中有2次以上重复，认为是过度重复
    return repeatCount >= 2;
  }



  /**
   * 清理历史记录
   */
  clearHistory(): void {
    this.overlapHistory.clear();
    this.processedChunks.clear();
  }

  /**
   * 对代码块数组进行去重
   * @param chunks 需要去重的代码块数组
   * @returns 去重后的代码块数组
   */
  static deduplicateChunks(chunks: CodeChunk[]): CodeChunk[] {
    const uniqueChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      let isDuplicate = false;

      // 检查是否与已添加的块重复
      for (const existingChunk of uniqueChunks) {
        if (this.isDuplicateChunk(chunk, existingChunk)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueChunks.push(chunk);
      }
    }

    return uniqueChunks;
  }

  /**
   * 获取去重统计信息
   */
  getStats(): {
    processedChunks: number;
    overlapHistoryEntries: number;
    skippedDuplicates: number;
  } {
    return {
      processedChunks: this.processedChunks.size,
      overlapHistoryEntries: this.overlapHistory.size,
      skippedDuplicates: 0 // 需要在实际使用中统计
    };
  }
}