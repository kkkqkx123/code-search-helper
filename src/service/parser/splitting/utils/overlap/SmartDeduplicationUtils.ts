import { CodeChunk } from '../..';
import { ContentHashIDGenerator } from '../ContentHashIDGenerator';
import { ChunkSimilarityUtils } from '../chunk-processing/ChunkSimilarityUtils';

/**
 * 智能去重工具类
 * 提取 OverlapCalculator 中的独特去重逻辑
 */
export class SmartDeduplicationUtils {
  private processedChunks: Map<string, CodeChunk>;
  private overlapHistory: Map<string, string[]>;

  constructor() {
    this.processedChunks = new Map();
    this.overlapHistory = new Map();
  }

  /**
   * 智能重复检测 - 检查是否应该跳过重复块
   */
  static shouldSkipDuplicate(chunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 1. 内容哈希快速检测
    const chunk1Hash = ContentHashIDGenerator.getContentHashPrefix(chunk.content);
    const chunk2Hash = ContentHashIDGenerator.getContentHashPrefix(nextChunk.content);

    if (chunk1Hash === chunk2Hash) {
      return true; // 内容完全相同，跳过
    }

    // 2. 位置关系检查
    const start1 = chunk.metadata.startLine;
    const end1 = chunk.metadata.endLine;
    const start2 = nextChunk.metadata.startLine;
    const end2 = nextChunk.metadata.endLine;

    // 如果两个块完全重叠，跳过
    if (start1 === start2 && end1 === end2) {
      return true;
    }

    // 3. 节点ID检查（如果有AST节点信息）
    if (chunk.metadata.nodeIds && nextChunk.metadata.nodeIds) {
      const hasCommonNodes = chunk.metadata.nodeIds.some(id =>
        nextChunk.metadata.nodeIds!.includes(id)
      );
      if (hasCommonNodes) {
        return true;
      }
    }

    // 4. 内容相似度检查
    return ChunkSimilarityUtils.isDuplicateChunk(chunk, nextChunk);
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
   * 智能重叠大小计算
   */
  static calculateOptimalOverlapSize(
    chunk1: CodeChunk,
    chunk2: CodeChunk,
    maxOverlapRatio: number,
    mergeStrategy: 'aggressive' | 'conservative'
  ): number {
    const chunk1Size = chunk1.metadata.endLine - chunk1.metadata.startLine + 1;
    const chunk2Size = chunk2.metadata.endLine - chunk2.metadata.startLine + 1;

    // 基于块大小和最大重叠比例计算
    const maxOverlap = Math.min(chunk1Size, chunk2Size) * maxOverlapRatio;

    // 保守策略：使用较小的重叠
    // 激进策略：使用较大的重叠
    const overlapMultiplier = mergeStrategy === 'conservative' ? 0.7 : 1.0;

    return Math.max(1, Math.floor(maxOverlap * overlapMultiplier));
  }

  /**
   * 生成替代重叠内容策略
   */
  static generateAlternativeOverlapStrategies(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    maxOverlapLines: number
  ): Array<() => string> {
    const lines = originalContent.split('\n');
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;

    return [
      // 策略1：减少重叠大小
      () => {
        const smallerOverlap = Math.max(1, Math.floor(maxOverlapLines * 0.5));
        const startLine = Math.max(0, currentEndLine - smallerOverlap);
        const overlapLines = lines.slice(startLine, currentEndLine);
        return overlapLines.join('\n');
      },

      // 策略2：调整重叠起始位置
      () => {
        const offset = Math.max(0, currentEndLine - 2);
        const availableLines = lines.slice(Math.max(0, offset - 1), currentEndLine);
        return availableLines.join('\n');
      },

      // 策略3：使用语法边界
      () => {
        // 查找语义边界，如函数结束、类结束等
        for (let i = currentEndLine - 1; i >= Math.max(0, currentEndLine - 5); i--) {
          const line = lines[i];
          if (line.includes('}') || line.includes('return') || line.trim() === '') {
            const overlapLines = lines.slice(i, currentEndLine);
            return overlapLines.join('\n');
          }
        }
        return '';
      }
    ];
  }

  /**
   * 清理历史记录
   */
  clearHistory(): void {
    this.overlapHistory.clear();
    this.processedChunks.clear();
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