import { injectable, inject } from 'inversify';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../types/SegmentationTypes';
import { CodeChunk, CodeChunkMetadata } from '../../splitting';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { BLOCK_SIZE_LIMITS } from '../constants';

/**
 * 行数分段策略
 * 职责：基于行数的简单分段，作为最终的降级方案
 */
@injectable()
export class LineSegmentationStrategy implements ISegmentationStrategy {
  private complexityCalculator: IComplexityCalculator;
  private logger?: LoggerService;
  
  constructor(
    @inject(TYPES.ComplexityCalculator) complexityCalculator: IComplexityCalculator,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
  }
  
  canHandle(context: SegmentationContext): boolean {
    // 行数分段策略总是可以处理，作为最后的降级方案
    return true;
  }
  
  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, filePath, language } = context;
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    // 内存保护：限制处理的行数
    const maxLines = Math.min(lines.length, 10000);

    for (let i = 0; i < maxLines; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // 检查是否应该分段，同时考虑块大小限制
      const chunkContent = currentChunk.join('\n');
      const shouldSplit = currentChunk.length >= context.options.maxLinesPerChunk ||
        chunkContent.length >= context.options.maxChunkSize ||
        chunkContent.length >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR ||
        i === maxLines - 1;

      if (shouldSplit) {
        const complexity = this.complexityCalculator.calculate(chunkContent);

        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'line',
            complexity
          }
        });

        currentChunk = [];
        currentLine = i + 2;
      }
    }

    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.complexityCalculator.calculate(chunkContent);

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'line',
          complexity
        }
      });
    }

    this.logger?.debug(`Line segmentation created ${chunks.length} chunks`);
    return chunks;
  }
  
  getName(): string {
    return 'line';
  }
  
  getPriority(): number {
    return 5; // 最低优先级，作为降级方案
  }
  
  getSupportedLanguages(): string[] {
    // 行数分段策略支持所有语言
    return ['*'];
  }
  
  validateContext(context: SegmentationContext): boolean {
    // 行数分段策略可以处理任何有效的上下文
    return !!(context.content && context.content.trim().length > 0);
  }
  
  /**
   * 智能行数分段，考虑空行和注释
   */
  private intelligentLineSegmentation(
    lines: string[],
    maxLinesPerChunk: number,
    maxChunkSize: number
  ): number[] {
    const splitPoints: number[] = [];
    let lastSplitPoint = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const linesSinceLastSplit = i - lastSplitPoint;
      const currentChunk = lines.slice(lastSplitPoint + 1, i + 1);
      const chunkSize = currentChunk.join('\n').length;
      
      // 检查是否需要分段
      const needsSplit = linesSinceLastSplit >= maxLinesPerChunk || 
                         chunkSize >= maxChunkSize ||
                         i === lines.length - 1;
      
      if (needsSplit) {
        // 尝试在更好的分割点分段
        const betterSplitPoint = this.findBetterSplitPoint(
          lines, 
          lastSplitPoint + 1, 
          i,
          maxLinesPerChunk
        );
        
        splitPoints.push(betterSplitPoint);
        lastSplitPoint = betterSplitPoint;
      }
    }
    
    return splitPoints;
  }
  
  /**
   * 寻找更好的分割点（空行、注释行等）
   */
  private findBetterSplitPoint(
    lines: string[], 
    startIndex: number, 
    endIndex: number,
    maxLines: number
  ): number {
    const maxLookback = Math.min(maxLines, endIndex - startIndex);
    
    // 从结束点往前找更好的分割点
    for (let i = endIndex; i >= startIndex && i >= endIndex - maxLookback; i--) {
      const line = lines[i].trim();
      
      // 优先在空行处分段
      if (line === '') {
        return i;
      }
      
      // 其次在注释行处分段
      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*') || line.startsWith('*')) {
        return i;
      }
      
      // 再次在简单的语句结束处分段
      if (line.endsWith(';') || line.endsWith('}')) {
        return i;
      }
    }
    
    // 如果没找到好的分割点，返回原始结束点
    return endIndex;
  }
  
  /**
   * 创建带有重叠的分块
   */
  private createChunkWithOverlap(
    lines: string[],
    startLine: number,
    endLine: number,
    overlapLines: number,
    filePath?: string,
    language?: string
  ): CodeChunk {
    const actualStartLine = Math.max(0, startLine - overlapLines);
    const chunkLines = lines.slice(actualStartLine, endLine + 1);
    const chunkContent = chunkLines.join('\n');
    const complexity = this.complexityCalculator.calculate(chunkContent);
    
    return {
      content: chunkContent,
      metadata: {
        startLine: actualStartLine + 1, // 转换为1基索引
        endLine: endLine + 1,
        language: language || 'unknown',
        filePath,
        type: 'line',
        complexity
      }
    };
  }
}