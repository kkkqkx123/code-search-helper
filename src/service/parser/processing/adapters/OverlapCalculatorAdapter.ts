import { CodeChunk, OverlapCalculator, IOverlapCalculator } from '../types/splitting-types';

/**
 * 重叠计算器适配器
 * 将 OverlapCalculator 接口适配为 IOverlapCalculator 接口
 */
export class OverlapCalculatorAdapter implements IOverlapCalculator {
  constructor(private overlapCalculator: OverlapCalculator) {}

  /**
   * 适配 IOverlapCalculator 的 addOverlap 方法
   */
  async addOverlap(chunks: CodeChunk[], content: string): Promise<CodeChunk[]> {
    // OverlapCalculator 的 addOverlap 是同步方法，这里包装为异步
    return Promise.resolve(this.overlapCalculator.addOverlap(chunks, content));
  }
}