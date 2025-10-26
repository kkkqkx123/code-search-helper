import { injectable, inject } from 'inversify';
import { ISegmentationProcessor, SegmentationContext, IComplexityCalculator } from '../../strategies/types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { BLOCK_SIZE_LIMITS } from '../backup-constants';

/**
 * 块再平衡器
 * 职责：智能分块再平衡，防止产生过小的最后一块
 */
@injectable()
export class ChunkRebalancer implements ISegmentationProcessor {
  private complexityCalculator: IComplexityCalculator;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.ComplexityCalculator) complexityCalculator: IComplexityCalculator,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
  }

  async process(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    if (!context.options.filterConfig.enableChunkRebalancing) {
      return chunks;
    }

    if (chunks.length === 0) {
      return chunks;
    }

    const rebalancedChunks: CodeChunk[] = [];
    const minChunkSize = context.options.filterConfig.minChunkSize;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 检查是否是最后一块且过小
      if (i === chunks.length - 1 && chunk.content.length < minChunkSize) {
        // 尝试向前合并到前一个块
        if (rebalancedChunks.length > 0) {
          const prevChunk = rebalancedChunks[rebalancedChunks.length - 1];
          const combinedSize = prevChunk.content.length + chunk.content.length;

          // 确保合并后不超过最大限制
          if (combinedSize <= context.options.filterConfig.maxChunkSize) {
            prevChunk.content += '\n' + chunk.content;
            prevChunk.metadata.endLine = chunk.metadata.endLine;
            prevChunk.metadata.complexity = this.complexityCalculator.calculate(prevChunk.content);

            this.logger?.info(`Rebalanced final small chunk (${chunk.content.length} chars) into previous chunk`);
            continue;
          }
        }
      }

      rebalancedChunks.push(chunk);
    }

    this.logger?.debug(`Rebalanced ${chunks.length} chunks to ${rebalancedChunks.length} chunks`);
    return rebalancedChunks;
  }

  getName(): string {
    return 'chunk-rebalancer';
  }

  shouldApply(chunks: CodeChunk[], context: SegmentationContext): boolean {
    return context.options.filterConfig.enableChunkRebalancing &&
      chunks.length > 1 &&
      chunks.some(chunk => chunk.content.length < context.options.filterConfig.minChunkSize);
  }

  /**
   * 高级再平衡：基于块大小分布的智能调整
   */
  async advancedRebalancing(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    const targetSize = this.calculateOptimalChunkSize(chunks, context);
    const rebalancedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (this.isOverSized(chunk, context)) {
        // 拆分过大的块
        const splitChunks = this.splitOversizedChunk(chunk, targetSize, context);
        rebalancedChunks.push(...splitChunks);
        this.logger?.debug(`Split oversized chunk into ${splitChunks.length} parts`);
      } else if (this.shouldMergeWithPrevious(chunk, rebalancedChunks, context)) {
        // 尝试与前一个块合并
        const prevChunk = rebalancedChunks[rebalancedChunks.length - 1];
        if (this.canSafelyMerge(prevChunk, chunk, context)) {
          this.mergeChunks(prevChunk, chunk);
          this.logger?.debug(`Merged undersized chunk with previous chunk`);
        } else {
          rebalancedChunks.push(chunk);
          this.logger?.debug(`Could not merge, adding as separate chunk`);
        }
      } else {
        rebalancedChunks.push(chunk);
      }
    }

    return rebalancedChunks;
  }

  /**
   * 判断块是否应该与前一个块合并
   */
  private shouldMergeWithPrevious(chunk: CodeChunk, rebalancedChunks: CodeChunk[], context: SegmentationContext): boolean {
    if (rebalancedChunks.length === 0) {
      return false;
    }

    // 如果块不是过小的，不合并
    if (!this.isUnderSized(chunk, context)) {
      return false;
    }

    // 检查块类型：某些类型的块即使过小也应该保持独立
    const chunkType = chunk.metadata.type || '';
    const independentTypes = ['function', 'class', 'method', 'interface'];

    if (independentTypes.includes(chunkType)) {
      return false;
    }

    // 检查内容：如果包含函数定义等，保持独立
    const content = chunk.content.trim();
    if (content.includes('function ') || content.includes('class ') || content.includes('=>')) {
      return false;
    }

    return true;
  }

  /**
   * 计算最优块大小
   */
  private calculateOptimalChunkSize(chunks: CodeChunk[], context: SegmentationContext): number {
    const sizes = chunks.map(chunk => chunk.content.length);
    const totalSize = sizes.reduce((sum, size) => sum + size, 0);
    const averageSize = totalSize / chunks.length;

    // 使用加权平均，考虑配置的最大和最小值
    const minSize = context.options.filterConfig.minChunkSize;
    const maxSize = context.options.filterConfig.maxChunkSize;

    // 目标大小应该是平均值的80%，但不超过配置范围
    const targetSize = Math.max(minSize, Math.min(maxSize, averageSize * 0.8));

    return targetSize;
  }

  /**
   * 检查块是否过小
   */
  private isUnderSized(chunk: CodeChunk, context: SegmentationContext): boolean {
    return chunk.content.length < context.options.filterConfig.minChunkSize;
  }

  /**
   * 检查块是否过大
   */
  private isOverSized(chunk: CodeChunk, context: SegmentationContext): boolean {
    return chunk.content.length > context.options.filterConfig.maxChunkSize;
  }

  /**
   * 检查是否可以安全合并
   */
  private canSafelyMerge(chunk1: CodeChunk, chunk2: CodeChunk, context: SegmentationContext): boolean {
    const combinedSize = chunk1.content.length + chunk2.content.length;

    // 大小限制
    if (combinedSize > context.options.filterConfig.maxChunkSize) {
      return false;
    }

    // 类型兼容性检查
    if (!this.areTypesCompatible(chunk1.metadata.type || '', chunk2.metadata.type || '')) {
      return false;
    }

    // 语言兼容性检查
    if (chunk1.metadata.language !== chunk2.metadata.language) {
      return false;
    }

    return true;
  }

  /**
   * 检查类型是否兼容
   */
  private areTypesCompatible(type1: string, type2: string): boolean {
    // 完全相同的类型
    if (type1 === type2) {
      return true;
    }

    // 语义相关的类型
    const semanticTypes = ['semantic', 'function', 'class', 'method'];
    if (semanticTypes.includes(type1) && semanticTypes.includes(type2)) {
      return true;
    }

    // 通用代码类型
    const codeTypes = ['code', 'import', 'variable'];
    if (codeTypes.includes(type1) && codeTypes.includes(type2)) {
      return true;
    }

    return false;
  }

  /**
   * 合并两个块
   */
  private mergeChunks(targetChunk: CodeChunk, sourceChunk: CodeChunk): void {
    targetChunk.content += '\n' + sourceChunk.content;
    targetChunk.metadata.endLine = sourceChunk.metadata.endLine;
    targetChunk.metadata.complexity = this.complexityCalculator.calculate(targetChunk.content);

    // 如果源块有额外的元数据，考虑是否需要保留
    if (sourceChunk.metadata.functionName && !targetChunk.metadata.functionName) {
      targetChunk.metadata.functionName = sourceChunk.metadata.functionName;
    }

    if (sourceChunk.metadata.className && !targetChunk.metadata.className) {
      targetChunk.metadata.className = sourceChunk.metadata.className;
    }
  }

  /**
   * 拆分过大的块
   */
  private splitOversizedChunk(chunk: CodeChunk, targetSize: number, context: SegmentationContext): CodeChunk[] {
    const content = chunk.content;
    const lines = content.split('\n');

    if (lines.length <= 1) {
      // 单行内容，按字符拆分
      return this.splitByCharacters(chunk, targetSize);
    }

    // 多行内容，按行拆分
    return this.splitByLines(chunk, targetSize);
  }

  /**
   * 按行拆分
   */
  private splitByLines(chunk: CodeChunk, targetSize: number): CodeChunk[] {
    const lines = chunk.content.split('\n');
    const chunks: CodeChunk[] = [];
    let currentLines: string[] = [];
    let currentSize = 0;
    let startLine = chunk.metadata.startLine;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      if (currentSize + lineSize > targetSize && currentLines.length > 0) {
        // 创建新块
        const chunkContent = currentLines.join('\n');
        chunks.push(this.createSubChunk(chunk, chunkContent, startLine, startLine + currentLines.length - 1));

        currentLines = [line];
        currentSize = lineSize;
        startLine = startLine + currentLines.length - 1;
      } else {
        currentLines.push(line);
        currentSize += lineSize;
      }
    }

    // 处理剩余的行
    if (currentLines.length > 0) {
      const chunkContent = currentLines.join('\n');
      chunks.push(this.createSubChunk(chunk, chunkContent, startLine, startLine + currentLines.length - 1));
    }

    return chunks;
  }

  /**
   * 按字符拆分
   */
  private splitByCharacters(chunk: CodeChunk, targetSize: number): CodeChunk[] {
    const content = chunk.content;
    const chunks: CodeChunk[] = [];

    for (let i = 0; i < content.length; i += targetSize) {
      const chunkContent = content.substring(i, i + targetSize);
      const startLine = chunk.metadata.startLine;
      const endLine = chunk.metadata.endLine;

      chunks.push(this.createSubChunk(chunk, chunkContent, startLine, endLine));
    }

    return chunks;
  }

  /**
   * 创建子块
   */
  private createSubChunk(
    parentChunk: CodeChunk,
    content: string,
    startLine: number,
    endLine: number
  ): CodeChunk {
    return {
      content,
      metadata: {
        startLine,
        endLine,
        language: parentChunk.metadata.language,
        filePath: parentChunk.metadata.filePath,
        type: parentChunk.metadata.type,
        complexity: this.complexityCalculator.calculate(content),
        functionName: parentChunk.metadata.functionName,
        className: parentChunk.metadata.className
      }
    };
  }

  /**
   * 动态调整块大小分布
   */
  async optimizeSizeDistribution(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    const sizes = chunks.map(chunk => chunk.content.length);
    const variance = this.calculateVariance(sizes);

    // 如果方差较小，不需要调整
    if (variance < 100000) { // 阈值可配置
      return chunks;
    }

    // 执行大小平衡
    return this.balanceChunkSizes(chunks, context);
  }

  /**
   * 计算方差
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * 平衡块大小
   */
  private balanceChunkSizes(chunks: CodeChunk[], context: SegmentationContext): CodeChunk[] {
    const targetSize = this.calculateOptimalChunkSize(chunks, context);
    const balancedChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length > targetSize * 1.5) {
        // 拆分过大的块
        const splitChunks = this.splitOversizedChunk(chunk, targetSize, context);
        balancedChunks.push(...splitChunks);
      } else if (chunk.content.length < targetSize * 0.5 && balancedChunks.length > 0) {
        // 合并过小的块
        const lastChunk = balancedChunks[balancedChunks.length - 1];
        if (this.canSafelyMerge(lastChunk, chunk, context)) {
          this.mergeChunks(lastChunk, chunk);
        } else {
          balancedChunks.push(chunk);
        }
      } else {
        balancedChunks.push(chunk);
      }
    }

    return balancedChunks;
  }

  /**
   * 设置再平衡配置
   */
  setRebalancingConfig(config: {
    enableChunkRebalancing?: boolean;
    minChunkSize?: number;
    maxChunkSize?: number;
    enableAdvancedRebalancing?: boolean;
  }): void {
    this.logger?.debug('Rebalancing configuration updated', config);
  }
}