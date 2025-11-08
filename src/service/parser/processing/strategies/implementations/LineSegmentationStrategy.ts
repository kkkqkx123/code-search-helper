import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../core/types/ResultTypes';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';

/**
 * 行数分段策略配置
 */
export interface LineStrategyConfig extends StrategyConfig {
  /** 每块最大行数 */
  maxLinesPerChunk?: number;
  /** 每块最小行数 */
  minLinesPerChunk?: number;
  /** 重叠行数 */
  overlapLines?: number;
  /** 最大块大小 */
  maxChunkSize?: number;
}

/**
 * 行数分段策略
 * 基于行数的简单分段，作为最终的降级方案
 */
export class LineSegmentationStrategy extends BaseStrategy {
  protected config: LineStrategyConfig;
  private logger: Logger;

  constructor(config: LineStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'line-segmentation',
      supportedLanguages: ['*'],
      enabled: true,
      description: 'Line Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxLinesPerChunk: 50,
      minLinesPerChunk: 5,
      overlapLines: 0,
      maxChunkSize: 3000,
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    // 行数策略可以处理任何内容，作为降级策略
    return true;
  }

  /**
   * 执行策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      const chunks = await this.process(context);
      return this.createSuccessResult(chunks, Date.now() - startTime);
    } catch (error) {
      return this.createFailureResult(Date.now() - startTime, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.debug(`Using Line segmentation strategy for ${context.filePath}`);

    try {
      const chunks: CodeChunk[] = [];
      const lines = context.content.split('\n');

      // 使用智能行数分段
      const splitPoints = this.intelligentLineSegmentation(lines);

      // 创建分块
      for (let i = 0; i <= splitPoints.length; i++) {
        const startLine = i === 0 ? 0 : splitPoints[i - 1] + 1;
        const endLine = i < splitPoints.length ? splitPoints[i] : lines.length - 1;

        if (startLine <= endLine) {
          const chunkLines = lines.slice(startLine, endLine + 1);
          const chunkContent = chunkLines.join('\n');

          chunks.push(this.createChunk(
            chunkContent,
            startLine + 1, // 转换为1基索引
            endLine + 1,
            context.language || 'unknown',
            ChunkType.LINE,
            {
              filePath: context.filePath,
              complexity: this.calculateComplexity(chunkContent)
            }
          ));
        }
      }

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`Line segmentation created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Line segmentation failed: ${error}`);
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    // 行数策略支持所有语言
    return ['*'];
  }

  /**
   * 智能行数分段，考虑空行和注释
   */
  private intelligentLineSegmentation(lines: string[]): number[] {
    const splitPoints: number[] = [];
    let lastSplitPoint = -1;

    for (let i = 0; i < lines.length; i++) {
      const linesSinceLastSplit = i - lastSplitPoint;
      const currentChunk = lines.slice(lastSplitPoint + 1, i + 1);
      const chunkSize = currentChunk.join('\n').length;

      // 检查是否需要分段
      const needsSplit = linesSinceLastSplit >= this.config.maxLinesPerChunk! ||
        chunkSize >= this.config.maxChunkSize! ||
        i === lines.length - 1;

      if (needsSplit) {
        // 尝试在更好的分割点分段
        const betterSplitPoint = this.findBetterSplitPoint(
          lines,
          lastSplitPoint + 1,
          i
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
    endIndex: number
  ): number {
    const maxLookback = Math.min(this.config.maxLinesPerChunk!, endIndex - startIndex);

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
    context: IProcessingContext
  ): CodeChunk {
    const actualStartLine = Math.max(0, startLine - this.config.overlapLines!);
    const chunkLines = lines.slice(actualStartLine, endLine + 1);
    const chunkContent = chunkLines.join('\n');
    const complexity = this.calculateComplexity(chunkContent);

    return this.createChunk(
      chunkContent,
      actualStartLine + 1, // 转换为1基索引
      endLine + 1,
      context.language || 'unknown',
      ChunkType.LINE,
      {
        filePath: context.filePath,
        complexity,
        overlap: this.config.overlapLines! > 0
      }
    );
  }

  /**
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
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
   * 获取策略配置
   */
  getConfig(): LineStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<LineStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}