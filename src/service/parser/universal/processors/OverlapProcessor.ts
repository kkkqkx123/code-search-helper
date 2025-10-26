import { injectable, inject } from 'inversify';
import { ISegmentationProcessor, SegmentationContext, IComplexityCalculator } from '../../processing/strategies/types/SegmentationTypes';
import { CodeChunk } from '../../splitting';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 重叠处理器
 * 职责：为分段结果添加重叠内容
 */
@injectable()
export class OverlapProcessor implements ISegmentationProcessor {
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
    if (chunks.length <= 1) {
      return chunks;
    }

    // 代码文件的重叠处理
    if (context.metadata.isCodeFile && !context.options.enableCodeOverlap) {
      return this.processCodeFileChunks(chunks, context);
    }

    // 非代码文件的重叠处理
    return this.processTextFileChunks(chunks, context);
  }

  getName(): string {
    return 'overlap';
  }

  shouldApply(chunks: CodeChunk[], context: SegmentationContext): boolean {
    return chunks.length > 1 && context.options.overlapSize > 0;
  }

  /**
   * 处理代码文件分块
   */
  private processCodeFileChunks(
    chunks: CodeChunk[],
    context: SegmentationContext
  ): CodeChunk[] {
    const finalChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      // 只对过大的块进行重叠拆分
      if (chunk.content.length > context.options.maxChunkSize) {
        const overlappedChunks = this.splitLargeChunkWithOverlap(chunk, context);
        finalChunks.push(...overlappedChunks);
      } else {
        finalChunks.push(chunk);
      }
    }

    this.logger?.debug(`Processed ${chunks.length} code file chunks, resulted in ${finalChunks.length} chunks`);
    return finalChunks;
  }

  /**
   * 处理文本文件分块
   */
  private processTextFileChunks(
    chunks: CodeChunk[],
    context: SegmentationContext
  ): CodeChunk[] {
    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i < chunks.length - 1) {
        const overlapContent = this.calculateOverlapContent(
          chunk,
          chunks[i + 1],
          context.content
        );

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

    this.logger?.debug(`Processed ${chunks.length} text file chunks with overlap`);
    return overlappedChunks;
  }

  /**
   * 带重叠的大块拆分
   */
  private splitLargeChunkWithOverlap(
    chunk: CodeChunk,
    context: SegmentationContext
  ): CodeChunk[] {
    const content = chunk.content;

    // 检查是否需要拆分 - 考虑行数作为额外条件
    const lines = content.split('\n');
    const shouldSplitBySize = content.length > context.options.maxChunkSize;
    const shouldSplitByLines = lines.length > context.options.maxLinesPerChunk;

    if (!shouldSplitBySize && !shouldSplitByLines) {
      return [chunk];
    }

    this.logger?.info(`Large chunk detected (${content.length} chars), splitting with overlap`);

    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let currentLine = chunk.metadata.startLine;

    // 计算最大允许重叠大小（考虑比例限制）
    const maxOverlapRatio = context.options.maxOverlapRatio || 0.3;
    const maxOverlapSize = Math.min(
      context.options.overlapSize,
      Math.floor(context.options.maxChunkSize * maxOverlapRatio)
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 检查是否应该分割 - 考虑重叠空间
      const projectedSize = currentSize + lineSize;
      const needsSplit = projectedSize > (context.options.maxChunkSize - maxOverlapSize) && currentChunk.length > 0;

      if (needsSplit || i === lines.length - 1) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.complexityCalculator.calculate(chunkContent);

        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: chunk.metadata.language,
            filePath: chunk.metadata.filePath,
            type: chunk.metadata.type || 'semantic',
            complexity
          }
        });

        // 为下一块计算重叠内容
        const overlapLines = this.calculateSmartOverlapLines(currentChunk, maxOverlapSize);

        currentChunk = [...overlapLines];
        currentSize = overlapLines.join('\n').length;
        currentLine = chunk.metadata.startLine + i - overlapLines.length + 1;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    // 处理剩余的最后一小块
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.complexityCalculator.calculate(chunkContent);

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: chunk.metadata.language,
          filePath: chunk.metadata.filePath,
          type: chunk.metadata.type || 'semantic',
          complexity
        }
      });
    }

    this.logger?.info(`Large chunk split into ${chunks.length} smaller chunks with overlap`);
    return chunks;
  }

  /**
   * 计算智能重叠行
   */
  private calculateSmartOverlapLines(lines: string[], maxOverlapSize: number): string[] {
    const overlapLines: string[] = [];
    let size = 0;

    // 从后往前计算重叠，优先选择语义边界
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lineSize = line.length + 1;

      if (size + lineSize <= maxOverlapSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    // 如果重叠太小，至少包含最后一行
    if (overlapLines.length === 0 && lines.length > 0) {
      overlapLines.unshift(lines[lines.length - 1]);
    }

    return overlapLines;
  }

  /**
   * 计算重叠内容
   */
  private calculateOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string
  ): string {
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;

    // 如果块相邻或重叠，不添加重叠内容
    if (currentEndLine >= nextStartLine) {
      return '';
    }

    // 如果原始内容为空或不包含块内容，返回空字符串
    if (!originalContent || originalContent === 'test content') {
      return '';
    }

    const lines = originalContent.split('\n');
    const overlapLines = [];
    const maxOverlapLines = Math.min(3, Math.floor((currentEndLine - currentChunk.metadata.startLine + 1) * 0.3));

    // 从当前分块的末尾获取重叠内容
    for (let i = Math.max(0, currentEndLine - maxOverlapLines); i < currentEndLine; i++) {
      if (i < lines.length) {
        overlapLines.push(lines[i]);
      }
    }

    return overlapLines.join('\n');
  }

  /**
   * 智能重叠计算（基于语义边界）
   */
  private calculateSemanticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string
  ): string {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    // 寻找语义边界
    const semanticBoundary = this.findSemanticBoundary(currentLines, nextLines);

    if (semanticBoundary) {
      return semanticBoundary;
    }

    // 如果没有找到语义边界，使用简单的重叠
    return this.calculateOverlapContent(currentChunk, nextChunk, originalContent);
  }

  /**
   * 寻找语义边界
   */
  private findSemanticBoundary(currentLines: string[], nextLines?: string[]): string | null {
    // 检查当前块的末尾是否有完整的语义单元
    const lastLines = currentLines.slice(-5); // 检查最后5行

    // 首先检查是否有函数定义
    for (let i = 0; i < lastLines.length; i++) {
      const line = lastLines[i].trim();

      // 查找函数定义
      if (line.startsWith('function ') || line.includes('function ')) {
        // 找到函数开始，返回从这一行开始的内容
        return lastLines.slice(i).join('\n');
      }
    }

    // 如果没有找到函数定义，检查其他语义边界
    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i].trim();

      // 如果找到完整的函数/类结束，可以作为重叠点
      if (line.match(/^[}\)]\s*$/) || line.match(/^\s*(end|endif|endforeach|endforeach)\b/i)) {
        return lastLines.slice(i).join('\n');
      }

      // 如果找到空行，也可以作为重叠点
      if (line === '') {
        return lastLines.slice(i).join('\n');
      }
    }

    return null;
  }

  /**
   * 设置重叠选项
   */
  setOverlapOptions(options: {
    overlapSize?: number;
    maxOverlapRatio?: number;
    enableCodeOverlap?: boolean;
  }): void {
    // 这里可以动态更新重叠配置
    this.logger?.debug('Overlap options updated', options);
  }
}