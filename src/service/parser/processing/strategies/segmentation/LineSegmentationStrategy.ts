import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionCenter';
import { CodeChunk, CodeChunkMetadata } from '../../types';
import { BLOCK_SIZE_LIMITS } from '../../constants';

/**
 * 行数分段策略
 * 职责：基于行数的简单分段，作为最终的降级方案
 */
@injectable()
export class LineSegmentationStrategy implements IProcessingStrategy {
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
  }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Line segmentation strategy for ${filePath}`);

    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    // 使用智能行数分段
    const splitPoints = this.intelligentLineSegmentation(lines, 50, 3000);

    // 创建分块
    for (let i = 0; i <= splitPoints.length; i++) {
      const startLine = i === 0 ? 0 : splitPoints[i - 1] + 1;
      const endLine = i < splitPoints.length ? splitPoints[i] : lines.length - 1;

      if (startLine <= endLine) {
        const chunkLines = lines.slice(startLine, endLine + 1);
        const chunkContent = chunkLines.join('\n');

        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: startLine + 1, // 转换为1基索引
            endLine: endLine + 1,
            language: detection.language || 'unknown',
            filePath,
            type: 'line',
            complexity: this.calculateComplexity(chunkContent)
          }
        });
      }
    }

    this.logger?.debug(`Line segmentation created ${chunks.length} chunks`);
    return { chunks, metadata: { strategy: 'LineSegmentationStrategy' } };
  }

  getName(): string {
    return 'LineSegmentationStrategy';
  }

  getDescription(): string {
    return 'Uses intelligent line-based splitting as a fallback segmentation method';
  }

  /**
   * 计算复杂度
   */
  private calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
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
        chunkSize >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR ||
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
    const complexity = this.calculateComplexity(chunkContent);

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