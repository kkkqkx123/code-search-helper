import { ISplitStrategy } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../types';

/**
 * 性能监控装饰器
 */
export class PerformanceMonitorDecorator implements ISplitStrategy {
  private splitCount = 0;
  private totalTime = 0;
  private totalChunks = 0;

  constructor(
    private strategy: ISplitStrategy,
    private logger?: any
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.splitCount++;

    try {
      const chunks = await this.strategy.split(content, language, filePath, options, nodeTracker, ast);

      const endTime = Date.now();
      const duration = endTime - startTime;
      this.totalTime += duration;
      this.totalChunks += chunks.length;

      this.logPerformance(language, chunks.length, duration);

      return chunks;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger?.error(`Strategy ${this.strategy.getName()} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  getName(): string {
    return `${this.strategy.getName()}_monitored`;
  }

  supportsLanguage(language: string): boolean {
    return this.strategy.supportsLanguage(language);
  }



  getDescription(): string {
    return `Performance monitor decorator for ${this.strategy.getDescription?.() || this.strategy.getName()}`;
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): {
    splitCount: number;
    totalTime: number;
    averageTime: number;
    totalChunks: number;
    averageChunksPerSplit: number;
  } {
    return {
      splitCount: this.splitCount,
      totalTime: this.totalTime,
      averageTime: this.splitCount > 0 ? this.totalTime / this.splitCount : 0,
      totalChunks: this.totalChunks,
      averageChunksPerSplit: this.splitCount > 0 ? this.totalChunks / this.splitCount : 0
    };
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.splitCount = 0;
    this.totalTime = 0;
    this.totalChunks = 0;
  }

  private logPerformance(language: string, chunkCount: number, duration: number): void {
    if (this.logger) {
      this.logger.debug(
        `Strategy ${this.strategy.getName()} split ${language} file ` +
        `into ${chunkCount} chunks in ${duration}ms ` +
        `(avg: ${(duration / Math.max(chunkCount, 1)).toFixed(2)}ms per chunk)`
      );
    }
  }
}