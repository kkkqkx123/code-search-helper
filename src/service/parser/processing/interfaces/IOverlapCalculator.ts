import { CodeChunk } from '..';

/**
 * 重叠计算器接口
 */
export interface IOverlapCalculator {
  /**
   * 为代码块添加重叠内容
   * @param chunks 代码块数组
   * @param originalCode 原始代码
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[];

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
  ): string;

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
  ): string[];
}