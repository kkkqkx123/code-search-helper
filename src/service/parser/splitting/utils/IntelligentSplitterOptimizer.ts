import { BalancedChunker } from '../BalancedChunker';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 智能分段优化器
 * 专门用于优化智能分段算法的性能和准确性
 */
export class IntelligentSplitterOptimizer {
  private balancedChunker: BalancedChunker;
  private logger?: LoggerService;

  constructor(balancedChunker: BalancedChunker, logger?: LoggerService) {
    this.balancedChunker = balancedChunker;
    this.logger = logger;
  }

  /**
   * 优化分段决策逻辑
   * @param line 当前行内容
   * @param currentChunk 当前块内容
   * @param currentSize 当前块大小
   * @param lineSize 当前行大小
   * @param maxChunkSize 最大块大小
   */
  shouldSplitAtLineWithSymbols(
    line: string,
    currentChunk: string[],
    currentSize: number,
    lineSize: number,
    maxChunkSize: number
  ): boolean {
    // 大小限制检查（优先）
    if (currentSize + lineSize > maxChunkSize) {
      return true;
    }

    // 符号平衡检查 - 只有在符号平衡时才允许分段
    if (!this.balancedChunker.canSafelySplit()) {
      return false;
    }

    const trimmedLine = line.trim();

    // 逻辑边界检查（原有的逻辑）
    if (trimmedLine.match(/^[}\)]\s*$/) && currentChunk.length > 0) {
      return currentSize > maxChunkSize * 0.3;
    }

    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/)) {
      return currentSize > maxChunkSize * 0.5;
    }

    if (trimmedLine === '' && currentChunk.length > 5) {
      return currentSize > maxChunkSize * 0.4;
    }

    if (trimmedLine.match(/^\s*\/\//) || trimmedLine.match(/^\s*\/\*/) || trimmedLine.match(/^\s*\*/)) {
      return currentSize > maxChunkSize * 0.6;
    }

    return false;
  }

  /**
   * 智能重叠计算，考虑符号平衡
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    overlapSize: number
  ): string[] {
    const overlapLines: string[] = [];
    const tempState = this.balancedChunker.getCurrentState();

    // 从当前chunk末尾向前寻找安全的分割点
    for (let i = currentChunk.length - 1; i >= 0; i--) {
      const line = currentChunk[i];

      // 模拟分析这一行
      this.balancedChunker.analyzeLineSymbols(line);

      // 如果符号平衡，这是一个安全的分割点
      if (this.balancedChunker.canSafelySplit()) {
        // 从这个点开始到末尾的所有行都作为重叠
        const safeOverlapLines = currentChunk.slice(i);
        overlapLines.unshift(...safeOverlapLines);
        break;
      }

      // 如果找到了合适的重叠大小且符号平衡，也可以作为重叠
      const currentOverlapSize = overlapLines.join('\n').length;
      if (currentOverlapSize >= overlapSize && this.balancedChunker.canSafelySplit()) {
        break;
      }

      // 如果符号不平衡，继续向前寻找
      overlapLines.unshift(line);
    }

    // 恢复符号栈状态
    this.balancedChunker.setCurrentState(tempState);

    // 如果重叠太大，截断到合适大小
    let finalOverlapLines: string[] = [];
    let size = 0;
    for (const line of overlapLines) {
      const lineSize = line.length + 1;
      if (size + lineSize <= overlapSize) {
        finalOverlapLines.push(line);
        size += lineSize;
      } else {
        break;
      }
    }

    return finalOverlapLines;
  }
}